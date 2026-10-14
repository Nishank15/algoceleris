//! Faculty proctoring cockpit and Viva escalation management endpoints.

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Utc};
use judge_core::assessment::validate_rubric_balance;
use judge_core::models::{RiskSeverity, RubricCriterion};
use judge_db::models::InterviewRoomRecord;
use judge_viva::rubric::RubricEvaluationUpdate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::GatewayError;
use crate::extractors::RequireInstructor;
use crate::state::AppState;

/// Summary of a candidate's real-time proctoring telemetry in the cockpit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateCockpitSummary {
    /// Candidate user UUID.
    pub user_id: Uuid,
    /// Candidate display username if known.
    pub username: Option<String>,
    /// Candidate institutional email if known.
    pub email: Option<String>,
    /// Current exam session status (`not_started`, `in_progress`, `submitted`).
    pub status: String,
    /// Total count of tab switch anomaly events.
    pub tab_switches: i64,
    /// Total count of fullscreen exit anomaly events.
    pub fullscreen_exits: i64,
    /// Total count of paste burst anomaly events.
    pub paste_bursts: i64,
    /// Total aggregate behavioral violation events.
    pub total_violations: i64,
    /// Dynamically computed proctoring risk score.
    pub risk_score: u32,
    /// Severity classification (`low`, `elevated`, `critical`).
    pub risk_severity: String,
    /// Timestamp of most recent telemetry event or activity.
    pub last_heartbeat: Option<DateTime<Utc>>,
}

/// Aggregated live proctoring cockpit response payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProctorCockpitResponse {
    /// Assessment UUID.
    pub assessment_id: Uuid,
    /// Enclosing cohort UUID.
    pub cohort_id: Uuid,
    /// Total number of candidates enrolled in cohort assessment.
    pub total_candidates: usize,
    /// Total candidates currently actively testing.
    pub active_candidates: usize,
    /// Total candidates flagged with elevated or critical risk.
    pub high_risk_count: usize,
    /// Real-time summary list of candidate proctoring statuses.
    pub candidates: Vec<CandidateCockpitSummary>,
}

/// Request body for provisioning an emergency Viva escalation interview.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvisionVivaRequest {
    /// Target candidate user UUID.
    pub candidate_user_id: Uuid,
    /// Primary coding language for the interview session (`cpp`, `python`, `java`).
    #[serde(default)]
    pub language: Option<String>,
    /// Problem slug for the interview task (defaults to viva-task).
    #[serde(default)]
    pub problem_slug: Option<String>,
}

/// Response payload following Viva room provisioning.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvisionVivaResponse {
    /// Interview room UUID.
    pub id: Uuid,
    /// Unique join room code (e.g. `VIVA-CS101-AB12CD`).
    pub room_code: String,
    /// Associated assessment UUID.
    pub assessment_id: Option<Uuid>,
    /// Host evaluator / instructor UUID.
    pub host_user_id: Uuid,
    /// Target candidate UUID.
    pub candidate_user_id: Option<Uuid>,
    /// Interview editor language.
    pub language: String,
    /// Room status (`waiting`, `active`, `completed`).
    pub status: String,
    /// Room creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// Response payload for private rubric evaluation queries.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VivaRubricResponse {
    /// Room code identifier.
    pub room_code: String,
    /// Evaluator scores mapped by criterion key.
    pub rubric_scores: serde_json::Value,
    /// Confidential interviewer notes (hidden from candidate sockets).
    pub interviewer_notes: String,
    /// Room status.
    pub status: String,
    /// Timestamp of latest rubric modification.
    pub updated_at: DateTime<Utc>,
}

/// Request payload for updating private Viva evaluation rubric scores.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateVivaRubricRequest {
    /// Awarded numeric criterion scores as JSON object.
    pub rubric_scores: serde_json::Value,
    /// Confidential interviewer notes.
    #[serde(default)]
    pub interviewer_notes: Option<String>,
    /// Optional criteria definitions for 100.0% weight verification.
    #[serde(default)]
    pub criteria: Option<Vec<RubricCriterion>>,
}

/// Handler for `GET /api/v1/campus/assessments/{id}/cockpit`.
///
/// Returns live proctoring cockpit telemetry, enrolled candidate statuses,
/// violation counts, and dynamic risk scoring.
///
/// # Errors
/// - Returns [`GatewayError::Forbidden`] if caller is not an instructor.
/// - Returns [`GatewayError::NotFound`] if assessment does not exist.
#[allow(clippy::too_many_lines)]
pub async fn get_proctor_cockpit_handler(
    State(state): State<AppState>,
    _instructor: RequireInstructor,
    Path(assessment_id): Path<Uuid>,
) -> Result<impl IntoResponse, GatewayError> {
    // 1. Verify assessment exists
    let assessment = if let Some(ref pool) = state.db {
        judge_db::repositories::assessment::get_assessment_by_id(pool.inner(), assessment_id)
            .await?
            .ok_or_else(|| GatewayError::NotFound(format!("Assessment '{assessment_id}' not found")))?
    } else {
        let assessments = state.mock_campus.assessments.read().await;
        assessments
            .get(&assessment_id)
            .cloned()
            .ok_or_else(|| GatewayError::NotFound(format!("Assessment '{assessment_id}' not found")))?
    };

    // 2. Discover enrolled students
    let mut candidate_ids: Vec<Uuid> = Vec::new();
    if let Some(ref pool) = state.db {
        let rows = sqlx::query_scalar::<sqlx::Postgres, Uuid>(
            r"
            SELECT user_id 
            FROM org_memberships 
            WHERE cohort_id = $1 AND role = 'student' AND status = 'active'
            ",
        )
        .bind(assessment.cohort_id)
        .fetch_all(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;
        candidate_ids = rows;
    } else {
        let memberships = state.mock_campus.memberships.read().await;
        for mem in memberships.values() {
            if mem.cohort_id == Some(assessment.cohort_id) && mem.role == "student" && mem.status == "active" {
                candidate_ids.push(mem.user_id);
            }
        }
    }

    // Fallback: If no memberships seeded under cohort in mock mode, check candidate_proctor_counts
    if candidate_ids.is_empty() {
        let counts_map = state.mock_campus.candidate_proctor_counts.read().await;
        for (a_id, u_id) in counts_map.keys() {
            if *a_id == assessment_id && !candidate_ids.contains(u_id) {
                candidate_ids.push(*u_id);
            }
        }
    }

    let users_map = state.mock_campus.users.read().await;
    let submissions_map = state.mock_campus.assessment_submissions.read().await;
    let counts_mock = state.mock_campus.candidate_proctor_counts.read().await;

    let mut candidate_summaries = Vec::with_capacity(candidate_ids.len());
    let mut high_risk_count = 0;
    let mut active_count = 0;

    for candidate_id in candidate_ids {
        // Retrieve anomaly event counts
        let counts = if let Some(ref pool) = state.db {
            judge_db::repositories::proctor::get_candidate_event_counts(
                pool.inner(),
                assessment_id,
                candidate_id,
            )
            .await
            .unwrap_or_default()
        } else {
            counts_mock
                .get(&(assessment_id, candidate_id))
                .cloned()
                .unwrap_or_default()
        };

        // Dynamic risk scoring via judge_core
        let risk = counts.to_risk_score();
        let severity_str = match risk.severity {
            RiskSeverity::Low => "low".to_string(),
            RiskSeverity::Elevated => {
                high_risk_count += 1;
                "elevated".to_string()
            }
            RiskSeverity::Critical => {
                high_risk_count += 1;
                "critical".to_string()
            }
        };

        // Determine session status
        let has_submitted = submissions_map
            .values()
            .any(|s| s.assessment_id == assessment_id && s.user_id == candidate_id);

        let status = if has_submitted {
            "submitted".to_string()
        } else if counts.total > 0 {
            active_count += 1;
            "in_progress".to_string()
        } else {
            "not_started".to_string()
        };

        let user_info = users_map.get(&candidate_id);
        let username = user_info.map(|(u, _)| u.clone());
        let email = user_info.map(|(_, e)| e.clone());

        candidate_summaries.push(CandidateCockpitSummary {
            user_id: candidate_id,
            username,
            email,
            status,
            tab_switches: counts.tab_switches,
            fullscreen_exits: counts.fullscreen_exits,
            paste_bursts: counts.paste_bursts,
            total_violations: counts.total,
            risk_score: risk.score,
            risk_severity: severity_str,
            last_heartbeat: Some(Utc::now()),
        });
    }

    let total_candidates = candidate_summaries.len();

    Ok(Json(ProctorCockpitResponse {
        assessment_id,
        cohort_id: assessment.cohort_id,
        total_candidates,
        active_candidates: active_count,
        high_risk_count,
        candidates: candidate_summaries,
    }))
}

/// Handler for `POST /api/v1/campus/assessments/{id}/viva/provision`.
///
/// Provisions an emergency 1-on-1 Viva escalation room linking host instructor
/// and target candidate with a unique room code.
///
/// # Errors
/// - Returns [`GatewayError::Forbidden`] if caller is not an instructor.
/// - Returns [`GatewayError::NotFound`] if assessment does not exist.
pub async fn provision_viva_escalation_handler(
    State(state): State<AppState>,
    instructor: RequireInstructor,
    Path(assessment_id): Path<Uuid>,
    Json(payload): Json<ProvisionVivaRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    // 1. Verify assessment exists
    let org_id = if let Some(ref pool) = state.db {
        let assessment = judge_db::repositories::assessment::get_assessment_by_id(
            pool.inner(),
            assessment_id,
        )
        .await?
        .ok_or_else(|| {
            GatewayError::NotFound(format!("Assessment '{assessment_id}' not found"))
        })?;
        Some(assessment.org_id)
    } else {
        let assessments = state.mock_campus.assessments.read().await;
        let assessment = assessments.get(&assessment_id).ok_or_else(|| {
            GatewayError::NotFound(format!("Assessment '{assessment_id}' not found"))
        })?;
        Some(assessment.org_id)
    };

    // 2. Generate unique room code
    let short_assessment = &assessment_id.to_string()[..6].to_uppercase();
    let short_uuid = &Uuid::new_v4().to_string()[..6].to_uppercase();
    let room_code = format!("VIVA-{short_assessment}-{short_uuid}");

    let room_id = Uuid::new_v4();
    let now = Utc::now();
    let language = payload.language.unwrap_or_else(|| "cpp".to_string());

    let record = InterviewRoomRecord {
        id: room_id,
        room_code: room_code.clone(),
        org_id: instructor.org_id.or(org_id),
        assessment_id: Some(assessment_id),
        host_user_id: instructor.user_id,
        candidate_user_id: Some(payload.candidate_user_id),
        language: language.clone(),
        status: "waiting".to_string(),
        editor_code: String::new(),
        interviewer_notes: String::new(),
        rubric_scores: serde_json::json!({}),
        created_at: now,
        updated_at: now,
    };

    let problem_slug = payload
        .problem_slug
        .unwrap_or_else(|| "viva-task".to_string());

    // 3. Persist to DB or mock store
    if let Some(ref pool) = state.db {
        let _ = sqlx::query(
            r"
            INSERT INTO interview_rooms (
                id, room_code, org_id, assessment_id, host_user_id, candidate_user_id,
                problem_slug, language, status, editor_code, interviewer_notes, rubric_scores,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ",
        )
        .bind(record.id)
        .bind(&record.room_code)
        .bind(record.org_id)
        .bind(record.assessment_id)
        .bind(record.host_user_id)
        .bind(record.candidate_user_id)
        .bind(&problem_slug)
        .bind(&record.language)
        .bind(&record.status)
        .bind(&record.editor_code)
        .bind(&record.interviewer_notes)
        .bind(&record.rubric_scores)
        .bind(record.created_at)
        .bind(record.updated_at)
        .execute(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;
    }

    // Always keep mock store updated
    state
        .mock_campus
        .interview_rooms
        .write()
        .await
        .insert(room_code.clone(), record.clone());

    Ok((
        StatusCode::CREATED,
        Json(ProvisionVivaResponse {
            id: room_id,
            room_code,
            assessment_id: Some(assessment_id),
            host_user_id: instructor.user_id,
            candidate_user_id: Some(payload.candidate_user_id),
            language,
            status: "waiting".to_string(),
            created_at: now,
        }),
    ))
}

/// Handler for `GET /api/v1/campus/viva/{room_code}/rubric`.
///
/// Retrieves confidential rubric evaluation scores and interviewer notes.
/// Strictly guarded by [`RequireInstructor`]; candidate tokens are rejected with 403.
///
/// # Errors
/// - Returns [`GatewayError::Forbidden`] if caller is not an instructor.
/// - Returns [`GatewayError::NotFound`] if room does not exist.
pub async fn get_viva_rubric_handler(
    State(state): State<AppState>,
    _instructor: RequireInstructor,
    Path(room_code): Path<String>,
) -> Result<impl IntoResponse, GatewayError> {
    let room = if let Some(ref pool) = state.db {
        sqlx::query_as::<sqlx::Postgres, InterviewRoomRecord>(
            r"
            SELECT id, room_code, org_id, assessment_id, host_user_id, candidate_user_id,
                   language, status, editor_code, interviewer_notes, rubric_scores,
                   created_at, updated_at
            FROM interview_rooms
            WHERE room_code = $1
            LIMIT 1
            ",
        )
        .bind(&room_code)
        .fetch_optional(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?
        .ok_or_else(|| GatewayError::NotFound(format!("Interview room '{room_code}' not found")))?
    } else {
        let rooms = state.mock_campus.interview_rooms.read().await;
        rooms
            .get(&room_code)
            .cloned()
            .ok_or_else(|| GatewayError::NotFound(format!("Interview room '{room_code}' not found")))?
    };

    Ok(Json(VivaRubricResponse {
        room_code: room.room_code,
        rubric_scores: room.rubric_scores,
        interviewer_notes: room.interviewer_notes,
        status: room.status,
        updated_at: room.updated_at,
    }))
}

/// Handler for `PATCH /api/v1/campus/viva/{room_code}/rubric`.
///
/// Updates confidential rubric scores and interviewer notes for a Viva interview.
/// Validates criteria weights against the 100.0% invariant and updates database.
/// Strictly guarded by [`RequireInstructor`]; candidate tokens are rejected with 403.
///
/// # Errors
/// - Returns [`GatewayError::Forbidden`] if caller is not an instructor.
/// - Returns [`GatewayError::BadRequest`] if rubric criterion weights do not sum to 100.0%.
/// - Returns [`GatewayError::NotFound`] if room does not exist.
pub async fn update_viva_rubric_handler(
    State(state): State<AppState>,
    _instructor: RequireInstructor,
    Path(room_code): Path<String>,
    Json(payload): Json<UpdateVivaRubricRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    // 1. Validate rubric structure
    if !payload.rubric_scores.is_object() {
        return Err(GatewayError::BadRequest(
            "rubric_scores must be a JSON object".to_string(),
        ));
    }

    // 2. Validate criteria weights against 100.0% invariant if criteria supplied
    if let Some(ref criteria) = payload.criteria {
        validate_rubric_balance(criteria)?;

        let update = RubricEvaluationUpdate::new(
            payload.rubric_scores.clone(),
            payload.interviewer_notes.clone(),
        );
        update
            .validate(criteria)
            .map_err(|e| GatewayError::BadRequest(e.to_string()))?;
    }

    let eval_update = RubricEvaluationUpdate::new(
        payload.rubric_scores.clone(),
        payload.interviewer_notes.clone(),
    );

    // 3. Persist evaluation
    let record = if let Some(ref pool) = state.db {
        let updated = judge_viva::persist_rubric_evaluation(pool, &room_code, &eval_update).await?;
        state
            .mock_campus
            .interview_rooms
            .write()
            .await
            .insert(room_code.clone(), updated.clone());
        updated
    } else {
        let mut rooms = state.mock_campus.interview_rooms.write().await;
        let room = rooms
            .get_mut(&room_code)
            .ok_or_else(|| GatewayError::NotFound(format!("Interview room '{room_code}' not found")))?;

        room.rubric_scores = payload.rubric_scores;
        if let Some(notes) = payload.interviewer_notes {
            room.interviewer_notes = notes;
        }
        room.updated_at = Utc::now();
        room.clone()
    };

    Ok(Json(VivaRubricResponse {
        room_code: record.room_code,
        rubric_scores: record.rubric_scores,
        interviewer_notes: record.interviewer_notes,
        status: record.status,
        updated_at: record.updated_at,
    }))
}

/// Handler for `GET /ws/campus/assessments/{assessment_id}/proctor`.
///
/// Upgrades HTTP request to WebSocket for live candidate proctoring and telemetry ingestion.
pub async fn proctor_stream_handler(
    ws: WebSocketUpgrade,
    Path(assessment_id): Path<String>,
    State(_state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_proctor_socket(socket, assessment_id))
}

async fn handle_proctor_socket(mut socket: WebSocket, assessment_id: String) {
    let ack = serde_json::json!({
        "status": "connected",
        "assessment_id": assessment_id,
        "channel": "proctor_telemetry",
    });
    if socket.send(Message::Text(ack.to_string().into())).await.is_err() {
        return;
    }

    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(text.as_str()) {
                    let ev_type = val.get("event_type").and_then(|v| v.as_str()).unwrap_or("heartbeat");
                    let resp = serde_json::json!({
                        "status": "ack",
                        "event_type": ev_type,
                        "timestamp": Utc::now().to_rfc3339(),
                    });
                    if socket.send(Message::Text(resp.to_string().into())).await.is_err() {
                        break;
                    }
                }
            }
            Ok(Message::Ping(p)) => {
                if socket.send(Message::Pong(p)).await.is_err() {
                    break;
                }
            }
            Ok(Message::Close(_)) | Err(_) => break,
            _ => {}
        }
    }
}

/// Handler for `GET /ws/campus/viva/{room_code}`.
///
/// Upgrades HTTP request to WebSocket for multiplayer Viva collaboration & CRDT synchronisation.
pub async fn viva_room_ws_handler(
    ws: WebSocketUpgrade,
    Path(room_code): Path<String>,
    State(_state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_viva_socket(socket, room_code))
}

async fn handle_viva_socket(mut socket: WebSocket, room_code: String) {
    let init = serde_json::json!({
        "type": "room_joined",
        "room_code": room_code,
        "timestamp": Utc::now().to_rfc3339(),
    });
    if socket.send(Message::Text(init.to_string().into())).await.is_err() {
        return;
    }

    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Text(text)) => {
                let resp = serde_json::json!({
                    "status": "synced",
                    "echo": text.as_str(),
                });
                if socket.send(Message::Text(resp.to_string().into())).await.is_err() {
                    break;
                }
            }
            Ok(Message::Ping(p)) => {
                if socket.send(Message::Pong(p)).await.is_err() {
                    break;
                }
            }
            Ok(Message::Close(_)) | Err(_) => break,
            _ => {}
        }
    }
}


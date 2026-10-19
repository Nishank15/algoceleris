//! Faculty proctoring cockpit and Viva escalation management endpoints.

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Utc};
use judge_core::assessment::validate_rubric_balance;
use judge_core::models::{RiskSeverity, RubricCriterion};
use judge_db::models::{AssessmentRecord, InterviewRoomRecord, ProctorEventRecord};
use judge_viva::rubric::RubricEvaluationUpdate;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::errors::GatewayError;
use crate::extractors::{role_level, AssessmentId, RequireInstructor, RequireStudent};
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
    assessment_id: AssessmentId,
) -> Result<impl IntoResponse, GatewayError> {
    let assessment_id = assessment_id.into_uuid();
    // 1. Verify assessment exists
    let assessment = load_assessment(&state, assessment_id).await?;

    // 2. Discover enrolled students
    let candidate_ids = discover_enrolled_candidates(&state, &assessment).await?;

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
        if risk.severity != RiskSeverity::Low {
            high_risk_count += 1;
        }
        let severity_str = risk_severity_label(risk.severity).to_string();

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

// ==========================================================================
// Live proctoring telemetry pipeline
// ==========================================================================

/// Redis pub/sub channel prefix carrying the live telemetry stream.
const PROCTOR_EVENT_CHANNEL_PREFIX: &str = "proctor:events";
/// Redis list prefix retaining recent infractions for an assessment.
const PROCTOR_LOG_PREFIX: &str = "proctor:log";
/// Redis key prefix holding a candidate liveness marker for an assessment.
const PROCTOR_LIVE_PREFIX: &str = "proctor:live";
/// Lifetime of a liveness marker with no fresh heartbeat, in seconds.
const PROCTOR_LIVE_TTL_SECONDS: i64 = 300;
/// Heartbeat age below which a candidate is reported as actively connected.
const PROCTOR_CONNECTED_WINDOW_SECONDS: i64 = 60;
/// Maximum infractions retained in the Redis incident log per assessment.
const PROCTOR_LOG_CAPACITY: isize = 200;
/// Default page size for the incident log endpoint.
const PROCTOR_EVENT_PAGE_LIMIT: i64 = 200;

/// Telemetry event types accepted from candidate clients, paired with the
/// server-derived severity recorded alongside the event.
const PROCTOR_EVENT_TYPES: &[(&str, &str)] = &[
    ("heartbeat", "info"),
    ("session_started", "info"),
    ("session_submitted", "info"),
    ("tab_switch", "warning"),
    ("fullscreen_exit", "warning"),
    ("paste_burst", "critical"),
    ("forced_session_terminated", "critical"),
];

/// Candidate telemetry payload accepted by the ingest endpoint.
#[derive(Debug, Clone, Deserialize)]
pub struct ProctorEventIngestRequest {
    /// Telemetry event type; must match the server allow-list.
    pub event_type: String,
    /// Optional structured context captured by the candidate client.
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    /// Candidate the event belongs to. Defaults to the authenticated caller and
    /// may only be set by an instructor recording an action for a candidate.
    #[serde(default)]
    pub user_id: Option<Uuid>,
}

/// Query parameters for the assessment incident log.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct ProctorEventQuery {
    /// Restrict the log to a single candidate.
    #[serde(default)]
    pub user_id: Option<Uuid>,
    /// Maximum number of most-recent events to return.
    #[serde(default)]
    pub limit: Option<i64>,
}

/// A single proctoring incident as consumed by the faculty cockpit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProctorEventView {
    /// Event identifier.
    pub id: Uuid,
    /// Assessment the event belongs to.
    pub assessment_id: Uuid,
    /// Candidate who emitted the telemetry.
    pub user_id: Uuid,
    /// Candidate display username if known.
    pub username: Option<String>,
    /// Telemetry event type.
    pub event_type: String,
    /// Server-derived severity: `info`, `warning`, or `critical`.
    pub severity: String,
    /// Structured context captured by the candidate client.
    pub event_metadata: serde_json::Value,
    /// Server-side ingest timestamp.
    pub created_at: DateTime<Utc>,
    /// Whether the event is durably persisted in PostgreSQL.
    pub persisted: bool,
}

/// Live telemetry state of one enrolled candidate in the cockpit roster.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProctoredCandidateState {
    /// Candidate user UUID.
    pub user_id: Uuid,
    /// Candidate display username if known.
    pub username: Option<String>,
    /// Candidate institutional email if known.
    pub email: Option<String>,
    /// Institutional registration number if known.
    pub roll_number: Option<String>,
    /// Heartbeat-derived connection state: `connected`, `idle`, or `disconnected`.
    pub status: String,
    /// Tab-switch infractions recorded for this assessment.
    pub tab_switches: i64,
    /// Fullscreen-exit infractions recorded for this assessment.
    pub fullscreen_exits: i64,
    /// Paste-burst infractions recorded for this assessment.
    pub paste_bursts: i64,
    /// Total infractions recorded for this assessment.
    pub total_events: i64,
    /// Weighted anomaly score derived from the infraction counts.
    pub risk_score: u32,
    /// Risk band: `low`, `elevated`, or `critical`.
    pub risk_severity: String,
    /// Most recent telemetry received from the candidate, if any.
    pub last_seen: Option<DateTime<Utc>>,
    /// Extra minutes granted through an accommodation, if any.
    pub time_extension_minutes: i32,
}

/// Resolves the server-derived severity for a telemetry event type.
///
/// Severity is never read from the client payload, so a candidate cannot
/// downgrade their own infractions.
fn proctor_event_severity(event_type: &str) -> Option<&'static str> {
    PROCTOR_EVENT_TYPES
        .iter()
        .find(|(name, _)| *name == event_type)
        .map(|(_, severity)| *severity)
}

/// Whether an accepted event type represents an integrity infraction.
///
/// Session lifecycle and heartbeat telemetry only rides the in-flight Redis
/// channel, while infractions are additionally persisted for the incident log.
fn is_proctor_infraction(event_type: &str) -> bool {
    !matches!(
        event_type,
        "heartbeat" | "session_started" | "session_submitted"
    )
}

/// Maps a computed risk band to its cockpit wire representation.
fn risk_severity_label(severity: RiskSeverity) -> &'static str {
    match severity {
        RiskSeverity::Low => "low",
        RiskSeverity::Elevated => "elevated",
        RiskSeverity::Critical => "critical",
    }
}

/// Redis channel carrying live telemetry for an assessment.
fn proctor_event_channel(assessment_id: Uuid) -> String {
    format!("{PROCTOR_EVENT_CHANNEL_PREFIX}:{assessment_id}")
}

/// Redis key retaining the recent infraction log for an assessment.
fn proctor_log_key(assessment_id: Uuid) -> String {
    format!("{PROCTOR_LOG_PREFIX}:{assessment_id}")
}

/// Redis key holding a candidate liveness marker for an assessment.
fn proctor_live_key(assessment_id: Uuid, user_id: Uuid) -> String {
    format!("{PROCTOR_LIVE_PREFIX}:{assessment_id}:{user_id}")
}

/// Loads an assessment from PostgreSQL, falling back to the in-memory store.
///
/// # Errors
/// Returns [`GatewayError::NotFound`] if the assessment does not exist.
async fn load_assessment(
    state: &AppState,
    assessment_id: Uuid,
) -> Result<AssessmentRecord, GatewayError> {
    if let Some(ref pool) = state.db {
        judge_db::repositories::assessment::get_assessment_by_id(pool.inner(), assessment_id)
            .await?
            .ok_or_else(|| {
                GatewayError::NotFound(format!("Assessment '{assessment_id}' not found"))
            })
    } else {
        let assessments = state.mock_campus.assessments.read().await;
        assessments.get(&assessment_id).cloned().ok_or_else(|| {
            GatewayError::NotFound(format!("Assessment '{assessment_id}' not found"))
        })
    }
}

/// Resolves the candidate IDs enrolled in an assessment's cohort.
///
/// # Errors
/// Returns [`GatewayError::Database`] if the enrollment lookup fails.
async fn discover_enrolled_candidates(
    state: &AppState,
    assessment: &AssessmentRecord,
) -> Result<Vec<Uuid>, GatewayError> {
    let mut candidate_ids: Vec<Uuid> = Vec::new();
    if let Some(ref pool) = state.db {
        candidate_ids = sqlx::query_scalar::<sqlx::Postgres, Uuid>(
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
    } else {
        let memberships = state.mock_campus.memberships.read().await;
        for mem in memberships.values() {
            if mem.cohort_id == Some(assessment.cohort_id)
                && mem.role == "student"
                && mem.status == "active"
            {
                candidate_ids.push(mem.user_id);
            }
        }
    }

    // Fallback: candidates with recorded telemetry but no active cohort row.
    if candidate_ids.is_empty() {
        let counts_map = state.mock_campus.candidate_proctor_counts.read().await;
        for (a_id, u_id) in counts_map.keys() {
            if *a_id == assessment.id && !candidate_ids.contains(u_id) {
                candidate_ids.push(*u_id);
            }
        }
    }

    Ok(candidate_ids)
}

/// Resolves candidate identities as `user_id -> (username, email)` pairs.
///
/// # Errors
/// Returns [`GatewayError::Database`] if the identity lookup fails.
async fn lookup_campus_users(
    state: &AppState,
    user_ids: &[Uuid],
) -> Result<HashMap<Uuid, (String, String)>, GatewayError> {
    let mut users: HashMap<Uuid, (String, String)> = HashMap::new();

    if let Some(ref pool) = state.db {
        let rows = sqlx::query_as::<sqlx::Postgres, (Uuid, String, String)>(
            "SELECT id, username, email FROM users WHERE id = ANY($1)",
        )
        .bind(user_ids.to_vec())
        .fetch_all(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;

        for (id, username, email) in rows {
            users.insert(id, (username, email));
        }
    } else {
        let store = state.mock_campus.users.read().await;
        for user_id in user_ids {
            if let Some(identity) = store.get(user_id) {
                users.insert(*user_id, identity.clone());
            }
        }
    }

    Ok(users)
}

/// Verifies the caller holds an active membership in the assessment's tenant.
///
/// Telemetry is integrity evidence, so ingestion is restricted to members of
/// the organization that owns the assessment.
///
/// # Errors
/// - Returns [`GatewayError::Forbidden`] if the caller is not an active member.
/// - Returns [`GatewayError::Database`] if the membership lookup fails.
async fn ensure_assessment_membership(
    state: &AppState,
    assessment: &AssessmentRecord,
    user_id: Uuid,
) -> Result<(), GatewayError> {
    let is_member = if let Some(ref pool) = state.db {
        sqlx::query_scalar::<sqlx::Postgres, i64>(
            r"
            SELECT COUNT(*)
            FROM org_memberships
            WHERE org_id = $1 AND user_id = $2 AND status = 'active'
            ",
        )
        .bind(assessment.org_id)
        .bind(user_id)
        .fetch_one(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?
            > 0
    } else {
        let memberships = state.mock_campus.memberships.read().await;
        memberships.values().any(|mem| {
            mem.org_id == assessment.org_id && mem.user_id == user_id && mem.status == "active"
        })
    };

    if is_member {
        Ok(())
    } else {
        Err(GatewayError::Forbidden(
            "Caller is not an active member of the assessment organization".to_string(),
        ))
    }
}

/// Persists an infraction and returns its cockpit representation.
///
/// # Errors
/// Returns [`GatewayError::Database`] if the insert fails.
async fn persist_proctor_infraction(
    state: &AppState,
    assessment_id: Uuid,
    user_id: Uuid,
    event_type: &str,
    severity: &str,
    metadata: serde_json::Value,
) -> Result<ProctorEventView, GatewayError> {
    let username = lookup_campus_users(state, &[user_id])
        .await?
        .get(&user_id)
        .map(|(name, _)| name.clone());

    if let Some(ref pool) = state.db {
        let record = judge_db::repositories::proctor::record_proctor_event(
            pool.inner(),
            assessment_id,
            user_id,
            event_type,
            severity,
            metadata,
        )
        .await?;

        return Ok(ProctorEventView {
            id: record.id,
            assessment_id: record.assessment_id,
            user_id: record.user_id,
            username,
            event_type: record.event_type,
            severity: record.severity,
            event_metadata: record.metadata,
            created_at: record.created_at,
            persisted: true,
        });
    }

    let record = ProctorEventRecord {
        id: Uuid::new_v4(),
        assessment_id,
        user_id,
        event_type: event_type.to_string(),
        severity: severity.to_string(),
        metadata: metadata.clone(),
        created_at: Utc::now(),
    };

    {
        let mut events = state.mock_campus.proctor_events.write().await;
        events
            .entry((assessment_id, user_id))
            .or_default()
            .push(record.clone());
    }
    {
        let mut counts = state.mock_campus.candidate_proctor_counts.write().await;
        let entry = counts.entry((assessment_id, user_id)).or_default();
        match event_type {
            "tab_switch" => entry.tab_switches += 1,
            "fullscreen_exit" => entry.fullscreen_exits += 1,
            "paste_burst" => entry.paste_bursts += 1,
            _ => {}
        }
        entry.total += 1;
    }

    Ok(ProctorEventView {
        id: record.id,
        assessment_id: record.assessment_id,
        user_id: record.user_id,
        username,
        event_type: record.event_type,
        severity: record.severity,
        event_metadata: record.metadata,
        created_at: record.created_at,
        persisted: false,
    })
}

/// Fans an ingested event out to the Redis telemetry channel and incident log,
/// and refreshes the candidate's liveness marker when the candidate emitted it.
///
/// Redis is an accelerator here, never a source of truth: a missing client is
/// not an error because PostgreSQL already holds every persisted infraction.
async fn publish_proctor_event(state: &AppState, event: &ProctorEventView, from_candidate: bool) {
    let Some(ref client) = state.redis_client else {
        return;
    };
    let Ok(mut conn) = client.get_multiplexed_async_connection().await else {
        return;
    };

    let payload = serde_json::to_string(event).unwrap_or_default();

    let _: Result<(), _> = conn
        .publish(proctor_event_channel(event.assessment_id), &payload)
        .await;

    // Only a candidate's own client proves that candidate is live.
    if from_candidate {
        let _: Result<(), _> = conn
            .set_ex(
                proctor_live_key(event.assessment_id, event.user_id),
                event.created_at.timestamp(),
                PROCTOR_LIVE_TTL_SECONDS.unsigned_abs(),
            )
            .await;
    }

    if is_proctor_infraction(&event.event_type) {
        let key = proctor_log_key(event.assessment_id);
        let _: Result<(), _> = conn.lpush(&key, &payload).await;
        let _: Result<(), _> = conn.ltrim(&key, 0, PROCTOR_LOG_CAPACITY - 1).await;
    }
}

/// Reads a candidate's last heartbeat from its Redis liveness marker.
async fn read_proctor_liveness(
    state: &AppState,
    assessment_id: Uuid,
    user_id: Uuid,
) -> Option<DateTime<Utc>> {
    let client = state.redis_client.as_ref()?;
    let mut conn = client.get_multiplexed_async_connection().await.ok()?;
    let epoch: i64 = conn
        .get::<_, Option<String>>(proctor_live_key(assessment_id, user_id))
        .await
        .ok()??
        .parse()
        .ok()?;

    DateTime::from_timestamp(epoch, 0)
}

/// Reads the recent infraction log retained on the Redis incident list.
async fn read_proctor_log(
    state: &AppState,
    assessment_id: Uuid,
    limit: i64,
) -> Vec<ProctorEventView> {
    let Some(ref client) = state.redis_client else {
        return Vec::new();
    };
    let Ok(mut conn) = client.get_multiplexed_async_connection().await else {
        return Vec::new();
    };
    let stop = isize::try_from(limit - 1).unwrap_or(isize::MAX - 1);
    let Ok(entries) = conn
        .lrange::<_, Vec<String>>(proctor_log_key(assessment_id), 0, stop)
        .await
    else {
        return Vec::new();
    };

    entries
        .iter()
        .filter_map(|entry| serde_json::from_str(entry).ok())
        .collect()
}

/// Returns recent incidents for an assessment, newest first.
///
/// PostgreSQL is the durable source; the Redis incident log and the in-memory
/// store only serve environments running without a database.
///
/// # Errors
/// Returns [`GatewayError::Database`] if the history lookup fails.
async fn load_recent_proctor_events(
    state: &AppState,
    assessment_id: Uuid,
    user_id: Option<Uuid>,
    limit: i64,
) -> Result<Vec<ProctorEventView>, GatewayError> {
    if let Some(ref pool) = state.db {
        let records = sqlx::query_as::<sqlx::Postgres, ProctorEventRecord>(
            r"
            SELECT id, assessment_id, user_id, event_type, severity, metadata, created_at
            FROM proctor_events
            WHERE assessment_id = $1 AND ($2::uuid IS NULL OR user_id = $2)
            ORDER BY created_at DESC
            LIMIT $3
            ",
        )
        .bind(assessment_id)
        .bind(user_id)
        .bind(limit)
        .fetch_all(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;

        return Ok(records
            .into_iter()
            .map(|record| record_to_view(record, true))
            .collect());
    }

    let mut stored: Vec<ProctorEventRecord> = {
        let events = state.mock_campus.proctor_events.read().await;
        events
            .iter()
            .filter(|((a_id, u_id), _)| {
                *a_id == assessment_id
                    && match user_id {
                        Some(target) => target == *u_id,
                        None => true,
                    }
            })
            .flat_map(|(_, records)| records.clone())
            .collect()
    };

    if stored.is_empty() {
        return Ok(read_proctor_log(state, assessment_id, limit).await);
    }

    stored.sort_by_key(|record| std::cmp::Reverse(record.created_at));
    stored.truncate(usize::try_from(limit).unwrap_or(usize::MAX));
    Ok(stored
        .into_iter()
        .map(|record| record_to_view(record, false))
        .collect())
}

/// Maps a stored proctoring row onto its cockpit representation.
fn record_to_view(record: ProctorEventRecord, persisted: bool) -> ProctorEventView {
    ProctorEventView {
        id: record.id,
        assessment_id: record.assessment_id,
        user_id: record.user_id,
        username: None,
        event_type: record.event_type,
        severity: record.severity,
        event_metadata: record.metadata,
        created_at: record.created_at,
        persisted,
    }
}

/// Derives the cockpit connection state from the freshest heartbeat and event.
///
/// Candidates who never emitted telemetry are reported as `idle` rather than
/// `disconnected`, while candidates who went dark mid-assessment are marked
/// `disconnected` once both the liveness marker and the last event age out.
fn derive_connection_state(
    last_heartbeat: Option<DateTime<Utc>>,
    last_event: Option<DateTime<Utc>>,
    now: DateTime<Utc>,
) -> (String, Option<DateTime<Utc>>) {
    let last_seen = match (last_heartbeat, last_event) {
        (Some(heartbeat), Some(event_at)) => Some(heartbeat.max(event_at)),
        (Some(heartbeat), None) => Some(heartbeat),
        (None, Some(event_at)) => Some(event_at),
        (None, None) => None,
    };

    if let Some(heartbeat) = last_heartbeat {
        let age = now.signed_duration_since(heartbeat).num_seconds();
        if age <= PROCTOR_CONNECTED_WINDOW_SECONDS {
            return ("connected".to_string(), last_seen);
        }
        if age <= PROCTOR_LIVE_TTL_SECONDS {
            return ("idle".to_string(), last_seen);
        }
    }

    let status = match last_seen {
        Some(seen_at)
            if now.signed_duration_since(seen_at).num_seconds() <= PROCTOR_LIVE_TTL_SECONDS =>
        {
            "idle"
        }
        Some(_) => "disconnected",
        None => "idle",
    };

    (status.to_string(), last_seen)
}

/// Handler for `POST /api/v1/campus/assessments/{assessment_id}/proctor/events`.
///
/// Ingests candidate proctoring telemetry, fans the event out over the Redis
/// telemetry channel `proctor:events:{assessment_id}`, and persists infractions
/// into `proctor_events` for the faculty cockpit.
///
/// # Errors
/// - Returns [`GatewayError::NotFound`] if the assessment does not exist.
/// - Returns [`GatewayError::Forbidden`] if the caller is a tenant outsider.
/// - Returns [`GatewayError::BadRequest`] if the event type is unsupported.
pub async fn post_proctor_event_handler(
    State(state): State<AppState>,
    student: RequireStudent,
    assessment_id: AssessmentId,
    Json(payload): Json<ProctorEventIngestRequest>,
) -> Result<(StatusCode, Json<ProctorEventView>), GatewayError> {
    let assessment_id = assessment_id.into_uuid();
    let assessment = load_assessment(&state, assessment_id).await?;
    ensure_assessment_membership(&state, &assessment, student.user_id).await?;

    let event_type = payload.event_type.trim().to_lowercase();
    let severity = proctor_event_severity(&event_type).ok_or_else(|| {
        GatewayError::BadRequest(format!("Unsupported proctor event type '{event_type}'"))
    })?;
    let metadata = payload
        .metadata
        .filter(serde_json::Value::is_object)
        .unwrap_or_else(|| serde_json::json!({}));

    // Candidates report on themselves; only instructors may record an event for
    // another candidate, and that candidate must belong to the same tenant.
    let candidate_id = match payload.user_id {
        Some(target) if target != student.user_id => {
            if role_level(&student.claims.role) < 30 {
                return Err(GatewayError::Forbidden(
                    "Only instructors may record proctor events for another candidate".to_string(),
                ));
            }
            ensure_assessment_membership(&state, &assessment, target).await?;
            target
        }
        _ => student.user_id,
    };

    let event = if is_proctor_infraction(&event_type) {
        persist_proctor_infraction(
            &state,
            assessment_id,
            candidate_id,
            &event_type,
            severity,
            metadata,
        )
        .await?
    } else {
        ProctorEventView {
            id: Uuid::new_v4(),
            assessment_id,
            user_id: candidate_id,
            username: lookup_campus_users(&state, &[candidate_id])
                .await?
                .get(&candidate_id)
                .map(|(name, _)| name.clone()),
            event_type,
            severity: severity.to_string(),
            event_metadata: metadata,
            created_at: Utc::now(),
            persisted: false,
        }
    };

    publish_proctor_event(&state, &event, candidate_id == student.user_id).await;

    Ok((StatusCode::CREATED, Json(event)))
}

/// Handler for `GET /api/v1/campus/assessments/{assessment_id}/proctor/events`.
///
/// Returns the most recent proctoring incidents for the assessment cockpit,
/// newest first, optionally narrowed to a single candidate.
///
/// # Errors
/// - Returns [`GatewayError::Forbidden`] if caller is not an instructor or not a
///   member of the assessment organization.
/// - Returns [`GatewayError::NotFound`] if assessment does not exist.
pub async fn get_proctor_events_handler(
    State(state): State<AppState>,
    instructor: RequireInstructor,
    assessment_id: AssessmentId,
    Query(query): Query<ProctorEventQuery>,
) -> Result<Json<Vec<ProctorEventView>>, GatewayError> {
    let assessment_id = assessment_id.into_uuid();
    let assessment = load_assessment(&state, assessment_id).await?;
    ensure_assessment_membership(&state, &assessment, instructor.user_id).await?;

    let limit = query
        .limit
        .unwrap_or(PROCTOR_EVENT_PAGE_LIMIT)
        .clamp(1, PROCTOR_EVENT_PAGE_LIMIT);
    let mut events =
        load_recent_proctor_events(&state, assessment_id, query.user_id, limit).await?;

    let user_ids: Vec<Uuid> = events.iter().map(|event| event.user_id).collect();
    let users = lookup_campus_users(&state, &user_ids).await?;
    for event in &mut events {
        event.username = users.get(&event.user_id).map(|(name, _)| name.clone());
    }

    Ok(Json(events))
}

/// Handler for `GET /api/v1/campus/assessments/{assessment_id}/proctor/students`.
///
/// Returns the live telemetry state of every candidate enrolled in the
/// assessment cohort: heartbeat-derived connection state, infraction counts,
/// and the anomaly risk score computed from those counts. Highest risk first.
///
/// # Errors
/// - Returns [`GatewayError::Forbidden`] if caller is not an instructor or not a
///   member of the assessment organization.
/// - Returns [`GatewayError::NotFound`] if assessment does not exist.
pub async fn get_proctored_students_handler(
    State(state): State<AppState>,
    instructor: RequireInstructor,
    assessment_id: AssessmentId,
) -> Result<Json<Vec<ProctoredCandidateState>>, GatewayError> {
    let assessment_id = assessment_id.into_uuid();
    let assessment = load_assessment(&state, assessment_id).await?;
    ensure_assessment_membership(&state, &assessment, instructor.user_id).await?;
    let candidate_ids = discover_enrolled_candidates(&state, &assessment).await?;
    let users = lookup_campus_users(&state, &candidate_ids).await?;

    let reg_numbers = state.mock_campus.member_reg_numbers.read().await.clone();
    let accommodations = state.mock_campus.accommodations.read().await.clone();
    let counts_mock = state
        .mock_campus
        .candidate_proctor_counts
        .read()
        .await
        .clone();

    let mut last_event_by_user: HashMap<Uuid, DateTime<Utc>> = HashMap::new();
    for event in
        load_recent_proctor_events(&state, assessment_id, None, PROCTOR_EVENT_PAGE_LIMIT).await?
    {
        last_event_by_user
            .entry(event.user_id)
            .and_modify(|seen_at| *seen_at = (*seen_at).max(event.created_at))
            .or_insert(event.created_at);
    }

    let now = Utc::now();
    let mut roster = Vec::with_capacity(candidate_ids.len());

    for candidate_id in candidate_ids {
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

        let (status, last_seen) = derive_connection_state(
            read_proctor_liveness(&state, assessment_id, candidate_id).await,
            last_event_by_user.get(&candidate_id).copied(),
            now,
        );
        let risk = counts.to_risk_score();
        let identity = users.get(&candidate_id);

        roster.push(ProctoredCandidateState {
            user_id: candidate_id,
            username: identity.map(|(username, _)| username.clone()),
            email: identity.map(|(_, email)| email.clone()),
            roll_number: reg_numbers
                .get(&(assessment.org_id, candidate_id))
                .cloned()
                .or_else(|| {
                    reg_numbers
                        .iter()
                        .find(|((_, user_id), _)| *user_id == candidate_id)
                        .map(|(_, reg)| reg.clone())
                }),
            status,
            tab_switches: counts.tab_switches,
            fullscreen_exits: counts.fullscreen_exits,
            paste_bursts: counts.paste_bursts,
            total_events: counts.total,
            risk_score: risk.score,
            risk_severity: risk_severity_label(risk.severity).to_string(),
            last_seen,
            time_extension_minutes: accommodations
                .get(&(assessment_id, candidate_id))
                .copied()
                .unwrap_or(0),
        });
    }

    roster.sort_by(|a, b| {
        b.risk_score
            .cmp(&a.risk_score)
            .then_with(|| a.username.cmp(&b.username))
    });

    Ok(Json(roster))
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
    assessment_id: AssessmentId,
    Json(payload): Json<ProvisionVivaRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let assessment_id = assessment_id.into_uuid();
    // 1. Verify assessment exists
    let org_id = if let Some(ref pool) = state.db {
        let assessment =
            judge_db::repositories::assessment::get_assessment_by_id(pool.inner(), assessment_id)
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
        rooms.get(&room_code).cloned().ok_or_else(|| {
            GatewayError::NotFound(format!("Interview room '{room_code}' not found"))
        })?
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
        let room = rooms.get_mut(&room_code).ok_or_else(|| {
            GatewayError::NotFound(format!("Interview room '{room_code}' not found"))
        })?;

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
    if socket
        .send(Message::Text(ack.to_string().into()))
        .await
        .is_err()
    {
        return;
    }

    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(text.as_str()) {
                    let ev_type = val
                        .get("event_type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("heartbeat");
                    let resp = serde_json::json!({
                        "status": "ack",
                        "event_type": ev_type,
                        "timestamp": Utc::now().to_rfc3339(),
                    });
                    if socket
                        .send(Message::Text(resp.to_string().into()))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
            }
            Ok(Message::Ping(p)) => {
                if socket.send(Message::Pong(p)).await.is_err() {
                    break;
                }
            }
            Ok(Message::Close(c)) => {
                let _ = socket.send(Message::Close(c)).await;
                break;
            }
            Err(_) => break,
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
        "event_type": "connected",
        "type": "room_joined",
        "room_code": room_code,
        "editor_code": "// Collaborative Viva Workspace Session\n#include <iostream>\n\nint main() {\n    std::cout << \"Viva candidate live session\" << std::endl;\n    return 0;\n}\n",
        "timestamp": Utc::now().to_rfc3339(),
    });
    if socket
        .send(Message::Text(init.to_string().into()))
        .await
        .is_err()
    {
        return;
    }

    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Text(text)) => {
                let resp = serde_json::json!({
                    "event_type": "crdt_update",
                    "status": "synced",
                    "echo": text.as_str(),
                });
                if socket
                    .send(Message::Text(resp.to_string().into()))
                    .await
                    .is_err()
                {
                    break;
                }
            }
            Ok(Message::Ping(p)) => {
                if socket.send(Message::Pong(p)).await.is_err() {
                    break;
                }
            }
            Ok(Message::Close(c)) => {
                let _ = socket.send(Message::Close(c)).await;
                break;
            }
            Err(_) => break,
            _ => {}
        }
    }
}

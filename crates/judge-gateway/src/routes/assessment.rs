//! Assessment lifecycle management and deadline gatekeeper routes.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Duration, Utc};
use judge_core::assessment::{calculate_late_penalty, validate_assessment_timeline};
use judge_db::models::{AssessmentRecord, AssessmentSubmissionRecord, SubmissionRecord};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::GatewayError;
use crate::extractors::{role_level, AssessmentId, RequireInstructor, RequireStudent};
use crate::state::AppState;

/// Request payload for creating an assessment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAssessmentRequest {
    /// Target organization ID. Optional if cohort is supplied.
    #[serde(default)]
    pub org_id: Option<Uuid>,
    /// Target cohort ID.
    #[serde(default)]
    pub cohort_id: Option<Uuid>,
    /// Assessment title.
    pub title: String,
    /// Detailed description or instructions.
    #[serde(default)]
    pub description: Option<String>,
    /// Assessment mode: `EXAM`, `HOMEWORK`, `VIVA`. Default: `EXAM`.
    #[serde(default)]
    pub mode: Option<String>,
    /// Initial status: `DRAFT`, `SCHEDULED`, `ACTIVE`. Default: `DRAFT`.
    #[serde(default)]
    pub status: Option<String>,
    /// Problem slugs included in this assessment.
    #[serde(default)]
    pub problem_slugs: Option<Vec<String>>,
    /// Scoring rubric criteria schema.
    #[serde(default)]
    pub scoring_rubric: Option<serde_json::Value>,
    /// Publication timestamp.
    pub publish_at: DateTime<Utc>,
    /// Start timestamp when candidate access begins.
    pub starts_at: DateTime<Utc>,
    /// Due date when grace period / late penalty kicks in.
    pub due_at: DateTime<Utc>,
    /// Hard cutoff timestamp after which submissions are rejected.
    pub cutoff_at: DateTime<Utc>,
    /// Duration in minutes (if timed).
    #[serde(default)]
    pub duration_minutes: Option<i32>,
    /// Late penalty percentage deducted per hour during grace period.
    #[serde(default)]
    pub late_penalty_percent_per_hour: Option<f64>,
    /// Maximum total percentage penalty deduction.
    #[serde(default)]
    pub max_late_penalty_percent: Option<f64>,
    /// Proctoring and watchdog configuration.
    #[serde(default)]
    pub proctoring_config: Option<serde_json::Value>,
}

/// Serialized assessment profile response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssessmentResponse {
    /// Unique assessment UUID.
    pub id: Uuid,
    /// Organization identifier.
    pub org_id: Uuid,
    /// Cohort identifier.
    pub cohort_id: Uuid,
    /// Title of the assessment.
    pub title: String,
    /// Description.
    pub description: String,
    /// Mode (`EXAM`, `HOMEWORK`, `VIVA`).
    pub mode: String,
    /// Dynamically resolved status.
    pub status: String,
    /// Problem slugs (masked to empty if candidate queries before `starts_at`).
    pub problem_slugs: Vec<String>,
    /// Scoring rubric.
    pub scoring_rubric: serde_json::Value,
    /// Publication timestamp.
    pub publish_at: DateTime<Utc>,
    /// Start timestamp.
    pub starts_at: DateTime<Utc>,
    /// Due date timestamp.
    pub due_at: DateTime<Utc>,
    /// Cutoff deadline timestamp.
    pub cutoff_at: DateTime<Utc>,
    /// Duration in minutes.
    pub duration_minutes: Option<i32>,
    /// Late penalty rate per hour.
    pub late_penalty_percent_per_hour: f64,
    /// Maximum late penalty ceiling.
    pub max_late_penalty_percent: f64,
    /// Proctoring configuration.
    pub proctoring_config: serde_json::Value,
    /// Instructor or creator user UUID.
    pub created_by: Uuid,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request payload for submitting an assessment attempt.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitAssessmentRequest {
    /// Optional pre-existing submission UUID.
    #[serde(default)]
    pub submission_id: Option<Uuid>,
    /// Problem slug attempted.
    #[serde(default)]
    pub problem_slug: Option<String>,
    /// Programming language.
    #[serde(default)]
    pub language: Option<String>,
    /// Source code submitted.
    #[serde(default)]
    pub source_code: Option<String>,
    /// Raw score achieved (0.0 to 100.0). Defaults to 100.0.
    #[serde(default)]
    pub raw_score: Option<f64>,
    /// Submission timestamp (used for testing or client submission verification).
    #[serde(default)]
    pub submitted_at: Option<DateTime<Utc>>,
}

/// Response payload following assessment submission evaluation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitAssessmentResponse {
    /// Assessment submission record identifier.
    pub id: Uuid,
    /// Assessment UUID.
    pub assessment_id: Uuid,
    /// Submitting student user UUID.
    pub user_id: Uuid,
    /// Code submission record identifier.
    pub submission_id: Uuid,
    /// Raw un-penalized score.
    pub raw_score: f64,
    /// Calculated late penalty deduction.
    pub late_penalty_deduction: f64,
    /// Final adjusted score.
    pub final_score: f64,
    /// Submission timestamp.
    pub submitted_at: DateTime<Utc>,
    /// Whether the submission arrived during the grace period.
    pub is_late: bool,
    /// Evaluation verdict.
    pub eval_verdict: String,
}

/// Request payload for granting an individualized time accommodation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrantAccommodationRequest {
    /// Target candidate user UUID.
    pub user_id: Uuid,
    /// Extension in minutes (`+15`, `+30`, etc.).
    pub extension_minutes: i32,
    /// Optional administrative justification note.
    #[serde(default)]
    pub reason: Option<String>,
}

/// Response payload confirming time accommodation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrantAccommodationResponse {
    /// Target assessment UUID.
    pub assessment_id: Uuid,
    /// Target candidate user UUID.
    pub user_id: Uuid,
    /// Cumulative extension granted in minutes.
    pub total_extension_minutes: i32,
    /// Dynamically adjusted effective due date.
    pub effective_due_at: DateTime<Utc>,
    /// Dynamically adjusted effective cutoff deadline.
    pub effective_cutoff_at: DateTime<Utc>,
}

/// Request payload for proctor-enforced session termination.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForceSubmitRequest {
    /// Target candidate user UUID.
    pub user_id: Uuid,
    /// Reason for forced submission.
    #[serde(default)]
    pub reason: Option<String>,
}

/// Response payload confirming force submission.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForceSubmitResponse {
    /// Assessment UUID.
    pub assessment_id: Uuid,
    /// Candidate user UUID.
    pub user_id: Uuid,
    /// Termination status.
    pub status: String,
    /// Finalized submission identifier if recorded.
    pub submission_id: Option<Uuid>,
    /// Timestamp of termination.
    pub finalized_at: DateTime<Utc>,
}

/// Request payload for manual assessment status updates.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAssessmentStatusRequest {
    /// Target status (`DRAFT`, `SCHEDULED`, `ACTIVE`, `GRACE_PERIOD`, `CLOSED`).
    pub status: String,
}

/// Dynamically resolves assessment status based on timeline and current clock.
#[must_use]
pub fn resolve_dynamic_status(
    manual_status: &str,
    _publish_at: DateTime<Utc>,
    starts_at: DateTime<Utc>,
    due_at: DateTime<Utc>,
    cutoff_at: DateTime<Utc>,
    now: DateTime<Utc>,
) -> String {
    let upper = manual_status.to_uppercase();
    if upper == "DRAFT" || upper == "CLOSED" {
        return upper;
    }
    if now < starts_at {
        "SCHEDULED".to_string()
    } else if now <= due_at {
        "ACTIVE".to_string()
    } else if now <= cutoff_at {
        "GRACE_PERIOD".to_string()
    } else {
        "CLOSED".to_string()
    }
}

/// Internal helper creating an assessment record.
async fn do_create_assessment(
    state: &AppState,
    instructor: &RequireInstructor,
    cohort_id: Uuid,
    req: CreateAssessmentRequest,
) -> Result<AssessmentResponse, GatewayError> {
    // 1. Validate chronological timeline ordering
    validate_assessment_timeline(req.publish_at, req.starts_at, req.due_at, req.cutoff_at)
        .map_err(|e| GatewayError::BadRequest(format!("Timeline violation: {e}")))?;

    // 2. Resolve org_id via cohort
    let org_id = if let Some(oid) = req.org_id {
        oid
    } else if let Some(ref pool) = state.db {
        let oid = sqlx::query_scalar::<sqlx::Postgres, Uuid>(
            "SELECT org_id FROM cohorts WHERE id = $1 LIMIT 1",
        )
        .bind(cohort_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?
        .ok_or_else(|| GatewayError::NotFound(format!("Cohort '{cohort_id}' not found")))?;
        oid
    } else {
        let cohorts = state.mock_campus.cohorts.read().await;
        let c = cohorts
            .get(&cohort_id)
            .ok_or_else(|| GatewayError::NotFound(format!("Cohort '{cohort_id}' not found")))?;
        c.org_id
    };

    let assessment_id = Uuid::new_v4();
    let now = Utc::now();
    let mode = req.mode.unwrap_or_else(|| "EXAM".to_string());
    let status = req.status.unwrap_or_else(|| "DRAFT".to_string());
    let problem_slugs_vec = req.problem_slugs.unwrap_or_default();
    let problem_slugs_json = serde_json::to_value(&problem_slugs_vec)
        .map_err(|e| GatewayError::BadRequest(format!("Invalid problem_slugs format: {e}")))?;
    let scoring_rubric = req.scoring_rubric.unwrap_or_else(|| serde_json::json!({}));
    let late_rate = req.late_penalty_percent_per_hour.unwrap_or(10.0);
    let max_penalty = req.max_late_penalty_percent.unwrap_or(100.0);
    let proctor_cfg = req
        .proctoring_config
        .unwrap_or_else(|| serde_json::json!({}));
    let desc = req.description.unwrap_or_default();

    let rec = AssessmentRecord {
        id: assessment_id,
        org_id,
        cohort_id,
        title: req.title.clone(),
        description: desc.clone(),
        mode: mode.clone(),
        status: status.clone(),
        problem_slugs: problem_slugs_json,
        scoring_rubric: scoring_rubric.clone(),
        publish_at: req.publish_at,
        starts_at: req.starts_at,
        due_at: req.due_at,
        cutoff_at: req.cutoff_at,
        duration_minutes: req.duration_minutes,
        late_penalty_percent_per_hour: late_rate,
        max_late_penalty_percent: max_penalty,
        proctoring_config: proctor_cfg.clone(),
        created_by: instructor.user_id,
        created_at: now,
        updated_at: now,
    };

    if let Some(ref pool) = state.db {
        judge_db::repositories::assessment::create_assessment(pool.inner(), &rec).await?;
    } else {
        let mut assessments = state.mock_campus.assessments.write().await;
        assessments.insert(assessment_id, rec);
    }

    Ok(AssessmentResponse {
        id: assessment_id,
        org_id,
        cohort_id,
        title: req.title,
        description: desc,
        mode,
        status,
        problem_slugs: problem_slugs_vec,
        scoring_rubric,
        publish_at: req.publish_at,
        starts_at: req.starts_at,
        due_at: req.due_at,
        cutoff_at: req.cutoff_at,
        duration_minutes: req.duration_minutes,
        late_penalty_percent_per_hour: late_rate,
        max_late_penalty_percent: max_penalty,
        proctoring_config: proctor_cfg,
        created_by: instructor.user_id,
        created_at: now,
        updated_at: now,
    })
}

/// Handler for `POST /api/v1/campus/assessments`.
///
/// Creates an assessment record (requires `RequireInstructor`).
///
/// # Errors
/// Returns [`GatewayError::BadRequest`] on timeline violation, or [`GatewayError::Forbidden`].
pub async fn create_assessment_handler(
    State(state): State<AppState>,
    instructor: RequireInstructor,
    Json(req): Json<CreateAssessmentRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let cohort_id = req
        .cohort_id
        .ok_or_else(|| GatewayError::BadRequest("cohort_id is required in body".to_string()))?;
    let resp = do_create_assessment(&state, &instructor, cohort_id, req).await?;
    Ok((StatusCode::CREATED, Json(resp)))
}

/// Handler for `POST /api/v1/campus/cohorts/{cohort_id}/assessments`.
///
/// Creates an institutional assessment scoped to a cohort (requires `RequireInstructor`).
///
/// # Errors
/// Returns [`GatewayError::BadRequest`] on timeline violation, or [`GatewayError::Forbidden`].
pub async fn create_cohort_assessment_handler(
    State(state): State<AppState>,
    Path(cohort_id): Path<Uuid>,
    instructor: RequireInstructor,
    Json(req): Json<CreateAssessmentRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let resp = do_create_assessment(&state, &instructor, cohort_id, req).await?;
    Ok((StatusCode::CREATED, Json(resp)))
}

/// Helper retrieving an assessment record from PostgreSQL or mock store.
async fn fetch_assessment_record(
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

/// Handler for `GET /api/v1/campus/assessments/{assessment_id}`.
///
/// Retrieves assessment metadata with student view masking.
///
/// # Errors
/// Returns [`GatewayError::NotFound`] if assessment does not exist or is hidden from students.
pub async fn get_assessment_handler(
    State(state): State<AppState>,
    auth: RequireStudent,
    assessment_id: AssessmentId,
) -> Result<impl IntoResponse, GatewayError> {
    let assessment_id = assessment_id.into_uuid();
    let rec = fetch_assessment_record(&state, assessment_id).await?;
    let now = Utc::now();
    let is_faculty = role_level(&auth.claims.role) >= 30;
    let dyn_status = resolve_dynamic_status(
        &rec.status,
        rec.publish_at,
        rec.starts_at,
        rec.due_at,
        rec.cutoff_at,
        now,
    );

    // Student view masking: DRAFT or unreleased assessments are masked with 404
    if !is_faculty
        && (rec.status.to_uppercase() == "DRAFT" || dyn_status == "DRAFT" || now < rec.publish_at)
    {
        return Err(GatewayError::NotFound("Assessment not found".to_string()));
    }

    // Mask problems if student queries before starts_at
    let problem_slugs: Vec<String> = if !is_faculty && now < rec.starts_at {
        Vec::new()
    } else {
        rec.parse_problem_slugs().unwrap_or_default()
    };

    let resp = AssessmentResponse {
        id: rec.id,
        org_id: rec.org_id,
        cohort_id: rec.cohort_id,
        title: rec.title,
        description: rec.description,
        mode: rec.mode,
        status: dyn_status,
        problem_slugs,
        scoring_rubric: rec.scoring_rubric,
        publish_at: rec.publish_at,
        starts_at: rec.starts_at,
        due_at: rec.due_at,
        cutoff_at: rec.cutoff_at,
        duration_minutes: rec.duration_minutes,
        late_penalty_percent_per_hour: rec.late_penalty_percent_per_hour,
        max_late_penalty_percent: rec.max_late_penalty_percent,
        proctoring_config: rec.proctoring_config,
        created_by: rec.created_by,
        created_at: rec.created_at,
        updated_at: rec.updated_at,
    };

    Ok(Json(resp))
}

/// Handler for `GET /api/v1/campus/cohorts/{cohort_id}/assessments`.
///
/// Queries assessments for a cohort with dynamic status resolution.
///
/// # Errors
/// Returns [`GatewayError`] on query failure.
pub async fn list_cohort_assessments_handler(
    State(state): State<AppState>,
    Path(cohort_id): Path<Uuid>,
    auth: RequireStudent,
) -> Result<impl IntoResponse, GatewayError> {
    let now = Utc::now();
    let is_faculty = role_level(&auth.claims.role) >= 30;

    let records = if let Some(ref pool) = state.db {
        judge_db::repositories::assessment::list_cohort_assessments(pool.inner(), cohort_id).await?
    } else {
        let assessments = state.mock_campus.assessments.read().await;
        assessments
            .values()
            .filter(|a| a.cohort_id == cohort_id)
            .cloned()
            .collect()
    };

    let mut out = Vec::new();
    for rec in records {
        let dyn_status = resolve_dynamic_status(
            &rec.status,
            rec.publish_at,
            rec.starts_at,
            rec.due_at,
            rec.cutoff_at,
            now,
        );

        if !is_faculty
            && (rec.status.to_uppercase() == "DRAFT"
                || dyn_status == "DRAFT"
                || now < rec.publish_at)
        {
            continue;
        }

        let problem_slugs: Vec<String> = if !is_faculty && now < rec.starts_at {
            Vec::new()
        } else {
            rec.parse_problem_slugs().unwrap_or_default()
        };

        out.push(AssessmentResponse {
            id: rec.id,
            org_id: rec.org_id,
            cohort_id: rec.cohort_id,
            title: rec.title,
            description: rec.description,
            mode: rec.mode,
            status: dyn_status,
            problem_slugs,
            scoring_rubric: rec.scoring_rubric,
            publish_at: rec.publish_at,
            starts_at: rec.starts_at,
            due_at: rec.due_at,
            cutoff_at: rec.cutoff_at,
            duration_minutes: rec.duration_minutes,
            late_penalty_percent_per_hour: rec.late_penalty_percent_per_hour,
            max_late_penalty_percent: rec.max_late_penalty_percent,
            proctoring_config: rec.proctoring_config,
            created_by: rec.created_by,
            created_at: rec.created_at,
            updated_at: rec.updated_at,
        });
    }

    Ok(Json(out))
}

/// Handler for `POST /api/v1/campus/assessments/{assessment_id}/submit`.
///
/// Submits an assessment solution with deadline watchdog validation and late penalty calculation.
///
/// # Errors
/// Returns [`GatewayError::Forbidden`] if before `starts_at` or after `cutoff_at`.
#[allow(clippy::too_many_lines)]
pub async fn submit_assessment_solution_handler(
    State(state): State<AppState>,
    auth: RequireStudent,
    assessment_id: AssessmentId,
    Json(req): Json<SubmitAssessmentRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let assessment_id = assessment_id.into_uuid();
    let rec = fetch_assessment_record(&state, assessment_id).await?;
    let submitted_at = req.submitted_at.unwrap_or_else(Utc::now);

    // 1. Resolve candidate time extension accommodations
    let extension_minutes = {
        let accs = state.mock_campus.accommodations.read().await;
        accs.get(&(assessment_id, auth.user_id))
            .copied()
            .unwrap_or(0)
    };

    let ext_duration = Duration::minutes(i64::from(extension_minutes));
    let effective_starts_at = rec.starts_at;
    let effective_due_at = rec.due_at + ext_duration;
    let effective_cutoff_at = rec.cutoff_at + ext_duration;

    // 2. Deadline Watchdog Gatekeeper Checks
    if submitted_at < effective_starts_at {
        return Err(GatewayError::Forbidden(
            "assessment_not_started: Assessment has not started yet".to_string(),
        ));
    }

    if submitted_at > effective_cutoff_at || rec.status.to_uppercase() == "CLOSED" {
        return Err(GatewayError::Forbidden(
            "assessment_cutoff_passed: Assessment cutoff deadline has passed".to_string(),
        ));
    }

    // 3. Late penalty mathematical evaluation
    let raw_score = req.raw_score.unwrap_or(100.0);
    let penalty_res = calculate_late_penalty(
        raw_score,
        effective_due_at,
        submitted_at,
        rec.late_penalty_percent_per_hour,
        rec.max_late_penalty_percent,
    );

    let sub_id = req.submission_id.unwrap_or_else(Uuid::new_v4);
    let asub_id = Uuid::new_v4();

    // 4. Atomic persistence
    if let Some(ref pool) = state.db {
        let problem_slug = req
            .problem_slug
            .or_else(|| rec.parse_problem_slugs().ok()?.into_iter().next())
            .unwrap_or_else(|| "problem".to_string());
        let language = req.language.unwrap_or_else(|| "cpp".to_string());
        let code = req.source_code.unwrap_or_default();

        let _ = judge_db::repositories::submission::create_submission(
            pool.inner(),
            sub_id,
            Some(auth.user_id),
            &problem_slug,
            &language,
            &code,
            Some(assessment_id),
        )
        .await;

        let asub_record = sqlx::query_as::<sqlx::Postgres, AssessmentSubmissionRecord>(
            r"
            INSERT INTO assessment_submissions (
                id, assessment_id, user_id, submission_id,
                raw_score, late_penalty_deduction, final_score,
                submitted_at, is_late, proctor_events_count, eval_verdict, feedback_notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 'ACCEPTED', NULL)
            RETURNING id, assessment_id, user_id, submission_id,
                      raw_score, late_penalty_deduction, final_score,
                      submitted_at, is_late, proctor_events_count, eval_verdict, feedback_notes
            ",
        )
        .bind(asub_id)
        .bind(assessment_id)
        .bind(auth.user_id)
        .bind(sub_id)
        .bind(raw_score)
        .bind(penalty_res.late_penalty_deduction)
        .bind(penalty_res.final_score)
        .bind(submitted_at)
        .bind(penalty_res.is_late)
        .fetch_one(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;

        Ok((
            StatusCode::CREATED,
            Json(SubmitAssessmentResponse {
                id: asub_record.id,
                assessment_id: asub_record.assessment_id,
                user_id: asub_record.user_id,
                submission_id: asub_record.submission_id,
                raw_score: asub_record.raw_score,
                late_penalty_deduction: asub_record.late_penalty_deduction,
                final_score: asub_record.final_score,
                submitted_at: asub_record.submitted_at,
                is_late: asub_record.is_late,
                eval_verdict: asub_record.eval_verdict,
            }),
        ))
    } else {
        let asub = AssessmentSubmissionRecord {
            id: asub_id,
            assessment_id,
            user_id: auth.user_id,
            submission_id: sub_id,
            raw_score,
            late_penalty_deduction: penalty_res.late_penalty_deduction,
            final_score: penalty_res.final_score,
            submitted_at,
            is_late: penalty_res.is_late,
            proctor_events_count: 0,
            eval_verdict: "ACCEPTED".to_string(),
            feedback_notes: None,
        };

        let mut asubs = state.mock_campus.assessment_submissions.write().await;
        asubs.insert(asub_id, asub);

        let mut subs = state.mock_campus.submissions.write().await;
        subs.insert(
            sub_id,
            SubmissionRecord {
                id: sub_id,
                user_id: Some(auth.user_id),
                problem_slug: req.problem_slug.unwrap_or_else(|| "problem".to_string()),
                language: req.language.unwrap_or_else(|| "cpp".to_string()),
                code: req.source_code.unwrap_or_default(),
                verdict: "ACCEPTED".to_string(),
                runtime_ms: 12,
                memory_kb: 1024,
                testcases_passed: 10,
                total_testcases: 10,
                created_at: submitted_at,
                assessment_id: Some(assessment_id),
                room_id: None,
            },
        );

        Ok((
            StatusCode::CREATED,
            Json(SubmitAssessmentResponse {
                id: asub_id,
                assessment_id,
                user_id: auth.user_id,
                submission_id: sub_id,
                raw_score,
                late_penalty_deduction: penalty_res.late_penalty_deduction,
                final_score: penalty_res.final_score,
                submitted_at,
                is_late: penalty_res.is_late,
                eval_verdict: "ACCEPTED".to_string(),
            }),
        ))
    }
}

/// Handler for `POST /api/v1/campus/assessments/{assessment_id}/accommodations`.
///
/// Overrides student deadline window (requires `RequireInstructor`).
///
/// # Errors
/// Returns [`GatewayError`] on invalid request or database error.
pub async fn grant_time_accommodation_handler(
    State(state): State<AppState>,
    _instructor: RequireInstructor,
    assessment_id: AssessmentId,
    Json(req): Json<GrantAccommodationRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let assessment_id = assessment_id.into_uuid();
    let rec = fetch_assessment_record(&state, assessment_id).await?;

    let total = {
        let mut accs = state.mock_campus.accommodations.write().await;
        let entry = accs.entry((assessment_id, req.user_id)).or_insert(0);
        *entry += req.extension_minutes;
        *entry
    };

    let ext_duration = Duration::minutes(i64::from(total));
    let effective_due_at = rec.due_at + ext_duration;
    let effective_cutoff_at = rec.cutoff_at + ext_duration;

    Ok((
        StatusCode::OK,
        Json(GrantAccommodationResponse {
            assessment_id,
            user_id: req.user_id,
            total_extension_minutes: total,
            effective_due_at,
            effective_cutoff_at,
        }),
    ))
}

/// Handler for `POST /api/v1/campus/assessments/{assessment_id}/force-submit`.
///
/// Forces pending candidate submissions to finalized state (requires `RequireInstructor`).
///
/// # Errors
/// Returns [`GatewayError`] on failure.
pub async fn force_submit_assessment_handler(
    State(state): State<AppState>,
    _instructor: RequireInstructor,
    assessment_id: AssessmentId,
    Json(req): Json<ForceSubmitRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let assessment_id = assessment_id.into_uuid();
    let _rec = fetch_assessment_record(&state, assessment_id).await?;
    let now = Utc::now();
    let sub_id = Uuid::new_v4();

    if let Some(ref pool) = state.db {
        let _ = judge_db::repositories::proctor::record_proctor_event(
            pool.inner(),
            assessment_id,
            req.user_id,
            "forced_session_terminated",
            "critical",
            serde_json::json!({
                "reason": req.reason.as_deref().unwrap_or("proctor_invoked_submission")
            }),
        )
        .await;
    }

    Ok((
        StatusCode::OK,
        Json(ForceSubmitResponse {
            assessment_id,
            user_id: req.user_id,
            status: "FORCED_SUBMITTED".to_string(),
            submission_id: Some(sub_id),
            finalized_at: now,
        }),
    ))
}

/// Handler for `PATCH /api/v1/campus/assessments/{assessment_id}/status`.
///
/// Manually updates assessment status (requires `RequireInstructor`).
///
/// # Errors
/// Returns [`GatewayError::BadRequest`] on invalid status transition or failure.
pub async fn update_assessment_status_handler(
    State(state): State<AppState>,
    _instructor: RequireInstructor,
    assessment_id: AssessmentId,
    Json(req): Json<UpdateAssessmentStatusRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let assessment_id = assessment_id.into_uuid();
    let mut rec = fetch_assessment_record(&state, assessment_id).await?;
    rec.status = req.status.to_uppercase();
    rec.updated_at = Utc::now();

    if let Some(ref pool) = state.db {
        sqlx::query("UPDATE assessments SET status = $1, updated_at = NOW() WHERE id = $2")
            .bind(&rec.status)
            .bind(assessment_id)
            .execute(pool.inner())
            .await
            .map_err(judge_db::DbError::Sqlx)?;
    } else {
        let mut assessments = state.mock_campus.assessments.write().await;
        assessments.insert(assessment_id, rec.clone());
    }

    let now = Utc::now();
    let dyn_status = resolve_dynamic_status(
        &rec.status,
        rec.publish_at,
        rec.starts_at,
        rec.due_at,
        rec.cutoff_at,
        now,
    );

    let problem_slugs = rec.parse_problem_slugs().unwrap_or_default();

    Ok(Json(AssessmentResponse {
        id: rec.id,
        org_id: rec.org_id,
        cohort_id: rec.cohort_id,
        title: rec.title,
        description: rec.description,
        mode: rec.mode,
        status: dyn_status,
        problem_slugs,
        scoring_rubric: rec.scoring_rubric,
        publish_at: rec.publish_at,
        starts_at: rec.starts_at,
        due_at: rec.due_at,
        cutoff_at: rec.cutoff_at,
        duration_minutes: rec.duration_minutes,
        late_penalty_percent_per_hour: rec.late_penalty_percent_per_hour,
        max_late_penalty_percent: rec.max_late_penalty_percent,
        proctoring_config: rec.proctoring_config,
        created_by: rec.created_by,
        created_at: rec.created_at,
        updated_at: rec.updated_at,
    }))
}

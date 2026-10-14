use chrono::{DateTime, Utc};
use judge_core::models::AssessmentStatus;
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::DbError;
use crate::models::AssessmentRecord;

/// Inserts a new assessment into the database.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if database query fails.
pub async fn create_assessment(
    pool: &PgPool,
    rec: &AssessmentRecord,
) -> Result<AssessmentRecord, DbError> {
    let created = sqlx::query_as::<_, AssessmentRecord>(
        r"
        INSERT INTO assessments (
            id, org_id, cohort_id, title, description, mode, status,
            problem_slugs, scoring_rubric, publish_at, starts_at, due_at, cutoff_at,
            duration_minutes, late_penalty_percent_per_hour, max_late_penalty_percent,
            proctoring_config, created_by, created_at, updated_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13,
            $14, $15, $16,
            $17, $18, NOW(), NOW()
        )
        RETURNING id, org_id, cohort_id, title, description, mode, status,
                  problem_slugs, scoring_rubric, publish_at, starts_at, due_at, cutoff_at,
                  duration_minutes, late_penalty_percent_per_hour, max_late_penalty_percent,
                  proctoring_config, created_by, created_at, updated_at
        ",
    )
    .bind(rec.id)
    .bind(rec.org_id)
    .bind(rec.cohort_id)
    .bind(&rec.title)
    .bind(&rec.description)
    .bind(&rec.mode)
    .bind(&rec.status)
    .bind(&rec.problem_slugs)
    .bind(&rec.scoring_rubric)
    .bind(rec.publish_at)
    .bind(rec.starts_at)
    .bind(rec.due_at)
    .bind(rec.cutoff_at)
    .bind(rec.duration_minutes)
    .bind(rec.late_penalty_percent_per_hour)
    .bind(rec.max_late_penalty_percent)
    .bind(&rec.proctoring_config)
    .bind(rec.created_by)
    .fetch_one(pool)
    .await
    .map_err(DbError::Sqlx)?;

    Ok(created)
}

/// Retrieves an assessment record by its unique identifier.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if database lookup fails.
pub async fn get_assessment_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<AssessmentRecord>, DbError> {
    sqlx::query_as::<_, AssessmentRecord>(
        r"
        SELECT id, org_id, cohort_id, title, description, mode, status,
               problem_slugs, scoring_rubric, publish_at, starts_at, due_at, cutoff_at,
               duration_minutes, late_penalty_percent_per_hour, max_late_penalty_percent,
               proctoring_config, created_by, created_at, updated_at
        FROM assessments
        WHERE id = $1
        ",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(DbError::Sqlx)
}

/// Lists all assessments belonging to a given cohort.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if database query fails.
pub async fn list_cohort_assessments(
    pool: &PgPool,
    cohort_id: Uuid,
) -> Result<Vec<AssessmentRecord>, DbError> {
    sqlx::query_as::<_, AssessmentRecord>(
        r"
        SELECT id, org_id, cohort_id, title, description, mode, status,
               problem_slugs, scoring_rubric, publish_at, starts_at, due_at, cutoff_at,
               duration_minutes, late_penalty_percent_per_hour, max_late_penalty_percent,
               proctoring_config, created_by, created_at, updated_at
        FROM assessments
        WHERE cohort_id = $1
        ORDER BY publish_at ASC
        ",
    )
    .bind(cohort_id)
    .fetch_all(pool)
    .await
    .map_err(DbError::Sqlx)
}

/// Queries active assessments based on deadline timestamp filtering:
/// `starts_at <= as_of AND cutoff_at >= as_of AND status = 'ACTIVE'`
///
/// # Errors
/// Returns [`DbError::Sqlx`] if query fails.
pub async fn list_active_assessments(
    pool: &PgPool,
    as_of: DateTime<Utc>,
) -> Result<Vec<AssessmentRecord>, DbError> {
    sqlx::query_as::<_, AssessmentRecord>(
        r"
        SELECT id, org_id, cohort_id, title, description, mode, status,
               problem_slugs, scoring_rubric, publish_at, starts_at, due_at, cutoff_at,
               duration_minutes, late_penalty_percent_per_hour, max_late_penalty_percent,
               proctoring_config, created_by, created_at, updated_at
        FROM assessments
        WHERE starts_at <= $1 AND cutoff_at >= $1 AND status = 'ACTIVE'
        ORDER BY starts_at ASC
        ",
    )
    .bind(as_of)
    .fetch_all(pool)
    .await
    .map_err(DbError::Sqlx)
}

/// Evaluates state machine validity and updates the assessment status.
///
/// Valid transitions are validated via [`judge_core::transition_assessment_state`].
///
/// # Errors
/// Returns [`DbError::NotFound`] if assessment is missing,
/// [`DbError::Domain`] if the state transition is illegal, or
/// [`DbError::Sqlx`] on database failure.
pub async fn update_assessment_status(
    pool: &PgPool,
    id: Uuid,
    target_status: AssessmentStatus,
) -> Result<AssessmentRecord, DbError> {
    let existing = get_assessment_by_id(pool, id)
        .await?
        .ok_or_else(|| DbError::NotFound(format!("assessment {id} not found")))?;

    let current_status = match existing.status.to_uppercase().as_str() {
        "DRAFT" => AssessmentStatus::Draft,
        "SCHEDULED" => AssessmentStatus::Scheduled,
        "ACTIVE" => AssessmentStatus::Active,
        "GRACE_PERIOD" => AssessmentStatus::GracePeriod,
        "CLOSED" => AssessmentStatus::Closed,
        other => return Err(DbError::NotFound(format!("unknown assessment status: {other}"))),
    };

    let valid_target = judge_core::transition_assessment_state(current_status, target_status)?;
    let target_str = match valid_target {
        AssessmentStatus::Draft => "DRAFT",
        AssessmentStatus::Scheduled => "SCHEDULED",
        AssessmentStatus::Active => "ACTIVE",
        AssessmentStatus::GracePeriod => "GRACE_PERIOD",
        AssessmentStatus::Closed => "CLOSED",
    };

    let updated = sqlx::query_as::<_, AssessmentRecord>(
        r"
        UPDATE assessments
        SET status = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, org_id, cohort_id, title, description, mode, status,
                  problem_slugs, scoring_rubric, publish_at, starts_at, due_at, cutoff_at,
                  duration_minutes, late_penalty_percent_per_hour, max_late_penalty_percent,
                  proctoring_config, created_by, created_at, updated_at
        ",
    )
    .bind(id)
    .bind(target_str)
    .fetch_one(pool)
    .await
    .map_err(DbError::Sqlx)?;

    Ok(updated)
}

/// Assessment repository wrapper struct.
#[derive(Debug, Clone)]
pub struct AssessmentRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> AssessmentRepository<'a> {
    #[must_use]
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Creates a new assessment.
    ///
    /// # Errors
    /// Returns [`DbError`] if database creation fails.
    pub async fn create(&self, rec: &AssessmentRecord) -> Result<AssessmentRecord, DbError> {
        create_assessment(self.pool, rec).await
    }

    /// Fetches assessment by ID.
    ///
    /// # Errors
    /// Returns [`DbError`] if database lookup fails.
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<AssessmentRecord>, DbError> {
        get_assessment_by_id(self.pool, id).await
    }

    /// Lists cohort assessments.
    ///
    /// # Errors
    /// Returns [`DbError`] if database query fails.
    pub async fn list_by_cohort(&self, cohort_id: Uuid) -> Result<Vec<AssessmentRecord>, DbError> {
        list_cohort_assessments(self.pool, cohort_id).await
    }

    /// Lists active assessments for a given moment in time.
    ///
    /// # Errors
    /// Returns [`DbError`] if database query fails.
    pub async fn list_active(
        &self,
        as_of: DateTime<Utc>,
    ) -> Result<Vec<AssessmentRecord>, DbError> {
        list_active_assessments(self.pool, as_of).await
    }

    /// Updates assessment status according to state machine transitions.
    ///
    /// # Errors
    /// Returns [`DbError`] if state transition or database update fails.
    pub async fn update_status(
        &self,
        id: Uuid,
        target_status: AssessmentStatus,
    ) -> Result<AssessmentRecord, DbError> {
        update_assessment_status(self.pool, id, target_status).await
    }
}

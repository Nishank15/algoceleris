use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::DbError;
use crate::models::{AssessmentRecord, AssessmentSubmissionRecord, SubmissionRecord};

/// Inserts a new code submission record atomically.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if database query fails.
pub async fn create_submission(
    pool: &PgPool,
    submission_id: Uuid,
    user_id: Option<Uuid>,
    problem_slug: &str,
    language: &str,
    code: &str,
    assessment_id: Option<Uuid>,
) -> Result<SubmissionRecord, DbError> {
    let record = sqlx::query_as::<_, SubmissionRecord>(
        r"
        INSERT INTO submissions (
            id, user_id, problem_slug, language, code,
            verdict, runtime_ms, memory_kb, testcases_passed, total_testcases,
            created_at, assessment_id
        )
        VALUES ($1, $2, $3, $4, $5, 'PENDING', 0, 0, 0, 0, NOW(), $6)
        RETURNING id, user_id, problem_slug, language, code, verdict,
                  runtime_ms, memory_kb, testcases_passed, total_testcases,
                  created_at, assessment_id, room_id
        ",
    )
    .bind(submission_id)
    .bind(user_id)
    .bind(problem_slug)
    .bind(language)
    .bind(code)
    .bind(assessment_id)
    .fetch_one(pool)
    .await
    .map_err(DbError::Sqlx)?;

    Ok(record)
}

/// Updates evaluation status and resource metrics of an existing submission.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if database update fails, or [`DbError::NotFound`] if the id does not exist.
pub async fn update_submission_status(
    pool: &PgPool,
    id: Uuid,
    verdict: &str,
    runtime_ms: i32,
    memory_kb: i32,
    testcases_passed: i32,
    total_testcases: i32,
) -> Result<SubmissionRecord, DbError> {
    let maybe_record = sqlx::query_as::<_, SubmissionRecord>(
        r"
        UPDATE submissions
        SET verdict = $2,
            runtime_ms = $3,
            memory_kb = $4,
            testcases_passed = $5,
            total_testcases = $6
        WHERE id = $1
        RETURNING id, user_id, problem_slug, language, code, verdict,
                  runtime_ms, memory_kb, testcases_passed, total_testcases,
                  created_at, assessment_id, room_id
        ",
    )
    .bind(id)
    .bind(verdict)
    .bind(runtime_ms)
    .bind(memory_kb)
    .bind(testcases_passed)
    .bind(total_testcases)
    .fetch_optional(pool)
    .await
    .map_err(DbError::Sqlx)?;

    maybe_record.ok_or_else(|| DbError::NotFound(format!("submission {id} not found")))
}

/// Finalizes an assessment submission, evaluating mathematical late penalties against deadline.
///
/// # Errors
/// Returns [`DbError::NotFound`] if assessment does not exist, or [`DbError::Sqlx`] on DB failure.
pub async fn finalize_assessment_submission(
    pool: &PgPool,
    assessment_id: Uuid,
    user_id: Uuid,
    submission_id: Uuid,
    raw_score: f64,
    submitted_at: DateTime<Utc>,
) -> Result<AssessmentSubmissionRecord, DbError> {
    let assessment = sqlx::query_as::<_, AssessmentRecord>(
        r"
        SELECT id, org_id, cohort_id, title, description, mode, status,
               problem_slugs, scoring_rubric, publish_at, starts_at, due_at, cutoff_at,
               duration_minutes, late_penalty_percent_per_hour, max_late_penalty_percent,
               proctoring_config, created_by, created_at, updated_at
        FROM assessments
        WHERE id = $1
        ",
    )
    .bind(assessment_id)
    .fetch_optional(pool)
    .await
    .map_err(DbError::Sqlx)?
    .ok_or_else(|| DbError::NotFound(format!("assessment {assessment_id} not found")))?;

    let penalty_result = judge_core::calculate_late_penalty(
        raw_score,
        assessment.due_at,
        submitted_at,
        assessment.late_penalty_percent_per_hour,
        assessment.max_late_penalty_percent,
    );

    let sub_record_id = Uuid::new_v4();
    let record = sqlx::query_as::<_, AssessmentSubmissionRecord>(
        r"
        INSERT INTO assessment_submissions (
            id, assessment_id, user_id, submission_id,
            raw_score, late_penalty_deduction, final_score,
            submitted_at, is_late, proctor_events_count, eval_verdict, feedback_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 'EVALUATED', NULL)
        RETURNING id, assessment_id, user_id, submission_id,
                  raw_score, late_penalty_deduction, final_score,
                  submitted_at, is_late, proctor_events_count, eval_verdict, feedback_notes
        ",
    )
    .bind(sub_record_id)
    .bind(assessment_id)
    .bind(user_id)
    .bind(submission_id)
    .bind(raw_score)
    .bind(penalty_result.late_penalty_deduction)
    .bind(penalty_result.final_score)
    .bind(submitted_at)
    .bind(penalty_result.is_late)
    .fetch_one(pool)
    .await
    .map_err(DbError::Sqlx)?;

    Ok(record)
}

/// Retrieves a submission by UUID.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if database lookup fails.
pub async fn get_submission_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<SubmissionRecord>, DbError> {
    sqlx::query_as::<_, SubmissionRecord>(
        r"
        SELECT id, user_id, problem_slug, language, code, verdict,
               runtime_ms, memory_kb, testcases_passed, total_testcases,
               created_at, assessment_id, room_id
        FROM submissions
        WHERE id = $1
        ",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(DbError::Sqlx)
}

/// Retrieves an assessment submission by assessment ID and candidate user ID.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if query fails.
pub async fn get_assessment_submission(
    pool: &PgPool,
    assessment_id: Uuid,
    user_id: Uuid,
) -> Result<Option<AssessmentSubmissionRecord>, DbError> {
    sqlx::query_as::<_, AssessmentSubmissionRecord>(
        r"
        SELECT id, assessment_id, user_id, submission_id,
               raw_score, late_penalty_deduction, final_score,
               submitted_at, is_late, proctor_events_count, eval_verdict, feedback_notes
        FROM assessment_submissions
        WHERE assessment_id = $1 AND user_id = $2
        ",
    )
    .bind(assessment_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(DbError::Sqlx)
}

/// Submission repository wrapper struct for ergonomic interaction.
#[derive(Debug, Clone)]
pub struct SubmissionRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> SubmissionRepository<'a> {
    #[must_use]
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Creates a submission.
    ///
    /// # Errors
    /// Returns [`DbError`] if database insertion fails.
    pub async fn create(
        &self,
        submission_id: Uuid,
        user_id: Option<Uuid>,
        problem_slug: &str,
        language: &str,
        code: &str,
        assessment_id: Option<Uuid>,
    ) -> Result<SubmissionRecord, DbError> {
        create_submission(
            self.pool,
            submission_id,
            user_id,
            problem_slug,
            language,
            code,
            assessment_id,
        )
        .await
    }

    /// Updates submission status.
    ///
    /// # Errors
    /// Returns [`DbError`] if database update fails.
    pub async fn update_status(
        &self,
        id: Uuid,
        verdict: &str,
        runtime_ms: i32,
        memory_kb: i32,
        testcases_passed: i32,
        total_testcases: i32,
    ) -> Result<SubmissionRecord, DbError> {
        update_submission_status(
            self.pool,
            id,
            verdict,
            runtime_ms,
            memory_kb,
            testcases_passed,
            total_testcases,
        )
        .await
    }

    /// Finalizes an assessment submission.
    ///
    /// # Errors
    /// Returns [`DbError`] if finalization evaluation fails.
    pub async fn finalize_assessment(
        &self,
        assessment_id: Uuid,
        user_id: Uuid,
        submission_id: Uuid,
        raw_score: f64,
        submitted_at: DateTime<Utc>,
    ) -> Result<AssessmentSubmissionRecord, DbError> {
        finalize_assessment_submission(
            self.pool,
            assessment_id,
            user_id,
            submission_id,
            raw_score,
            submitted_at,
        )
        .await
    }

    /// Fetches a submission by ID.
    ///
    /// # Errors
    /// Returns [`DbError`] if database lookup fails.
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<SubmissionRecord>, DbError> {
        get_submission_by_id(self.pool, id).await
    }
}

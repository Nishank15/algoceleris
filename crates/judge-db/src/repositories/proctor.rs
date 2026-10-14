use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::DbError;
use crate::models::{ProctorEventCounts, ProctorEventRecord};

/// Records a new behavioral proctoring incident for an assessment candidate.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if database query fails.
pub async fn record_proctor_event(
    pool: &PgPool,
    assessment_id: Uuid,
    user_id: Uuid,
    event_type: &str,
    severity: &str,
    metadata: serde_json::Value,
) -> Result<ProctorEventRecord, DbError> {
    let event_id = Uuid::new_v4();
    let record = sqlx::query_as::<_, ProctorEventRecord>(
        r"
        INSERT INTO proctor_events (
            id, assessment_id, user_id, event_type, severity, metadata, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, assessment_id, user_id, event_type, severity, metadata, created_at
        ",
    )
    .bind(event_id)
    .bind(assessment_id)
    .bind(user_id)
    .bind(event_type)
    .bind(severity)
    .bind(metadata)
    .fetch_one(pool)
    .await
    .map_err(DbError::Sqlx)?;

    Ok(record)
}

/// Retrieves aggregated violation counters for a candidate in an assessment.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if aggregation query fails.
pub async fn get_candidate_event_counts(
    pool: &PgPool,
    assessment_id: Uuid,
    user_id: Uuid,
) -> Result<ProctorEventCounts, DbError> {
    let counts = sqlx::query_as::<_, ProctorEventCounts>(
        r"
        SELECT 
            COUNT(*)::bigint AS total,
            COUNT(*) FILTER (WHERE event_type ILIKE 'tab_switch%')::bigint AS tab_switches,
            COUNT(*) FILTER (WHERE event_type ILIKE 'fullscreen%')::bigint AS fullscreen_exits,
            COUNT(*) FILTER (WHERE event_type ILIKE 'paste%')::bigint AS paste_bursts
        FROM proctor_events
        WHERE assessment_id = $1 AND user_id = $2
        ",
    )
    .bind(assessment_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(DbError::Sqlx)?;

    Ok(counts)
}

/// Lists recent proctor events for an assessment with pagination.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if query fails.
pub async fn list_assessment_events(
    pool: &PgPool,
    assessment_id: Uuid,
    limit: i64,
    offset: i64,
) -> Result<Vec<ProctorEventRecord>, DbError> {
    sqlx::query_as::<_, ProctorEventRecord>(
        r"
        SELECT id, assessment_id, user_id, event_type, severity, metadata, created_at
        FROM proctor_events
        WHERE assessment_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        ",
    )
    .bind(assessment_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(DbError::Sqlx)
}

/// Proctor event repository wrapper struct.
#[derive(Debug, Clone)]
pub struct ProctorRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> ProctorRepository<'a> {
    #[must_use]
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Records a proctoring event.
    ///
    /// # Errors
    /// Returns [`DbError`] if recording fails.
    pub async fn record_event(
        &self,
        assessment_id: Uuid,
        user_id: Uuid,
        event_type: &str,
        severity: &str,
        metadata: serde_json::Value,
    ) -> Result<ProctorEventRecord, DbError> {
        record_proctor_event(
            self.pool,
            assessment_id,
            user_id,
            event_type,
            severity,
            metadata,
        )
        .await
    }

    /// Fetches violation counts for a candidate.
    ///
    /// # Errors
    /// Returns [`DbError`] if query fails.
    pub async fn get_counts(
        &self,
        assessment_id: Uuid,
        user_id: Uuid,
    ) -> Result<ProctorEventCounts, DbError> {
        get_candidate_event_counts(self.pool, assessment_id, user_id).await
    }

    /// Lists proctoring events for an assessment.
    ///
    /// # Errors
    /// Returns [`DbError`] if query fails.
    pub async fn list_events(
        &self,
        assessment_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<ProctorEventRecord>, DbError> {
        list_assessment_events(self.pool, assessment_id, limit, offset).await
    }
}

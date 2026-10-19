//! Flexible `{assessment_id}` path identifier resolution.

use axum::extract::{FromRequestParts, Path};
use axum::http::request::Parts;
use judge_db::models::AssessmentRecord;
use uuid::Uuid;

use crate::errors::GatewayError;
use crate::routes::campus::lab_assessment_id_for_lab_code;
use crate::state::AppState;

/// Longest `assessment_id` path segment accepted before it is treated as malformed.
const MAX_ASSESSMENT_HANDLE_LEN: usize = 128;

/// Canonical assessment UUID resolved from the `{assessment_id}` path segment.
///
/// The canonical key for an assessment is a UUID, but seed data, fixtures and the SPA also address
/// assessments by short handles — a 1-based ordinal (`"1"`) or a curriculum slug such as
/// `"bacs101-lab-10"`. Binding the path segment straight to [`Uuid`] made axum reject every such
/// handle with `400 Bad Request` before the handler ran, even when the assessment existed.
///
/// This extractor captures the segment as text and resolves it through [`resolve_assessment_id`],
/// so handlers only ever observe a canonical UUID:
///
/// - a UUID, or a handle that resolves, yields the assessment key;
/// - structurally unusable input (empty, over-long) is a [`GatewayError::BadRequest`];
/// - a well-formed handle that matches no assessment is a [`GatewayError::NotFound`].
///
/// Because resolution reads the assessment store, handlers must declare their authorization
/// extractor *before* this one: `(State, RequireStudent, AssessmentId, Json(..))`. Reversing the
/// two would let an unauthenticated caller distinguish an existing handle from a missing one by
/// the status code alone.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AssessmentId(Uuid);

impl AssessmentId {
    /// Returns the canonical assessment UUID.
    #[must_use]
    pub fn into_uuid(self) -> Uuid {
        self.0
    }
}

impl FromRequestParts<AppState> for AssessmentId {
    type Rejection = GatewayError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let Path(raw) = Path::<String>::from_request_parts(parts, state)
            .await
            .map_err(|_| {
                GatewayError::BadRequest("assessment_id path segment is missing".to_string())
            })?;

        resolve_assessment_id(state, &raw).await.map(Self)
    }
}

/// Resolves a flexible assessment handle to the UUID that keys the record.
///
/// Handles are accepted in this order:
///
/// 1. **UUID** — the canonical key, returned as-is.
/// 2. **1-based ordinal** — the assessment at that position when the store is ordered by
///    `(publish_at, id)`, the ordering the cohort listing already uses. Ordering by the immutable
///    `id` as a tiebreaker keeps repeated calls pinned to the same record.
/// 3. **Curriculum slug** — first the assessment whose stored `problem_slugs` contain the handle
///    (the seeded labs publish their lab code there), then the deterministic lab-code mapping the
///    campus lab routes already rely on, which also resolves catalogue aliases such as
///    `bacs101-lab-11`.
///
/// # Errors
/// Returns [`GatewayError::BadRequest`] for empty or over-long handles and for the ordinal `0`;
/// returns [`GatewayError::NotFound`] when a well-formed handle matches no assessment, and
/// [`GatewayError::Database`] if the backing store cannot be read.
pub async fn resolve_assessment_id(state: &AppState, raw: &str) -> Result<Uuid, GatewayError> {
    let handle = raw.trim();

    if handle.is_empty() {
        return Err(GatewayError::BadRequest(
            "assessment_id must not be empty".to_string(),
        ));
    }
    if handle.len() > MAX_ASSESSMENT_HANDLE_LEN {
        return Err(GatewayError::BadRequest(format!(
            "assessment_id must be at most {MAX_ASSESSMENT_HANDLE_LEN} characters"
        )));
    }

    // 1. Canonical UUID: accepted verbatim, whether or not a record exists yet.
    if let Ok(id) = Uuid::parse_str(handle) {
        return Ok(id);
    }

    // 2. Ordinal handle over the store's published ordering.
    if let Ok(position) = handle.parse::<i64>() {
        if position < 1 {
            return Err(GatewayError::BadRequest(
                "assessment_id ordinals are 1-based".to_string(),
            ));
        }
        return nth_assessment_id(state, position)
            .await?
            .ok_or_else(|| GatewayError::NotFound(format!("Assessment '{handle}' not found")));
    }

    // 3. Curriculum slug: stored problem slugs first, then the deterministic lab-code catalogue.
    if let Some(id) = assessment_id_for_slug(state, handle).await? {
        return Ok(id);
    }
    if let Some(id) = lab_assessment_id_for_lab_code(handle) {
        return Ok(id);
    }

    Err(GatewayError::NotFound(format!(
        "Assessment '{handle}' not found"
    )))
}

/// Returns the assessment at a 1-based `position` in `(publish_at, id)` order, if any.
async fn nth_assessment_id(state: &AppState, position: i64) -> Result<Option<Uuid>, GatewayError> {
    if let Some(ref pool) = state.db {
        sqlx::query_scalar::<_, Uuid>(
            r"
            SELECT id
            FROM (
                SELECT id, row_number() OVER (ORDER BY publish_at ASC, id ASC) AS position
                FROM assessments
            ) ranked
            WHERE ranked.position = $1
            ",
        )
        .bind(position)
        .fetch_optional(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)
        .map_err(GatewayError::from)
    } else {
        let ordered = ordered_mock_assessments(state).await;
        Ok(ordered
            .into_iter()
            .nth(
                usize::try_from(position)
                    .unwrap_or(usize::MAX)
                    .wrapping_sub(1),
            )
            .map(|record| record.id))
    }
}

/// Returns the assessment whose stored problem slugs contain `slug`, if any.
async fn assessment_id_for_slug(
    state: &AppState,
    slug: &str,
) -> Result<Option<Uuid>, GatewayError> {
    if let Some(ref pool) = state.db {
        sqlx::query_scalar::<_, Uuid>(
            r"
            SELECT a.id
            FROM assessments a
            WHERE EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(a.problem_slugs::jsonb) AS entry(slug)
                WHERE entry.slug = $1
            )
            ORDER BY a.publish_at ASC, a.id ASC
            LIMIT 1
            ",
        )
        .bind(slug)
        .fetch_optional(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)
        .map_err(GatewayError::from)
    } else {
        let ordered = ordered_mock_assessments(state).await;
        Ok(ordered
            .into_iter()
            .find(|record| {
                record
                    .parse_problem_slugs()
                    .unwrap_or_default()
                    .iter()
                    .any(|entry| entry == slug)
            })
            .map(|record| record.id))
    }
}

/// Snapshot of the in-memory assessment store in the same `(publish_at, id)` order used by SQL.
async fn ordered_mock_assessments(state: &AppState) -> Vec<AssessmentRecord> {
    let assessments = state.mock_campus.assessments.read().await;
    let mut records: Vec<AssessmentRecord> = assessments.values().cloned().collect();
    records.sort_by(|a, b| {
        a.publish_at
            .cmp(&b.publish_at)
            .then_with(|| a.id.cmp(&b.id))
    });
    records
}

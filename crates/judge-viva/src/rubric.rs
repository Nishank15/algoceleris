//! Rubric evaluation validation, weighted score computation, and database persistence.

use judge_core::assessment::validate_rubric_balance;
use judge_core::models::RubricCriterion;
use judge_db::{DbError, DbPool, InterviewRoomRecord};
use serde::{Deserialize, Serialize};

use crate::errors::VivaError;

/// Evaluation payload submitted by viva evaluators / instructors.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RubricEvaluationUpdate {
    /// Mapping of criterion identifier (UUID string or name) to awarded numeric score.
    pub rubric_scores: serde_json::Value,
    /// Confidential interviewer notes (must NEVER be exposed to candidate peers).
    #[serde(default)]
    pub interviewer_notes: Option<String>,
}

impl RubricEvaluationUpdate {
    /// Creates a new `RubricEvaluationUpdate`.
    #[must_use]
    pub fn new(rubric_scores: serde_json::Value, interviewer_notes: Option<String>) -> Self {
        Self {
            rubric_scores,
            interviewer_notes,
        }
    }

    /// Validates that evaluation scores adhere to defined rubric criteria constraints:
    /// - Criteria weights must balance to exactly 100.0% (validated via [`judge_core`]).
    /// - `rubric_scores` must be a JSON object.
    /// - Each score must be a number within `0.0 ..= criterion.max_points`.
    ///
    /// # Errors
    /// Returns [`VivaError::InvalidRubricEvaluation`] or [`VivaError::Domain`] if invalid.
    pub fn validate(&self, criteria: &[RubricCriterion]) -> Result<(), VivaError> {
        validate_rubric_balance(criteria)?;

        let scores_obj = self.rubric_scores.as_object().ok_or_else(|| {
            VivaError::InvalidRubricEvaluation("rubric_scores must be a JSON object".to_string())
        })?;

        for criterion in criteria {
            let key_str = criterion.id.to_string();
            // Allow lookup by criterion UUID string or name
            let score_val = scores_obj
                .get(&key_str)
                .or_else(|| scores_obj.get(&criterion.name));

            if let Some(val) = score_val {
                let score = val.as_f64().ok_or_else(|| {
                    VivaError::InvalidRubricEvaluation(format!(
                        "score for criterion '{}' must be a numeric value",
                        criterion.name
                    ))
                })?;

                if score < 0.0 || score > criterion.max_points {
                    return Err(VivaError::InvalidRubricEvaluation(format!(
                        "score {score} for criterion '{}' out of range [0.0, {}]",
                        criterion.name, criterion.max_points
                    )));
                }
            }
        }

        Ok(())
    }

    /// Calculates the normalized final percentage score across all balanced criteria.
    ///
    /// Formula:
    /// $\text{final\_score} = \sum_{i} \left( \frac{\text{awarded}_i}{\text{max\_points}_i} \times \text{weight}_i \right)$
    ///
    /// # Errors
    /// Returns [`VivaError::InvalidRubricEvaluation`] if criterion scores are invalid or missing.
    pub fn calculate_weighted_score(&self, criteria: &[RubricCriterion]) -> Result<f64, VivaError> {
        self.validate(criteria)?;

        let scores_obj = self.rubric_scores.as_object().ok_or_else(|| {
            VivaError::InvalidRubricEvaluation("rubric_scores must be a JSON object".to_string())
        })?;

        let mut total_score = 0.0;
        for criterion in criteria {
            let key_str = criterion.id.to_string();
            let score_val = scores_obj
                .get(&key_str)
                .or_else(|| scores_obj.get(&criterion.name));

            let score = match score_val {
                Some(val) => val.as_f64().ok_or_else(|| {
                    VivaError::InvalidRubricEvaluation(format!(
                        "score for criterion '{}' must be a numeric value",
                        criterion.name
                    ))
                })?,
                None => 0.0,
            };

            if criterion.max_points > 0.0 {
                let criterion_ratio = score / criterion.max_points;
                total_score += criterion_ratio * criterion.weight;
            }
        }

        Ok((total_score * 100.0).round() / 100.0)
    }
}

/// Persists the rubric evaluation update to the PostgreSQL database for the given room code.
///
/// Updates `rubric_scores` and optionally `interviewer_notes` on `interview_rooms`.
///
/// # Errors
/// Returns [`VivaError::DatabaseError`] or [`VivaError::RoomNotFound`] if the update fails.
pub async fn persist_rubric_evaluation(
    pool: &DbPool,
    room_code: &str,
    update: &RubricEvaluationUpdate,
) -> Result<InterviewRoomRecord, VivaError> {
    let notes = update.interviewer_notes.as_deref();

    let record = sqlx::query_as::<sqlx::Postgres, InterviewRoomRecord>(
        r"
        UPDATE interview_rooms
        SET rubric_scores = $1,
            interviewer_notes = COALESCE($2, interviewer_notes),
            updated_at = NOW()
        WHERE room_code = $3
        RETURNING id, room_code, org_id, assessment_id, host_user_id, candidate_user_id,
                  language, status, editor_code, interviewer_notes, rubric_scores,
                  created_at, updated_at
        ",
    )
    .bind(&update.rubric_scores)
    .bind(notes)
    .bind(room_code)
    .fetch_optional(pool.inner())
    .await
    .map_err(DbError::Sqlx)?
    .ok_or_else(|| VivaError::RoomNotFound(format!("interview room '{room_code}' not found")))?;

    Ok(record)
}

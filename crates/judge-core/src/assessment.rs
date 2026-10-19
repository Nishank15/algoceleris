use crate::errors::DomainError;
use crate::models::{AssessmentStatus, LatePenaltyResult, RubricCriterion};
use chrono::{DateTime, Utc};

/// Validates the chronological timeline ordering of an assessment:
/// `publish_at <= starts_at <= due_at <= cutoff_at`
///
/// # Errors
/// Returns [`DomainError::TimelineParadox`] if timestamps are inverted.
pub fn validate_assessment_timeline(
    publish_at: DateTime<Utc>,
    starts_at: DateTime<Utc>,
    due_at: DateTime<Utc>,
    cutoff_at: DateTime<Utc>,
) -> Result<(), DomainError> {
    if publish_at > starts_at {
        return Err(DomainError::TimelineParadox {
            message: format!("publish_at ({publish_at}) occurs after starts_at ({starts_at})"),
        });
    }
    if starts_at > due_at {
        return Err(DomainError::TimelineParadox {
            message: format!("starts_at ({starts_at}) occurs after due_at ({due_at})"),
        });
    }
    if due_at > cutoff_at {
        return Err(DomainError::TimelineParadox {
            message: format!("due_at ({due_at}) occurs after cutoff_at ({cutoff_at})"),
        });
    }
    Ok(())
}

/// Evaluates state machine transition between two assessment states.
///
/// Valid transitions:
/// - `Draft -> Scheduled`
/// - `Draft -> Active`
/// - `Scheduled -> Active`
/// - `Scheduled -> Closed`
/// - `Active -> GracePeriod`
/// - `Active -> Closed`
/// - `GracePeriod -> Closed`
/// - `Current == Target` (idempotent no-op)
///
/// # Errors
/// Returns [`DomainError::InvalidStateTransition`] for forbidden transitions.
pub fn transition_assessment_state(
    current: AssessmentStatus,
    target: AssessmentStatus,
) -> Result<AssessmentStatus, DomainError> {
    if current == target {
        return Ok(target);
    }

    match (current, target) {
        (AssessmentStatus::Draft, AssessmentStatus::Scheduled | AssessmentStatus::Active)
        | (AssessmentStatus::Scheduled, AssessmentStatus::Active | AssessmentStatus::Closed)
        | (AssessmentStatus::Active, AssessmentStatus::GracePeriod | AssessmentStatus::Closed)
        | (AssessmentStatus::GracePeriod, AssessmentStatus::Closed) => Ok(target),
        _ => Err(DomainError::InvalidStateTransition {
            from: format!("{current:?}"),
            to: format!("{target:?}"),
        }),
    }
}

/// Calculates late penalty deductions based on mathematical models:
/// `hours_late = ceil(seconds_late / 3600)`
/// `penalty_percent = min(max_penalty, hours_late * rate_per_hour)`
/// `deduction = round(raw_score * penalty_percent / 100, 2)`
/// `final_score = max(0.0, raw_score - deduction)`
#[must_use]
pub fn calculate_late_penalty(
    raw_score: f64,
    due_at: DateTime<Utc>,
    submitted_at: DateTime<Utc>,
    late_penalty_percent_per_hour: f64,
    max_late_penalty_percent: f64,
) -> LatePenaltyResult {
    if submitted_at <= due_at {
        return LatePenaltyResult {
            is_late: false,
            hours_late: 0,
            seconds_late: 0.0,
            penalty_percent: 0.0,
            late_penalty_deduction: 0.0,
            final_score: raw_score,
        };
    }

    #[allow(clippy::cast_precision_loss)]
    let seconds_late = (submitted_at - due_at).num_seconds() as f64;
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let hours_late = ((seconds_late / 3600.0).ceil() as u32).max(1);

    let calculated_pct = f64::from(hours_late) * late_penalty_percent_per_hour;
    let penalty_percent = calculated_pct
        .min(max_late_penalty_percent)
        .clamp(0.0, 100.0);

    let deduction = (raw_score * (penalty_percent / 100.0) * 100.0).round() / 100.0;
    let final_score = (raw_score - deduction).max(0.0);

    LatePenaltyResult {
        is_late: true,
        hours_late,
        seconds_late,
        penalty_percent,
        late_penalty_deduction: deduction,
        final_score,
    }
}

/// Validates that rubric criteria weights balance to exactly 100.0% ($\pm 0.001$).
///
/// # Errors
/// Returns [`DomainError::UnbalancedRubricWeights`] if weights do not sum to 100.0%.
pub fn validate_rubric_balance(criteria: &[RubricCriterion]) -> Result<(), DomainError> {
    let total_weight: f64 = criteria.iter().map(|c| c.weight).sum();
    if (total_weight - 100.0).abs() > 0.001 {
        return Err(DomainError::UnbalancedRubricWeights {
            sum: format!("{total_weight:.2}"),
        });
    }
    Ok(())
}

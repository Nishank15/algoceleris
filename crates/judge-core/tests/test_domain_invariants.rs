use chrono::{Duration, Utc};
use judge_core::assessment::{
    calculate_late_penalty, transition_assessment_state, validate_assessment_timeline,
    validate_rubric_balance,
};
use judge_core::errors::DomainError;
use judge_core::models::{AssessmentStatus, RiskSeverity, RubricCriterion};
use judge_core::proctor::calculate_risk_score;
use uuid::Uuid;

#[test]
fn test_timeline_invariant_valid_ordering() {
    let now = Utc::now();
    let publish_at = now;
    let starts_at = now + Duration::hours(1);
    let due_at = now + Duration::hours(3);
    let cutoff_at = now + Duration::hours(4);

    let result = validate_assessment_timeline(publish_at, starts_at, due_at, cutoff_at);
    assert!(result.is_ok());
}

#[test]
fn test_timeline_invariant_rejects_paradox() {
    let now = Utc::now();
    // Starts after due date
    let publish_at = now;
    let starts_at = now + Duration::hours(4);
    let due_at = now + Duration::hours(2);
    let cutoff_at = now + Duration::hours(5);

    let result = validate_assessment_timeline(publish_at, starts_at, due_at, cutoff_at);
    assert!(matches!(
        result,
        Err(DomainError::TimelineParadox { .. })
    ));

    // Due after cutoff date
    let due_after_cutoff = validate_assessment_timeline(
        now,
        now + Duration::hours(1),
        now + Duration::hours(6),
        now + Duration::hours(5),
    );
    assert!(matches!(
        due_after_cutoff,
        Err(DomainError::TimelineParadox { .. })
    ));
}

#[test]
fn test_late_penalty_formula_parity() {
    let now = Utc::now();
    let due_at = now;
    // 1.5 hours late -> ceil to 2 hours late
    // 15% rate per hour -> 30% penalty
    // 30% cap -> penalty = min(30%, 30%) = 30%
    // Raw 100 -> deduction 30.0, final 70.0
    let submitted_at = due_at + Duration::minutes(90);
    let res = calculate_late_penalty(100.0, due_at, submitted_at, 15.0, 30.0);

    assert!(res.is_late);
    assert_eq!(res.hours_late, 2);
    assert!((res.penalty_percent - 30.0).abs() < 1e-4);
    assert!((res.late_penalty_deduction - 30.0).abs() < 1e-4);
    assert!((res.final_score - 70.0).abs() < 1e-4);

    // On-time submission has 0 deduction
    let on_time_submission = due_at - Duration::minutes(10);
    let on_time_res = calculate_late_penalty(100.0, due_at, on_time_submission, 15.0, 30.0);
    assert!(!on_time_res.is_late);
    assert_eq!(on_time_res.hours_late, 0);
    assert!((on_time_res.late_penalty_deduction - 0.0).abs() < 1e-4);
    assert!((on_time_res.final_score - 100.0).abs() < 1e-4);
}

#[test]
fn test_assessment_state_machine_valid_transitions() {
    // Valid: Draft -> Scheduled -> Active -> GracePeriod -> Closed
    assert_eq!(
        transition_assessment_state(AssessmentStatus::Draft, AssessmentStatus::Scheduled).unwrap(),
        AssessmentStatus::Scheduled
    );
    assert_eq!(
        transition_assessment_state(AssessmentStatus::Scheduled, AssessmentStatus::Active).unwrap(),
        AssessmentStatus::Active
    );
    assert_eq!(
        transition_assessment_state(AssessmentStatus::Active, AssessmentStatus::GracePeriod).unwrap(),
        AssessmentStatus::GracePeriod
    );
    assert_eq!(
        transition_assessment_state(AssessmentStatus::GracePeriod, AssessmentStatus::Closed).unwrap(),
        AssessmentStatus::Closed
    );
    // Direct early termination from Active -> Closed
    assert_eq!(
        transition_assessment_state(AssessmentStatus::Active, AssessmentStatus::Closed).unwrap(),
        AssessmentStatus::Closed
    );
}

#[test]
fn test_assessment_state_machine_rejects_illegal_leaps() {
    // Cannot leap from Draft directly to GracePeriod
    let invalid_leap = transition_assessment_state(AssessmentStatus::Draft, AssessmentStatus::GracePeriod);
    assert!(matches!(
        invalid_leap,
        Err(DomainError::InvalidStateTransition { .. })
    ));

    // Cannot transition from Closed to Active (terminal state)
    let revive_closed = transition_assessment_state(AssessmentStatus::Closed, AssessmentStatus::Active);
    assert!(matches!(
        revive_closed,
        Err(DomainError::InvalidStateTransition { .. })
    ));
}

#[test]
fn test_proctor_risk_score_aggregation() {
    // Tab switches: 5 pts, Fullscreen exits: 10 pts, Paste bursts: 15 pts
    // Case 1: 1 tab switch (5 pts) -> Low (< 15)
    let low_risk = calculate_risk_score(1, 0, 0);
    assert_eq!(low_risk.score, 5);
    assert_eq!(low_risk.severity, RiskSeverity::Low);

    // Case 2: 2 tab switches + 1 fullscreen exit = 10 + 10 = 20 pts -> Elevated (15..=34)
    let elevated_risk = calculate_risk_score(2, 1, 0);
    assert_eq!(elevated_risk.score, 20);
    assert_eq!(elevated_risk.severity, RiskSeverity::Elevated);

    // Case 3: 1 fullscreen exit + 2 paste bursts = 10 + 30 = 40 pts -> Critical (>= 35)
    let critical_risk = calculate_risk_score(0, 1, 2);
    assert_eq!(critical_risk.score, 40);
    assert_eq!(critical_risk.severity, RiskSeverity::Critical);
}

#[test]
fn test_rubric_balance_validation() {
    // Valid balanced rubric: 40% + 30% + 30% = 100.0%
    let balanced = vec![
        RubricCriterion {
            id: Uuid::new_v4(),
            name: "Algorithmic Correctness".to_string(),
            weight: 40.0,
            max_points: 100.0,
        },
        RubricCriterion {
            id: Uuid::new_v4(),
            name: "Code Cleanliness".to_string(),
            weight: 30.0,
            max_points: 100.0,
        },
        RubricCriterion {
            id: Uuid::new_v4(),
            name: "Time/Space Optimization".to_string(),
            weight: 30.0,
            max_points: 100.0,
        },
    ];
    assert!(validate_rubric_balance(&balanced).is_ok());

    // Unbalanced rubric: 40% + 40% = 80.0%
    let unbalanced = vec![
        RubricCriterion {
            id: Uuid::new_v4(),
            name: "Part 1".to_string(),
            weight: 40.0,
            max_points: 100.0,
        },
        RubricCriterion {
            id: Uuid::new_v4(),
            name: "Part 2".to_string(),
            weight: 40.0,
            max_points: 100.0,
        },
    ];
    assert!(matches!(
        validate_rubric_balance(&unbalanced),
        Err(DomainError::UnbalancedRubricWeights { .. })
    ));
}

//! # judge-core
//!
//! Pure domain entities, mathematical formulas, state machine invariants,
//! and error definitions for `AlgoCeleris` / Cloud-Judge V2.
//!
//! Operational Invariant: Absolute Zero-I/O. No networking, file system, or database dependencies.

pub mod assessment;
pub mod errors;
pub mod models;
pub mod proctor;

pub use assessment::{
    calculate_late_penalty, transition_assessment_state, validate_assessment_timeline,
    validate_rubric_balance,
};
pub use errors::DomainError;
pub use models::{
    Assessment, AssessmentMode, AssessmentStatus, AssessmentSubmission, CampusRole, Cohort,
    Language, LatePenaltyResult, MembershipStatus, Organization, RiskScore, RiskSeverity,
    RubricCriterion, Submission, Verdict,
};
pub use proctor::calculate_risk_score;

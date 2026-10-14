use thiserror::Error;

#[derive(Debug, Clone, Error, PartialEq, Eq)]
pub enum DomainError {
    #[error("assessment timeline paradox: {message}")]
    TimelineParadox { message: String },

    #[error("invalid state transition from {from:?} to {to:?}")]
    InvalidStateTransition { from: String, to: String },

    #[error("unbalanced rubric weights: sum is {sum}%, expected exactly 100.0%")]
    UnbalancedRubricWeights { sum: String },

    #[error("assessment is closed")]
    AssessmentClosed,

    #[error("deadline exceeded: cutoff passed")]
    CutoffExceeded,

    #[error("invalid penalty percentage: {0}, must be between 0 and 100")]
    InvalidPenalty(u32),

    #[error("not found: {0}")]
    NotFound(String),
}

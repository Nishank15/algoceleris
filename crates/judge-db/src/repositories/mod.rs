//! Repositories for atomic transactions, batch ingestion, and relational persistence.

pub mod assessment;
pub mod membership;
pub mod problem;
pub mod proctor;
pub mod submission;

pub use assessment::{
    create_assessment, get_assessment_by_id, list_active_assessments, list_cohort_assessments,
    update_assessment_status, AssessmentRepository,
};
pub use membership::{
    batch_insert_memberships, build_batch_insert_query, list_cohort_memberships,
    MembershipRepository,
};
pub use problem::{
    get_problem_by_id, list_all_sample_test_cases, list_problem_test_cases,
    list_published_problems, seed_problem_catalog, ProblemRepository,
};
pub use proctor::{
    get_candidate_event_counts, list_assessment_events, record_proctor_event, ProctorRepository,
};
pub use submission::{
    create_submission, finalize_assessment_submission, get_assessment_submission,
    get_submission_by_id, update_submission_status, SubmissionRepository,
};

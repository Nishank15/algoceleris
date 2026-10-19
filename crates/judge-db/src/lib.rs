//! # judge-db
//!
//! PostgreSQL 16 persistence, async connection pooling, and transactional
//! repositories for `AlgoCeleris` / Cloud-Judge V2.

pub mod errors;
pub mod models;
pub mod pool;
pub mod problem_catalog;
pub mod repositories;

pub use errors::DbError;
pub use models::{
    AssessmentRecord, AssessmentSubmissionRecord, CohortRecord, HackathonRecord,
    HackathonRegistrationRecord, HackathonSubmissionRecord, HackathonTeamMemberRecord,
    HackathonTeamRecord, InterviewRoomRecord, NewMember, OrgMembershipRecord, OrganizationRecord,
    ProblemRecord, ProblemTestCaseRecord, ProctorEventCounts, ProctorEventRecord, SubmissionRecord,
    UserRecord,
};
pub use pool::{check_health, create_connection_pool, DbPool};
pub use repositories::{
    batch_insert_memberships, build_batch_insert_query, create_assessment, create_submission,
    finalize_assessment_submission, get_assessment_by_id, get_assessment_submission,
    get_candidate_event_counts, get_problem_by_id, get_submission_by_id, list_active_assessments,
    list_all_sample_test_cases, list_assessment_events, list_cohort_assessments,
    list_cohort_memberships, list_problem_test_cases, list_published_problems,
    record_proctor_event, seed_problem_catalog, update_assessment_status, update_submission_status,
    AssessmentRepository, MembershipRepository, ProblemRepository, ProctorRepository,
    SubmissionRepository,
};

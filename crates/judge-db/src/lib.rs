//! # judge-db
//!
//! PostgreSQL 16 persistence, async connection pooling, and transactional
//! repositories for `AlgoCeleris` / Cloud-Judge V2.

pub mod errors;
pub mod models;
pub mod pool;
pub mod repositories;

pub use errors::DbError;
pub use models::{
    AssessmentRecord, AssessmentSubmissionRecord, CohortRecord, InterviewRoomRecord, NewMember,
    OrgMembershipRecord, OrganizationRecord, ProctorEventCounts, ProctorEventRecord,
    SubmissionRecord, UserRecord,
};
pub use pool::{check_health, create_connection_pool, DbPool};
pub use repositories::{
    batch_insert_memberships, build_batch_insert_query, create_assessment, create_submission,
    finalize_assessment_submission, get_assessment_by_id, get_assessment_submission,
    get_candidate_event_counts, get_submission_by_id, list_active_assessments,
    list_assessment_events, list_cohort_assessments, list_cohort_memberships, record_proctor_event,
    update_assessment_status, update_submission_status, AssessmentRepository, MembershipRepository,
    ProctorRepository, SubmissionRepository,
};

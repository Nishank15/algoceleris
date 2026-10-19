//! Axum request extractors for multi-tenant campus authorization and identifier resolution.

pub mod assessment_id;
pub mod rbac;

pub use assessment_id::{resolve_assessment_id, AssessmentId};
pub use rbac::{
    role_level, AuthenticatedUser, OptionalUser, RequireInstructor, RequireOrgAdmin, RequireStudent,
};

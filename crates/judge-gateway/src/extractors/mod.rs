//! Axum request extractors for multi-tenant campus authorization.

pub mod rbac;

pub use rbac::{
    role_level, AuthenticatedUser, OptionalUser, RequireInstructor, RequireOrgAdmin, RequireStudent,
};

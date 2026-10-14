//! Multi-tenant RBAC extractors enforcing campus organizational role hierarchies.

use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;
use judge_db::models::OrgMembershipRecord;
use uuid::Uuid;

use crate::auth::{decode_access_token, AccessTokenClaims};
use crate::errors::GatewayError;
use crate::state::AppState;

/// Maps a role name to its hierarchical authorization level.
#[must_use]
pub fn role_level(role: &str) -> u32 {
    match role.to_lowercase().as_str() {
        "admin" | "org_admin" | "orgadmin" => 40,
        "instructor" | "evaluator" | "host" => 30,
        "teaching_assistant" | "ta" => 20,
        "student" | "candidate" | "free" | "pro" => 10,
        _ => 0,
    }
}

/// Extracted authenticated user claims from bearer token.
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    /// Authenticated user identifier.
    pub user_id: Uuid,
    /// Verified access token claims.
    pub claims: AccessTokenClaims,
}

impl FromRequestParts<AppState> for AuthenticatedUser {
    type Rejection = GatewayError;

    #[allow(clippy::unused_async_trait_impl)]
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let auth_hdr = parts
            .headers
            .get(AUTHORIZATION)
            .ok_or_else(|| GatewayError::Unauthorized("Missing Authorization header".to_string()))?
            .to_str()
            .map_err(|_| GatewayError::Unauthorized("Invalid Authorization header encoding".to_string()))?;

        let token = auth_hdr
            .strip_prefix("Bearer ")
            .or_else(|| auth_hdr.strip_prefix("bearer "))
            .ok_or_else(|| {
                GatewayError::Unauthorized("Authorization scheme must be Bearer".to_string())
            })?
            .trim();

        let claims = decode_access_token(token, &state.jwt_secret)?;
        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|_| GatewayError::Unauthorized("Malformed user ID in token".to_string()))?;

        Ok(Self { user_id, claims })
    }
}

/// Extractor for optional authentication credentials.
#[derive(Debug, Clone, Default)]
pub struct OptionalUser(pub Option<AuthenticatedUser>);

impl FromRequestParts<AppState> for OptionalUser {
    type Rejection = std::convert::Infallible;

    #[allow(clippy::unused_async_trait_impl)]
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let auth = AuthenticatedUser::from_request_parts(parts, state).await.ok();
        Ok(Self(auth))
    }
}

/// Helper extracting target `org_id` from request headers, query, or path.
fn resolve_target_org_id(parts: &Parts) -> Option<Uuid> {
    // 1. Header: X-Org-ID or x-org-id
    if let Some(val) = parts.headers.get("x-org-id").or_else(|| parts.headers.get("X-Org-ID")) {
        if let Ok(s) = val.to_str() {
            if let Ok(uid) = Uuid::parse_str(s.trim()) {
                return Some(uid);
            }
        }
    }

    // 2. Query string: ?org_id=...
    if let Some(query) = parts.uri.query() {
        for param in query.split('&') {
            if let Some(val) = param.strip_prefix("org_id=") {
                if let Ok(uid) = Uuid::parse_str(val.trim()) {
                    return Some(uid);
                }
            }
        }
    }

    // 3. Path parameter: /orgs/{uuid}/...
    let path = parts.uri.path();
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    for i in 0..segments.len() {
        if segments[i] == "orgs" && i + 1 < segments.len() {
            if let Ok(uid) = Uuid::parse_str(segments[i + 1]) {
                return Some(uid);
            }
        }
    }

    None
}

/// Helper extracting target `cohort_id` from request path or query.
fn resolve_target_cohort_id(parts: &Parts) -> Option<Uuid> {
    if let Some(query) = parts.uri.query() {
        for param in query.split('&') {
            if let Some(val) = param.strip_prefix("cohort_id=") {
                if let Ok(uid) = Uuid::parse_str(val.trim()) {
                    return Some(uid);
                }
            }
        }
    }

    let path = parts.uri.path();
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    for i in 0..segments.len() {
        if segments[i] == "cohorts" && i + 1 < segments.len() {
            if let Ok(uid) = Uuid::parse_str(segments[i + 1]) {
                return Some(uid);
            }
        }
    }

    None
}

/// Helper extracting target `assessment_id` from request path or query.
fn resolve_target_assessment_id(parts: &Parts) -> Option<Uuid> {
    if let Some(query) = parts.uri.query() {
        for param in query.split('&') {
            if let Some(val) = param.strip_prefix("assessment_id=") {
                if let Ok(uid) = Uuid::parse_str(val.trim()) {
                    return Some(uid);
                }
            }
        }
    }

    let path = parts.uri.path();
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    for i in 0..segments.len() {
        if segments[i] == "assessments" && i + 1 < segments.len() {
            if let Ok(uid) = Uuid::parse_str(segments[i + 1]) {
                return Some(uid);
            }
        }
    }

    None
}

/// Verifies user permissions against organization membership or token role level.
async fn verify_role_level(
    parts: &Parts,
    state: &AppState,
    auth: &AuthenticatedUser,
    required_level: u32,
    required_name: &str,
) -> Result<(Option<Uuid>, Option<OrgMembershipRecord>), GatewayError> {
    let mut target_org_id = resolve_target_org_id(parts);

    // If org_id is not in path, try resolving via cohort_id if present
    if target_org_id.is_none() {
        if let Some(cohort_id) = resolve_target_cohort_id(parts) {
            if let Some(ref pool) = state.db {
                let row = sqlx::query_scalar::<sqlx::Postgres, Uuid>(
                    "SELECT org_id FROM cohorts WHERE id = $1 LIMIT 1",
                )
                .bind(cohort_id)
                .fetch_optional(pool.inner())
                .await
                .map_err(judge_db::DbError::Sqlx)?;

                target_org_id = row;
            } else {
                let cohorts = state.mock_campus.cohorts.read().await;
                if let Some(cohort) = cohorts.get(&cohort_id) {
                    target_org_id = Some(cohort.org_id);
                }
            }
        }
    }

    // If org_id is still not found, try resolving via assessment_id if present
    if target_org_id.is_none() {
        if let Some(assessment_id) = resolve_target_assessment_id(parts) {
            if let Some(ref pool) = state.db {
                let row = sqlx::query_scalar::<sqlx::Postgres, Uuid>(
                    "SELECT org_id FROM assessments WHERE id = $1 LIMIT 1",
                )
                .bind(assessment_id)
                .fetch_optional(pool.inner())
                .await
                .map_err(judge_db::DbError::Sqlx)?;

                target_org_id = row;
            } else {
                let assessments = state.mock_campus.assessments.read().await;
                if let Some(assessment) = assessments.get(&assessment_id) {
                    target_org_id = Some(assessment.org_id);
                }
            }
        }
    }

    let token_level = role_level(&auth.claims.role);

    // If an organization scope is specified, enforce organization membership check
    if let Some(org_id) = target_org_id {
        if let Some(ref pool) = state.db {
            let membership = sqlx::query_as::<sqlx::Postgres, OrgMembershipRecord>(
                r"
                SELECT id, org_id, user_id, cohort_id, role, status, created_at
                FROM org_memberships
                WHERE org_id = $1 AND user_id = $2 AND status = 'active'
                LIMIT 1
                ",
            )
            .bind(org_id)
            .bind(auth.user_id)
            .fetch_optional(pool.inner())
            .await
            .map_err(judge_db::DbError::Sqlx)?;

            if let Some(mem) = membership {
                let member_level = role_level(&mem.role);
                if member_level >= required_level || token_level >= 40 {
                    return Ok((Some(org_id), Some(mem)));
                }
                return Err(GatewayError::Forbidden(format!(
                    "Required role {required_name}, but user has role '{}'",
                    mem.role
                )));
            }

            // If no membership found, global system admins are still permitted
            if token_level >= 40 {
                return Ok((Some(org_id), None));
            }

            return Err(GatewayError::Forbidden(format!(
                "User is not an active member of organization '{org_id}'"
            )));
        }

        // Mock in-memory mode
        let memberships = state.mock_campus.memberships.read().await;
        if let Some(mem) = memberships.get(&(org_id, auth.user_id)) {
            let member_level = role_level(&mem.role);
            if member_level >= required_level || token_level >= 40 {
                return Ok((Some(org_id), Some(mem.clone())));
            }
            return Err(GatewayError::Forbidden(format!(
                "Required role {required_name}, but user has role '{}'",
                mem.role
            )));
        }

        // If no membership record in mock store, fall back to token role level
        if token_level >= required_level {
            return Ok((Some(org_id), None));
        }

        return Err(GatewayError::Forbidden(format!(
            "User is not a member of organization '{org_id}'"
        )));
    }

    // No organization scope: evaluate token role level directly
    if token_level >= required_level {
        return Ok((None, None));
    }

    Err(GatewayError::Forbidden(format!(
        "Required role {required_name}, but token has role '{}'",
        auth.claims.role
    )))
}

/// Extractor requiring Organization Administrator (`org_admin` or `admin`).
#[derive(Debug, Clone)]
pub struct RequireOrgAdmin {
    /// Authenticated user ID.
    pub user_id: Uuid,
    /// Target organization ID if resolved.
    pub org_id: Option<Uuid>,
    /// Access token claims.
    pub claims: AccessTokenClaims,
    /// Active organization membership record if found.
    pub membership: Option<OrgMembershipRecord>,
}

impl FromRequestParts<AppState> for RequireOrgAdmin {
    type Rejection = GatewayError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let auth = AuthenticatedUser::from_request_parts(parts, state).await?;
        let (org_id, membership) =
            verify_role_level(parts, state, &auth, 40, "org_admin").await?;

        Ok(Self {
            user_id: auth.user_id,
            org_id,
            claims: auth.claims,
            membership,
        })
    }
}

/// Extractor requiring Instructor (`instructor`, `org_admin`, or `admin`).
#[derive(Debug, Clone)]
pub struct RequireInstructor {
    /// Authenticated user ID.
    pub user_id: Uuid,
    /// Target organization ID if resolved.
    pub org_id: Option<Uuid>,
    /// Access token claims.
    pub claims: AccessTokenClaims,
    /// Active organization membership record if found.
    pub membership: Option<OrgMembershipRecord>,
}

impl FromRequestParts<AppState> for RequireInstructor {
    type Rejection = GatewayError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let auth = AuthenticatedUser::from_request_parts(parts, state).await?;
        let (org_id, membership) =
            verify_role_level(parts, state, &auth, 30, "instructor").await?;

        Ok(Self {
            user_id: auth.user_id,
            org_id,
            claims: auth.claims,
            membership,
        })
    }
}

/// Extractor requiring Student (enrolled tenant member: `student`, `instructor`, `org_admin`, etc.).
#[derive(Debug, Clone)]
pub struct RequireStudent {
    /// Authenticated user ID.
    pub user_id: Uuid,
    /// Target organization ID if resolved.
    pub org_id: Option<Uuid>,
    /// Access token claims.
    pub claims: AccessTokenClaims,
    /// Active organization membership record if found.
    pub membership: Option<OrgMembershipRecord>,
}

impl FromRequestParts<AppState> for RequireStudent {
    type Rejection = GatewayError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let auth = AuthenticatedUser::from_request_parts(parts, state).await?;
        let (org_id, membership) =
            verify_role_level(parts, state, &auth, 10, "student").await?;

        Ok(Self {
            user_id: auth.user_id,
            org_id,
            claims: auth.claims,
            membership,
        })
    }
}

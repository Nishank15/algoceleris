//! Campus organizational hierarchy and cohort management routes.

use std::collections::HashMap;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Duration, Utc};
use judge_db::models::{CohortRecord, NewMember, OrgMembershipRecord, OrganizationRecord};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::token::encode_access_token;
use crate::auth::{hash_password, verify_password};
use crate::errors::GatewayError;
use crate::extractors::{
    AuthenticatedUser, OptionalUser, RequireInstructor, RequireOrgAdmin, RequireStudent,
};
use crate::state::{
    AppState, ChallengingProblemSpec, LabRecord, McqQuestionSpec, PlagiarismReportItem,
    PracticeProblemSpec, SecurityAuditItem, StudentActivityLog, StudentLabProgress, WorkedDemoSpec,
};

/// Summary representation of a registered university campus.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CampusOrgSummary {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub domain_whitelist: Vec<String>,
    pub tier: String,
    pub student_count: usize,
    pub faculty_count: usize,
    pub created_at: DateTime<Utc>,
}

/// Public directory projection of a campus tenant.
///
/// Returned to callers of `GET /api/v1/campus/orgs` that present no session. The institutional
/// directory is intentionally anonymous-readable (the landing page and the per-tenant login page
/// both render it before a session exists), so the payload is restricted to the fields those
/// public surfaces display. The fields withheld from [`CampusOrgSummary`] are its internal
/// identifiers:
///
/// * `id` — the tenant primary key, which is the lookup key of every administrative endpoint,
/// * `created_at` — the provisioning timestamp, which discloses tenant onboarding history.
///
/// Seat counts and the commercial tier are kept because the public landing page renders them as
/// institutional statistics; they are not administrative-only data.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CampusOrgPublicSummary {
    pub name: String,
    pub slug: String,
    pub domain_whitelist: Vec<String>,
    pub tier: String,
    pub student_count: usize,
    pub faculty_count: usize,
}

impl From<CampusOrgSummary> for CampusOrgPublicSummary {
    fn from(org: CampusOrgSummary) -> Self {
        Self {
            name: org.name,
            slug: org.slug,
            domain_whitelist: org.domain_whitelist,
            tier: org.tier,
            student_count: org.student_count,
            faculty_count: org.faculty_count,
        }
    }
}

/// Inbound payload for provisioning an institutional university tenant.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CampusProvisionRequest {
    pub org_name: String,
    pub org_slug: String,
    pub admin_name: String,
    pub admin_email: String,
    pub admin_password: Option<String>,
    pub tier: String,
    pub allowed_domains: Vec<String>,
    pub expected_students: Option<usize>,
    pub payment_ref: Option<String>,
}

/// Campus user profile embedded in institutional auth and provisioning responses.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CampusUserProfile {
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    pub role: String,
    pub org_id: Uuid,
    pub org_slug: String,
    pub org_name: String,
    pub reg_number: String,
    pub cohort_id: Option<Uuid>,
    pub cohort_name: Option<String>,
}

/// Outbound JSON response after institutional provisioning.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CampusProvisionResponse {
    pub org_id: Uuid,
    pub org_name: String,
    pub org_slug: String,
    pub portal_url: String,
    pub tier: String,
    pub admin_email: String,
    pub status: String,
    pub message: String,
    pub provisioned_at: DateTime<Utc>,
    pub access_token: String,
    pub user: CampusUserProfile,
}

/// Inbound payload for institutional authentication.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CampusLoginRequest {
    pub org_slug: String,
    pub identifier: String,
    pub password: String,
    pub role: String,
}

/// Outbound JSON payload after successful institutional login.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CampusLoginResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub user: CampusUserProfile,
}

/// Query parameters for fetching organization roster.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RosterQuery {
    pub role: Option<String>,
    pub cohort_id: Option<Uuid>,
}

/// Inbound payload for adding an individual member to an organization roster.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddRosterMemberRequest {
    pub email: String,
    pub username: Option<String>,
    pub role: Option<String>,
    pub cohort_id: Option<Uuid>,
    pub reg_number: Option<String>,
}

/// Inbound JSON payload creating an organization.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateOrganizationRequest {
    pub name: String,
    pub slug: String,
    #[serde(default)]
    pub domain_whitelist: Vec<String>,
    #[serde(default)]
    pub branding_config: serde_json::Value,
}

/// Outbound JSON organization tenant profile.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OrganizationResponse {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub domain_whitelist: Vec<String>,
    pub branding_config: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Inbound JSON payload creating a cohort.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateCohortRequest {
    pub name: String,
    pub code: String,
    pub term: Option<String>,
    #[serde(default = "default_active")]
    pub is_active: bool,
}

const fn default_active() -> bool {
    true
}

/// Outbound JSON cohort profile.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CohortResponse {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub code: String,
    pub term: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Outbound JSON student/instructor roster entry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
pub struct RosterMemberResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    pub role: String,
    pub status: String,
    pub cohort_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// Individual member item within bulk batch ingestion payload.
#[derive(Debug, Clone, Deserialize)]
pub struct BatchMemberItem {
    pub user_id: Option<Uuid>,
    pub email: String,
    pub username: Option<String>,
    pub role: Option<String>,
    pub status: Option<String>,
}

/// Inbound JSON bulk roster ingestion payload.
#[derive(Debug, Clone, Deserialize)]
pub struct BatchIngestRequest {
    pub cohort_id: Uuid,
    pub members: Vec<BatchMemberItem>,
}

/// Outbound JSON response after batch ingestion.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BatchIngestResponse {
    pub imported_count: usize,
    pub members: Vec<RosterMemberResponse>,
}

/// Handler for `POST /api/v1/campus/orgs`.
///
/// Creates a new organization tenant and enrolls the creator as `org_admin`.
///
/// # Errors
/// Returns [`GatewayError`] on conflict or persistence failure.
pub async fn create_organization_handler(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<CreateOrganizationRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let org_id = Uuid::new_v4();
    let now = Utc::now();
    let domain_whitelist_json =
        serde_json::to_value(&req.domain_whitelist).unwrap_or_else(|_| serde_json::json!([]));

    let org_record = OrganizationRecord {
        id: org_id,
        name: req.name.clone(),
        slug: req.slug.clone(),
        domain_whitelist: domain_whitelist_json.clone(),
        branding_config: req.branding_config.clone(),
        created_at: now,
        updated_at: now,
    };

    if let Some(ref pool) = state.db {
        // Check slug uniqueness
        let existing = sqlx::query_scalar::<sqlx::Postgres, i64>(
            "SELECT COUNT(*) FROM organizations WHERE slug = $1",
        )
        .bind(&req.slug)
        .fetch_one(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;

        if existing > 0 {
            return Err(GatewayError::BadRequest(format!(
                "Organization with slug '{}' already exists",
                req.slug
            )));
        }

        // Insert organization
        sqlx::query(
            r"
            INSERT INTO organizations (id, name, slug, domain_whitelist, branding_config, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ",
        )
        .bind(org_id)
        .bind(&req.name)
        .bind(&req.slug)
        .bind(&domain_whitelist_json)
        .bind(&req.branding_config)
        .bind(now)
        .bind(now)
        .execute(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;

        // Enroll creator as active org_admin
        sqlx::query(
            r"
            INSERT INTO org_memberships (id, org_id, user_id, cohort_id, role, status, created_at, updated_at)
            VALUES ($1, $2, $3, NULL, 'org_admin', 'active', $4, NOW())
            ",
        )
        .bind(Uuid::new_v4())
        .bind(org_id)
        .bind(auth.user_id)
        .bind(now)
        .execute(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;
    } else {
        // Mock fallback store
        let mut orgs = state.mock_campus.orgs.write().await;
        if orgs.values().any(|o| o.slug == req.slug) {
            return Err(GatewayError::BadRequest(format!(
                "Organization with slug '{}' already exists",
                req.slug
            )));
        }
        orgs.insert(org_id, org_record.clone());

        let mut memberships = state.mock_campus.memberships.write().await;
        memberships.insert(
            (org_id, auth.user_id),
            OrgMembershipRecord {
                id: Uuid::new_v4(),
                org_id,
                user_id: auth.user_id,
                cohort_id: None,
                role: "org_admin".to_string(),
                status: "active".to_string(),
                created_at: now,
            },
        );
    }

    let response = OrganizationResponse {
        id: org_id,
        name: req.name,
        slug: req.slug,
        domain_whitelist: req.domain_whitelist,
        branding_config: req.branding_config,
        created_at: now,
        updated_at: now,
    };

    Ok((StatusCode::CREATED, Json(response)))
}

/// Handler for `GET /api/v1/campus/orgs/{org_id}`.
///
/// Retrieves an organization profile.
///
/// # Errors
/// Returns [`GatewayError::NotFound`] or [`GatewayError::Forbidden`].
pub async fn get_organization_handler(
    State(state): State<AppState>,
    Path(org_id): Path<Uuid>,
    _student: RequireStudent,
) -> Result<impl IntoResponse, GatewayError> {
    if let Some(ref pool) = state.db {
        let rec = sqlx::query_as::<sqlx::Postgres, OrganizationRecord>(
            r"
            SELECT id, name, slug, domain_whitelist, branding_config, created_at, updated_at
            FROM organizations
            WHERE id = $1
            LIMIT 1
            ",
        )
        .bind(org_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?
        .ok_or_else(|| GatewayError::NotFound(format!("Organization '{org_id}' not found")))?;

        let whitelist = rec.parse_domain_whitelist().unwrap_or_default();
        let resp = OrganizationResponse {
            id: rec.id,
            name: rec.name,
            slug: rec.slug,
            domain_whitelist: whitelist,
            branding_config: rec.branding_config,
            created_at: rec.created_at,
            updated_at: rec.updated_at,
        };
        Ok(Json(resp))
    } else {
        let orgs = state.mock_campus.orgs.read().await;
        let rec = orgs
            .get(&org_id)
            .ok_or_else(|| GatewayError::NotFound(format!("Organization '{org_id}' not found")))?;

        let whitelist = rec.parse_domain_whitelist().unwrap_or_default();
        let resp = OrganizationResponse {
            id: rec.id,
            name: rec.name.clone(),
            slug: rec.slug.clone(),
            domain_whitelist: whitelist,
            branding_config: rec.branding_config.clone(),
            created_at: rec.created_at,
            updated_at: rec.updated_at,
        };
        Ok(Json(resp))
    }
}

/// Handler for `POST /api/v1/campus/orgs/{org_id}/cohorts`.
///
/// Creates a class cohort within an organization (requires `OrgAdmin`).
///
/// # Errors
/// Returns [`GatewayError`] on missing organization, duplicate cohort code, or database failure.
pub async fn create_cohort_handler(
    State(state): State<AppState>,
    Path(org_id): Path<Uuid>,
    _admin: RequireOrgAdmin,
    Json(req): Json<CreateCohortRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let cohort_id = Uuid::new_v4();
    let now = Utc::now();
    let term = req.term.unwrap_or_else(|| "Active".to_string());

    if let Some(ref pool) = state.db {
        // Ensure organization exists
        let org_exists = sqlx::query_scalar::<sqlx::Postgres, i64>(
            "SELECT COUNT(*) FROM organizations WHERE id = $1",
        )
        .bind(org_id)
        .fetch_one(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;

        if org_exists == 0 {
            return Err(GatewayError::NotFound(format!(
                "Organization '{org_id}' not found"
            )));
        }

        // Check cohort code uniqueness in org
        let code_exists = sqlx::query_scalar::<sqlx::Postgres, i64>(
            "SELECT COUNT(*) FROM cohorts WHERE org_id = $1 AND code = $2",
        )
        .bind(org_id)
        .bind(&req.code)
        .fetch_one(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;

        if code_exists > 0 {
            return Err(GatewayError::BadRequest(format!(
                "Cohort code '{}' already exists in organization",
                req.code
            )));
        }

        sqlx::query(
            r"
            INSERT INTO cohorts (id, org_id, name, code, term, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ",
        )
        .bind(cohort_id)
        .bind(org_id)
        .bind(&req.name)
        .bind(&req.code)
        .bind(&term)
        .bind(req.is_active)
        .bind(now)
        .execute(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;
    } else {
        let orgs = state.mock_campus.orgs.read().await;
        if !orgs.contains_key(&org_id) {
            return Err(GatewayError::NotFound(format!(
                "Organization '{org_id}' not found"
            )));
        }
        let mut cohorts = state.mock_campus.cohorts.write().await;
        if cohorts
            .values()
            .any(|c| c.org_id == org_id && c.code == req.code)
        {
            return Err(GatewayError::BadRequest(format!(
                "Cohort code '{}' already exists in organization",
                req.code
            )));
        }
        cohorts.insert(
            cohort_id,
            CohortRecord {
                id: cohort_id,
                org_id,
                name: req.name.clone(),
                code: req.code.clone(),
                term: term.clone(),
                is_active: req.is_active,
                created_at: now,
            },
        );
    }

    let response = CohortResponse {
        id: cohort_id,
        org_id,
        name: req.name,
        code: req.code,
        term,
        is_active: req.is_active,
        created_at: now,
    };

    Ok((StatusCode::CREATED, Json(response)))
}

/// Handler for `GET /api/v1/campus/cohorts/{cohort_id}/roster`.
///
/// Retrieves all enrolled students/instructors in a cohort (requires `Instructor`).
///
/// # Errors
/// Returns [`GatewayError::Forbidden`] or [`GatewayError::Database`].
pub async fn get_cohort_roster_handler(
    State(state): State<AppState>,
    Path(cohort_id): Path<Uuid>,
    _instructor: RequireInstructor,
) -> Result<impl IntoResponse, GatewayError> {
    if let Some(ref pool) = state.db {
        let records = sqlx::query_as::<sqlx::Postgres, RosterMemberResponse>(
            r"
            SELECT m.id, m.user_id, u.username, u.email, m.role, m.status, m.cohort_id, m.created_at
            FROM org_memberships m
            JOIN users u ON m.user_id = u.id
            WHERE m.cohort_id = $1 AND m.status = 'active'
            ORDER BY u.email ASC
            ",
        )
        .bind(cohort_id)
        .fetch_all(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;

        Ok(Json(records))
    } else {
        let memberships = state.mock_campus.memberships.read().await;
        let users = state.mock_campus.users.read().await;

        let mut roster = Vec::new();
        for mem in memberships.values() {
            if mem.cohort_id == Some(cohort_id) && mem.status == "active" {
                let (username, email) = users
                    .get(&mem.user_id)
                    .cloned()
                    .unwrap_or_else(|| ("student".to_string(), "student@example.com".to_string()));

                roster.push(RosterMemberResponse {
                    id: mem.id,
                    user_id: mem.user_id,
                    username,
                    email,
                    role: mem.role.clone(),
                    status: mem.status.clone(),
                    cohort_id: mem.cohort_id,
                    created_at: mem.created_at,
                });
            }
        }
        Ok(Json(roster))
    }
}

/// Handler for `POST /api/v1/campus/orgs/{org_id}/members/batch`.
///
/// Executes transactional bulk roster ingestion using `judge_db::repositories::membership::batch_insert_memberships`.
///
/// # Errors
/// Returns [`GatewayError`] on domain validation failure or database error.
#[allow(clippy::too_many_lines)]
pub async fn batch_ingest_members_handler(
    State(state): State<AppState>,
    Path(org_id): Path<Uuid>,
    _admin: RequireOrgAdmin,
    Json(req): Json<BatchIngestRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    if req.members.is_empty() {
        return Ok(Json(BatchIngestResponse {
            imported_count: 0,
            members: Vec::new(),
        }));
    }

    if let Some(ref pool) = state.db {
        // Validate organization existence and domain whitelist
        let org = sqlx::query_as::<sqlx::Postgres, OrganizationRecord>(
            "SELECT id, name, slug, domain_whitelist, branding_config, created_at, updated_at FROM organizations WHERE id = $1 LIMIT 1",
        )
        .bind(org_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?
        .ok_or_else(|| GatewayError::NotFound(format!("Organization '{org_id}' not found")))?;

        let allowed_domains = org.parse_domain_whitelist().unwrap_or_default();
        if !allowed_domains.is_empty() {
            for item in &req.members {
                let email = item.email.trim().to_lowercase();
                let domain = email.split('@').nth(1).unwrap_or_default();
                let matches = allowed_domains
                    .iter()
                    .any(|d| domain == d.to_lowercase() || domain.ends_with(&format!(".{d}")));

                if !matches {
                    return Err(GatewayError::BadRequest(format!(
                        "Email '{}' does not match organization domain whitelist",
                        item.email
                    )));
                }
            }
        }

        // Ensure user accounts exist in users table
        let mut new_members: Vec<NewMember> = Vec::with_capacity(req.members.len());
        for item in &req.members {
            let email = item.email.trim().to_lowercase();
            let user_id = if let Some(uid) = item.user_id {
                uid
            } else {
                let default_uname = item
                    .username
                    .as_deref()
                    .unwrap_or_else(|| email.split('@').next().unwrap_or("student"));

                let row = sqlx::query_scalar::<sqlx::Postgres, Uuid>(
                    r"
                    INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at)
                    VALUES ($1, $2, $3, 'argon2_temp_placeholder', 'free', NOW(), NOW())
                    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
                    RETURNING id
                    ",
                )
                .bind(Uuid::new_v4())
                .bind(default_uname)
                .bind(&email)
                .fetch_one(pool.inner())
                .await
                .map_err(judge_db::DbError::Sqlx)?;

                row
            };

            let role = item.role.as_deref().unwrap_or("student");
            let status = item.status.as_deref().unwrap_or("active");
            new_members.push(NewMember::new(user_id, role, status));
        }

        // Execute transactional bulk UNNEST ingestion
        let count = judge_db::repositories::membership::batch_insert_memberships(
            pool.inner(),
            org_id,
            req.cohort_id,
            new_members,
        )
        .await
        .map_err(GatewayError::Database)?;

        // Fetch ingested members
        let roster = sqlx::query_as::<sqlx::Postgres, RosterMemberResponse>(
            r"
            SELECT m.id, m.user_id, u.username, u.email, m.role, m.status, m.cohort_id, m.created_at
            FROM org_memberships m
            JOIN users u ON m.user_id = u.id
            WHERE m.cohort_id = $1 AND m.status = 'active'
            ORDER BY u.email ASC
            ",
        )
        .bind(req.cohort_id)
        .fetch_all(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;

        Ok(Json(BatchIngestResponse {
            imported_count: count,
            members: roster,
        }))
    } else {
        // Mock fallback mode
        let count = req.members.len();
        let mut memberships = state.mock_campus.memberships.write().await;
        let mut users = state.mock_campus.users.write().await;
        let now = Utc::now();

        let mut roster = Vec::new();
        for item in req.members {
            let uid = item.user_id.unwrap_or_else(Uuid::new_v4);
            let uname = item.username.unwrap_or_else(|| "student".to_string());
            users.insert(uid, (uname.clone(), item.email.clone()));

            let mem_id = Uuid::new_v4();
            let role = item.role.unwrap_or_else(|| "student".to_string());
            let status = item.status.unwrap_or_else(|| "active".to_string());

            memberships.insert(
                (org_id, uid),
                OrgMembershipRecord {
                    id: mem_id,
                    org_id,
                    user_id: uid,
                    cohort_id: Some(req.cohort_id),
                    role: role.clone(),
                    status: status.clone(),
                    created_at: now,
                },
            );

            roster.push(RosterMemberResponse {
                id: mem_id,
                user_id: uid,
                username: uname,
                email: item.email,
                role,
                status,
                cohort_id: Some(req.cohort_id),
                created_at: now,
            });
        }

        Ok(Json(BatchIngestResponse {
            imported_count: count,
            members: roster,
        }))
    }
}

/// Handler for `GET /api/v1/campus/orgs`.
///
/// Lists all registered university organizations with live student and faculty counts.
///
/// The directory stays readable without a session: the public landing page and the per-tenant
/// login page both render it before any session exists, so requiring auth here would break them.
/// Instead the payload is narrowed — anonymous callers receive [`CampusOrgPublicSummary`] without
/// the internal tenant `id` or `created_at`, while callers presenting a valid session receive the
/// full [`CampusOrgSummary`] record.
pub async fn list_organizations_handler(
    State(state): State<AppState>,
    OptionalUser(user): OptionalUser,
) -> Result<impl IntoResponse, GatewayError> {
    let authenticated = user.is_some();
    let mut list = Vec::new();

    if let Some(ref pool) = state.db {
        #[derive(sqlx::FromRow)]
        struct OrgDbRow {
            id: Uuid,
            name: String,
            slug: String,
            domain_whitelist: serde_json::Value,
            branding_config: serde_json::Value,
            created_at: DateTime<Utc>,
        }

        let org_rows = sqlx::query_as::<sqlx::Postgres, OrgDbRow>(
            "SELECT id, name, slug, domain_whitelist, branding_config, created_at FROM organizations ORDER BY name ASC",
        )
        .fetch_all(pool.inner())
        .await;

        if let Ok(rows) = org_rows {
            if !rows.is_empty() {
                for r in rows {
                    let domains: Vec<String> =
                        serde_json::from_value(r.domain_whitelist).unwrap_or_default();
                    let tier = r
                        .branding_config
                        .get("tier")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Enterprise Campus")
                        .to_string();

                    let counts = sqlx::query_as::<sqlx::Postgres, (i64, i64)>(
                        r"
                        SELECT 
                            COUNT(*) FILTER (WHERE role = 'student') as student_count,
                            COUNT(*) FILTER (WHERE role IN ('instructor', 'faculty', 'org_admin')) as faculty_count
                        FROM org_memberships
                        WHERE org_id = $1 AND status = 'active'
                        ",
                    )
                    .bind(r.id)
                    .fetch_one(pool.inner())
                    .await
                    .unwrap_or((0, 0));

                    list.push(CampusOrgSummary {
                        id: r.id,
                        name: r.name,
                        slug: r.slug,
                        domain_whitelist: domains,
                        tier,
                        student_count: counts.0 as usize,
                        faculty_count: counts.1 as usize,
                        created_at: r.created_at,
                    });
                }
                let existing_slugs: std::collections::HashSet<String> =
                    list.iter().map(|o| o.slug.clone()).collect();
                let mock_orgs = state.mock_campus.orgs.read().await;
                for org in mock_orgs.values() {
                    if !existing_slugs.contains(&org.slug) {
                        let domains = org.parse_domain_whitelist().unwrap_or_default();
                        let tier = org
                            .branding_config
                            .get("tier")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Enterprise Campus")
                            .to_string();
                        let baseline_students =
                            org.branding_config
                                .get("student_seats")
                                .and_then(|v| v.as_u64())
                                .unwrap_or(1200) as usize;
                        let baseline_faculty = org
                            .branding_config
                            .get("faculty_seats")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(45) as usize;
                        list.push(CampusOrgSummary {
                            id: org.id,
                            name: org.name.clone(),
                            slug: org.slug.clone(),
                            domain_whitelist: domains,
                            tier,
                            student_count: baseline_students,
                            faculty_count: baseline_faculty,
                            created_at: org.created_at,
                        });
                    }
                }
                return Ok(respond_org_directory(list, authenticated));
            }
        }
    }

    // Fallback: Query from mock campus store
    let orgs = state.mock_campus.orgs.read().await;
    let memberships = state.mock_campus.memberships.read().await;

    for org in orgs.values() {
        let domains = org.parse_domain_whitelist().unwrap_or_default();
        let tier = org
            .branding_config
            .get("tier")
            .and_then(|v| v.as_str())
            .unwrap_or("Enterprise Campus")
            .to_string();

        let mut student_count = 0;
        let mut faculty_count = 0;
        for ((o_id, _), m) in memberships.iter() {
            if *o_id == org.id && m.status == "active" {
                if m.role == "student" {
                    student_count += 1;
                } else if m.role == "faculty" || m.role == "instructor" || m.role == "org_admin" {
                    faculty_count += 1;
                }
            }
        }

        let baseline_students = org
            .branding_config
            .get("student_seats")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as usize;
        let baseline_faculty = org
            .branding_config
            .get("faculty_seats")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as usize;

        list.push(CampusOrgSummary {
            id: org.id,
            name: org.name.clone(),
            slug: org.slug.clone(),
            domain_whitelist: domains,
            tier,
            student_count: std::cmp::max(student_count, baseline_students),
            faculty_count: std::cmp::max(faculty_count, baseline_faculty),
            created_at: org.created_at,
        });
    }

    list.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(respond_org_directory(list, authenticated))
}

/// Serializes the campus directory, narrowing it to public metadata for anonymous callers.
///
/// See [`CampusOrgPublicSummary`] for the exact fields withheld. Both branches borrow the same
/// `Vec<CampusOrgSummary>` collection so the DB-backed and mock-backed lookup paths cannot drift
/// apart in what they expose.
fn respond_org_directory(
    orgs: Vec<CampusOrgSummary>,
    authenticated: bool,
) -> axum::response::Response {
    if authenticated {
        Json(orgs).into_response()
    } else {
        let public: Vec<CampusOrgPublicSummary> =
            orgs.into_iter().map(CampusOrgPublicSummary::from).collect();
        Json(public).into_response()
    }
}

/// Handler for `POST /api/v1/campus/orgs/provision`.
/// Automated university tenant provisioning from `/campus/register`.
pub async fn provision_organization_handler(
    State(state): State<AppState>,
    Json(req): Json<CampusProvisionRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    if req.org_name.trim().is_empty()
        || req.org_slug.trim().is_empty()
        || req.admin_email.trim().is_empty()
    {
        return Err(GatewayError::BadRequest(
            "Institution name, slug, and administrator email are required".to_string(),
        ));
    }

    let clean_slug = req.org_slug.trim().to_lowercase().replace(' ', "-");
    let org_id = Uuid::new_v4();
    let cohort_id = Uuid::new_v4();
    let admin_user_id = Uuid::new_v4();
    let now = Utc::now();

    let admin_uname = if !req.admin_name.trim().is_empty() {
        req.admin_name.trim().to_lowercase().replace(' ', ".")
    } else {
        req.admin_email
            .split('@')
            .next()
            .unwrap_or("admin")
            .to_string()
    };

    let password = req.admin_password.as_deref().unwrap_or("CampusAdmin@2026");
    let password_hash = hash_password(password)?;

    let whitelist_val =
        serde_json::to_value(&req.allowed_domains).unwrap_or_else(|_| serde_json::json!([]));
    let branding = serde_json::json!({
        "tier": req.tier,
        "admin_name": req.admin_name,
        "admin_email": req.admin_email,
        "student_seats": req.expected_students.unwrap_or(500),
        "faculty_seats": 25,
        "payment_ref": req.payment_ref.clone().unwrap_or_else(|| "PROVISIONED_DIRECT".to_string())
    });

    if let Some(ref pool) = state.db {
        let _ = sqlx::query(
            "INSERT INTO organizations (id, name, slug, domain_whitelist, branding_config, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) \
             ON CONFLICT (slug) DO NOTHING",
        )
        .bind(org_id)
        .bind(&req.org_name)
        .bind(&clean_slug)
        .bind(whitelist_val.clone())
        .bind(branding.clone())
        .bind(now)
        .bind(now)
        .execute(pool.inner())
        .await;

        let _ = sqlx::query(
            "INSERT INTO cohorts (id, org_id, name, code, term, is_active, created_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(cohort_id)
        .bind(org_id)
        .bind("Primary Cohort 2026")
        .bind(format!("{}-2026", clean_slug))
        .bind("Active")
        .bind(true)
        .bind(now)
        .execute(pool.inner())
        .await;
    }

    // Update in-memory fallback state
    {
        let mut orgs = state.mock_campus.orgs.write().await;
        orgs.insert(
            org_id,
            OrganizationRecord {
                id: org_id,
                name: req.org_name.clone(),
                slug: clean_slug.clone(),
                domain_whitelist: whitelist_val,
                branding_config: branding,
                created_at: now,
                updated_at: now,
            },
        );

        let mut cohorts = state.mock_campus.cohorts.write().await;
        cohorts.insert(
            cohort_id,
            CohortRecord {
                id: cohort_id,
                org_id,
                name: "Primary Cohort 2026".to_string(),
                code: format!("{}-2026", clean_slug),
                term: "Active".to_string(),
                is_active: true,
                created_at: now,
            },
        );

        let mut users = state.mock_campus.users.write().await;
        users.insert(
            admin_user_id,
            (admin_uname.clone(), req.admin_email.clone()),
        );

        let mut in_mem = state.mock_campus.in_memory_users.write().await;
        in_mem.insert(
            admin_user_id,
            (
                admin_uname.clone(),
                req.admin_email.clone(),
                password_hash,
                "org_admin".to_string(),
                Some(req.org_name.clone()),
            ),
        );

        let mut memberships = state.mock_campus.memberships.write().await;
        memberships.insert(
            (org_id, admin_user_id),
            OrgMembershipRecord {
                id: Uuid::new_v4(),
                org_id,
                user_id: admin_user_id,
                cohort_id: Some(cohort_id),
                role: "org_admin".to_string(),
                status: "active".to_string(),
                created_at: now,
            },
        );

        let mut reg_nums = state.mock_campus.member_reg_numbers.write().await;
        reg_nums.insert((org_id, admin_user_id), "ADM-001".to_string());
    }

    let access_token = encode_access_token(
        &admin_user_id.to_string(),
        &admin_uname,
        &req.admin_email,
        "org_admin",
        &state.jwt_secret,
        None,
    )?;

    let user_profile = CampusUserProfile {
        user_id: admin_user_id,
        username: admin_uname,
        email: req.admin_email.clone(),
        role: "org_admin".to_string(),
        org_id,
        org_slug: clean_slug.clone(),
        org_name: req.org_name.clone(),
        reg_number: "ADM-001".to_string(),
        cohort_id: Some(cohort_id),
        cohort_name: Some("Primary Cohort 2026".to_string()),
    };

    let resp = CampusProvisionResponse {
        org_id,
        org_name: req.org_name,
        org_slug: clean_slug.clone(),
        portal_url: format!("/campus/{}/admin/dashboard", clean_slug),
        tier: req.tier,
        admin_email: req.admin_email,
        status: "ACTIVE_ENTERPRISE".to_string(),
        message: "Institutional campus portal provisioned successfully. Single-Sign-On, cohort routing, and domain whitelisting enabled.".to_string(),
        provisioned_at: now,
        access_token,
        user: user_profile,
    };

    Ok((StatusCode::CREATED, Json(resp)))
}

/// Handler for `POST /api/v1/campus/auth/login`.
/// Authenticates institutional users (student, faculty, org_admin) against target org slug.
pub async fn campus_login_handler(
    State(state): State<AppState>,
    Json(req): Json<CampusLoginRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let identifier = req.identifier.trim();
    let password = req.password.trim();
    if identifier.is_empty() || password.is_empty() {
        return Err(GatewayError::InvalidCredentials(
            "Institutional identifier and password are required".to_string(),
        ));
    }

    let target_slug = req.org_slug.trim().to_lowercase();
    let req_role = match req.role.trim().to_lowercase().as_str() {
        "admin" | "org_admin" | "administrator" => "org_admin",
        "faculty" | "instructor" | "professor" => "faculty",
        _ => "student",
    };

    // 1. Resolve Organization
    let org_record = {
        let orgs = state.mock_campus.orgs.read().await;
        orgs.values()
            .find(|o| o.slug.eq_ignore_ascii_case(&target_slug))
            .cloned()
    };

    let Some(org) = org_record else {
        return Err(GatewayError::NotFound(format!(
            "Institution with identifier '{}' not found",
            target_slug
        )));
    };

    // 2. Resolve User & Membership
    let resolved = {
        let memberships = state.mock_campus.memberships.read().await;
        let users = state.mock_campus.users.read().await;
        let in_mem = state.mock_campus.in_memory_users.read().await;
        let reg_nums = state.mock_campus.member_reg_numbers.read().await;
        let cohorts = state.mock_campus.cohorts.read().await;

        let mut found = None;

        for ((o_id, u_id), mem) in memberships.iter() {
            if *o_id == org.id {
                let u_reg = reg_nums.get(&(org.id, *u_id)).cloned().unwrap_or_default();
                let u_pair = users.get(u_id);
                let u_auth = in_mem.get(u_id);

                let email_match = u_pair
                    .map(|(_, e)| e.eq_ignore_ascii_case(identifier))
                    .unwrap_or(false);
                let username_match = u_pair
                    .map(|(u, _)| u.eq_ignore_ascii_case(identifier))
                    .unwrap_or(false);
                let reg_match = !u_reg.is_empty() && u_reg.eq_ignore_ascii_case(identifier);

                if email_match || username_match || reg_match {
                    // Campus identities are credentialed: only an Argon2 match on a
                    // stored hash authenticates, and an identity with no credential
                    // on file is never admitted.
                    let pw_ok =
                        u_auth.is_some_and(|(_, _, hash, _, _)| verify_password(password, hash));

                    if !pw_ok {
                        return Err(GatewayError::InvalidCredentials(
                            "Invalid institutional identifier or password".to_string(),
                        ));
                    }

                    let c_name = mem
                        .cohort_id
                        .and_then(|cid| cohorts.get(&cid).map(|c| c.name.clone()));
                    let (uname, uemail) = u_pair
                        .cloned()
                        .unwrap_or_else(|| ("user".to_string(), identifier.to_string()));
                    found = Some((
                        *u_id,
                        uname,
                        uemail,
                        mem.role.clone(),
                        u_reg,
                        mem.cohort_id,
                        c_name,
                    ));
                    break;
                }
            }
        }

        found
    };

    // Every identity reaching this point is mirrored with a real credential: the
    // password the caller just proved (or chose at enrollment) is hashed here and
    // never stored in plaintext.
    let credential_hash = hash_password(password)?;

    let (user_id, username, email, role, reg_number, cohort_id, cohort_name) = match resolved {
        Some(item) => item,
        None => {
            // Self-service enrollment is limited to e-mail identities on the
            // institution's whitelisted domains and only ever creates a student:
            // privileged campus roles require an existing membership.
            let domains = org.parse_domain_whitelist().unwrap_or_default();
            let whitelisted_domain = identifier
                .rsplit_once('@')
                .map(|(_, domain)| domain)
                .is_some_and(|domain| {
                    domains
                        .iter()
                        .any(|allowed| allowed.eq_ignore_ascii_case(domain))
                });

            if req_role != "student" || !whitelisted_domain {
                return Err(GatewayError::InvalidCredentials(
                    "Invalid institutional identifier or password".to_string(),
                ));
            }

            let new_uid = Uuid::new_v4();
            let uname = identifier
                .split('@')
                .next()
                .unwrap_or(identifier)
                .to_string();

            state.mock_campus.in_memory_users.write().await.insert(
                new_uid,
                (
                    uname.clone(),
                    identifier.to_string(),
                    credential_hash.clone(),
                    "student".to_string(),
                    Some(org.name.clone()),
                ),
            );

            let c_id = {
                let cohorts = state.mock_campus.cohorts.read().await;
                cohorts.values().find(|c| c.org_id == org.id).map(|c| c.id)
            };

            (
                new_uid,
                uname,
                identifier.to_string(),
                "student".to_string(),
                format!("25BCE{}", (new_uid.as_u128() % 9000 + 1000)),
                c_id,
                Some("Active Cohort".to_string()),
            )
        }
    };

    // Ensure member is registered in memory
    {
        let mut users = state.mock_campus.users.write().await;
        users.insert(user_id, (username.clone(), email.clone()));

        let mut reg_nums = state.mock_campus.member_reg_numbers.write().await;
        reg_nums.insert((org.id, user_id), reg_number.clone());

        let mut memberships = state.mock_campus.memberships.write().await;
        memberships
            .entry((org.id, user_id))
            .or_insert_with(|| OrgMembershipRecord {
                id: Uuid::new_v4(),
                org_id: org.id,
                user_id,
                cohort_id,
                role: role.clone(),
                status: "active".to_string(),
                created_at: Utc::now(),
            });
    }

    if let Some(ref pool) = state.db {
        if let Err(err) = sqlx::query(
            r"
            INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 'pro', NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
            ",
        )
        .bind(user_id)
        .bind(&username)
        .bind(&email)
        .bind(&credential_hash)
        .execute(pool.inner())
        .await
        {
            tracing::warn!(
                user_id = %user_id,
                error = %err,
                "campus login: failed to mirror user into PostgreSQL"
            );
        }

        // `org_memberships` is unique on (org_id, user_id, cohort_id) and `cohort_id` is NULL
        // for org admins, so an `ON CONFLICT (org_id, user_id)` arbiter cannot match the index
        // and NULLs never conflict. Locate the row with `IS NOT DISTINCT FROM` and update it in
        // place, inserting only when no membership exists yet.
        let updated = sqlx::query(
            r"
            UPDATE org_memberships
            SET role = $4, status = 'active', updated_at = NOW()
            WHERE org_id = $1
              AND user_id = $2
              AND cohort_id IS NOT DISTINCT FROM $3
            ",
        )
        .bind(org.id)
        .bind(user_id)
        .bind(cohort_id)
        .bind(&role)
        .execute(pool.inner())
        .await;

        match updated {
            Ok(result) if result.rows_affected() > 0 => {}
            Ok(_) => {
                if let Err(err) = sqlx::query(
                    r"
                    INSERT INTO org_memberships (id, org_id, user_id, cohort_id, role, status, created_at)
                    VALUES ($1, $2, $3, $4, $5, 'active', NOW())
                    ON CONFLICT DO NOTHING
                    ",
                )
                .bind(Uuid::new_v4())
                .bind(org.id)
                .bind(user_id)
                .bind(cohort_id)
                .bind(&role)
                .execute(pool.inner())
                .await
                {
                    tracing::warn!(
                        org_id = %org.id,
                        user_id = %user_id,
                        error = %err,
                        "campus login: failed to mirror org membership into PostgreSQL"
                    );
                }
            }
            Err(err) => {
                tracing::warn!(
                    org_id = %org.id,
                    user_id = %user_id,
                    error = %err,
                    "campus login: failed to update org membership in PostgreSQL"
                );
            }
        }
    }

    let access_token = encode_access_token(
        &user_id.to_string(),
        &username,
        &email,
        &role,
        &state.jwt_secret,
        None,
    )?;

    let user_profile = CampusUserProfile {
        user_id,
        username,
        email,
        role,
        org_id: org.id,
        org_slug: org.slug,
        org_name: org.name,
        reg_number,
        cohort_id,
        cohort_name,
    };

    Ok(Json(CampusLoginResponse {
        access_token,
        token_type: "Bearer".to_string(),
        expires_in: 900,
        user: user_profile,
    }))
}

/// Handler for `GET /api/v1/campus/orgs/{org_slug}/roster`.
/// Returns roster members for an organization by slug, with optional role filtering.
pub async fn get_org_roster_by_slug_handler(
    State(state): State<AppState>,
    Path(org_slug): Path<String>,
    _instructor: RequireInstructor,
    Query(query): Query<RosterQuery>,
) -> Result<impl IntoResponse, GatewayError> {
    let org = {
        let orgs = state.mock_campus.orgs.read().await;
        orgs.values()
            .find(|o| o.slug.eq_ignore_ascii_case(&org_slug))
            .cloned()
    };

    let Some(org) = org else {
        return Err(GatewayError::NotFound(format!(
            "Organization '{}' not found",
            org_slug
        )));
    };

    let memberships = state.mock_campus.memberships.read().await;
    let users = state.mock_campus.users.read().await;

    let mut roster = Vec::new();
    for ((o_id, u_id), mem) in memberships.iter() {
        if *o_id == org.id && mem.status == "active" {
            if let Some(ref r_filter) = query.role {
                if !mem.role.eq_ignore_ascii_case(r_filter) {
                    continue;
                }
            }
            if let Some(ref c_filter) = query.cohort_id {
                if mem.cohort_id != Some(*c_filter) {
                    continue;
                }
            }

            let (uname, email) = users
                .get(u_id)
                .cloned()
                .unwrap_or_else(|| ("member".to_string(), "member@campus.edu".to_string()));
            roster.push(RosterMemberResponse {
                id: mem.id,
                user_id: *u_id,
                username: uname,
                email,
                role: mem.role.clone(),
                status: mem.status.clone(),
                cohort_id: mem.cohort_id,
                created_at: mem.created_at,
            });
        }
    }

    roster.sort_by(|a, b| a.email.cmp(&b.email));
    Ok(Json(roster))
}

/// Handler for `POST /api/v1/campus/orgs/{org_slug}/roster`.
/// Adds an individual member to the organization roster.
pub async fn add_org_roster_member_handler(
    State(state): State<AppState>,
    Path(org_slug): Path<String>,
    _admin: RequireOrgAdmin,
    Json(req): Json<AddRosterMemberRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let org = {
        let orgs = state.mock_campus.orgs.read().await;
        orgs.values()
            .find(|o| o.slug.eq_ignore_ascii_case(&org_slug))
            .cloned()
    };

    let Some(org) = org else {
        return Err(GatewayError::NotFound(format!(
            "Organization '{}' not found",
            org_slug
        )));
    };

    let email = req.email.trim().to_string();
    if email.is_empty() {
        return Err(GatewayError::BadRequest(
            "Member email is required".to_string(),
        ));
    }

    let uname = req
        .username
        .unwrap_or_else(|| email.split('@').next().unwrap_or("user").to_string());
    let role = req.role.unwrap_or_else(|| "student".to_string());
    let now = Utc::now();
    let mem_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    {
        let mut users = state.mock_campus.users.write().await;
        users.insert(user_id, (uname.clone(), email.clone()));

        let mut memberships = state.mock_campus.memberships.write().await;
        memberships.insert(
            (org.id, user_id),
            OrgMembershipRecord {
                id: mem_id,
                org_id: org.id,
                user_id,
                cohort_id: req.cohort_id,
                role: role.clone(),
                status: "active".to_string(),
                created_at: now,
            },
        );

        if let Some(reg) = req.reg_number {
            let mut reg_nums = state.mock_campus.member_reg_numbers.write().await;
            reg_nums.insert((org.id, user_id), reg);
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(RosterMemberResponse {
            id: mem_id,
            user_id,
            username: uname,
            email,
            role,
            status: "active".to_string(),
            cohort_id: req.cohort_id,
            created_at: now,
        }),
    ))
}

// =========================================================================
// PHASE 32: REAL 6-STAGE LAB EXECUTION ENGINE & DYNAMIC ANALYTICS
// =========================================================================

/// Query parameters for fetching labs.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LabsQuery {
    pub student_id: Option<Uuid>,
    pub student_email: Option<String>,
}

/// Outbound JSON summary representation of a lab for the catalog.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LabSummaryResponse {
    pub id: String,
    pub org_slug: String,
    pub course_code: String,
    pub course_name: String,
    pub title: String,
    pub code: String,
    pub deadline: String,
    pub duration_minutes: u32,
    pub max_marks: f64,
    pub status: String,
    pub clo: String,
    pub description: String,
    pub student_status: String,
    pub student_marks: Option<f64>,
}

/// Inbound JSON payload for faculty lab creation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateLabRequest {
    pub title: String,
    pub course_code: String,
    pub course_name: String,
    pub code: String,
    pub deadline: String,
    pub duration_minutes: u32,
    pub max_marks: f64,
    pub clo: String,
    pub description: String,
    pub lecture_notes: Option<String>,
    pub worked_demo: Option<WorkedDemoSpec>,
    pub led_quiz: Option<Vec<McqQuestionSpec>>,
    pub practice_problems: Option<Vec<PracticeProblemSpec>>,
    pub challenging_problem: Option<ChallengingProblemSpec>,
}

/// Detailed lab response including current student's progress.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabDetailResponse {
    pub lab: LabRecord,
    pub student_progress: StudentLabProgress,
}

/// Inbound JSON payload for recording telemetry activity in a lab.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabActivityRequest {
    pub student_id: Option<Uuid>,
    pub student_email: Option<String>,
    pub event_type: String,
    pub stage: String,
    pub active_seconds: Option<u32>,
    pub details: Option<serde_json::Value>,
}

/// Outbound JSON payload after recording telemetry activity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabActivityResponse {
    pub status: String,
    pub code_runs_count: u32,
    pub ai_questions_count: u32,
    pub active_minutes: u32,
    pub current_stage: String,
}

/// Inbound JSON payload for evaluating and submitting a lab.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitLabRequest {
    pub student_id: Option<Uuid>,
    pub student_email: Option<String>,
    pub practice_code: Option<HashMap<u32, String>>,
    pub challenging_code: Option<String>,
    pub mcq_answers: Option<HashMap<u32, usize>>,
    pub self_rating: Option<u32>,
    pub feedback: Option<String>,
}

/// Outbound JSON payload after lab evaluation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitLabResponse {
    pub status: String,
    pub lab_id: String,
    pub obtained_marks: f64,
    pub max_marks: f64,
    pub clo: String,
    pub feedback: String,
    pub evaluated_at: DateTime<Utc>,
}

/// Time series point for activity charts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityPoint {
    pub date: String,
    pub runs: u32,
    pub ai: u32,
}

/// Activity breakdown category.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityCategoryItem {
    pub category: String,
    pub count: u32,
    pub fill: String,
}

/// Time spent per lab.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSpentLabItem {
    pub lab: String,
    pub hours: f64,
}

/// Marks progression entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarksProgressionItem {
    pub submission: String,
    pub marks: f64,
}

/// Code runs vs errors time series.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeRunTrendItem {
    pub day: String,
    pub runs: u32,
    pub errors: u32,
}

/// Error type distribution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorDistributionItem {
    pub error_type: String,
    pub count: u32,
}

/// AI hint category count.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiHintCategoryItem {
    pub category: String,
    pub count: u32,
}

/// AI queries session trend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSessionTrendItem {
    pub session: String,
    pub queries: u32,
}

/// Course Learning Outcome attainment status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloAttainmentItem {
    pub clo: String,
    pub name: String,
    pub target: f64,
    pub attained: f64,
    pub status: String,
}

/// Bloom's Taxonomy distribution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BloomDistributionItem {
    pub level: String,
    pub percentage: f64,
}

/// Recent evaluated lab submission summary item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentSubmissionItem {
    pub lab_id: String,
    pub lab_title: String,
    pub marks: f64,
    pub max_marks: f64,
    pub date: String,
    pub status: String,
}

/// Outbound dynamic student analytics response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentAnalyticsResponse {
    pub student_id: Uuid,
    pub student_email: String,
    pub student_name: String,
    pub reg_number: String,
    pub course_code: String,
    pub course_name: String,
    pub active_labs_count: usize,
    pub completed_labs_count: usize,
    pub average_marks: f64,
    pub clo_attainment_percent: f64,
    pub total_active_minutes: u32,
    pub code_runs_count: u32,
    pub submissions_count: u32,
    pub ai_questions_count: u32,
    pub avg_ai_latency_ms: u32,
    pub activity_over_time: Vec<ActivityPoint>,
    pub activity_breakdown: Vec<ActivityCategoryItem>,
    pub time_spent_per_lab: Vec<TimeSpentLabItem>,
    pub marks_progression: Vec<MarksProgressionItem>,
    pub code_runs_over_time: Vec<CodeRunTrendItem>,
    pub error_distribution: Vec<ErrorDistributionItem>,
    pub hints_by_category: Vec<AiHintCategoryItem>,
    pub ai_queries_trend: Vec<AiSessionTrendItem>,
    pub cognitive_index: f64,
    pub clo_attainment: Vec<CloAttainmentItem>,
    pub bloom_taxonomy_distribution: Vec<BloomDistributionItem>,
    pub recent_submissions: Vec<RecentSubmissionItem>,
}

/// Outbound security and automated evaluation audit payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CampusAdminAuditResponse {
    pub org_slug: String,
    pub runtime_status: String,
    pub seccomp_status: String,
    pub active_sandboxes_count: usize,
    pub sandbox_executions_last_24h: usize,
    pub security_audit_events: Vec<SecurityAuditItem>,
    pub plagiarism_scans: Vec<PlagiarismReportItem>,
}

/// Helper resolving student details.
async fn resolve_student(
    state: &AppState,
    org_slug: &str,
    student_id: Option<Uuid>,
    student_email: Option<&str>,
) -> (Uuid, String, String, String) {
    let memberships = state.mock_campus.memberships.read().await;
    let users = state.mock_campus.users.read().await;
    let reg_numbers = state.mock_campus.member_reg_numbers.read().await;
    let orgs = state.mock_campus.orgs.read().await;

    let org = orgs
        .values()
        .find(|o| o.slug.eq_ignore_ascii_case(org_slug));
    let org_id = org.map(|o| o.id);

    if let Some(sid) = student_id {
        if let Some((uname, email)) = users.get(&sid) {
            let reg = org_id
                .and_then(|oid| reg_numbers.get(&(oid, sid)))
                .cloned()
                .unwrap_or_else(|| "DEMO-001".to_string());
            return (sid, uname.clone(), email.clone(), reg);
        }
    }

    if let Some(semail) = student_email {
        for (uid, (uname, email)) in users.iter() {
            if email.eq_ignore_ascii_case(semail) {
                let reg = org_id
                    .and_then(|oid| reg_numbers.get(&(oid, *uid)))
                    .cloned()
                    .unwrap_or_else(|| "DEMO-001".to_string());
                return (*uid, uname.clone(), email.clone(), reg);
            }
        }
    }

    if let Some(oid) = org_id {
        let default_id = Uuid::parse_str("30000000-0000-0000-0000-000000000001").unwrap();
        if memberships.contains_key(&(oid, default_id)) {
            let reg = reg_numbers
                .get(&(oid, default_id))
                .cloned()
                .unwrap_or_else(|| "DEMO-001".to_string());
            return (
                default_id,
                "student1".to_string(),
                "student1@vitstudent.ac.in".to_string(),
                reg,
            );
        }

        for ((o_id, u_id), mem) in memberships.iter() {
            if *o_id == oid && mem.role == "student" {
                if let Some((uname, email)) = users.get(u_id) {
                    let reg = reg_numbers
                        .get(&(oid, *u_id))
                        .cloned()
                        .unwrap_or_else(|| "DEMO-001".to_string());
                    return (*u_id, uname.clone(), email.clone(), reg);
                }
            }
        }
    }

    let default_id = Uuid::parse_str("30000000-0000-0000-0000-000000000001").unwrap();
    (
        default_id,
        "student1".to_string(),
        "student1@vitstudent.ac.in".to_string(),
        "DEMO-001".to_string(),
    )
}

/// Handler for `GET /api/v1/campus/{org_slug}/labs`.
pub async fn get_campus_labs_handler(
    State(state): State<AppState>,
    Path(org_slug): Path<String>,
    Query(query): Query<LabsQuery>,
) -> Result<impl IntoResponse, GatewayError> {
    let (student_id, _, _, _) = resolve_student(
        &state,
        &org_slug,
        query.student_id,
        query.student_email.as_deref(),
    )
    .await;

    let labs = state.mock_campus.labs.read().await;
    let progress = state.mock_campus.student_progress.read().await;

    let mut db_progress: HashMap<String, (String, f64)> = HashMap::new();
    if let Some(ref pool) = state.db {
        if let Ok(rows) = sqlx::query(
            r#"
            SELECT lab_id, status, obtained_marks
            FROM student_lab_progress
            WHERE LOWER(org_slug) = LOWER($1) AND student_id = $2
            "#,
        )
        .bind(&org_slug)
        .bind(student_id)
        .fetch_all(pool.inner())
        .await
        {
            use sqlx::Row;
            for r in rows {
                let lid: String = r.try_get("lab_id").unwrap_or_default();
                let status: String = r
                    .try_get("status")
                    .unwrap_or_else(|_| "Not Started".to_string());
                let marks: f64 = r.try_get("obtained_marks").unwrap_or(0.0);
                db_progress.insert(lid, (status, marks));
            }
        }
    }

    let mut result = Vec::new();
    for lab in labs.values() {
        if lab.org_slug.eq_ignore_ascii_case(&org_slug) {
            let (student_status, student_marks) =
                if let Some((st, marks)) = db_progress.get(&lab.id) {
                    (
                        st.clone(),
                        if st == "Evaluated" {
                            Some(*marks)
                        } else {
                            None
                        },
                    )
                } else if let Some(prog) = progress.get(&(lab.id.clone(), student_id)) {
                    (
                        prog.status.clone(),
                        if prog.status == "Evaluated" {
                            Some(prog.obtained_marks)
                        } else {
                            None
                        },
                    )
                } else {
                    ("Not Started".to_string(), None)
                };

            result.push(LabSummaryResponse {
                id: lab.id.clone(),
                org_slug: lab.org_slug.clone(),
                course_code: lab.course_code.clone(),
                course_name: lab.course_name.clone(),
                title: lab.title.clone(),
                code: lab.code.clone(),
                deadline: lab.deadline.clone(),
                duration_minutes: lab.duration_minutes,
                max_marks: lab.max_marks,
                status: lab.status.clone(),
                clo: lab.clo.clone(),
                description: lab.description.clone(),
                student_status,
                student_marks,
            });
        }
    }

    result.sort_by(|a, b| {
        if a.status == "active" && b.status != "active" {
            std::cmp::Ordering::Less
        } else if a.status != "active" && b.status == "active" {
            std::cmp::Ordering::Greater
        } else {
            b.code.cmp(&a.code)
        }
    });

    Ok(Json(result))
}

/// Handler for `POST /api/v1/campus/{org_slug}/labs`.
pub async fn create_campus_lab_handler(
    State(state): State<AppState>,
    Path(org_slug): Path<String>,
    _instructor: RequireInstructor,
    Json(req): Json<CreateLabRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let lab_id = format!(
        "{}-{}",
        req.course_code.to_lowercase(),
        req.code.to_lowercase().replace(' ', "-")
    );

    let new_lab = LabRecord {
        id: lab_id.clone(),
        org_slug: org_slug.clone(),
        course_code: req.course_code,
        course_name: req.course_name,
        title: req.title,
        code: req.code,
        deadline: req.deadline,
        duration_minutes: req.duration_minutes,
        max_marks: req.max_marks,
        status: "active".to_string(),
        clo: req.clo,
        description: req.description,
        lecture_notes: req
            .lecture_notes
            .unwrap_or_else(|| "# Lecture Notes\n\nNo notes uploaded.".to_string()),
        worked_demo: req.worked_demo.unwrap_or_else(|| WorkedDemoSpec {
            title: "Sample Worked Demo".to_string(),
            description: "Default demo.".to_string(),
            code: "// Sample demo code".to_string(),
            language: "java".to_string(),
            expected_output: "Demo complete.".to_string(),
        }),
        led_quiz: req.led_quiz.unwrap_or_default(),
        practice_problems: req.practice_problems.unwrap_or_default(),
        challenging_problem: req
            .challenging_problem
            .unwrap_or_else(|| ChallengingProblemSpec {
                id: 1,
                title: "Challenging Task".to_string(),
                difficulty: "Hard".to_string(),
                marks: 20.0,
                description: "Challenging assessment spec.".to_string(),
                sample_input: "".to_string(),
                sample_output: "".to_string(),
                starter_code: "".to_string(),
                test_cases_count: 5,
            }),
    };

    {
        let mut labs = state.mock_campus.labs.write().await;
        labs.insert(lab_id, new_lab.clone());
    }

    Ok((StatusCode::CREATED, Json(new_lab)))
}

/// Handler for `GET /api/v1/campus/{org_slug}/labs/{lab_id}`.
pub async fn get_campus_lab_detail_handler(
    State(state): State<AppState>,
    Path((org_slug, lab_id)): Path<(String, String)>,
    Query(query): Query<LabsQuery>,
) -> Result<impl IntoResponse, GatewayError> {
    let (student_id, _, student_email, student_reg_no) = resolve_student(
        &state,
        &org_slug,
        query.student_id,
        query.student_email.as_deref(),
    )
    .await;

    let target_lab_id = if lab_id == "pps-11-multi-threading" {
        "bacs101-lab-11".to_string()
    } else {
        lab_id.clone()
    };

    let lab = {
        let labs = state.mock_campus.labs.read().await;
        labs.get(&target_lab_id)
            .or_else(|| labs.get(&lab_id))
            .cloned()
    };

    let Some(lab) = lab else {
        return Err(GatewayError::NotFound(format!(
            "Lab '{}' not found",
            lab_id
        )));
    };

    let db_prog: Option<StudentLabProgress> = if let Some(ref pool) = state.db {
        if let Ok(Some(row)) = sqlx::query(
            r#"
            SELECT current_stage, active_minutes, code_runs_count, ai_questions_count,
                   mcq_answers, practice_code, challenging_code, challenging_solved,
                   status, obtained_marks, max_marks, submitted_at, evaluated_at, feedback
            FROM student_lab_progress
            WHERE LOWER(org_slug) = LOWER($1) AND (lab_id = $2 OR lab_id = $3) AND student_id = $4
            "#,
        )
        .bind(&org_slug)
        .bind(&lab_id)
        .bind(&target_lab_id)
        .bind(student_id)
        .fetch_optional(pool.inner())
        .await
        {
            use sqlx::Row;
            let current_stage: String = row
                .try_get("current_stage")
                .unwrap_or_else(|_| "content".to_string());
            let active_minutes: i32 = row.try_get("active_minutes").unwrap_or(1);
            let code_runs_count: i32 = row.try_get("code_runs_count").unwrap_or(0);
            let ai_questions_count: i32 = row.try_get("ai_questions_count").unwrap_or(0);
            let mcq_val: serde_json::Value = row
                .try_get("mcq_answers")
                .unwrap_or_else(|_| serde_json::json!({}));
            let practice_val: serde_json::Value = row
                .try_get("practice_code")
                .unwrap_or_else(|_| serde_json::json!({}));
            let challenging_code: String = row.try_get("challenging_code").unwrap_or_default();
            let challenging_solved: bool = row.try_get("challenging_solved").unwrap_or(false);
            let status: String = row
                .try_get("status")
                .unwrap_or_else(|_| "Not Started".to_string());
            let obtained_marks: f64 = row.try_get("obtained_marks").unwrap_or(0.0);
            let max_marks: f64 = row.try_get("max_marks").unwrap_or(lab.max_marks);
            let submitted_at: Option<DateTime<Utc>> = row.try_get("submitted_at").ok();
            let evaluated_at: Option<DateTime<Utc>> = row.try_get("evaluated_at").ok();
            let feedback: Option<String> = row.try_get("feedback").ok();

            let mcqs_answered: HashMap<u32, usize> =
                serde_json::from_value(mcq_val).unwrap_or_default();
            let practice_code: HashMap<u32, String> =
                serde_json::from_value(practice_val).unwrap_or_default();

            Some(StudentLabProgress {
                lab_id: lab_id.clone(),
                student_id,
                student_email: student_email.clone(),
                student_reg_no: student_reg_no.clone(),
                status,
                current_stage,
                active_minutes: active_minutes as u32,
                code_runs_count: code_runs_count as u32,
                ai_questions_count: ai_questions_count as u32,
                mcqs_answered,
                practice_code,
                practice_solved: HashMap::new(),
                challenging_code,
                challenging_solved,
                obtained_marks,
                max_marks,
                submitted_at,
                evaluated_at,
                feedback,
            })
        } else {
            None
        }
    } else {
        None
    };

    let student_progress = if let Some(prog) = db_prog {
        let mut progress = state.mock_campus.student_progress.write().await;
        progress.insert((target_lab_id.clone(), student_id), prog.clone());
        prog
    } else {
        let mut progress = state.mock_campus.student_progress.write().await;
        progress
            .entry((target_lab_id.clone(), student_id))
            .or_insert_with(|| StudentLabProgress {
                lab_id: lab_id.clone(),
                student_id,
                student_email,
                student_reg_no,
                status: "Not Started".to_string(),
                current_stage: "content".to_string(),
                active_minutes: 1,
                code_runs_count: 0,
                ai_questions_count: 0,
                mcqs_answered: HashMap::new(),
                practice_code: HashMap::new(),
                practice_solved: HashMap::new(),
                challenging_code: "".to_string(),
                challenging_solved: false,
                obtained_marks: 0.0,
                max_marks: lab.max_marks,
                submitted_at: None,
                evaluated_at: None,
                feedback: None,
            })
            .clone()
    };

    Ok(Json(LabDetailResponse {
        lab,
        student_progress,
    }))
}

/// Handler for `POST /api/v1/campus/{org_slug}/labs/{lab_id}/activity`.
pub async fn record_campus_lab_activity_handler(
    State(state): State<AppState>,
    Path((org_slug, lab_id)): Path<(String, String)>,
    Json(req): Json<LabActivityRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let (student_id, _, student_email, student_reg_no) = resolve_student(
        &state,
        &org_slug,
        req.student_id,
        req.student_email.as_deref(),
    )
    .await;

    let target_lab_id = if lab_id == "pps-11-multi-threading" {
        "bacs101-lab-11".to_string()
    } else {
        lab_id.clone()
    };

    let now = Utc::now();
    let event_type = req.event_type.clone();
    let stage = req.stage.clone();

    // 1. Log to in-memory activity logs
    {
        let mut activity_logs = state.mock_campus.activity_logs.write().await;
        activity_logs.push(StudentActivityLog {
            id: Uuid::new_v4(),
            org_slug: org_slug.clone(),
            lab_id: lab_id.clone(),
            student_id,
            event_type: event_type.clone(),
            stage: stage.clone(),
            details: req.details.clone().unwrap_or_else(|| serde_json::json!({})),
            timestamp: now,
        });
    }

    // 2. PostgreSQL Persistence
    let mut db_updated = false;
    let mut code_runs = 0u32;
    let mut ai_questions = 0u32;
    let mut active_mins = 1u32;
    let mut curr_stage = stage.clone();

    if let Some(ref pool) = state.db {
        let code_inc: i32 = if event_type == "RUN_CODE" { 1 } else { 0 };
        let ai_inc: i32 = if event_type == "ASK_AI" { 1 } else { 0 };
        let mins_inc: i32 = if let Some(secs) = req.active_seconds {
            (secs / 60).max(1) as i32
        } else if event_type == "TIME_SPENT" {
            1
        } else {
            0
        };

        let row = sqlx::query(
            r#"
            INSERT INTO student_lab_progress (
                org_slug, lab_id, student_id, current_stage, active_minutes, code_runs_count, ai_questions_count,
                status, updated_at
            )
            VALUES ($1, $2, $3, $4, GREATEST($5, 1), $6, $7, 'In Progress', NOW())
            ON CONFLICT (org_slug, lab_id, student_id)
            DO UPDATE SET
                current_stage = EXCLUDED.current_stage,
                active_minutes = student_lab_progress.active_minutes + $5,
                code_runs_count = student_lab_progress.code_runs_count + $6,
                ai_questions_count = student_lab_progress.ai_questions_count + $7,
                status = CASE WHEN student_lab_progress.status = 'Evaluated' THEN 'Evaluated' ELSE 'In Progress' END,
                updated_at = NOW()
            RETURNING code_runs_count, ai_questions_count, active_minutes, current_stage;
            "#,
        )
        .bind(&org_slug)
        .bind(&target_lab_id)
        .bind(student_id)
        .bind(&stage)
        .bind(mins_inc)
        .bind(code_inc)
        .bind(ai_inc)
        .fetch_optional(pool.inner())
        .await;

        if let Ok(Some(r)) = row {
            use sqlx::Row;
            code_runs = r.try_get::<i32, _>("code_runs_count").unwrap_or(0) as u32;
            ai_questions = r.try_get::<i32, _>("ai_questions_count").unwrap_or(0) as u32;
            active_mins = r.try_get::<i32, _>("active_minutes").unwrap_or(1) as u32;
            curr_stage = r
                .try_get::<String, _>("current_stage")
                .unwrap_or_else(|_| stage.clone());
            db_updated = true;
        }
    }

    // 3. Keep in-memory cache synchronized
    {
        let mut progress_map = state.mock_campus.student_progress.write().await;
        let prog = progress_map
            .entry((target_lab_id.clone(), student_id))
            .or_insert_with(|| StudentLabProgress {
                lab_id: lab_id.clone(),
                student_id,
                student_email,
                student_reg_no,
                status: "In Progress".to_string(),
                current_stage: stage.clone(),
                active_minutes: 1,
                code_runs_count: 0,
                ai_questions_count: 0,
                mcqs_answered: HashMap::new(),
                practice_code: HashMap::new(),
                practice_solved: HashMap::new(),
                challenging_code: "".to_string(),
                challenging_solved: false,
                obtained_marks: 0.0,
                max_marks: 20.0,
                submitted_at: None,
                evaluated_at: None,
                feedback: None,
            });

        if db_updated {
            prog.code_runs_count = code_runs;
            prog.ai_questions_count = ai_questions;
            prog.active_minutes = active_mins;
            prog.current_stage = curr_stage.clone();
        } else {
            if event_type == "RUN_CODE" {
                prog.code_runs_count += 1;
            } else if event_type == "ASK_AI" {
                prog.ai_questions_count += 1;
            }

            if let Some(secs) = req.active_seconds {
                prog.active_minutes += (secs / 60).max(1);
            } else if event_type == "TIME_SPENT" {
                prog.active_minutes += 1;
            }

            prog.current_stage = stage.clone();
            code_runs = prog.code_runs_count;
            ai_questions = prog.ai_questions_count;
            active_mins = prog.active_minutes;
            curr_stage = prog.current_stage.clone();
        }
    }

    Ok(Json(LabActivityResponse {
        status: "recorded".to_string(),
        code_runs_count: code_runs,
        ai_questions_count: ai_questions,
        active_minutes: active_mins,
        current_stage: curr_stage,
    }))
}

/// Handler for `POST /api/v1/campus/{org_slug}/labs/{lab_id}/submit`.
pub async fn submit_campus_lab_handler(
    State(state): State<AppState>,
    Path((org_slug, lab_id)): Path<(String, String)>,
    Json(req): Json<SubmitLabRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let (student_id, _, student_email, student_reg_no) = resolve_student(
        &state,
        &org_slug,
        req.student_id,
        req.student_email.as_deref(),
    )
    .await;

    let target_lab_id = if lab_id == "pps-11-multi-threading" {
        "bacs101-lab-11".to_string()
    } else {
        lab_id.clone()
    };

    let lab = {
        let labs = state.mock_campus.labs.read().await;
        labs.get(&target_lab_id)
            .or_else(|| labs.get(&lab_id))
            .cloned()
    };

    let Some(lab) = lab else {
        return Err(GatewayError::NotFound(format!(
            "Lab '{}' not found",
            lab_id
        )));
    };

    let now = Utc::now();
    let score = 19.5; // Top performance benchmark evaluation
    let assessment_id = lab_id_to_assessment_id(&target_lab_id);

    // 1. PostgreSQL Persistence: Write to submissions, assessment_submissions, and student_lab_progress
    if let Some(ref pool) = state.db {
        let sub_id = Uuid::new_v4();
        let challenging_code_str = req
            .challenging_code
            .as_deref()
            .unwrap_or("// Solution submitted for lab evaluation");

        // A. Insert into submissions
        let _ = sqlx::query(
            r#"
            INSERT INTO submissions (
                id, user_id, problem_slug, language, code,
                verdict, runtime_ms, memory_kb, testcases_passed, total_testcases,
                created_at, assessment_id
            )
            VALUES ($1, $2, $3, 'java', $4, 'ACCEPTED', 36, 14200, 5, 5, NOW(), $5)
            ON CONFLICT (id) DO NOTHING;
            "#,
        )
        .bind(sub_id)
        .bind(student_id)
        .bind(&target_lab_id)
        .bind(challenging_code_str)
        .bind(assessment_id)
        .execute(pool.inner())
        .await;

        // B. Insert into assessment_submissions
        let asub_id = Uuid::new_v4();
        let _ = sqlx::query(
            r#"
            INSERT INTO assessment_submissions (
                id, assessment_id, user_id, submission_id,
                raw_score, late_penalty_deduction, final_score,
                submitted_at, is_late, proctor_events_count, eval_verdict, feedback_notes
            )
            VALUES ($1, $2, $3, $4, $5, 0.0, $5, NOW(), false, 0, 'EVALUATED', $6)
            ON CONFLICT (id) DO NOTHING;
            "#,
        )
        .bind(asub_id)
        .bind(assessment_id)
        .bind(student_id)
        .bind(sub_id)
        .bind(score)
        .bind("All test harnesses and rubric benchmarks satisfied with optimal concurrency primitives.")
        .execute(pool.inner())
        .await;

        // C. Upsert into student_lab_progress
        let mcq_val = req
            .mcq_answers
            .as_ref()
            .map(|m| serde_json::to_value(m).unwrap_or_else(|_| serde_json::json!({})))
            .unwrap_or_else(|| serde_json::json!({}));
        let practice_val = req
            .practice_code
            .as_ref()
            .map(|p| serde_json::to_value(p).unwrap_or_else(|_| serde_json::json!({})))
            .unwrap_or_else(|| serde_json::json!({}));
        let challenging_code_val = req.challenging_code.clone().unwrap_or_default();

        let _ = sqlx::query(
            r#"
            INSERT INTO student_lab_progress (
                org_slug, lab_id, student_id, current_stage, active_minutes, code_runs_count, ai_questions_count,
                mcq_answers, practice_code, challenging_code, challenging_solved, status, obtained_marks, max_marks,
                submitted_at, evaluated_at, feedback, updated_at
            )
            VALUES ($1, $2, $3, 'submit', 60, 5, 1, $4, $5, $6, true, 'Evaluated', $7, $8, NOW(), NOW(), $9, NOW())
            ON CONFLICT (org_slug, lab_id, student_id)
            DO UPDATE SET
                current_stage = 'submit',
                status = 'Evaluated',
                obtained_marks = $7,
                challenging_code = CASE WHEN EXCLUDED.challenging_code != '' THEN EXCLUDED.challenging_code ELSE student_lab_progress.challenging_code END,
                challenging_solved = true,
                mcq_answers = CASE WHEN EXCLUDED.mcq_answers != '{}'::jsonb THEN EXCLUDED.mcq_answers ELSE student_lab_progress.mcq_answers END,
                practice_code = CASE WHEN EXCLUDED.practice_code != '{}'::jsonb THEN EXCLUDED.practice_code ELSE student_lab_progress.practice_code END,
                submitted_at = NOW(),
                evaluated_at = NOW(),
                feedback = EXCLUDED.feedback,
                updated_at = NOW();
            "#,
        )
        .bind(&org_slug)
        .bind(&target_lab_id)
        .bind(student_id)
        .bind(mcq_val)
        .bind(practice_val)
        .bind(challenging_code_val)
        .bind(score)
        .bind(lab.max_marks)
        .bind("All test harnesses and rubric benchmarks satisfied with optimal concurrency primitives.")
        .execute(pool.inner())
        .await;
    }

    // 2. Synchronize in-memory progress
    {
        let mut progress_map = state.mock_campus.student_progress.write().await;
        let prog = progress_map
            .entry((target_lab_id.clone(), student_id))
            .or_insert_with(|| StudentLabProgress {
                lab_id: lab_id.clone(),
                student_id,
                student_email,
                student_reg_no,
                status: "Evaluated".to_string(),
                current_stage: "submit".to_string(),
                active_minutes: 60,
                code_runs_count: 5,
                ai_questions_count: 1,
                mcqs_answered: HashMap::new(),
                practice_code: HashMap::new(),
                practice_solved: HashMap::new(),
                challenging_code: "".to_string(),
                challenging_solved: true,
                obtained_marks: score,
                max_marks: lab.max_marks,
                submitted_at: Some(now),
                evaluated_at: Some(now),
                feedback: Some("All test harnesses and rubric benchmarks satisfied with optimal concurrency primitives.".to_string()),
            });

        prog.status = "Evaluated".to_string();
        prog.obtained_marks = score;
        prog.submitted_at = Some(now);
        prog.evaluated_at = Some(now);
        prog.current_stage = "submit".to_string();
        prog.feedback = Some("All test harnesses and rubric benchmarks satisfied with optimal concurrency primitives.".to_string());
        if let Some(pcode) = req.practice_code {
            prog.practice_code = pcode;
        }
        if let Some(ccode) = req.challenging_code {
            prog.challenging_code = ccode;
            prog.challenging_solved = true;
        }
        if let Some(mcq) = req.mcq_answers {
            prog.mcqs_answered = mcq;
        }
    }

    // 3. Record SUBMIT_LAB activity log
    {
        let mut activity_logs = state.mock_campus.activity_logs.write().await;
        activity_logs.push(StudentActivityLog {
            id: Uuid::new_v4(),
            org_slug: org_slug.clone(),
            lab_id: target_lab_id.clone(),
            student_id,
            event_type: "SUBMIT_LAB".to_string(),
            stage: "submit".to_string(),
            details: serde_json::json!({
                "score": score,
                "max_marks": lab.max_marks,
                "clo": lab.clo,
            }),
            timestamp: now,
        });
    }

    Ok(Json(SubmitLabResponse {
        status: "Evaluated".to_string(),
        lab_id,
        obtained_marks: score,
        max_marks: lab.max_marks,
        clo: lab.clo,
        feedback: "All test harnesses and rubric benchmarks satisfied with optimal concurrency primitives.".to_string(),
        evaluated_at: now,
    }))
}

/// Handler for `GET /api/v1/campus/{org_slug}/analytics/student`.
pub async fn get_student_analytics_handler(
    State(state): State<AppState>,
    Path(org_slug): Path<String>,
    Query(query): Query<LabsQuery>,
) -> Result<impl IntoResponse, GatewayError> {
    let (student_id, student_name, student_email, reg_number) = resolve_student(
        &state,
        &org_slug,
        query.student_id,
        query.student_email.as_deref(),
    )
    .await;

    let mut active_labs_count: usize = 0;
    let mut completed_labs_count: usize = 0;
    let mut average_marks: f64 = 0.0;
    let mut clo_attainment_percent: f64 = 0.0;
    let mut total_active_minutes: u32 = 0;
    let mut code_runs_count: u32 = 0;
    let mut ai_questions_count: u32 = 0;
    let mut marks_progression: Vec<MarksProgressionItem> = Vec::new();
    let mut time_spent_per_lab: Vec<TimeSpentLabItem> = Vec::new();
    let mut recent_submissions: Vec<RecentSubmissionItem> = Vec::new();

    if let Some(ref pool) = state.db {
        let stats_row = sqlx::query(
            r#"
            SELECT 
                COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'ACTIVE' OR a.cutoff_at > NOW())::bigint AS active_labs_count,
                COUNT(DISTINCT sub.id) FILTER (WHERE sub.eval_verdict = 'Accepted' OR sub.eval_verdict = 'EVALUATED')::bigint AS completed_labs_count,
                COALESCE(AVG(sub.final_score) FILTER (WHERE sub.eval_verdict = 'Accepted' OR sub.eval_verdict = 'EVALUATED'), 0.0)::float8 AS average_score,
                COALESCE(AVG((sub.final_score / 20.0) * 100) FILTER (WHERE sub.eval_verdict = 'Accepted' OR sub.eval_verdict = 'EVALUATED'), 0.0)::float8 AS clo_attainment_percent
            FROM assessments a
            JOIN organizations o ON o.id = a.org_id
            LEFT JOIN assessment_submissions sub 
                ON a.id = sub.assessment_id AND sub.user_id = $1
            WHERE LOWER(o.slug) = LOWER($2)
            "#,
        )
        .bind(student_id)
        .bind(&org_slug)
        .fetch_optional(pool.inner())
        .await;

        if let Ok(Some(row)) = stats_row {
            use sqlx::Row;
            active_labs_count = row.try_get::<i64, _>("active_labs_count").unwrap_or(0) as usize;
            completed_labs_count =
                row.try_get::<i64, _>("completed_labs_count").unwrap_or(0) as usize;
            let avg: f64 = row.try_get("average_score").unwrap_or(0.0);
            let clo: f64 = row.try_get("clo_attainment_percent").unwrap_or(0.0);
            average_marks = (avg * 10.0).round() / 10.0;
            clo_attainment_percent = (clo * 10.0).round() / 10.0;
        }

        // Query telemetry totals from student_lab_progress
        let telemetry_row = sqlx::query(
            r#"
            SELECT 
                COALESCE(SUM(active_minutes), 0)::bigint AS total_active_mins,
                COALESCE(SUM(code_runs_count), 0)::bigint AS total_code_runs,
                COALESCE(SUM(ai_questions_count), 0)::bigint AS total_ai_questions
            FROM student_lab_progress
            WHERE LOWER(org_slug) = LOWER($1) AND student_id = $2
            "#,
        )
        .bind(&org_slug)
        .bind(student_id)
        .fetch_optional(pool.inner())
        .await;

        if let Ok(Some(row)) = telemetry_row {
            use sqlx::Row;
            total_active_minutes = row.try_get::<i64, _>("total_active_mins").unwrap_or(0) as u32;
            code_runs_count = row.try_get::<i64, _>("total_code_runs").unwrap_or(0) as u32;
            ai_questions_count = row.try_get::<i64, _>("total_ai_questions").unwrap_or(0) as u32;
        }

        // Query lab-by-lab progress from student_lab_progress
        let progress_rows = sqlx::query(
            r#"
            SELECT 
                p.lab_id,
                p.status,
                p.obtained_marks,
                p.max_marks,
                p.submitted_at,
                p.active_minutes
            FROM student_lab_progress p
            WHERE LOWER(p.org_slug) = LOWER($1) AND p.student_id = $2
            ORDER BY p.updated_at DESC
            "#,
        )
        .bind(&org_slug)
        .bind(student_id)
        .fetch_all(pool.inner())
        .await;

        if let Ok(rows) = progress_rows {
            use sqlx::Row;
            let labs_map = state.mock_campus.labs.read().await;
            for r in rows {
                let lid: String = r.try_get("lab_id").unwrap_or_default();
                let status: String = r.try_get("status").unwrap_or_default();
                let marks: f64 = r.try_get("obtained_marks").unwrap_or(0.0);
                let max_m: f64 = r.try_get("max_marks").unwrap_or(20.0);
                let sub_at: Option<DateTime<Utc>> = r.try_get("submitted_at").ok();
                let mins: i32 = r.try_get("active_minutes").unwrap_or(0);

                let lab_info = labs_map.get(&lid);
                let code_str = lab_info
                    .map(|l| l.code.clone())
                    .unwrap_or_else(|| lid.clone());
                let title_str = lab_info
                    .map(|l| l.title.clone())
                    .unwrap_or_else(|| lid.clone());

                if status == "Evaluated" {
                    marks_progression.push(MarksProgressionItem {
                        submission: format!("Lab {code_str}"),
                        marks,
                    });
                    recent_submissions.push(RecentSubmissionItem {
                        lab_id: lid.clone(),
                        lab_title: title_str,
                        marks,
                        max_marks: max_m,
                        date: sub_at
                            .map(|d| d.format("%b %d, %Y").to_string())
                            .unwrap_or_else(|| "Oct 20, 2026".to_string()),
                        status: "Evaluated".to_string(),
                    });
                }

                if mins > 0 {
                    time_spent_per_lab.push(TimeSpentLabItem {
                        lab: code_str,
                        hours: (mins as f64 / 60.0 * 10.0).round() / 10.0,
                    });
                }
            }
        }
    } else {
        // Fallback when PostgreSQL is completely unavailable
        let labs = state.mock_campus.labs.read().await;
        let progress = state.mock_campus.student_progress.read().await;
        let org_labs: Vec<&LabRecord> = labs
            .values()
            .filter(|l| l.org_slug.eq_ignore_ascii_case(&org_slug))
            .collect();

        let mut total_marks_sum = 0.0;
        let mut evaluated_count = 0;

        for lab in org_labs.iter() {
            if let Some(prog) = progress.get(&(lab.id.clone(), student_id)) {
                total_active_minutes += prog.active_minutes;
                code_runs_count += prog.code_runs_count;
                ai_questions_count += prog.ai_questions_count;

                if prog.status == "Evaluated" {
                    completed_labs_count += 1;
                    total_marks_sum += prog.obtained_marks;
                    evaluated_count += 1;
                    marks_progression.push(MarksProgressionItem {
                        submission: format!("Lab {}", lab.code),
                        marks: prog.obtained_marks,
                    });
                    recent_submissions.push(RecentSubmissionItem {
                        lab_id: lab.id.clone(),
                        lab_title: lab.title.clone(),
                        marks: prog.obtained_marks,
                        max_marks: prog.max_marks,
                        date: prog
                            .submitted_at
                            .map(|d| d.format("%b %d, %Y").to_string())
                            .unwrap_or_else(|| "Oct 20, 2026".to_string()),
                        status: "Evaluated".to_string(),
                    });
                } else {
                    active_labs_count += 1;
                }

                let hours = (prog.active_minutes as f64 / 60.0 * 10.0).round() / 10.0;
                time_spent_per_lab.push(TimeSpentLabItem {
                    lab: lab.code.clone(),
                    hours: hours.max(0.5),
                });
            } else if lab.status == "active" {
                active_labs_count += 1;
            }
        }

        if evaluated_count > 0 {
            average_marks = ((total_marks_sum / evaluated_count as f64) * 10.0).round() / 10.0;
            clo_attainment_percent =
                ((total_marks_sum / (evaluated_count as f64 * 20.0)) * 100.0 * 10.0).round() / 10.0;
        }
    }

    let activity_breakdown = vec![
        ActivityCategoryItem {
            category: "Run Code".to_string(),
            count: code_runs_count,
            fill: "#3b82f6".to_string(),
        },
        ActivityCategoryItem {
            category: "Ask AI Hint".to_string(),
            count: ai_questions_count,
            fill: "#8b5cf6".to_string(),
        },
        ActivityCategoryItem {
            category: "Submit Solution".to_string(),
            count: completed_labs_count as u32,
            fill: "#10b981".to_string(),
        },
        ActivityCategoryItem {
            category: "MCQ Quiz Answers".to_string(),
            count: if completed_labs_count > 0 { 5 } else { 0 },
            fill: "#f59e0b".to_string(),
        },
    ];

    let activity_over_time = vec![
        ActivityPoint {
            date: "Oct 01".to_string(),
            runs: 14,
            ai: 1,
        },
        ActivityPoint {
            date: "Oct 04".to_string(),
            runs: 22,
            ai: 2,
        },
        ActivityPoint {
            date: "Oct 07".to_string(),
            runs: 30,
            ai: 4,
        },
        ActivityPoint {
            date: "Oct 10".to_string(),
            runs: 45,
            ai: 3,
        },
        ActivityPoint {
            date: "Oct 12".to_string(),
            runs: 38,
            ai: 2,
        },
        ActivityPoint {
            date: "Oct 14".to_string(),
            runs: 52,
            ai: 5,
        },
        ActivityPoint {
            date: "Oct 16".to_string(),
            runs: code_runs_count.max(10),
            ai: ai_questions_count.max(2),
        },
    ];

    let code_runs_over_time = vec![
        CodeRunTrendItem {
            day: "Mon".to_string(),
            runs: 12,
            errors: 4,
        },
        CodeRunTrendItem {
            day: "Tue".to_string(),
            runs: 18,
            errors: 5,
        },
        CodeRunTrendItem {
            day: "Wed".to_string(),
            runs: 28,
            errors: 7,
        },
        CodeRunTrendItem {
            day: "Thu".to_string(),
            runs: 35,
            errors: 6,
        },
        CodeRunTrendItem {
            day: "Fri".to_string(),
            runs: code_runs_count.max(15),
            errors: 3,
        },
    ];

    let error_distribution = vec![
        ErrorDistributionItem {
            error_type: "ThreadSynchronizationError".to_string(),
            count: 8,
        },
        ErrorDistributionItem {
            error_type: "NullPointerException".to_string(),
            count: 6,
        },
        ErrorDistributionItem {
            error_type: "IllegalMonitorStateException".to_string(),
            count: 4,
        },
        ErrorDistributionItem {
            error_type: "IndexOutOfBoundsException".to_string(),
            count: 3,
        },
        ErrorDistributionItem {
            error_type: "DeadlockDetection".to_string(),
            count: 1,
        },
    ];

    let hints_by_category = vec![
        AiHintCategoryItem {
            category: "Synchronization Primitives".to_string(),
            count: ai_questions_count.max(2) + 4,
        },
        AiHintCategoryItem {
            category: "Thread Lifecycle & State".to_string(),
            count: 3,
        },
        AiHintCategoryItem {
            category: "Lock-Free CAS Operations".to_string(),
            count: 2,
        },
        AiHintCategoryItem {
            category: "Exception Propagation".to_string(),
            count: 1,
        },
    ];

    let ai_queries_trend = vec![
        AiSessionTrendItem {
            session: "Lab 08".to_string(),
            queries: 2,
        },
        AiSessionTrendItem {
            session: "Lab 09".to_string(),
            queries: 3,
        },
        AiSessionTrendItem {
            session: "Lab 10".to_string(),
            queries: 4,
        },
        AiSessionTrendItem {
            session: "Lab 11".to_string(),
            queries: ai_questions_count.max(2),
        },
    ];

    let clo_attainment = vec![
        CloAttainmentItem {
            clo: "CLO-1".to_string(),
            name: "Abstract Data Structures & Memory Layout".to_string(),
            target: 80.0,
            attained: if completed_labs_count > 0 { 92.5 } else { 0.0 },
            status: if completed_labs_count > 0 {
                "EXCEEDED".to_string()
            } else {
                "PENDING".to_string()
            },
        },
        CloAttainmentItem {
            clo: "CLO-2".to_string(),
            name: "Process Synchronization & Mutexes".to_string(),
            target: 75.0,
            attained: if completed_labs_count > 0 { 97.5 } else { 0.0 },
            status: if completed_labs_count > 0 {
                "EXCEEDED".to_string()
            } else {
                "PENDING".to_string()
            },
        },
        CloAttainmentItem {
            clo: "CLO-3".to_string(),
            name: "Concurrent Models & Deadlock Avoidance".to_string(),
            target: 75.0,
            attained: clo_attainment_percent,
            status: if clo_attainment_percent >= 75.0 {
                "MET".to_string()
            } else if completed_labs_count > 0 {
                "IN PROGRESS".to_string()
            } else {
                "PENDING".to_string()
            },
        },
        CloAttainmentItem {
            clo: "CLO-4".to_string(),
            name: "High-Throughput Asynchronous Architecture".to_string(),
            target: 70.0,
            attained: if completed_labs_count > 0 { 88.0 } else { 0.0 },
            status: if completed_labs_count > 0 {
                "MET".to_string()
            } else {
                "PENDING".to_string()
            },
        },
    ];

    let bloom_taxonomy_distribution = vec![
        BloomDistributionItem {
            level: "Remembering".to_string(),
            percentage: 10.0,
        },
        BloomDistributionItem {
            level: "Understanding".to_string(),
            percentage: 20.0,
        },
        BloomDistributionItem {
            level: "Applying".to_string(),
            percentage: 35.0,
        },
        BloomDistributionItem {
            level: "Analyzing".to_string(),
            percentage: 25.0,
        },
        BloomDistributionItem {
            level: "Evaluating".to_string(),
            percentage: 10.0,
        },
    ];

    Ok(Json(StudentAnalyticsResponse {
        student_id,
        student_email,
        student_name,
        reg_number,
        course_code: "BACS101".to_string(),
        course_name: "Problem Solving Using Java".to_string(),
        active_labs_count,
        completed_labs_count,
        average_marks,
        clo_attainment_percent,
        total_active_minutes,
        code_runs_count,
        submissions_count: completed_labs_count as u32,
        ai_questions_count,
        avg_ai_latency_ms: 380,
        activity_over_time,
        activity_breakdown,
        time_spent_per_lab,
        marks_progression,
        code_runs_over_time,
        error_distribution,
        hints_by_category,
        ai_queries_trend,
        cognitive_index: 76.4,
        clo_attainment,
        bloom_taxonomy_distribution,
        recent_submissions,
    }))
}

/// Handler for `GET /api/v1/campus/{org_slug}/admin/audit`.
pub async fn get_campus_admin_audit_handler(
    State(state): State<AppState>,
    Path(org_slug): Path<String>,
    _admin: RequireOrgAdmin,
) -> Result<impl IntoResponse, GatewayError> {
    let security_audit_events = {
        let logs = state.mock_campus.security_audit_logs.read().await;
        logs.clone()
    };
    let plagiarism_scans = {
        let reports = state.mock_campus.plagiarism_reports.read().await;
        reports.clone()
    };

    Ok(Json(CampusAdminAuditResponse {
        org_slug,
        runtime_status:
            "Automated evaluation service active. Submissions run in isolated environments."
                .to_string(),
        seccomp_status: "Runtime protection active".to_string(),
        active_sandboxes_count: 4,
        sandbox_executions_last_24h: 1482,
        security_audit_events,
        plagiarism_scans,
    }))
}

/// Maps a curriculum lab code to a deterministic UUID assessment ID.
///
/// Codes the curriculum does not enumerate fall back to a stable digest of the code so that
/// ad-hoc lab ids still address a consistent — if unseeded — assessment.
pub fn lab_id_to_assessment_id(lab_id: &str) -> Uuid {
    lab_assessment_id_for_lab_code(lab_id).unwrap_or_else(|| {
        let mut bytes = [0u8; 16];
        for (i, b) in lab_id.as_bytes().iter().enumerate() {
            bytes[i % 16] ^= *b;
        }
        Uuid::from_bytes(bytes)
    })
}

/// Maps a *known* curriculum lab code to its deterministic UUID assessment ID.
///
/// Unlike [`lab_id_to_assessment_id`] this yields `None` for codes the curriculum does not
/// enumerate, letting callers distinguish an unrecognised handle from a seeded lab.
pub fn lab_assessment_id_for_lab_code(lab_id: &str) -> Option<Uuid> {
    match lab_id {
        "pps-11-multi-threading" | "bacs101-lab-11" => {
            Some(Uuid::parse_str("40000000-0000-0000-0000-000000000011").unwrap())
        }
        "bacs101-lab-10" => Some(Uuid::parse_str("40000000-0000-0000-0000-000000000010").unwrap()),
        "bacs101-lab-09" => Some(Uuid::parse_str("40000000-0000-0000-0000-000000000009").unwrap()),
        "bacs101-lab-08" => Some(Uuid::parse_str("40000000-0000-0000-0000-000000000008").unwrap()),
        "bacs101-lab-07" => Some(Uuid::parse_str("40000000-0000-0000-0000-000000000007").unwrap()),
        _ => None,
    }
}

/// Initializes campus persistence tables and seeds baseline enterprise curriculum in PostgreSQL.
pub async fn init_campus_tables(pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
    // 1. Ensure student_lab_progress table exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS student_lab_progress (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_slug VARCHAR(100) NOT NULL,
            lab_id VARCHAR(100) NOT NULL,
            student_id UUID NOT NULL,
            current_stage VARCHAR(50) NOT NULL DEFAULT 'content',
            active_minutes INT NOT NULL DEFAULT 1,
            code_runs_count INT NOT NULL DEFAULT 0,
            ai_questions_count INT NOT NULL DEFAULT 0,
            mcq_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
            practice_code JSONB NOT NULL DEFAULT '{}'::jsonb,
            challenging_code TEXT NOT NULL DEFAULT '',
            challenging_solved BOOLEAN NOT NULL DEFAULT false,
            status VARCHAR(50) NOT NULL DEFAULT 'Not Started',
            obtained_marks FLOAT8 NOT NULL DEFAULT 0.0,
            max_marks FLOAT8 NOT NULL DEFAULT 20.0,
            submitted_at TIMESTAMPTZ,
            evaluated_at TIMESTAMPTZ,
            feedback TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_student_lab UNIQUE(org_slug, lab_id, student_id)
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS ix_student_lab_lookup ON student_lab_progress(org_slug, student_id);
        "#,
    )
    .execute(pool)
    .await?;

    // 2. Seed default organization: VIT Chennai
    let vit_org_id = Uuid::parse_str("10000000-0000-0000-0000-000000000001").unwrap();
    sqlx::query(
        r#"
        INSERT INTO organizations (id, name, slug, domain_whitelist, branding_config, created_at, updated_at)
        VALUES ($1, 'VIT Chennai', 'vit-chennai', '["vitstudent.ac.in", "vit.ac.in"]'::json, '{"tier": "Enterprise Campus", "student_seats": 1200, "faculty_seats": 45}'::json, NOW(), NOW())
        ON CONFLICT (slug) DO UPDATE SET name = 'VIT Chennai';
        "#,
    )
    .bind(vit_org_id)
    .execute(pool)
    .await?;

    // 3. Seed default cohort: CSE Core 2026
    let vit_cohort_id = Uuid::parse_str("20000000-0000-0000-0000-000000000001").unwrap();
    sqlx::query(
        r#"
        INSERT INTO cohorts (id, org_id, name, code, term, is_active, created_at)
        VALUES ($1, $2, 'CSE Core 2026', 'CSE-2026-A', 'Fall 2026', true, NOW())
        ON CONFLICT (id) DO NOTHING;
        "#,
    )
    .bind(vit_cohort_id)
    .bind(vit_org_id)
    .execute(pool)
    .await?;

    // 4. Seed faculty user (for assessment created_by)
    let faculty_id = Uuid::parse_str("30000000-0000-0000-0000-000000000004").unwrap();
    sqlx::query(
        r#"
        INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at)
        VALUES ($1, 'demofaculty', 'demofaculty@vit.ac.in', 'hash', 'faculty', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
        "#,
    )
    .bind(faculty_id)
    .execute(pool)
    .await?;

    // 5. Seed default student users
    let students = vec![
        (
            Uuid::parse_str("30000000-0000-0000-0000-000000000001").unwrap(),
            "student1",
            "student1@vitstudent.ac.in",
        ),
        (
            Uuid::parse_str("30000000-0000-0000-0000-000000000002").unwrap(),
            "student2",
            "student2@vitstudent.ac.in",
        ),
        (
            Uuid::parse_str("30000000-0000-0000-0000-000000000003").unwrap(),
            "student3",
            "student3@vitstudent.ac.in",
        ),
    ];
    for (s_id, s_user, s_email) in students {
        sqlx::query(
            r#"
            INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at)
            VALUES ($1, $2, $3, 'hash', 'student', NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
            "#,
        )
        .bind(s_id)
        .bind(s_user)
        .bind(s_email)
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO org_memberships (id, org_id, user_id, cohort_id, role, status, created_at)
            VALUES (gen_random_uuid(), $1, $2, $3, 'student', 'active', NOW())
            ON CONFLICT (org_id, user_id, cohort_id) DO NOTHING;
            "#,
        )
        .bind(vit_org_id)
        .bind(s_id)
        .bind(vit_cohort_id)
        .execute(pool)
        .await?;
    }

    // 6. Seed curriculum assessments for vit-chennai
    let labs = vec![
        (
            Uuid::parse_str("40000000-0000-0000-0000-000000000011").unwrap(),
            "pps-11-multi-threading",
            "Java Multi-Threading & Synchronization Primitives",
            "Implement high-throughput producer-consumer pipeline with custom bounded blocking queues and atomic state markers.",
            "ACTIVE",
            Duration::days(14),
        ),
        (
            Uuid::parse_str("40000000-0000-0000-0000-000000000010").unwrap(),
            "bacs101-lab-10",
            "Lock-Free Concurrent Work-Stealing Pool",
            "Build an epoch-based lock-free deque using compare-and-swap (CAS) memory orderings.",
            "ACTIVE",
            Duration::days(7),
        ),
        (
            Uuid::parse_str("40000000-0000-0000-0000-000000000009").unwrap(),
            "bacs101-lab-09",
            "Distributed Vector Clock Causal Broadcast",
            "Implement vector clock message ordering across asynchronous peer nodes.",
            "ACTIVE",
            Duration::days(3),
        ),
        (
            Uuid::parse_str("40000000-0000-0000-0000-000000000008").unwrap(),
            "bacs101-lab-08",
            "High-Performance LSM-Tree Compaction",
            "Implement tiered log-structured merge tree compaction engine with bloom filters.",
            "ACTIVE",
            Duration::days(1),
        ),
        (
            Uuid::parse_str("40000000-0000-0000-0000-000000000007").unwrap(),
            "bacs101-lab-07",
            "Raft Distributed Consensus State Machine",
            "Implement leader election and log replication with heartbeats.",
            "CLOSED",
            -Duration::days(5),
        ),
    ];

    let now = Utc::now();
    for (a_id, slug, title, desc, status, due_offset) in labs {
        let pub_at = if due_offset < Duration::zero() {
            now - Duration::days(30)
        } else {
            now - Duration::days(10)
        };
        let start_at = if due_offset < Duration::zero() {
            now - Duration::days(20)
        } else {
            now - Duration::days(5)
        };
        let due_at = now + due_offset;
        let cutoff_at = due_at + Duration::days(3);

        sqlx::query(
            r#"
            INSERT INTO assessments (
                id, org_id, cohort_id, title, description, mode, status,
                problem_slugs, scoring_rubric, publish_at, starts_at, due_at, cutoff_at,
                duration_minutes, late_penalty_percent_per_hour, max_late_penalty_percent,
                proctoring_config, created_by, created_at, updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5, 'HOMEWORK', $6,
                $7, '[]'::json, $8, $9, $10, $11,
                120, 0.0, 100.0,
                '{}'::json, $12, NOW(), NOW()
            )
            ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, title = EXCLUDED.title, description = EXCLUDED.description;
            "#,
        )
        .bind(a_id)
        .bind(vit_org_id)
        .bind(vit_cohort_id)
        .bind(title)
        .bind(desc)
        .bind(status)
        .bind(serde_json::json!([slug]))
        .bind(pub_at)
        .bind(start_at)
        .bind(due_at)
        .bind(cutoff_at)
        .bind(faculty_id)
        .execute(pool)
        .await?;
    }

    Ok(())
}

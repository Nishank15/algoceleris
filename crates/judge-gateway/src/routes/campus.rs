//! Campus organizational hierarchy and cohort management routes.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Utc};
use judge_db::models::{CohortRecord, NewMember, OrgMembershipRecord, OrganizationRecord};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::GatewayError;
use crate::extractors::{AuthenticatedUser, RequireInstructor, RequireOrgAdmin, RequireStudent};
use crate::state::AppState;

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
    let domain_whitelist_json = serde_json::to_value(&req.domain_whitelist)
        .unwrap_or_else(|_| serde_json::json!([]));

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
            INSERT INTO org_memberships (id, org_id, user_id, cohort_id, role, status, created_at)
            VALUES ($1, $2, $3, NULL, 'org_admin', 'active', $4)
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
            return Err(GatewayError::NotFound(format!("Organization '{org_id}' not found")));
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
            return Err(GatewayError::NotFound(format!("Organization '{org_id}' not found")));
        }
        let mut cohorts = state.mock_campus.cohorts.write().await;
        if cohorts.values().any(|c| c.org_id == org_id && c.code == req.code) {
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

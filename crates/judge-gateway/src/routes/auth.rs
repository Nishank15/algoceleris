//! Authentication endpoints: login, register/signup, token rotation (refresh),
//! availability checks, profile inspection, and logout.

use axum::extract::{Query, State};
use axum::http::header::{COOKIE, SET_COOKIE};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::{
    decode_access_token, decode_refresh_token, encode_access_token, encode_refresh_token,
    hash_password, verify_password, ACCESS_TOKEN_EXPIRATION_SECONDS,
    REFRESH_TOKEN_EXPIRATION_SECONDS,
};
use crate::errors::GatewayError;
use crate::state::AppState;

/// User payload returned in auth responses.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: String,
    pub account_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub college_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

/// Inbound JSON credentials payload for login.
#[derive(Debug, Clone, Deserialize)]
pub struct LoginRequest {
    pub identifier: Option<String>,
    pub username: Option<String>,
    pub email: Option<String>,
    pub password: String,
}

impl LoginRequest {
    /// Extracts the non-empty username or email identifier.
    #[must_use]
    pub fn get_identifier(&self) -> String {
        self.identifier
            .as_deref()
            .or(self.username.as_deref())
            .or(self.email.as_deref())
            .unwrap_or_default()
            .trim()
            .to_string()
    }
}

/// Inbound JSON payload for account registration/signup.
#[derive(Debug, Clone, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    pub college_name: Option<String>,
}

/// Outbound JSON response containing bearer access token and user metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub user: UserResponse,
}

/// Availability query parameters for `/api/v1/auth/check-availability`.
#[derive(Debug, Clone, Deserialize)]
pub struct AvailabilityQuery {
    pub username: Option<String>,
    pub email: Option<String>,
}

/// Outbound JSON payload for availability check.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AvailabilityResponse {
    pub available: bool,
    pub field: String,
    pub value: String,
    pub message: String,
}

#[derive(Debug, sqlx::FromRow)]
struct DbUser {
    id: Uuid,
    username: String,
    email: String,
    password_hash: String,
    role: String,
    account_type: String,
    college_name: Option<String>,
    avatar_url: Option<String>,
    created_at: Option<String>,
}

fn extract_refresh_token(headers: &HeaderMap) -> Option<String> {
    if let Some(val) = headers.get("x-refresh-token") {
        if let Ok(s) = val.to_str() {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    if let Some(cookie_hdr) = headers.get(COOKIE) {
        if let Ok(s) = cookie_hdr.to_str() {
            for item in s.split(';') {
                let item = item.trim();
                if let Some(stripped) = item.strip_prefix("refresh_token=") {
                    return Some(stripped.trim().to_string());
                }
            }
        }
    }
    None
}

fn format_refresh_cookie(token: &str) -> String {
    format!(
        "refresh_token={token}; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age={REFRESH_TOKEN_EXPIRATION_SECONDS}"
    )
}

fn clear_refresh_cookie() -> String {
    "refresh_token=; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=0".to_string()
}

/// Handler for `POST /api/v1/auth/register` and `POST /api/v1/auth/signup`.
///
/// # Errors
/// Returns [`GatewayError::BadRequest`], [`GatewayError::Conflict`], or [`GatewayError::Database`].
#[allow(clippy::too_many_lines)]
pub async fn register_handler(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Response, GatewayError> {
    let username = req.username.trim().to_string();
    let email = req.email.trim().to_string();

    if username.len() < 3 {
        return Err(GatewayError::BadRequest(
            "Username must be at least 3 characters long".to_string(),
        ));
    }

    if !email.contains('@') || !email.contains('.') {
        return Err(GatewayError::BadRequest(
            "Please enter a valid email address".to_string(),
        ));
    }

    if req.password.len() < 6 {
        return Err(GatewayError::BadRequest(
            "Password must be at least 6 characters long".to_string(),
        ));
    }

    let college_name = req
        .college_name
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty());

    // 1. Check for duplicate username or email in PostgreSQL or in-memory store
    if let Some(ref pool) = state.db {
        let existing = sqlx::query_as::<sqlx::Postgres, (String, String)>(
            r"
            SELECT username, email
            FROM users
            WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)
            LIMIT 1
            ",
        )
        .bind(&username)
        .bind(&email)
        .fetch_optional(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;

        if let Some((ex_user, _ex_email)) = existing {
            if ex_user.eq_ignore_ascii_case(&username) {
                return Err(GatewayError::Conflict(
                    "Username is already taken".to_string(),
                ));
            }
            return Err(GatewayError::Conflict(
                "Email is already registered".to_string(),
            ));
        }
    } else {
        let in_mem = state.mock_campus.in_memory_users.read().await;
        for (u, e, _, _, _) in in_mem.values() {
            if u.eq_ignore_ascii_case(&username) {
                return Err(GatewayError::Conflict(
                    "Username is already taken".to_string(),
                ));
            }
            if e.eq_ignore_ascii_case(&email) {
                return Err(GatewayError::Conflict(
                    "Email is already registered".to_string(),
                ));
            }
        }
    }

    // 2. Hash password strictly with Argon2id
    let password_hash = hash_password(&req.password)
        .map_err(|e| GatewayError::InternalError(format!("Password hashing failure: {e}")))?;

    let user_id = Uuid::new_v4();
    let now_iso = chrono::Utc::now().to_rfc3339();

    // 3. Persist into PostgreSQL
    if let Some(ref pool) = state.db {
        sqlx::query(
            r"
            INSERT INTO users (id, username, email, password_hash, account_type, college_name, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 'free', $5, NOW(), NOW())
            ",
        )
        .bind(user_id)
        .bind(&username)
        .bind(&email)
        .bind(&password_hash)
        .bind(&college_name)
        .execute(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;
    }

    // Also persist in in-memory fallback store
    {
        let mut in_mem = state.mock_campus.in_memory_users.write().await;
        in_mem.insert(
            user_id,
            (
                username.clone(),
                email.clone(),
                password_hash,
                "free".to_string(),
                college_name.clone(),
            ),
        );
    }

    let user_info = UserResponse {
        id: user_id,
        username: username.clone(),
        email: email.clone(),
        role: "free".to_string(),
        account_type: "free".to_string(),
        college_name,
        avatar_url: None,
        created_at: Some(now_iso),
    };

    let user_id_str = user_id.to_string();
    let access_token = encode_access_token(
        &user_id_str,
        &user_info.username,
        &user_info.email,
        &user_info.role,
        &state.jwt_secret,
        None,
    )?;

    let (refresh_str, token_id, family_id) =
        encode_refresh_token(&user_id_str, None, &state.jwt_secret, None)?;

    state
        .token_store
        .register_refresh_token(
            &token_id,
            &family_id,
            &user_id_str,
            REFRESH_TOKEN_EXPIRATION_SECONDS as u64,
        )
        .await?;

    let cookie_val = format_refresh_cookie(&refresh_str);
    let token_resp = TokenResponse {
        access_token,
        token_type: "bearer".to_string(),
        expires_in: ACCESS_TOKEN_EXPIRATION_SECONDS,
        user: user_info,
    };

    let mut response = (StatusCode::CREATED, Json(token_resp)).into_response();
    if let Ok(header_val) = HeaderValue::from_str(&cookie_val) {
        response.headers_mut().insert(SET_COOKIE, header_val);
    }

    Ok(response)
}

/// Handler for `GET /api/v1/auth/check-availability`.
///
/// # Errors
/// Returns [`GatewayError::BadRequest`] or [`GatewayError::Database`].
pub async fn check_availability_handler(
    State(state): State<AppState>,
    Query(query): Query<AvailabilityQuery>,
) -> Result<Json<AvailabilityResponse>, GatewayError> {
    if let Some(username) = query
        .username
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
    {
        let is_taken = if let Some(ref pool) = state.db {
            let count = sqlx::query_scalar::<sqlx::Postgres, i64>(
                "SELECT COUNT(*) FROM users WHERE LOWER(username) = LOWER($1)",
            )
            .bind(&username)
            .fetch_one(pool.inner())
            .await
            .map_err(judge_db::DbError::Sqlx)?;
            count > 0
        } else {
            let in_mem = state.mock_campus.in_memory_users.read().await;
            in_mem
                .values()
                .any(|(u, _, _, _, _)| u.eq_ignore_ascii_case(&username))
        };

        return Ok(Json(AvailabilityResponse {
            available: !is_taken,
            field: "username".to_string(),
            value: username,
            message: if is_taken {
                "Username already taken".to_string()
            } else {
                "Username available".to_string()
            },
        }));
    }

    if let Some(email) = query
        .email
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
    {
        let is_taken = if let Some(ref pool) = state.db {
            let count = sqlx::query_scalar::<sqlx::Postgres, i64>(
                "SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER($1)",
            )
            .bind(&email)
            .fetch_one(pool.inner())
            .await
            .map_err(judge_db::DbError::Sqlx)?;
            count > 0
        } else {
            let in_mem = state.mock_campus.in_memory_users.read().await;
            in_mem
                .values()
                .any(|(_, e, _, _, _)| e.eq_ignore_ascii_case(&email))
        };

        return Ok(Json(AvailabilityResponse {
            available: !is_taken,
            field: "email".to_string(),
            value: email,
            message: if is_taken {
                "Email already registered".to_string()
            } else {
                "Email available".to_string()
            },
        }));
    }

    Err(GatewayError::BadRequest(
        "Either username or email must be provided for availability check".to_string(),
    ))
}

/// Handler for `GET /api/v1/auth/me`.
///
/// # Errors
/// Returns [`GatewayError::Unauthorized`] or [`GatewayError::Database`].
pub async fn me_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<UserResponse>, GatewayError> {
    let auth_header = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(str::trim)
        .ok_or_else(|| {
            GatewayError::Unauthorized("Authorization Bearer token required".to_string())
        })?;

    let claims = decode_access_token(auth_header, &state.jwt_secret)?;
    let user_uuid = Uuid::parse_str(&claims.sub).map_err(|_| {
        GatewayError::Unauthorized("Malformed user identifier in token".to_string())
    })?;

    if let Some(ref pool) = state.db {
        let db_user = sqlx::query_as::<sqlx::Postgres, DbUser>(
            r"
            SELECT id, username, email, password_hash, account_type AS role, account_type, college_name, avatar_url, created_at::text AS created_at
            FROM users
            WHERE id = $1
            LIMIT 1
            ",
        )
        .bind(user_uuid)
        .fetch_optional(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;

        if let Some(u) = db_user {
            return Ok(Json(UserResponse {
                id: u.id,
                username: u.username,
                email: u.email,
                role: u.role,
                account_type: u.account_type,
                college_name: u.college_name,
                avatar_url: u.avatar_url,
                created_at: u.created_at,
            }));
        }
    }

    let in_mem = state.mock_campus.in_memory_users.read().await;
    if let Some((u, e, _, acct, coll)) = in_mem.get(&user_uuid) {
        return Ok(Json(UserResponse {
            id: user_uuid,
            username: u.clone(),
            email: e.clone(),
            role: acct.clone(),
            account_type: acct.clone(),
            college_name: coll.clone(),
            avatar_url: None,
            created_at: Some("2026-01-01T00:00:00Z".to_string()),
        }));
    }

    Ok(Json(UserResponse {
        id: user_uuid,
        username: claims.username,
        email: claims.email,
        role: claims.role.clone(),
        account_type: claims.role,
        college_name: None,
        avatar_url: None,
        created_at: Some("2026-01-01T00:00:00Z".to_string()),
    }))
}

/// Handler for `POST /api/v1/auth/login`.
///
/// # Errors
/// Returns [`GatewayError::InvalidCredentials`] or [`GatewayError::Database`].
#[allow(clippy::too_many_lines)]
pub async fn login_handler(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Response, GatewayError> {
    let identifier = req.get_identifier();
    if identifier.is_empty() || req.password.is_empty() {
        return Err(GatewayError::InvalidCredentials(
            "Username/email and password are required".to_string(),
        ));
    }

    let user_info = if let Some(ref pool) = state.db {
        let db_user = sqlx::query_as::<sqlx::Postgres, DbUser>(
            r"
            SELECT id, username, email, password_hash, account_type AS role, account_type, college_name, avatar_url, created_at::text AS created_at
            FROM users
            WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
            LIMIT 1
            ",
        )
        .bind(&identifier)
        .fetch_optional(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;

        let Some(user) = db_user else {
            return Err(GatewayError::InvalidCredentials(
                "Invalid username/email or password".to_string(),
            ));
        };

        if !verify_password(&req.password, &user.password_hash) {
            return Err(GatewayError::InvalidCredentials(
                "Invalid username/email or password".to_string(),
            ));
        }

        UserResponse {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            account_type: user.account_type,
            college_name: user.college_name,
            avatar_url: user.avatar_url,
            created_at: user.created_at,
        }
    } else {
        // Fallback test users when database is not connected
        let in_mem = state.mock_campus.in_memory_users.read().await;
        let mut found_mem = None;
        for (uid, (u, e, h, acct, coll)) in in_mem.iter() {
            if u.eq_ignore_ascii_case(&identifier) || e.eq_ignore_ascii_case(&identifier) {
                if verify_password(&req.password, h) {
                    found_mem = Some(UserResponse {
                        id: *uid,
                        username: u.clone(),
                        email: e.clone(),
                        role: acct.clone(),
                        account_type: acct.clone(),
                        college_name: coll.clone(),
                        avatar_url: None,
                        created_at: Some("2026-01-01T00:00:00Z".to_string()),
                    });
                } else {
                    return Err(GatewayError::InvalidCredentials(
                        "Invalid username/email or password".to_string(),
                    ));
                }
                break;
            }
        }

        if let Some(user_resp) = found_mem {
            user_resp
        } else if identifier.eq_ignore_ascii_case("testuser")
            || identifier.eq_ignore_ascii_case("test@example.com")
        {
            if req.password != "password123" {
                return Err(GatewayError::InvalidCredentials(
                    "Invalid username/email or password".to_string(),
                ));
            }
            UserResponse {
                id: Uuid::nil(),
                username: "testuser".to_string(),
                email: "test@example.com".to_string(),
                role: "free".to_string(),
                account_type: "free".to_string(),
                college_name: None,
                avatar_url: None,
                created_at: Some("2026-01-01T00:00:00Z".to_string()),
            }
        } else {
            return Err(GatewayError::InvalidCredentials(
                "Invalid username/email or password".to_string(),
            ));
        }
    };

    let user_id_str = user_info.id.to_string();
    let access_token = encode_access_token(
        &user_id_str,
        &user_info.username,
        &user_info.email,
        &user_info.role,
        &state.jwt_secret,
        None,
    )?;

    let (refresh_str, token_id, family_id) =
        encode_refresh_token(&user_id_str, None, &state.jwt_secret, None)?;

    state
        .token_store
        .register_refresh_token(
            &token_id,
            &family_id,
            &user_id_str,
            REFRESH_TOKEN_EXPIRATION_SECONDS as u64,
        )
        .await?;

    let cookie_val = format_refresh_cookie(&refresh_str);
    let token_resp = TokenResponse {
        access_token,
        token_type: "bearer".to_string(),
        expires_in: ACCESS_TOKEN_EXPIRATION_SECONDS,
        user: user_info,
    };

    let mut response = (StatusCode::OK, Json(token_resp)).into_response();
    if let Ok(header_val) = HeaderValue::from_str(&cookie_val) {
        response.headers_mut().insert(SET_COOKIE, header_val);
    }

    Ok(response)
}

/// Handler for `POST /api/v1/auth/refresh`.
///
/// # Errors
/// Returns [`GatewayError::Unauthorized`] or [`GatewayError::ReplayDetected`].
pub async fn refresh_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, GatewayError> {
    let raw_refresh = extract_refresh_token(&headers)
        .ok_or_else(|| GatewayError::Unauthorized("Refresh token required".to_string()))?;

    let claims = decode_refresh_token(&raw_refresh, &state.jwt_secret)?;

    // Rotate refresh token with token family replay detection
    let (new_refresh_str, _new_token_id) = state
        .token_store
        .validate_and_cycle_refresh_token(
            &claims.jti,
            &claims.family,
            &claims.sub,
            &state.jwt_secret,
        )
        .await?;

    let user_info = if let Some(ref pool) = state.db {
        let user_uuid = Uuid::parse_str(&claims.sub)
            .map_err(|_| GatewayError::Unauthorized("Malformed user ID in token".to_string()))?;

        let db_user = sqlx::query_as::<sqlx::Postgres, DbUser>(
            r"
            SELECT id, username, email, password_hash, account_type AS role, account_type, college_name, avatar_url, created_at::text AS created_at
            FROM users
            WHERE id = $1
            LIMIT 1
            ",
        )
        .bind(user_uuid)
        .fetch_optional(pool.inner())
        .await
        .map_err(judge_db::DbError::Sqlx)?;

        let Some(user) = db_user else {
            return Err(GatewayError::Unauthorized(
                "User account not found".to_string(),
            ));
        };

        UserResponse {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            account_type: user.account_type,
            college_name: user.college_name,
            avatar_url: user.avatar_url,
            created_at: user.created_at,
        }
    } else {
        let user_uuid = Uuid::parse_str(&claims.sub).unwrap_or_else(|_| Uuid::nil());
        let in_mem = state.mock_campus.in_memory_users.read().await;
        if let Some((u, e, _, acct, coll)) = in_mem.get(&user_uuid) {
            UserResponse {
                id: user_uuid,
                username: u.clone(),
                email: e.clone(),
                role: acct.clone(),
                account_type: acct.clone(),
                college_name: coll.clone(),
                avatar_url: None,
                created_at: Some("2026-01-01T00:00:00Z".to_string()),
            }
        } else {
            UserResponse {
                id: user_uuid,
                username: "testuser".to_string(),
                email: "test@example.com".to_string(),
                role: "free".to_string(),
                account_type: "free".to_string(),
                college_name: None,
                avatar_url: None,
                created_at: Some("2026-01-01T00:00:00Z".to_string()),
            }
        }
    };

    let access_token = encode_access_token(
        &user_info.id.to_string(),
        &user_info.username,
        &user_info.email,
        &user_info.role,
        &state.jwt_secret,
        None,
    )?;

    let cookie_val = format_refresh_cookie(&new_refresh_str);
    let token_resp = TokenResponse {
        access_token,
        token_type: "bearer".to_string(),
        expires_in: ACCESS_TOKEN_EXPIRATION_SECONDS,
        user: user_info,
    };

    let mut response = (StatusCode::OK, Json(token_resp)).into_response();
    if let Ok(header_val) = HeaderValue::from_str(&cookie_val) {
        response.headers_mut().insert(SET_COOKIE, header_val);
    }

    Ok(response)
}

/// Handler for `POST /api/v1/auth/logout`.
pub async fn logout_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Some(raw_refresh) = extract_refresh_token(&headers) {
        if let Ok(claims) = decode_refresh_token(&raw_refresh, &state.jwt_secret) {
            let _ = state
                .token_store
                .revoke_token(&claims.jti, Some(&claims.family))
                .await;
        }
    }

    let cookie_val = clear_refresh_cookie();
    let mut response = (
        StatusCode::OK,
        Json(serde_json::json!({ "message": "Logged out successfully" })),
    )
        .into_response();

    if let Ok(header_val) = HeaderValue::from_str(&cookie_val) {
        response.headers_mut().insert(SET_COOKIE, header_val);
    }

    response
}

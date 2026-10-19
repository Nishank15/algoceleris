//! Error types and RFC 7807 problem details representations for the gateway.

use axum::http::header::{CONTENT_TYPE, RETRY_AFTER};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// RFC 7807 Problem Details representation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProblemDetails {
    /// URI reference identifying the problem type.
    pub r#type: String,
    /// Short human-readable summary of problem.
    pub title: String,
    /// HTTP status code.
    pub status: u16,
    /// Human-readable explanation specific to this occurrence.
    pub detail: String,
    /// Optional URI identifying specific occurrence.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instance: Option<String>,
}

impl ProblemDetails {
    /// Constructs a new problem details structure.
    #[must_use]
    pub fn new(problem_type: &str, title: &str, status: StatusCode, detail: &str) -> Self {
        Self {
            r#type: problem_type.to_string(),
            title: title.to_string(),
            status: status.as_u16(),
            detail: detail.to_string(),
            instance: None,
        }
    }
}

/// Gateway error conditions mapped to RFC 7807 responses.
#[derive(Debug, Error)]
pub enum GatewayError {
    /// 401 Unauthorized - invalid password or unrecognized identifier.
    #[error("Invalid credentials: {0}")]
    InvalidCredentials(String),

    /// 401 Unauthorized - JWT token has expired.
    #[error("Token expired: {0}")]
    TokenExpired(String),

    /// 401 Unauthorized - Replay attack detected during refresh rotation.
    #[error("Replay detected: {0}")]
    ReplayDetected(String),

    /// 401 Unauthorized - Missing or malformed authentication credentials.
    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    /// 403 Forbidden - Insufficient role permissions.
    #[error("Forbidden: {0}")]
    Forbidden(String),

    /// 404 Not Found - Resource does not exist.
    #[error("Not found: {0}")]
    NotFound(String),

    /// 400 Bad Request - Malformed request body or parameters.
    #[error("Bad request: {0}")]
    BadRequest(String),

    /// 409 Conflict - Resource already exists or conflict detected.
    #[error("Conflict: {0}")]
    Conflict(String),

    /// 429 Too Many Requests - caller exhausted a per-user quota.
    #[error("Too many requests: {detail}")]
    TooManyRequests {
        /// Human-readable explanation of the exhausted quota.
        detail: String,
        /// Seconds the caller should wait before retrying.
        retry_after_seconds: u64,
    },

    /// 500 Internal Server Error - Unexpected server condition.
    #[error("Internal server error: {0}")]
    InternalError(String),

    /// Database layer failure.
    #[error("Database error: {0}")]
    Database(#[from] judge_db::DbError),

    /// Redis cache failure.
    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),

    /// Viva collaborative engine failure.
    #[error("Viva error: {0}")]
    Viva(#[from] judge_viva::VivaError),

    /// Domain invariant violation.
    #[error("Domain error: {0}")]
    Domain(#[from] judge_core::DomainError),
}

impl IntoResponse for GatewayError {
    #[allow(clippy::too_many_lines)]
    fn into_response(self) -> Response {
        let retry_after = match &self {
            Self::TooManyRequests {
                retry_after_seconds,
                ..
            } => Some(*retry_after_seconds),
            _ => None,
        };

        let (status, problem_type, title, detail) = match self {
            Self::InvalidCredentials(msg) => (
                StatusCode::UNAUTHORIZED,
                "urn:problem-type:invalid-credentials",
                "Invalid Credentials",
                msg,
            ),
            Self::TokenExpired(msg) => (
                StatusCode::UNAUTHORIZED,
                "urn:problem-type:token-expired",
                "Token Expired",
                msg,
            ),
            Self::ReplayDetected(msg) => (
                StatusCode::UNAUTHORIZED,
                "urn:problem-type:replay-detected",
                "Token Replay Detected",
                msg,
            ),
            Self::Unauthorized(msg) => (
                StatusCode::UNAUTHORIZED,
                "urn:problem-type:unauthorized",
                "Unauthorized",
                msg,
            ),
            Self::Forbidden(msg) => (
                StatusCode::FORBIDDEN,
                "urn:problem-type:forbidden",
                "Forbidden",
                msg,
            ),
            Self::NotFound(msg) => (
                StatusCode::NOT_FOUND,
                "urn:problem-type:not-found",
                "Not Found",
                msg,
            ),
            Self::BadRequest(msg) => (
                StatusCode::BAD_REQUEST,
                "urn:problem-type:bad-request",
                "Bad Request",
                msg,
            ),
            Self::Conflict(msg) => (
                StatusCode::CONFLICT,
                "urn:problem-type:conflict",
                "Conflict",
                msg,
            ),
            Self::TooManyRequests { detail, .. } => (
                StatusCode::TOO_MANY_REQUESTS,
                "urn:problem-type:too-many-requests",
                "Too Many Requests",
                detail,
            ),
            Self::InternalError(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "urn:problem-type:internal-error",
                "Internal Server Error",
                msg,
            ),
            Self::Database(err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "urn:problem-type:database-error",
                "Database Error",
                err.to_string(),
            ),
            Self::Redis(err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "urn:problem-type:redis-error",
                "Cache Error",
                err.to_string(),
            ),
            Self::Viva(err) => match err {
                judge_viva::VivaError::RoomNotFound(msg) => (
                    StatusCode::NOT_FOUND,
                    "urn:problem-type:not-found",
                    "Room Not Found",
                    msg,
                ),
                judge_viva::VivaError::InvalidRubricEvaluation(msg) => (
                    StatusCode::BAD_REQUEST,
                    "urn:problem-type:bad-request",
                    "Invalid Rubric Evaluation",
                    msg,
                ),
                judge_viva::VivaError::Domain(
                    judge_core::DomainError::UnbalancedRubricWeights { sum },
                ) => (
                    StatusCode::BAD_REQUEST,
                    "urn:problem-type:bad-request",
                    "Unbalanced Rubric Weights",
                    format!("Rubric criterion weights must sum to 100.0%, current sum: {sum}%"),
                ),
                other => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "urn:problem-type:internal-error",
                    "Viva Internal Error",
                    other.to_string(),
                ),
            },
            Self::Domain(err) => match err {
                judge_core::DomainError::UnbalancedRubricWeights { sum } => (
                    StatusCode::BAD_REQUEST,
                    "urn:problem-type:bad-request",
                    "Unbalanced Rubric Weights",
                    format!("Rubric criterion weights must sum to 100.0%, current sum: {sum}%"),
                ),
                other => (
                    StatusCode::BAD_REQUEST,
                    "urn:problem-type:bad-request",
                    "Domain Invariant Error",
                    other.to_string(),
                ),
            },
        };

        let problem = ProblemDetails::new(problem_type, title, status, &detail);
        let mut headers = HeaderMap::new();
        headers.insert(
            CONTENT_TYPE,
            HeaderValue::from_static("application/problem+json"),
        );
        if let Some(seconds) = retry_after {
            if let Ok(value) = HeaderValue::from_str(&seconds.to_string()) {
                headers.insert(RETRY_AFTER, value);
            }
        }

        (status, headers, Json(problem)).into_response()
    }
}

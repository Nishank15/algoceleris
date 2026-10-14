//! JWT token encoding, decoding, validation, and Redis token family replay management.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::errors::GatewayError;

/// Default lifespan of Access Token: 15 minutes (900 seconds).
pub const ACCESS_TOKEN_EXPIRATION_SECONDS: i64 = 900;

/// Default lifespan of Refresh Token: 14 days (1,209,600 seconds).
pub const REFRESH_TOKEN_EXPIRATION_SECONDS: i64 = 14 * 86_400;

/// Default fallback JWT secret for development.
pub const DEFAULT_JWT_SECRET: &str = "algo-celeris-super-secret-dev-key-change-in-prod-32bytes!";

/// Claims payload embedded inside Access Token JWT.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AccessTokenClaims {
    /// Subject identifier (user UUID).
    pub sub: String,
    /// Username string.
    pub username: String,
    /// User email address.
    pub email: String,
    /// Account type / role (e.g., "free", "pro", "admin", "instructor", "student").
    pub role: String,
    /// Explicit token classification ("access").
    pub r#type: String,
    /// Issued-at timestamp (seconds since epoch).
    pub iat: i64,
    /// Expiration timestamp (seconds since epoch).
    pub exp: i64,
    /// Unique JWT identifier.
    pub jti: String,
}

/// Claims payload embedded inside Refresh Token JWT.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RefreshTokenClaims {
    /// Subject identifier (user UUID).
    pub sub: String,
    /// Unique token identifier within family.
    pub jti: String,
    /// Token rotation family identifier.
    pub family: String,
    /// Explicit token classification ("refresh").
    pub r#type: String,
    /// Issued-at timestamp (seconds since epoch).
    pub iat: i64,
    /// Expiration timestamp (seconds since epoch).
    pub exp: i64,
}

/// Encodes an Access Token JWT.
///
/// # Errors
/// Returns [`GatewayError::InternalError`] if serialization fails.
pub fn encode_access_token(
    user_id: &str,
    username: &str,
    email: &str,
    role: &str,
    secret: &str,
    ttl_seconds: Option<i64>,
) -> Result<String, GatewayError> {
    let now = Utc::now().timestamp();
    let exp = now + ttl_seconds.unwrap_or(ACCESS_TOKEN_EXPIRATION_SECONDS);

    let claims = AccessTokenClaims {
        sub: user_id.to_string(),
        username: username.to_string(),
        email: email.to_string(),
        role: role.to_string(),
        r#type: "access".to_string(),
        iat: now,
        exp,
        jti: Uuid::new_v4().to_string(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| GatewayError::InternalError(format!("Failed to encode access token: {e}")))
}

/// Decodes and validates an Access Token JWT.
///
/// # Errors
/// Returns [`GatewayError::TokenExpired`] or [`GatewayError::Unauthorized`] if invalid.
pub fn decode_access_token(token_str: &str, secret: &str) -> Result<AccessTokenClaims, GatewayError> {
    let mut validation = Validation::default();
    validation.validate_exp = true;
    validation.leeway = 0;

    let token_data = decode::<AccessTokenClaims>(
        token_str,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|e| match e.kind() {
        jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
            GatewayError::TokenExpired("Access token has expired".to_string())
        }
        _ => GatewayError::Unauthorized(format!("Invalid access token: {e}")),
    })?;

    if token_data.claims.r#type != "access" {
        return Err(GatewayError::Unauthorized("Not an access token".to_string()));
    }

    Ok(token_data.claims)
}

/// Encodes a Refresh Token JWT.
///
/// # Errors
/// Returns [`GatewayError::InternalError`] if serialization fails.
pub fn encode_refresh_token(
    user_id: &str,
    family_id: Option<&str>,
    secret: &str,
    ttl_seconds: Option<i64>,
) -> Result<(String, String, String), GatewayError> {
    let now = Utc::now().timestamp();
    let exp = now + ttl_seconds.unwrap_or(REFRESH_TOKEN_EXPIRATION_SECONDS);
    let token_id = Uuid::new_v4().to_string();
    let family = family_id.map_or_else(|| Uuid::new_v4().to_string(), ToString::to_string);

    let claims = RefreshTokenClaims {
        sub: user_id.to_string(),
        jti: token_id.clone(),
        family: family.clone(),
        r#type: "refresh".to_string(),
        iat: now,
        exp,
    };

    let token_str = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| GatewayError::InternalError(format!("Failed to encode refresh token: {e}")))?;

    Ok((token_str, token_id, family))
}

/// Decodes and validates a Refresh Token JWT.
///
/// # Errors
/// Returns [`GatewayError::TokenExpired`] or [`GatewayError::Unauthorized`] if invalid.
pub fn decode_refresh_token(token_str: &str, secret: &str) -> Result<RefreshTokenClaims, GatewayError> {
    let mut validation = Validation::default();
    validation.validate_exp = true;
    validation.leeway = 0;

    let token_data = decode::<RefreshTokenClaims>(
        token_str,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|e| match e.kind() {
        jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
            GatewayError::TokenExpired("Refresh token has expired".to_string())
        }
        _ => GatewayError::Unauthorized(format!("Invalid refresh token: {e}")),
    })?;

    if token_data.claims.r#type != "refresh" {
        return Err(GatewayError::Unauthorized("Not a refresh token".to_string()));
    }

    Ok(token_data.claims)
}

/// Refresh token metadata stored in cache.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshTokenRecord {
    pub user_id: String,
    pub family_id: String,
}

/// Refresh token store managing active tokens and token families for replay protection.
#[derive(Clone)]
pub struct TokenStore {
    redis_client: Option<redis::Client>,
    mem_tokens: Arc<RwLock<HashMap<String, RefreshTokenRecord>>>,
    mem_families: Arc<RwLock<HashMap<String, HashSet<String>>>>,
}

impl TokenStore {
    /// Constructs a token store backed by Redis.
    #[must_use]
    pub fn new(redis_client: Option<redis::Client>) -> Self {
        Self {
            redis_client,
            mem_tokens: Arc::new(RwLock::new(HashMap::new())),
            mem_families: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Constructs an in-memory token store for deterministic unit/integration testing.
    #[must_use]
    pub fn new_in_memory() -> Self {
        Self::new(None)
    }

    /// Registers a newly issued refresh token in its family.
    ///
    /// # Errors
    /// Returns [`GatewayError`] on Redis failure.
    pub async fn register_refresh_token(
        &self,
        token_id: &str,
        family_id: &str,
        user_id: &str,
        ttl_seconds: u64,
    ) -> Result<(), GatewayError> {
        if let Some(ref client) = self.redis_client {
            if let Ok(mut conn) = client.get_multiplexed_async_connection().await {
                let token_key = format!("auth:refresh:{token_id}");
                let family_key = format!("auth:family:{family_id}");

                let _: () = conn
                    .hset_multiple(
                        &token_key,
                        &[("user_id", user_id), ("family_id", family_id)],
                    )
                    .await
                    .map_err(GatewayError::Redis)?;
                let ttl_i64 = i64::try_from(ttl_seconds).unwrap_or(i64::MAX);
                let _: () = conn
                    .expire(&token_key, ttl_i64)
                    .await
                    .map_err(GatewayError::Redis)?;

                let _: () = conn
                    .sadd(&family_key, token_id)
                    .await
                    .map_err(GatewayError::Redis)?;
                let _: () = conn
                    .expire(&family_key, ttl_i64)
                    .await
                    .map_err(GatewayError::Redis)?;
                return Ok(());
            }
        }

        // In-memory fallback
        let mut tokens = self.mem_tokens.write().await;
        let mut families = self.mem_families.write().await;

        tokens.insert(
            token_id.to_string(),
            RefreshTokenRecord {
                user_id: user_id.to_string(),
                family_id: family_id.to_string(),
            },
        );

        families
            .entry(family_id.to_string())
            .or_default()
            .insert(token_id.to_string());

        Ok(())
    }

    /// Consumes (deactivates) a refresh token while preserving its family record for replay detection.
    ///
    /// # Errors
    /// Returns [`GatewayError`] on Redis failure.
    pub async fn consume_refresh_token(&self, token_id: &str) -> Result<(), GatewayError> {
        if let Some(ref client) = self.redis_client {
            if let Ok(mut conn) = client.get_multiplexed_async_connection().await {
                let token_key = format!("auth:refresh:{token_id}");
                let _: () = conn.del(&token_key).await.map_err(GatewayError::Redis)?;
                return Ok(());
            }
        }

        let mut tokens = self.mem_tokens.write().await;
        tokens.remove(token_id);
        Ok(())
    }

    /// Revokes an entire token family due to suspected reuse / replay attack.
    ///
    /// # Errors
    /// Returns [`GatewayError`] on Redis failure.
    pub async fn revoke_family(&self, family_id: &str) -> Result<(), GatewayError> {
        if let Some(ref client) = self.redis_client {
            if let Ok(mut conn) = client.get_multiplexed_async_connection().await {
                let family_key = format!("auth:family:{family_id}");
                let members: Vec<String> = conn
                    .smembers(&family_key)
                    .await
                    .map_err(GatewayError::Redis)?;

                for token in members {
                    let token_key = format!("auth:refresh:{token}");
                    let _: () = conn.del(&token_key).await.map_err(GatewayError::Redis)?;
                }
                let _: () = conn.del(&family_key).await.map_err(GatewayError::Redis)?;
                return Ok(());
            }
        }

        let mut families = self.mem_families.write().await;
        let mut tokens = self.mem_tokens.write().await;

        if let Some(members) = families.remove(family_id) {
            for token in members {
                tokens.remove(&token);
            }
        }

        Ok(())
    }

    /// Revokes a single token and removes it from its family (normal logout).
    ///
    /// # Errors
    /// Returns [`GatewayError`] on Redis failure.
    pub async fn revoke_token(&self, token_id: &str, family_id: Option<&str>) -> Result<(), GatewayError> {
        self.consume_refresh_token(token_id).await?;

        if let Some(fam) = family_id {
            if let Some(ref client) = self.redis_client {
                if let Ok(mut conn) = client.get_multiplexed_async_connection().await {
                    let family_key = format!("auth:family:{fam}");
                    let _: () = conn.srem(&family_key, token_id).await.map_err(GatewayError::Redis)?;
                    return Ok(());
                }
            }

            let mut families = self.mem_families.write().await;
            if let Some(set) = families.get_mut(fam) {
                set.remove(token_id);
            }
        }

        Ok(())
    }

    /// Validates an incoming refresh token and cycles it to a new refresh token with replay protection.
    ///
    /// - If active token exists and is in family: Valid -> Consume old token, issue new token in family.
    /// - If token does NOT exist as active, but IS in family: REPLAY DETECTED -> Revoke entire family!
    /// - If token is neither: Invalid / revoked -> Reject.
    ///
    /// # Errors
    /// Returns [`GatewayError::ReplayDetected`], [`GatewayError::Unauthorized`], or Redis errors.
    pub async fn validate_and_cycle_refresh_token(
        &self,
        token_id: &str,
        family_id: &str,
        user_id: &str,
        jwt_secret: &str,
    ) -> Result<(String, String), GatewayError> {
        let (token_exists, in_family) = self.check_token_membership(token_id, family_id).await?;

        // Replay detection:
        if !token_exists && in_family {
            tracing::warn!(
                user_id = %user_id,
                family_id = %family_id,
                token_id = %token_id,
                "REPLAY ATTACK DETECTED: Refresh token reuse detected! Revoking token family."
            );
            self.revoke_family(family_id).await?;
            return Err(GatewayError::ReplayDetected(
                "Refresh token reuse detected. Your session has been revoked for security.".to_string(),
            ));
        }

        if !token_exists {
            return Err(GatewayError::Unauthorized(
                "Refresh token is invalid or expired".to_string(),
            ));
        }

        // Cycle token: deactivate old token
        self.consume_refresh_token(token_id).await?;

        // Issue new refresh token within the SAME family
        let (new_refresh_str, new_token_id, _) =
            encode_refresh_token(user_id, Some(family_id), jwt_secret, None)?;

        self.register_refresh_token(
            &new_token_id,
            family_id,
            user_id,
            REFRESH_TOKEN_EXPIRATION_SECONDS as u64,
        )
        .await?;

        Ok((new_refresh_str, new_token_id))
    }

    async fn check_token_membership(
        &self,
        token_id: &str,
        family_id: &str,
    ) -> Result<(bool, bool), GatewayError> {
        if let Some(ref client) = self.redis_client {
            if let Ok(mut conn) = client.get_multiplexed_async_connection().await {
                let token_key = format!("auth:refresh:{token_id}");
                let family_key = format!("auth:family:{family_id}");

                let exists: bool = conn.exists(&token_key).await.map_err(GatewayError::Redis)?;
                let in_family: bool = conn
                    .sismember(&family_key, token_id)
                    .await
                    .map_err(GatewayError::Redis)?;

                return Ok((exists, in_family));
            }
        }

        let tokens = self.mem_tokens.read().await;
        let families = self.mem_families.read().await;

        let exists = tokens.contains_key(token_id);
        let in_family = families
            .get(family_id)
            .is_some_and(|set| set.contains(token_id));

        Ok((exists, in_family))
    }
}

impl Default for TokenStore {
    fn default() -> Self {
        Self::new_in_memory()
    }
}

//! Per-user quota accounting for model-backed AI debugging.
//!
//! Counters live in Redis so every gateway replica shares one window; an unreachable
//! Redis degrades to a process-local window (`WARN` logged) instead of removing the
//! quota entirely.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use redis::AsyncCommands;

/// Rolling-window length applied to AI debug requests.
pub const AI_DEBUG_WINDOW: Duration = Duration::from_secs(600);
/// Rolling-window length in seconds, the unit Redis expires keys in.
pub const AI_DEBUG_WINDOW_SECONDS: i64 = 600;
/// Requests allowed per window on the free tier.
pub const FREE_TIER_LIMIT: u32 = 5;
/// Requests allowed per window on the pro tier (paid users and administrators).
pub const PRO_TIER_LIMIT: u32 = 60;
/// Invariant keeping the paid tier strictly above the free allowance.
const _: () = assert!(PRO_TIER_LIMIT > FREE_TIER_LIMIT);
/// Redis key prefix, mirroring the action-based naming of the legacy limiter.
const KEY_PREFIX: &str = "ratelimit:ai_debug:";
/// Local windows retained before expired entries are pruned.
const LOCAL_WINDOW_CAPACITY: usize = 4_096;

/// Subscription tier derived from the authenticated session.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubscriptionTier {
    /// Free-tier account.
    Free,
    /// Paid or administrative account.
    Pro,
}

impl SubscriptionTier {
    /// Maps a JWT role claim onto a quota tier; unknown roles count as free.
    #[must_use]
    pub fn from_role(role: &str) -> Self {
        match role.trim().to_ascii_lowercase().as_str() {
            "pro" | "premium" | "admin" => Self::Pro,
            _ => Self::Free,
        }
    }

    /// Requests allowed per window for this tier.
    #[must_use]
    pub fn limit(self) -> u32 {
        match self {
            Self::Free => FREE_TIER_LIMIT,
            Self::Pro => PRO_TIER_LIMIT,
        }
    }

    /// Lower-case label used in diagnostics and quota messages.
    #[must_use]
    pub fn label(self) -> &'static str {
        match self {
            Self::Free => "free",
            Self::Pro => "pro",
        }
    }
}

/// Outcome of one quota check.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RateLimitDecision {
    /// Whether the caller may proceed with the request.
    pub allowed: bool,
    /// Requests allowed per window for the caller's tier.
    pub limit: u32,
    /// Requests still available in the current window.
    pub remaining: u32,
    /// Seconds until the current window resets.
    pub retry_after_seconds: u64,
}

/// Redis-backed fixed-window limiter with a process-local fallback.
#[derive(Debug, Clone)]
pub struct AiDebugRateLimiter {
    redis: Option<redis::Client>,
    local: Arc<Mutex<HashMap<String, LocalWindow>>>,
}

/// One process-local window: when it opened and how many hits it recorded.
#[derive(Debug, Clone, Copy)]
struct LocalWindow {
    started: Instant,
    hits: u32,
}

impl AiDebugRateLimiter {
    /// Creates a limiter; supplying `redis` shares windows across replicas.
    #[must_use]
    pub fn new(redis: Option<redis::Client>) -> Self {
        Self {
            redis,
            local: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Accounts one AI debug request for `user_id`.
    ///
    /// Redis errors are downgraded to the process-local window so a cache outage
    /// tightens the quota per replica instead of removing it.
    pub async fn check(&self, user_id: &str, tier: SubscriptionTier) -> RateLimitDecision {
        let key = format!("{KEY_PREFIX}{user_id}");
        let limit = tier.limit();

        if let Some(client) = &self.redis {
            match consume_redis(client, &key, limit, AI_DEBUG_WINDOW_SECONDS).await {
                Ok(decision) => return decision,
                Err(error) => {
                    tracing::warn!(
                        %error,
                        %user_id,
                        "ai debug rate limiter degraded to the in-memory window"
                    );
                }
            }
        }

        self.consume_local(&key, limit)
    }

    /// Fixed-window accounting inside this process.
    fn consume_local(&self, key: &str, limit: u32) -> RateLimitDecision {
        let mut windows = self
            .local
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let now = Instant::now();

        if windows.len() >= LOCAL_WINDOW_CAPACITY {
            windows.retain(|_, window| now.duration_since(window.started) < AI_DEBUG_WINDOW);
        }

        let window = windows.entry(key.to_string()).or_insert(LocalWindow {
            started: now,
            hits: 0,
        });
        if now.duration_since(window.started) >= AI_DEBUG_WINDOW {
            *window = LocalWindow {
                started: now,
                hits: 0,
            };
        }
        window.hits = window.hits.saturating_add(1);

        RateLimitDecision {
            allowed: window.hits <= limit,
            limit,
            remaining: limit.saturating_sub(window.hits),
            retry_after_seconds: AI_DEBUG_WINDOW
                .saturating_sub(now.duration_since(window.started))
                .as_secs()
                .max(1),
        }
    }
}

/// Accounts one hit in Redis via `INCR` plus a window `EXPIRE` on first use.
async fn consume_redis(
    client: &redis::Client,
    key: &str,
    limit: u32,
    window_seconds: i64,
) -> Result<RateLimitDecision, redis::RedisError> {
    let mut connection = client.get_multiplexed_async_connection().await?;
    let hits: i64 = connection.incr(key, 1_u32).await?;
    if hits == 1 {
        let _: () = connection.expire(key, window_seconds).await?;
    }
    let ttl: i64 = connection.ttl(key).await?;

    Ok(decision_from_redis(hits, ttl, limit))
}

/// Converts raw counter readings into a quota decision.
fn decision_from_redis(hits: i64, ttl: i64, limit: u32) -> RateLimitDecision {
    let hits = u32::try_from(hits).unwrap_or(u32::MAX);

    RateLimitDecision {
        allowed: hits <= limit,
        limit,
        remaining: limit.saturating_sub(hits),
        retry_after_seconds: u64::try_from(ttl).unwrap_or(0).max(1),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        decision_from_redis, AiDebugRateLimiter, SubscriptionTier, AI_DEBUG_WINDOW,
        AI_DEBUG_WINDOW_SECONDS, FREE_TIER_LIMIT,
    };

    #[test]
    fn window_constants_agree() {
        assert_eq!(AI_DEBUG_WINDOW.as_secs(), 600);
        assert_eq!(AI_DEBUG_WINDOW_SECONDS, 600);
    }

    #[test]
    fn role_mapping_covers_pro_admin_and_free() {
        assert_eq!(SubscriptionTier::from_role("pro"), SubscriptionTier::Pro);
        assert_eq!(
            SubscriptionTier::from_role(" Admin "),
            SubscriptionTier::Pro
        );
        assert_eq!(
            SubscriptionTier::from_role("premium"),
            SubscriptionTier::Pro
        );
        assert_eq!(SubscriptionTier::from_role("free"), SubscriptionTier::Free);
        assert_eq!(
            SubscriptionTier::from_role("student"),
            SubscriptionTier::Free
        );
    }

    #[tokio::test]
    async fn free_tier_is_capped_at_the_free_limit() {
        let limiter = AiDebugRateLimiter::new(None);

        for request in 1..=FREE_TIER_LIMIT {
            let decision = limiter.check("free-user", SubscriptionTier::Free).await;
            assert!(decision.allowed, "request {request} must be allowed");
        }

        let blocked = limiter.check("free-user", SubscriptionTier::Free).await;
        assert!(!blocked.allowed);
        assert_eq!(blocked.remaining, 0);
        assert!(blocked.retry_after_seconds > 0);
    }

    #[tokio::test]
    async fn pro_tier_gets_the_higher_quota() {
        let limiter = AiDebugRateLimiter::new(None);

        for request in 1..=FREE_TIER_LIMIT + 1 {
            let decision = limiter.check("pro-user", SubscriptionTier::Pro).await;
            assert!(decision.allowed, "pro request {request} must be allowed");
        }
    }

    #[tokio::test]
    async fn windows_are_scoped_per_user() {
        let limiter = AiDebugRateLimiter::new(None);

        for _ in 0..=FREE_TIER_LIMIT {
            let _ = limiter
                .check("exhausted-user", SubscriptionTier::Free)
                .await;
        }

        let decision = limiter.check("fresh-user", SubscriptionTier::Free).await;
        assert!(decision.allowed);
        assert_eq!(decision.remaining, FREE_TIER_LIMIT - 1);
    }

    #[test]
    fn redis_readings_map_onto_the_window_limit() {
        let within = decision_from_redis(i64::from(FREE_TIER_LIMIT), 42, FREE_TIER_LIMIT);
        assert!(within.allowed);
        assert_eq!(within.remaining, 0);
        assert_eq!(within.retry_after_seconds, 42);

        let beyond = decision_from_redis(i64::from(FREE_TIER_LIMIT + 1), -1, FREE_TIER_LIMIT);
        assert!(!beyond.allowed);
        assert_eq!(beyond.retry_after_seconds, 1);
    }
}

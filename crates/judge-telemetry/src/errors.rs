//! Error types for proctoring telemetry ingestion and Pub/Sub relayer.

use thiserror::Error;

/// Proctoring telemetry error representations.
#[derive(Debug, Error)]
pub enum TelemetryError {
    #[error("connection error: {0}")]
    ConnectionError(String),

    #[error("serialization error: {0}")]
    SerializationError(String),

    #[error("rate limit exceeded: {0}")]
    RateLimitExceeded(String),

    #[error("channel closed: {0}")]
    ChannelClosed(String),

    #[error("identity mismatch: expected candidate {expected}, got {received}")]
    IdentityMismatch {
        expected: uuid::Uuid,
        received: uuid::Uuid,
    },

    #[error("redis error: {0}")]
    Redis(#[from] redis::RedisError),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

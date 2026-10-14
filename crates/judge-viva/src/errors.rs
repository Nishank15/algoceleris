//! Error definitions for the Viva collaborative engine and CRDT synchronization.

use thiserror::Error;

/// Viva engine and CRDT session error representations.
#[derive(Debug, Error)]
pub enum VivaError {
    #[error("room not found: {0}")]
    RoomNotFound(String),

    #[error("crdt sync error: {0}")]
    CrdtSyncError(String),

    #[error("protocol error: {0}")]
    ProtocolError(String),

    #[error("serialization error: {0}")]
    SerializationError(String),

    #[error("invalid rubric evaluation: {0}")]
    InvalidRubricEvaluation(String),

    #[error("database error: {0}")]
    DatabaseError(#[from] judge_db::DbError),

    #[error("redis error: {0}")]
    Redis(#[from] redis::RedisError),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("domain error: {0}")]
    Domain(#[from] judge_core::DomainError),
}

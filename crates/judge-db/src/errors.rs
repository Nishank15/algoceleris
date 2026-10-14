use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("connection pool error: {0}")]
    PoolError(String),

    #[error("sqlx error: {0}")]
    Sqlx(#[from] sqlx::Error),

    #[error("record not found: {0}")]
    NotFound(String),

    #[error("unique constraint violation: {0}")]
    UniqueViolation(String),

    #[error("foreign key constraint violation: {0}")]
    ForeignKeyViolation(String),

    #[error("serialization error: {0}")]
    SerializationError(String),

    #[error("domain error: {0}")]
    Domain(#[from] judge_core::DomainError),
}

impl From<serde_json::Error> for DbError {
    fn from(err: serde_json::Error) -> Self {
        Self::SerializationError(err.to_string())
    }
}

use crate::errors::DbError;
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct DbPool {
    pool: PgPool,
}

impl DbPool {
    #[must_use]
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    #[must_use]
    pub fn inner(&self) -> &PgPool {
        &self.pool
    }

    /// Acquires a connection and verifies that the database is responsive.
    ///
    /// # Errors
    /// Returns [`DbError::Sqlx`] if the health check query fails.
    pub async fn check_health(&self) -> Result<(), DbError> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await
            .map_err(DbError::Sqlx)?;
        Ok(())
    }
}

impl std::ops::Deref for DbPool {
    type Target = PgPool;

    fn deref(&self) -> &Self::Target {
        &self.pool
    }
}

/// Creates a new Postgres connection pool with bounded connections and timeouts.
///
/// # Errors
/// Returns [`DbError::PoolError`] if pool construction or connection fails.
pub async fn create_connection_pool(
    database_url: &str,
    max_connections: u32,
) -> Result<DbPool, DbError> {
    let pool = PgPoolOptions::new()
        .max_connections(max_connections)
        .acquire_timeout(Duration::from_secs(5))
        .connect(database_url)
        .await
        .map_err(|e| DbError::PoolError(e.to_string()))?;

    Ok(DbPool::new(pool))
}

/// Standalone health probe function taking a `&DbPool`.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if database connectivity fails.
pub async fn check_health(pool: &DbPool) -> Result<(), DbError> {
    pool.check_health().await
}

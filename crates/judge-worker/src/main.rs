use std::env;

use anyhow::Result;
use judge_worker::WorkerDaemon;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();
    tracing::info!("judge-worker daemon initializing...");

    let redis_url =
        env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://postgres:postgres@127.0.0.1:5432/cloud_judge".to_string()
    });

    let pool = match judge_db::create_connection_pool(&db_url, 5).await {
        Ok(pool) => {
            tracing::info!("judge-worker connected to Postgres database pool.");
            Some(pool)
        }
        Err(err) => {
            tracing::warn!("judge-worker running without database connection: {err}");
            None
        }
    };

    let worker = WorkerDaemon::with_pool(pool);
    tracing::info!("judge-worker daemon running and polling Redis queue...");
    worker.run_loop(&redis_url).await?;

    Ok(())
}


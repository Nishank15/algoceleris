//! Gateway HTTP server binary bootstrap.

use std::env;
use std::net::SocketAddr;

use anyhow::Result;
use judge_gateway::auth::TokenStore;
use judge_gateway::state::AppState;
use judge_gateway::{create_router, DEFAULT_JWT_SECRET};
use tokio::net::TcpListener;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| "8000".to_string())
        .parse()
        .unwrap_or(8000);

    let db_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:5432/cloud_judge".to_string());

    let redis_url = env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());

    let jwt_secret = env::var("JWT_SECRET_KEY")
        .unwrap_or_else(|_| DEFAULT_JWT_SECRET.to_string());

    // Connect to PostgreSQL if available
    let db_pool = match judge_db::create_connection_pool(&db_url, 10).await {
        Ok(pool) => {
            info!("PostgreSQL connected successfully");
            Some(pool)
        }
        Err(e) => {
            tracing::warn!("PostgreSQL connection unavailable ({e}); running in standalone fallback mode");
            None
        }
    };

    // Connect to Redis if available
    let (token_store, redis_client) = match redis::Client::open(redis_url.as_str()) {
        Ok(client) => {
            info!("Redis client initialized");
            (TokenStore::new(Some(client.clone())), Some(client))
        }
        Err(e) => {
            tracing::warn!("Redis connection failed ({e}); using in-memory token store");
            (TokenStore::new_in_memory(), None)
        }
    };

    let state = AppState::new_with_redis(db_pool, token_store, Some(jwt_secret), redis_client);
    let app = create_router(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = TcpListener::bind(addr).await?;
    info!("judge-gateway listening on http://{addr}");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("judge-gateway shut down cleanly.");
    Ok(())
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
    info!("Shutdown signal received, draining active connections...");
}

//! Health check endpoints `/health` and `/api/v1/health`.

use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::state::AppState;

/// System health status matching Python gateway contract.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub database: String,
    pub broker: String,
    pub subscription_store: String,
    pub rate_limiter: String,
    pub ai_assistant: String,
    pub contest_store: String,
    pub leaderboard_engine: String,
    pub proctoring_store: String,
    pub plagiarism_detector: String,
    pub bloom_filter: String,
}

/// Handler for `/health` and `/api/v1/health`.
pub async fn health_handler(State(state): State<AppState>) -> impl IntoResponse {
    let db_status = if let Some(ref pool) = state.db {
        if sqlx::query("SELECT 1").execute(pool.inner()).await.is_ok() {
            "connected".to_string()
        } else {
            "disconnected".to_string()
        }
    } else {
        "disconnected".to_string()
    };

    let response = HealthResponse {
        status: "healthy".to_string(),
        database: db_status,
        broker: "InMemoryQueueBroker".to_string(),
        subscription_store: "InMemorySubscriptionStore".to_string(),
        rate_limiter: "InMemoryLimiter".to_string(),
        ai_assistant: "GeminiDebugAssistant".to_string(),
        contest_store: "InMemoryContestStore".to_string(),
        leaderboard_engine: "InMemoryLeaderboardEngine".to_string(),
        proctoring_store: "RedisProctoringMesh".to_string(),
        plagiarism_detector: "StructuralSimilarityDetector".to_string(),
        bloom_filter: "in_memory".to_string(),
    };

    Json(response)
}

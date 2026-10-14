//! Shared gateway application state.

use std::collections::HashMap;
use std::sync::Arc;

use judge_db::models::{
    AssessmentRecord, AssessmentSubmissionRecord, CohortRecord, InterviewRoomRecord,
    OrgMembershipRecord, OrganizationRecord, ProctorEventCounts, ProctorEventRecord,
    SubmissionRecord,
};
use judge_db::DbPool;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::auth::token::DEFAULT_JWT_SECRET;
use crate::auth::TokenStore;

/// In-memory mock store used when running without a PostgreSQL connection.
#[derive(Clone, Default)]
#[allow(clippy::type_complexity)]
pub struct MockCampusStore {
    pub orgs: Arc<RwLock<HashMap<Uuid, OrganizationRecord>>>,
    pub cohorts: Arc<RwLock<HashMap<Uuid, CohortRecord>>>,
    pub memberships: Arc<RwLock<HashMap<(Uuid, Uuid), OrgMembershipRecord>>>,
    pub users: Arc<RwLock<HashMap<Uuid, (String, String)>>>,
    pub assessments: Arc<RwLock<HashMap<Uuid, AssessmentRecord>>>,
    pub accommodations: Arc<RwLock<HashMap<(Uuid, Uuid), i32>>>,
    pub submissions: Arc<RwLock<HashMap<Uuid, SubmissionRecord>>>,
    pub assessment_submissions: Arc<RwLock<HashMap<Uuid, AssessmentSubmissionRecord>>>,
    pub submission_queue: Arc<RwLock<Vec<serde_json::Value>>>,
    pub submission_results: Arc<RwLock<HashMap<Uuid, Vec<serde_json::Value>>>>,
    pub submission_broadcasts: Arc<RwLock<HashMap<Uuid, tokio::sync::broadcast::Sender<serde_json::Value>>>>,
    pub proctor_events: Arc<RwLock<HashMap<(Uuid, Uuid), Vec<ProctorEventRecord>>>>,
    pub candidate_proctor_counts: Arc<RwLock<HashMap<(Uuid, Uuid), ProctorEventCounts>>>,
    pub interview_rooms: Arc<RwLock<HashMap<String, InterviewRoomRecord>>>,
    pub in_memory_users: Arc<RwLock<HashMap<Uuid, (String, String, String, String, Option<String>)>>>,
}

/// Shared application state injected into Axum route handlers.
#[derive(Clone)]
pub struct AppState {
    /// PostgreSQL connection pool.
    pub db: Option<DbPool>,
    /// Refresh token family store (Redis or in-memory fallback).
    pub token_store: TokenStore,
    /// Secret key used for signing and verifying JWT tokens.
    pub jwt_secret: String,
    /// In-memory fallback campus data store for standalone testing.
    pub mock_campus: MockCampusStore,
    /// Optional Redis client for queue dispatches and pub/sub streaming.
    pub redis_client: Option<redis::Client>,
}

impl AppState {
    /// Creates a new `AppState` instance with optional Redis client.
    #[must_use]
    pub fn new_with_redis(
        db: Option<DbPool>,
        token_store: TokenStore,
        jwt_secret: Option<String>,
        redis_client: Option<redis::Client>,
    ) -> Self {
        Self {
            db,
            token_store,
            jwt_secret: jwt_secret.unwrap_or_else(|| DEFAULT_JWT_SECRET.to_string()),
            mock_campus: MockCampusStore::default(),
            redis_client,
        }
    }

    /// Creates a new `AppState` instance.
    #[must_use]
    pub fn new(db: Option<DbPool>, token_store: TokenStore, jwt_secret: Option<String>) -> Self {
        Self::new_with_redis(db, token_store, jwt_secret, None)
    }

    /// Creates an in-memory testing state without database or Redis network dependencies.
    #[must_use]
    pub fn new_test() -> Self {
        Self::new(None, TokenStore::new_in_memory(), None)
    }
}

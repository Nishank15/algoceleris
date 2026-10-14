use std::collections::HashMap;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::errors::GatewayError;
use crate::state::AppState;

/// Contest problem summary representation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContestProblemSummary {
    pub id: String,
    pub letter_code: String,
    pub title: String,
    pub difficulty: String,
    pub points: u32,
}

/// Contest summary representation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContestSummary {
    pub id: String,
    pub title: String,
    pub description: String,
    pub start_time: i64,
    pub end_time: i64,
    pub duration_minutes: u32,
    pub status: String,
    pub problems: Vec<ContestProblemSummary>,
}

/// Score detail for an individual problem on the leaderboard.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProblemScoreInfo {
    pub solved: bool,
    pub rejected_attempts: u32,
    pub penalty_minutes: u32,
    pub solved_at: Option<i64>,
}

/// Contest leaderboard entry matching frontend `LeaderboardEntry`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub user_id: String,
    pub solved_count: u32,
    pub total_penalty_minutes: u32,
    pub problem_scores: HashMap<String, ProblemScoreInfo>,
    pub score_composite: f64,
}

/// Lists available contests.
///
/// # Errors
/// Returns [`GatewayError`] on store failure.
pub async fn list_contests_handler(
    State(_state): State<AppState>,
) -> Result<impl IntoResponse, GatewayError> {
    let now = chrono::Utc::now().timestamp_millis();
    let hour_ms = 3_600_000;
    let contests = vec![
        ContestSummary {
            id: "weekly-contest-412".to_string(),
            title: "Weekly Contest 412".to_string(),
            description: "Four problems, 90 minutes. ICPC-style penalties.".to_string(),
            start_time: now - 25 * 60_000,
            end_time: now + 65 * 60_000,
            duration_minutes: 90,
            status: "ACTIVE".to_string(),
            problems: vec![
                ContestProblemSummary {
                    id: "two-sum".to_string(),
                    letter_code: "A".to_string(),
                    title: "Two Sum".to_string(),
                    difficulty: "Easy".to_string(),
                    points: 100,
                },
                ContestProblemSummary {
                    id: "valid-parentheses".to_string(),
                    letter_code: "B".to_string(),
                    title: "Valid Parentheses".to_string(),
                    difficulty: "Easy".to_string(),
                    points: 100,
                },
            ],
        },
        ContestSummary {
            id: "biweekly-contest-138".to_string(),
            title: "Biweekly Contest 138".to_string(),
            description: "Biweekly sprint: four problems in 90 minutes.".to_string(),
            start_time: now + 30 * hour_ms,
            end_time: now + 31 * hour_ms + 30 * 60_000,
            duration_minutes: 90,
            status: "UPCOMING".to_string(),
            problems: vec![],
        },
    ];
    Ok(Json(contests))
}

/// Retrieves single contest details.
///
/// # Errors
/// Returns [`GatewayError`] on store failure.
pub async fn get_contest_handler(
    State(_state): State<AppState>,
    Path(contest_id): Path<String>,
) -> Result<impl IntoResponse, GatewayError> {
    let now = chrono::Utc::now().timestamp_millis();
    let c = ContestSummary {
        id: contest_id,
        title: "Weekly Contest 412".to_string(),
        description: "Four problems, 90 minutes.".to_string(),
        start_time: now - 25 * 60_000,
        end_time: now + 65 * 60_000,
        duration_minutes: 90,
        status: "ACTIVE".to_string(),
        problems: vec![
            ContestProblemSummary {
                id: "two-sum".to_string(),
                letter_code: "A".to_string(),
                title: "Two Sum".to_string(),
                difficulty: "Easy".to_string(),
                points: 100,
            },
            ContestProblemSummary {
                id: "valid-parentheses".to_string(),
                letter_code: "B".to_string(),
                title: "Valid Parentheses".to_string(),
                difficulty: "Easy".to_string(),
                points: 100,
            },
        ],
    };
    Ok(Json(c))
}

fn build_mock_leaderboard() -> Vec<LeaderboardEntry> {
    let mut problem_scores_1 = HashMap::new();
    problem_scores_1.insert(
        "two-sum".to_string(),
        ProblemScoreInfo {
            solved: true,
            rejected_attempts: 0,
            penalty_minutes: 12,
            solved_at: Some(12),
        },
    );
    problem_scores_1.insert(
        "valid-parentheses".to_string(),
        ProblemScoreInfo {
            solved: true,
            rejected_attempts: 1,
            penalty_minutes: 45,
            solved_at: Some(25),
        },
    );

    let mut problem_scores_2 = HashMap::new();
    problem_scores_2.insert(
        "two-sum".to_string(),
        ProblemScoreInfo {
            solved: true,
            rejected_attempts: 0,
            penalty_minutes: 18,
            solved_at: Some(18),
        },
    );

    vec![
        LeaderboardEntry {
            rank: 1,
            user_id: "tourist_champion".to_string(),
            solved_count: 2,
            total_penalty_minutes: 57,
            problem_scores: problem_scores_1,
            score_composite: 200.0,
        },
        LeaderboardEntry {
            rank: 2,
            user_id: "coder_pro".to_string(),
            solved_count: 1,
            total_penalty_minutes: 18,
            problem_scores: problem_scores_2,
            score_composite: 100.0,
        },
    ]
}

/// Retrieves contest leaderboard.
///
/// # Errors
/// Returns [`GatewayError`].
pub async fn get_contest_leaderboard_handler(
    State(_state): State<AppState>,
    Path(_contest_id): Path<String>,
) -> Result<Json<Vec<LeaderboardEntry>>, GatewayError> {
    Ok(Json(build_mock_leaderboard()))
}

/// Retrieves global/default contest leaderboard.
///
/// # Errors
/// Returns [`GatewayError`].
pub async fn get_global_leaderboard_handler(
    State(_state): State<AppState>,
) -> Result<Json<Vec<LeaderboardEntry>>, GatewayError> {
    Ok(Json(build_mock_leaderboard()))
}

/// WebSocket streaming handler for live contest leaderboard updates.
pub async fn contest_leaderboard_ws_handler(
    ws: WebSocketUpgrade,
    Path(_contest_id): Path<String>,
) -> impl IntoResponse {
    ws.on_upgrade(handle_leaderboard_socket)
}

async fn handle_leaderboard_socket(mut socket: WebSocket) {
    let snapshot = build_mock_leaderboard();
    let initial_msg = serde_json::json!({
        "event_type": "leaderboard_snapshot",
        "data": snapshot,
    });

    if socket
        .send(Message::Text(initial_msg.to_string().into()))
        .await
        .is_err()
    {
        return;
    }

    // Keepalive loop
    while let Some(msg) = socket.recv().await {
        if let Ok(Message::Close(_)) = msg {
            break;
        }
    }
}

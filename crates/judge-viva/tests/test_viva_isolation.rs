#![allow(clippy::too_many_lines)]

use std::sync::Arc;
use std::time::Duration;

use axum::extract::ws::WebSocketUpgrade;
use axum::extract::{Path, State};
use axum::response::Response;
use axum::routing::get;
use axum::Router;
use futures_util::{SinkExt, StreamExt};
use judge_core::models::RubricCriterion;
use judge_viva::{
    format_viva_channel, handle_viva_socket, persist_rubric_evaluation, AwarenessEnvelope,
    CursorPosition, PeerPresence, RubricEvaluationUpdate, VivaClusterMessage, VivaError,
    VivaRedisRelay, VivaRoom, VivaWsClientMessage, VivaWsServerMessage,
};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message as TungsteniteMessage;
use uuid::Uuid;

async fn viva_ws_endpoint(
    ws: WebSocketUpgrade,
    Path((_room_code, role)): Path<(String, String)>,
    State(room): State<Arc<VivaRoom>>,
) -> Response {
    let user_id = Uuid::new_v4();
    let username = format!("{role}_user");
    ws.on_upgrade(move |socket| {
        handle_viva_socket(socket, room, user_id, username, role)
    })
}

/// Helper function setting up an ephemeral Axum server hosting a Viva room.
async fn setup_viva_server(room: Arc<VivaRoom>) -> (String, tokio::task::JoinHandle<()>) {
    let app = Router::new()
        .route("/ws/{room_code}/{role}", get(viva_ws_endpoint))
        .with_state(room);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("failed to bind ephemeral test port");
    let addr = listener
        .local_addr()
        .expect("failed to get local address");

    let server_handle = tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });

    (format!("ws://{addr}/ws"), server_handle)
}

#[tokio::test]
async fn test_candidate_rubric_masking_invariant() -> Result<(), Box<dyn std::error::Error>> {
    let room = Arc::new(VivaRoom::new("VIVA-PRIVACY-101"));
    let (base_url, _server_handle) = setup_viva_server(Arc::clone(&room)).await;

    let candidate_url = format!("{base_url}/VIVA-PRIVACY-101/candidate");
    let instructor_url = format!("{base_url}/VIVA-PRIVACY-101/instructor");

    // Connect candidate and evaluator
    let (mut candidate_ws, _) = connect_async(&candidate_url).await?;
    let (mut instructor_ws, _) = connect_async(&instructor_url).await?;

    // Drain initial handshake (CRDT full document snapshot) from both
    let _cand_handshake = candidate_ws.next().await;
    let _inst_handshake = instructor_ws.next().await;

    // Evaluator prepares a sensitive rubric update with confidential notes
    let rubric_payload = serde_json::json!({
        "criterion_algorithm": 35.0,
        "criterion_complexity": 25.0,
        "criterion_style": 20.0
    });
    let confidential_notes = "Candidate struggled with edge cases; do not offer senior role.";

    let update = RubricEvaluationUpdate::new(
        rubric_payload.clone(),
        Some(confidential_notes.to_string()),
    );

    // Instructor sends the RubricEvaluation frame over WebSocket
    let client_msg = VivaWsClientMessage::RubricEvaluation {
        update: update.clone(),
    };
    let instructor_json = serde_json::to_string(&client_msg)?;
    instructor_ws
        .send(TungsteniteMessage::Text(instructor_json.into()))
        .await?;

    // Candidate must receive ZERO rubric frames or confidential notes
    // Candidate may only receive presence notifications
    let mut candidate_received_rubric = false;
    let mut candidate_received_notes = false;

    let check_candidate_messages = async {
        while let Some(Ok(msg)) = candidate_ws.next().await {
            if let TungsteniteMessage::Text(text) = msg {
                let text_str = text.as_str();
                if text_str.contains("rubric_scores") || text_str.contains("RubricEvaluation") {
                    candidate_received_rubric = true;
                }
                if text_str.contains("struggled with edge cases") || text_str.contains(confidential_notes) {
                    candidate_received_notes = true;
                }
            }
        }
    };

    // Wait 300ms to verify no rubric leak occurred
    let _ = tokio::time::timeout(Duration::from_millis(300), check_candidate_messages).await;

    assert!(
        !candidate_received_rubric,
        "CRITICAL PRIVACY VIOLATION: Candidate received rubric evaluation broadcast"
    );
    assert!(
        !candidate_received_notes,
        "CRITICAL PRIVACY VIOLATION: Candidate received confidential interviewer notes"
    );

    // Test reverse invariant: Candidate attempts to submit a rubric evaluation
    let unauthorized_submission = VivaWsClientMessage::RubricEvaluation {
        update: RubricEvaluationUpdate::new(serde_json::json!({ "self_score": 100 }), None),
    };
    let unauth_json = serde_json::to_string(&unauthorized_submission)?;
    candidate_ws
        .send(TungsteniteMessage::Text(unauth_json.into()))
        .await?;

    // Candidate should receive an explicit FORBIDDEN error response
    let mut received_forbidden = false;
    let check_forbidden = async {
        while let Some(Ok(msg)) = candidate_ws.next().await {
            if let TungsteniteMessage::Text(text) = msg {
                if let Ok(VivaWsServerMessage::Error { code, .. }) =
                    serde_json::from_str::<VivaWsServerMessage>(text.as_str())
                {
                    if code == "FORBIDDEN" {
                        received_forbidden = true;
                        break;
                    }
                }
            }
        }
    };
    let _ = tokio::time::timeout(Duration::from_millis(300), check_forbidden).await;

    assert!(
        received_forbidden,
        "Expected server to reject candidate rubric modification with FORBIDDEN"
    );

    Ok(())
}

#[tokio::test]
async fn test_evaluator_frame_delivery() -> Result<(), Box<dyn std::error::Error>> {
    let room = Arc::new(VivaRoom::new("VIVA-EVAL-202"));
    let (base_url, _server_handle) = setup_viva_server(Arc::clone(&room)).await;

    let host_url = format!("{base_url}/VIVA-EVAL-202/host");
    let evaluator_url = format!("{base_url}/VIVA-EVAL-202/evaluator");

    let (mut host_ws, _) = connect_async(&host_url).await?;
    let (mut evaluator_ws, _) = connect_async(&evaluator_url).await?;

    // Drain initial handshake
    let _h_handshake = host_ws.next().await;
    let _e_handshake = evaluator_ws.next().await;

    let rubric_scores = serde_json::json!({
        "system_design": 40.0,
        "concurrency": 30.0,
        "problem_solving": 20.0
    });
    let confidential_notes = "Strong performance on architectural tradeoffs.";

    let update = RubricEvaluationUpdate::new(
        rubric_scores.clone(),
        Some(confidential_notes.to_string()),
    );

    // Host updates rubric
    let client_msg = VivaWsClientMessage::RubricEvaluation {
        update: update.clone(),
    };
    let json_msg = serde_json::to_string(&client_msg)?;
    host_ws
        .send(TungsteniteMessage::Text(json_msg.into()))
        .await?;

    // Both host and second evaluator peers must receive the full RubricEvaluation frame
    let mut received_by_evaluator = None;
    let timeout_res = tokio::time::timeout(Duration::from_millis(500), async {
        while let Some(Ok(msg)) = evaluator_ws.next().await {
            if let TungsteniteMessage::Text(text) = msg {
                if let Ok(VivaWsServerMessage::RubricEvaluation { update: rec_up }) =
                    serde_json::from_str::<VivaWsServerMessage>(text.as_str())
                {
                    received_by_evaluator = Some(rec_up);
                    break;
                }
            }
        }
    })
    .await;

    assert!(
        timeout_res.is_ok(),
        "Timed out waiting for evaluator rubric frame delivery"
    );

    let delivered = received_by_evaluator.expect("evaluator did not receive rubric evaluation frame");
    assert_eq!(delivered.rubric_scores, rubric_scores);
    assert_eq!(delivered.interviewer_notes, Some(confidential_notes.to_string()));

    Ok(())
}

#[tokio::test]
async fn test_multi_gateway_redis_serialization() -> Result<(), VivaError> {
    // 1. Channel naming validation
    let room_code = "CAMPUS-EXAM-42";
    let channel = format_viva_channel(room_code);
    assert_eq!(channel, "campus:viva:CAMPUS-EXAM-42:events");

    // 2. Binary Yrs CRDT Frame base64 serialization round-trip
    let raw_yrs_bytes = vec![0x00, 0x01, 0xFE, 0xCA, 0xBA, 0xBE, 0x42, 0xFF, 0x10, 0x20];
    let crdt_cluster_msg = VivaClusterMessage::crdt(room_code, &raw_yrs_bytes);

    let json_crdt = crdt_cluster_msg.to_json()?;
    let parsed_crdt = VivaClusterMessage::from_json(&json_crdt)?;

    assert_eq!(parsed_crdt.room_code(), room_code);
    let decoded_bytes = parsed_crdt
        .decode_crdt_bytes()
        .expect("failed to decode base64 CRDT bytes");
    assert_eq!(decoded_bytes, raw_yrs_bytes);

    // 3. Awareness Envelope serialization round-trip
    let user_id = Uuid::new_v4();
    let presence = PeerPresence::new(
        user_id,
        "bob_student",
        "candidate",
        Some(CursorPosition::new(12, 4)),
        "#e4f222",
    );
    let awareness_env = AwarenessEnvelope::presence_update(room_code, presence);
    let awareness_cluster_msg = VivaClusterMessage::awareness(awareness_env.clone());

    let json_awareness = awareness_cluster_msg.to_json()?;
    let parsed_awareness = VivaClusterMessage::from_json(&json_awareness)?;

    assert_eq!(parsed_awareness.room_code(), room_code);
    if let VivaClusterMessage::Awareness { envelope } = parsed_awareness {
        assert_eq!(envelope, awareness_env);
    } else {
        panic!("expected Awareness variant in parsed message");
    }

    // 4. Rubric Update Envelope serialization round-trip
    let rubric_update = RubricEvaluationUpdate::new(
        serde_json::json!({ "criteria_1": 95.0, "criteria_2": 88.0 }),
        Some("Excellent algorithmic explanation".to_string()),
    );
    let rubric_cluster_msg = VivaClusterMessage::rubric(room_code, rubric_update.clone());

    let json_rubric = rubric_cluster_msg.to_json()?;
    let parsed_rubric = VivaClusterMessage::from_json(&json_rubric)?;

    assert_eq!(parsed_rubric.room_code(), room_code);
    if let VivaClusterMessage::RubricUpdate { update, .. } = parsed_rubric {
        assert_eq!(update, rubric_update);
    } else {
        panic!("expected RubricUpdate variant in parsed message");
    }

    // 5. Redis Relay local fan-out and room listener routing
    let relay = VivaRedisRelay::new_in_memory();
    let room = Arc::new(VivaRoom::new(room_code));
    let _listener_handle = relay.spawn_cluster_listener(Arc::clone(&room));

    let mut rx_rubric = room.subscribe_rubric();
    let mut rx_awareness = room.subscribe_awareness();
    let mut rx_crdt = room.subscribe_crdt();

    // Publish CRDT update via relay
    relay.publish(&crdt_cluster_msg).await?;
    let received_crdt = rx_crdt
        .recv()
        .await
        .expect("room failed to receive CRDT update from relay");
    assert_eq!(received_crdt, raw_yrs_bytes);

    // Publish Awareness via relay
    relay.publish(&awareness_cluster_msg).await?;
    let received_awareness = rx_awareness
        .recv()
        .await
        .expect("room failed to receive awareness update from relay");
    assert_eq!(received_awareness, awareness_env);

    // Publish Rubric update via relay
    relay.publish(&rubric_cluster_msg).await?;
    let received_rubric = rx_rubric
        .recv()
        .await
        .expect("room failed to receive rubric update from relay");
    assert_eq!(received_rubric, rubric_update);

    Ok(())
}

#[tokio::test]
async fn test_rubric_score_math_and_persistence() -> Result<(), VivaError> {
    // 1. Setup criteria conforming to judge_core rules (weights must sum to 100.0)
    let crit1_id = Uuid::new_v4();
    let crit2_id = Uuid::new_v4();
    let crit3_id = Uuid::new_v4();

    let criteria = vec![
        RubricCriterion {
            id: crit1_id,
            name: "Data Structures & Algorithms".to_string(),
            weight: 40.0,
            max_points: 100.0,
        },
        RubricCriterion {
            id: crit2_id,
            name: "System Architecture & Scalability".to_string(),
            weight: 35.0,
            max_points: 50.0,
        },
        RubricCriterion {
            id: crit3_id,
            name: "Communication & Technical Articulation".to_string(),
            weight: 25.0,
            max_points: 10.0,
        },
    ];

    // Evaluator awards:
    // - crit1 (max 100, weight 40%): 80.0  -> 0.8 * 40 = 32.0%
    // - crit2 (max 50, weight 35%): 45.0   -> 0.9 * 35 = 31.5%
    // - crit3 (max 10, weight 25%): 10.0   -> 1.0 * 25 = 25.0%
    // Total expected score = 32.0 + 31.5 + 25.0 = 88.5%
    let scores = serde_json::json!({
        crit1_id.to_string(): 80.0,
        crit2_id.to_string(): 45.0,
        crit3_id.to_string(): 10.0
    });

    let eval_update = RubricEvaluationUpdate::new(scores, Some("Solid execution overall".to_string()));
    let calculated = eval_update.calculate_weighted_score(&criteria)?;
    assert!((calculated - 88.5).abs() < 0.001, "Expected 88.5%, got {calculated}%");

    // Also support criterion lookup by name
    let scores_by_name = serde_json::json!({
        "Data Structures & Algorithms": 100.0,
        "System Architecture & Scalability": 50.0,
        "Communication & Technical Articulation": 10.0
    });
    let perfect_update = RubricEvaluationUpdate::new(scores_by_name, None);
    let perfect_score = perfect_update.calculate_weighted_score(&criteria)?;
    assert!((perfect_score - 100.0).abs() < 0.001, "Expected 100.0%, got {perfect_score}%");

    // 2. Validate rejection of out-of-bounds scores
    let out_of_bounds = serde_json::json!({
        crit1_id.to_string(): 150.0 // Max is 100.0
    });
    let invalid_eval = RubricEvaluationUpdate::new(out_of_bounds, None);
    let err = invalid_eval.calculate_weighted_score(&criteria);
    assert!(
        matches!(err, Err(VivaError::InvalidRubricEvaluation(_))),
        "Expected InvalidRubricEvaluation for score exceeding max_points"
    );

    // 3. Validate rejection of unbalanced rubric criteria (e.g. weights sum to 90.0)
    let unbalanced_criteria = vec![
        RubricCriterion {
            id: crit1_id,
            name: "Part A".to_string(),
            weight: 50.0,
            max_points: 100.0,
        },
        RubricCriterion {
            id: crit2_id,
            name: "Part B".to_string(),
            weight: 40.0, // 50 + 40 = 90.0 != 100.0
            max_points: 100.0,
        },
    ];
    let unbalanced_err = eval_update.calculate_weighted_score(&unbalanced_criteria);
    assert!(
        matches!(unbalanced_err, Err(VivaError::Domain(_))),
        "Expected Domain error for unbalanced rubric weights"
    );

    // 4. Test live PostgreSQL persistence if database pool is accessible
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:5432/cloud_judge".to_string());

    if let Ok(pg_pool) = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(Duration::from_secs(2))
        .connect(&db_url)
        .await
    {
        let pool = judge_db::DbPool::new(pg_pool);
        let room_code = format!("VIVA-{}", &Uuid::new_v4().to_string()[..8]);
        let user_id = Uuid::new_v4();

        // Insert prerequisite user records and interview room
        let insert_user_res = sqlx::query(
            r"
            INSERT INTO users (id, username, email, password_hash, role)
            VALUES ($1, $2, $3, 'argon2_dummy', 'INSTRUCTOR')
            ON CONFLICT (id) DO NOTHING
            ",
        )
        .bind(user_id)
        .bind(format!("user_{}", room_code.to_lowercase()))
        .bind(format!("user_{}@example.com", room_code.to_lowercase()))
        .execute(pool.inner())
        .await;

        if insert_user_res.is_ok() {
            let insert_room_res = sqlx::query(
                r"
                INSERT INTO interview_rooms (id, room_code, host_user_id, candidate_user_id, problem_slug, language, status, editor_code, interviewer_notes, rubric_scores)
                VALUES ($1, $2, $3, $3, 'two-sum', 'python', 'ACTIVE', '', '', '{}'::json)
                ",
            )
            .bind(Uuid::new_v4())
            .bind(&room_code)
            .bind(user_id)
            .execute(pool.inner())
            .await;

            if insert_room_res.is_ok() {
                let persisted = persist_rubric_evaluation(&pool, &room_code, &eval_update).await?;
                assert_eq!(persisted.rubric_scores, eval_update.rubric_scores);
                assert_eq!(persisted.interviewer_notes, "Solid execution overall");

                // Cleanup test record
                let _ = sqlx::query("DELETE FROM interview_rooms WHERE room_code = $1")
                    .bind(&room_code)
                    .execute(pool.inner())
                    .await;
                let _ = sqlx::query("DELETE FROM users WHERE id = $1")
                    .bind(user_id)
                    .execute(pool.inner())
                    .await;
            }
        }
    }

    Ok(())
}

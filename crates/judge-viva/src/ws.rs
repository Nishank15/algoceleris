//! Axum WebSocket connection handler for collaborative Viva sessions with strict rubric isolation.

use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tracing::{debug, warn};
use uuid::Uuid;

use crate::awareness::{AwarenessEnvelope, PeerPresence};
use crate::room::VivaRoom;
use crate::rubric::RubricEvaluationUpdate;

/// Outbound message queue capacity per client.
pub const CLIENT_OUTBOUND_QUEUE_CAPACITY: usize = 128;

/// Inbound JSON envelope transmitted over client WebSocket.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum VivaWsClientMessage {
    /// Awareness envelope (presence / cursor).
    Awareness {
        /// Enclosed awareness envelope.
        envelope: AwarenessEnvelope,
    },
    /// Rubric evaluation update submitted by evaluator.
    RubricEvaluation {
        /// Evaluator rubric scores and notes.
        update: RubricEvaluationUpdate,
    },
}

/// Outbound server frame broadcast to participants.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum VivaWsServerMessage {
    /// Awareness update (shared with all peers).
    Awareness {
        /// Enclosed awareness envelope.
        envelope: AwarenessEnvelope,
    },
    /// Rubric evaluation update (strictly masked from candidates).
    RubricEvaluation {
        /// Evaluator rubric scores and confidential notes.
        update: RubricEvaluationUpdate,
    },
    /// Error message.
    Error {
        /// Error status code.
        code: String,
        /// Diagnostic message.
        message: String,
    },
}

/// Manages a bi-directional WebSocket session for a viva participant.
///
/// **Candidate Rubric Masking Invariant:**
/// When `role` is `"candidate"`, rubric updates and confidential interviewer notes are
/// strictly filtered and never emitted over the candidate's socket.
#[allow(clippy::too_many_lines)]
pub async fn handle_viva_socket(
    socket: WebSocket,
    room: Arc<VivaRoom>,
    user_id: Uuid,
    username: String,
    role: String,
) {
    let is_evaluator = matches!(
        role.to_lowercase().as_str(),
        "instructor" | "evaluator" | "host" | "admin" | "orgadmin"
    );

    let (mut sender, mut receiver) = socket.split();
    let (outbound_tx, mut outbound_rx) = mpsc::channel::<Message>(CLIENT_OUTBOUND_QUEUE_CAPACITY);

    // 1. Initial handshake: send server's full document state as an initial sync update
    let initial_update = room.doc().encode_update_v1();
    if outbound_tx
        .send(Message::Binary(initial_update.into()))
        .await
        .is_err()
    {
        return;
    }

    // 2. Broadcast presence update indicating user has joined
    let join_presence = PeerPresence::new(
        user_id,
        &username,
        &role,
        None,
        "#e4f222",
    );
    let join_env = AwarenessEnvelope::presence_update(room.room_code(), join_presence);
    let _ = room.broadcast_awareness(join_env);

    let mut rx_crdt = room.subscribe_crdt();
    let mut rx_awareness = room.subscribe_awareness();
    let mut rx_rubric_opt = if is_evaluator {
        Some(room.subscribe_rubric())
    } else {
        None
    };

    // Outbound task: sole owner of `sender`
    let mut outbound_task = Box::pin(async move {
        loop {
            tokio::select! {
                Some(msg) = outbound_rx.recv() => {
                    if sender.send(msg).await.is_err() {
                        break;
                    }
                }
                Ok(crdt_bytes) = rx_crdt.recv() => {
                    if sender.send(Message::Binary(crdt_bytes.into())).await.is_err() {
                        break;
                    }
                }
                Ok(env) = rx_awareness.recv() => {
                    if let Ok(json) = env.to_json() {
                        if sender.send(Message::Text(json.into())).await.is_err() {
                            break;
                        }
                    }
                }
                // Only evaluated if recipient is an evaluator; NEVER fires for candidate sockets
                Some(rubric_res) = async {
                    match rx_rubric_opt.as_mut() {
                        Some(rx) => Some(rx.recv().await),
                        None => std::future::pending().await,
                    }
                } => {
                    if let Ok(update) = rubric_res {
                        let server_frame = VivaWsServerMessage::RubricEvaluation { update };
                        if let Ok(json) = serde_json::to_string(&server_frame) {
                            if sender.send(Message::Text(json.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                }
                else => break,
            }
        }
    });

    // Inbound task: process frames sent by participant
    let room_clone = Arc::clone(&room);
    let outbound_tx_clone = outbound_tx.clone();
    let mut inbound_task = Box::pin(async move {
        while let Some(msg_res) = receiver.next().await {
            let msg = match msg_res {
                Ok(m) => m,
                Err(e) => {
                    warn!("WebSocket participant error ({username}): {e}");
                    break;
                }
            };

            match msg {
                Message::Binary(bytes) => {
                    // Binary payload represents Yrs update or sync step
                    if let Ok(applied) = room_clone.doc().apply_client_update(&bytes) {
                        let _ = room_clone.broadcast_crdt_update(applied);
                    } else if let Ok(diff) = room_clone.doc().generate_diff_for_client(&bytes) {
                        let _ = room_clone.broadcast_crdt_update(diff);
                    }
                }
                Message::Text(text) => {
                    // Try parsing typed VivaWsClientMessage first
                    if let Ok(client_frame) = serde_json::from_str::<VivaWsClientMessage>(text.as_str()) {
                        match client_frame {
                            VivaWsClientMessage::Awareness { envelope } => {
                                let _ = room_clone.broadcast_awareness(envelope);
                            }
                            VivaWsClientMessage::RubricEvaluation { update } => {
                                if is_evaluator {
                                    let _ = room_clone.broadcast_rubric(update);
                                } else {
                                    warn!("Unauthorized rubric update attempted by candidate {username}");
                                    let err_frame = VivaWsServerMessage::Error {
                                        code: "FORBIDDEN".to_string(),
                                        message: "Candidates are forbidden from updating evaluation rubrics".to_string(),
                                    };
                                    if let Ok(json) = serde_json::to_string(&err_frame) {
                                        let _ = outbound_tx_clone.send(Message::Text(json.into())).await;
                                    }
                                }
                            }
                        }
                    } else if let Ok(env) = AwarenessEnvelope::from_json(text.as_str()) {
                        let _ = room_clone.broadcast_awareness(env);
                    }
                }
                Message::Ping(payload) => {
                    debug!("Received ping from {username}");
                    let _ = outbound_tx_clone.send(Message::Pong(payload)).await;
                }
                Message::Pong(_) => {
                    debug!("Received pong from {username}");
                }
                Message::Close(_) => {
                    debug!("Participant {username} closed session");
                    break;
                }
            }
        }
    });

    // Run both tasks concurrently until either closes
    tokio::select! {
        () = &mut outbound_task => {},
        () = &mut inbound_task => {},
    }

    // Departure cleanup: broadcast departure
    let leave_env = AwarenessEnvelope::peer_leave(room.room_code(), user_id);
    let _ = room.broadcast_awareness(leave_env);
}

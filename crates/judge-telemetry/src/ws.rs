//! Axum WebSocket connection handler for candidate proctoring telemetry.

use axum::extract::ws::{Message, WebSocket};
use tracing::{debug, error, warn};
use uuid::Uuid;

use crate::models::{CandidateProctorState, TelemetryEvent};
use crate::pubsub::TelemetryRelay;
use crate::rate_limit::TokenBucket;

/// Processes an active candidate WebSocket telemetry session.
///
/// Validates incoming events against `candidate_id` and `assessment_id`,
/// throttles burst anomalies with a [`TokenBucket`], tracks aggregate candidate state,
/// and broadcasts events to Redis Pub/Sub.
pub async fn handle_telemetry_socket(
    mut socket: WebSocket,
    assessment_id: Uuid,
    candidate_id: Uuid,
    relay: TelemetryRelay,
) {
    let mut rate_limiter = TokenBucket::default();
    let mut state = CandidateProctorState::new(assessment_id, candidate_id);

    while let Some(msg_result) = socket.recv().await {
        let msg = match msg_result {
            Ok(m) => m,
            Err(e) => {
                warn!("WebSocket error for candidate {candidate_id}: {e}");
                break;
            }
        };

        match msg {
            Message::Text(text) => {
                // 1. Enforce rate limiting
                if let Err(e) = rate_limiter.try_acquire() {
                    warn!("Rate limit throttled for candidate {candidate_id}: {e}");
                    let err_payload = serde_json::json!({
                        "error": "rate_limit_exceeded",
                        "message": e.to_string(),
                    });
                    let _ = socket
                        .send(Message::Text(err_payload.to_string().into()))
                        .await;
                    continue;
                }

                // 2. Parse incoming telemetry frame
                let event: TelemetryEvent = match serde_json::from_str(text.as_str()) {
                    Ok(ev) => ev,
                    Err(e) => {
                        warn!("Malformed telemetry JSON from candidate {candidate_id}: {e}");
                        let err_payload = serde_json::json!({
                            "error": "invalid_payload",
                            "message": e.to_string(),
                        });
                        let _ = socket
                            .send(Message::Text(err_payload.to_string().into()))
                            .await;
                        continue;
                    }
                };

                // 3. Validate identity invariants
                if event.candidate_id != candidate_id || event.assessment_id != assessment_id {
                    error!(
                        "Telemetry identity mismatch: expected ({assessment_id}, {candidate_id}), got ({}, {})",
                        event.assessment_id, event.candidate_id
                    );
                    let err_payload = serde_json::json!({
                        "error": "identity_mismatch",
                        "message": "event assessment_id or candidate_id does not match connection",
                    });
                    let _ = socket
                        .send(Message::Text(err_payload.to_string().into()))
                        .await;
                    break;
                }

                // 4. Update aggregated proctor state
                let alert_opt = state.record_event(&event);

                // 5. Broadcast to Redis Pub/Sub
                if let Err(e) = relay.publish(&event).await {
                    error!("Failed to relay telemetry event to Pub/Sub: {e}");
                }

                // 6. Acknowledge with updated risk score or alert
                let ack_payload = serde_json::json!({
                    "status": "recorded",
                    "risk_score": state.risk_score.score,
                    "severity": state.risk_score.severity,
                    "alert": alert_opt,
                });
                if socket
                    .send(Message::Text(ack_payload.to_string().into()))
                    .await
                    .is_err()
                {
                    break;
                }
            }
            Message::Binary(_) => {
                debug!("Received unexpected binary payload from candidate {candidate_id}");
            }
            Message::Ping(payload) => {
                if socket.send(Message::Pong(payload)).await.is_err() {
                    break;
                }
            }
            Message::Pong(_) => {
                debug!("Received pong heartbeat from candidate {candidate_id}");
            }
            Message::Close(_) => {
                debug!("Candidate {candidate_id} closed telemetry WebSocket connection");
                break;
            }
        }
    }
}

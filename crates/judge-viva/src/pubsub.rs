//! Multi-gateway Redis Pub/Sub distribution for concurrent viva sessions.

use std::sync::Arc;

use futures_util::StreamExt;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

use crate::awareness::AwarenessEnvelope;
use crate::errors::VivaError;
use crate::room::VivaRoom;
use crate::rubric::RubricEvaluationUpdate;

/// Formats standard Redis Pub/Sub channel identifier for viva room events.
#[must_use]
pub fn format_viva_channel(room_code: &str) -> String {
    format!("campus:viva:{room_code}:events")
}

/// Simple RFC 4648 Base64 utility without unsafe operations.
pub mod base64_codec {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    /// Encodes arbitrary binary bytes to a base64 string.
    #[must_use]
    pub fn encode(data: &[u8]) -> String {
        let mut result = String::with_capacity(data.len().div_ceil(3) * 4);
        for chunk in data.chunks(3) {
            let b0 = chunk[0];
            let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
            let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

            result.push(TABLE[(b0 >> 2) as usize] as char);
            result.push(TABLE[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
            if chunk.len() > 1 {
                result.push(TABLE[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
            } else {
                result.push('=');
            }
            if chunk.len() > 2 {
                result.push(TABLE[(b2 & 0x3f) as usize] as char);
            } else {
                result.push('=');
            }
        }
        result
    }

    /// Decodes a base64 string back to binary bytes.
    #[must_use]
    pub fn decode(input: &str) -> Option<Vec<u8>> {
        let mut vals = Vec::new();
        for &byte in input.as_bytes() {
            if byte == b'=' || byte.is_ascii_whitespace() {
                continue;
            }
            let val = match byte {
                b'A'..=b'Z' => byte - b'A',
                b'a'..=b'z' => byte - b'a' + 26,
                b'0'..=b'9' => byte - b'0' + 52,
                b'+' => 62,
                b'/' => 63,
                _ => return None,
            };
            vals.push(val);
        }

        let mut out = Vec::with_capacity(vals.len() * 3 / 4);
        for chunk in vals.chunks(4) {
            if chunk.len() >= 2 {
                out.push((chunk[0] << 2) | (chunk[1] >> 4));
            }
            if chunk.len() >= 3 {
                out.push(((chunk[1] & 0x0f) << 4) | (chunk[2] >> 2));
            }
            if chunk.len() == 4 {
                out.push(((chunk[2] & 0x03) << 6) | chunk[3]);
            }
        }
        Some(out)
    }
}

/// Message payload fan-out across dual gateway clusters.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum VivaClusterMessage {
    /// Binary CRDT update encoded as base64 string.
    CrdtUpdate {
        /// Target room code.
        room_code: String,
        /// Base64-encoded Yrs update payload.
        update_b64: String,
    },
    /// Awareness envelope (presence / cursor).
    Awareness {
        /// Enclosed awareness envelope.
        envelope: AwarenessEnvelope,
    },
    /// Rubric evaluation update (evaluator-only).
    RubricUpdate {
        /// Target room code.
        room_code: String,
        /// Enclosed rubric scores and evaluator notes.
        update: RubricEvaluationUpdate,
    },
}

impl VivaClusterMessage {
    /// Creates a CRDT update cluster message from raw binary bytes.
    #[must_use]
    pub fn crdt(room_code: impl Into<String>, update_bytes: &[u8]) -> Self {
        Self::CrdtUpdate {
            room_code: room_code.into(),
            update_b64: base64_codec::encode(update_bytes),
        }
    }

    /// Decodes the underlying binary CRDT update bytes if this message is a `CrdtUpdate`.
    #[must_use]
    pub fn decode_crdt_bytes(&self) -> Option<Vec<u8>> {
        match self {
            Self::CrdtUpdate { update_b64, .. } => base64_codec::decode(update_b64),
            _ => None,
        }
    }

    /// Creates an awareness cluster message.
    #[must_use]
    pub const fn awareness(envelope: AwarenessEnvelope) -> Self {
        Self::Awareness { envelope }
    }

    /// Creates a rubric update cluster message.
    #[must_use]
    pub fn rubric(room_code: impl Into<String>, update: RubricEvaluationUpdate) -> Self {
        Self::RubricUpdate {
            room_code: room_code.into(),
            update,
        }
    }

    /// Returns the room code targeted by this cluster message.
    #[must_use]
    pub fn room_code(&self) -> &str {
        match self {
            Self::CrdtUpdate { room_code, .. } | Self::RubricUpdate { room_code, .. } => room_code,
            Self::Awareness { envelope } => &envelope.room_code,
        }
    }

    /// Serializes cluster message to JSON string.
    ///
    /// # Errors
    /// Returns [`VivaError::SerializationError`] if serialization fails.
    pub fn to_json(&self) -> Result<String, VivaError> {
        serde_json::to_string(self)
            .map_err(|e| VivaError::SerializationError(e.to_string()))
    }

    /// Deserializes cluster message from JSON string.
    ///
    /// # Errors
    /// Returns [`VivaError::SerializationError`] if parsing fails.
    pub fn from_json(json: &str) -> Result<Self, VivaError> {
        serde_json::from_str(json)
            .map_err(|e| VivaError::SerializationError(e.to_string()))
    }
}

/// Multi-gateway Redis Pub/Sub relayer distributing viva session updates.
#[derive(Clone)]
pub struct VivaRedisRelay {
    client: Option<redis::Client>,
    local_tx: broadcast::Sender<VivaClusterMessage>,
}

impl VivaRedisRelay {
    /// In-memory broadcast capacity for local test execution.
    pub const LOCAL_CAPACITY: usize = 1024;

    /// Creates an in-memory relayer without external Redis network dependencies.
    #[must_use]
    pub fn new_in_memory() -> Self {
        let (local_tx, _) = broadcast::channel(Self::LOCAL_CAPACITY);
        Self {
            client: None,
            local_tx,
        }
    }

    /// Creates a relayer connected to an external Redis cluster.
    ///
    /// # Errors
    /// Returns [`VivaError::ProtocolError`] if the connection URL is malformed.
    pub fn new(redis_url: &str) -> Result<Self, VivaError> {
        let client = redis::Client::open(redis_url)
            .map_err(|e| VivaError::ProtocolError(format!("invalid redis url: {e}")))?;
        let (local_tx, _) = broadcast::channel(Self::LOCAL_CAPACITY);
        Ok(Self {
            client: Some(client),
            local_tx,
        })
    }

    /// Publishes a cluster message to the appropriate Redis channel and local broadcast bus.
    ///
    /// # Errors
    /// Returns [`VivaError`] if message serialization or Redis publishing fails.
    pub async fn publish(&self, msg: &VivaClusterMessage) -> Result<(), VivaError> {
        let payload = msg.to_json()?;

        // Broadcast locally
        let _ = self.local_tx.send(msg.clone());

        // Publish to Redis if connected
        if let Some(ref client) = self.client {
            let mut conn = client
                .get_multiplexed_async_connection()
                .await
                .map_err(VivaError::Redis)?;
            let channel = format_viva_channel(msg.room_code());
            conn.publish::<_, _, ()>(channel, payload)
                .await
                .map_err(VivaError::Redis)?;
        }

        Ok(())
    }

    /// Subscribes to the local in-memory broadcast bus.
    #[must_use]
    pub fn subscribe_local(&self) -> broadcast::Receiver<VivaClusterMessage> {
        self.local_tx.subscribe()
    }

    /// Spawns an asynchronous listener forwarding incoming cluster messages into the target room.
    pub fn spawn_cluster_listener(&self, room: Arc<VivaRoom>) -> tokio::task::JoinHandle<()> {
        let target_code = room.room_code().to_string();
        let client_opt = self.client.clone();
        let mut local_rx = self.subscribe_local();

        tokio::spawn(async move {
            if let Some(client) = client_opt {
                if let Ok(mut pubsub) = client.get_async_pubsub().await {
                    let channel = format_viva_channel(&target_code);
                    if pubsub.subscribe(&channel).await.is_ok() {
                        let mut stream = pubsub.into_on_message();
                        while let Some(msg) = stream.next().await {
                            if let Ok(payload) = msg.get_payload::<String>() {
                                if let Ok(cluster_msg) = VivaClusterMessage::from_json(&payload) {
                                    Self::route_message_into_room(&room, &cluster_msg);
                                }
                            }
                        }
                        return;
                    }
                }
            }

            // Fallback: listen on local broadcast channel
            while let Ok(msg) = local_rx.recv().await {
                if msg.room_code() == target_code {
                    Self::route_message_into_room(&room, &msg);
                }
            }
        })
    }

    fn route_message_into_room(room: &VivaRoom, msg: &VivaClusterMessage) {
        match msg {
            VivaClusterMessage::CrdtUpdate { .. } => {
                if let Some(bytes) = msg.decode_crdt_bytes() {
                    let _ = room.doc().apply_client_update(&bytes);
                    let _ = room.broadcast_crdt_update(bytes);
                }
            }
            VivaClusterMessage::Awareness { envelope } => {
                let _ = room.broadcast_awareness(envelope.clone());
            }
            VivaClusterMessage::RubricUpdate { update, .. } => {
                let _ = room.broadcast_rubric(update.clone());
            }
        }
    }
}

impl Default for VivaRedisRelay {
    fn default() -> Self {
        Self::new_in_memory()
    }
}

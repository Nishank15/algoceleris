//! Real-time peer presence and remote cursor awareness envelopes.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::VivaError;

/// Monaco editor cursor line and column coordinates.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CursorPosition {
    /// 1-indexed line number.
    pub line: u32,
    /// 1-indexed column number.
    pub column: u32,
}

impl CursorPosition {
    /// Creates a new cursor coordinate.
    #[must_use]
    pub const fn new(line: u32, column: u32) -> Self {
        Self { line, column }
    }
}

/// Metadata and real-time cursor state for a connected viva peer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PeerPresence {
    /// Peer user UUID.
    pub user_id: Uuid,
    /// Display username.
    pub username: String,
    /// Assigned viva role (e.g., `"instructor"`, `"candidate"`).
    pub role: String,
    /// Current cursor position, if active in editor.
    #[serde(default)]
    pub cursor: Option<CursorPosition>,
    /// Unique assigned hex color for remote cursor rendering.
    pub color: String,
}

impl PeerPresence {
    /// Creates a new `PeerPresence` instance.
    #[must_use]
    pub fn new(
        user_id: Uuid,
        username: impl Into<String>,
        role: impl Into<String>,
        cursor: Option<CursorPosition>,
        color: impl Into<String>,
    ) -> Self {
        Self {
            user_id,
            username: username.into(),
            role: role.into(),
            cursor,
            color: color.into(),
        }
    }
}

/// Awareness event payload variants.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AwarenessMessage {
    /// Full peer presence state update.
    PresenceUpdate {
        presence: PeerPresence,
        timestamp: DateTime<Utc>,
    },
    /// Fast cursor relocation event.
    CursorMove {
        user_id: Uuid,
        cursor: CursorPosition,
        timestamp: DateTime<Utc>,
    },
    /// Peer disconnected from session.
    PeerLeave {
        user_id: Uuid,
        timestamp: DateTime<Utc>,
    },
}

/// Envelope wrapping an awareness message destined for a specific viva room.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AwarenessEnvelope {
    /// Room code identifier.
    pub room_code: String,
    /// Nested awareness payload.
    pub message: AwarenessMessage,
}

impl AwarenessEnvelope {
    /// Creates a presence update envelope.
    #[must_use]
    pub fn presence_update(room_code: impl Into<String>, presence: PeerPresence) -> Self {
        Self {
            room_code: room_code.into(),
            message: AwarenessMessage::PresenceUpdate {
                presence,
                timestamp: Utc::now(),
            },
        }
    }

    /// Creates a cursor movement envelope.
    #[must_use]
    pub fn cursor_move(
        room_code: impl Into<String>,
        user_id: Uuid,
        line: u32,
        column: u32,
    ) -> Self {
        Self {
            room_code: room_code.into(),
            message: AwarenessMessage::CursorMove {
                user_id,
                cursor: CursorPosition::new(line, column),
                timestamp: Utc::now(),
            },
        }
    }

    /// Creates a peer departure envelope.
    #[must_use]
    pub fn peer_leave(room_code: impl Into<String>, user_id: Uuid) -> Self {
        Self {
            room_code: room_code.into(),
            message: AwarenessMessage::PeerLeave {
                user_id,
                timestamp: Utc::now(),
            },
        }
    }

    /// Serializes envelope to a JSON string.
    ///
    /// # Errors
    /// Returns [`VivaError::SerializationError`] if serialization fails.
    pub fn to_json(&self) -> Result<String, VivaError> {
        serde_json::to_string(self).map_err(|e| VivaError::SerializationError(e.to_string()))
    }

    /// Deserializes envelope from a JSON string.
    ///
    /// # Errors
    /// Returns [`VivaError::SerializationError`] if parsing fails.
    pub fn from_json(json: &str) -> Result<Self, VivaError> {
        serde_json::from_str(json).map_err(|e| VivaError::SerializationError(e.to_string()))
    }
}

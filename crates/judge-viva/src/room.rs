//! Thread-safe viva room pooling and broadcast channels.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use chrono::{DateTime, Utc};
use tokio::sync::broadcast;

use crate::awareness::AwarenessEnvelope;
use crate::crdt::VivaDoc;
use crate::errors::VivaError;

/// Broadcast channel buffer capacity for CRDT updates.
pub const CRDT_BROADCAST_CAPACITY: usize = 1024;

/// Broadcast channel buffer capacity for awareness frames.
pub const AWARENESS_BROADCAST_CAPACITY: usize = 512;

/// Broadcast channel buffer capacity for rubric updates.
pub const RUBRIC_BROADCAST_CAPACITY: usize = 128;

/// A live collaborative interview session holding document state and broadcast buses.
pub struct VivaRoom {
    room_code: String,
    doc: Arc<VivaDoc>,
    tx_crdt: broadcast::Sender<Vec<u8>>,
    tx_awareness: broadcast::Sender<AwarenessEnvelope>,
    tx_rubric: broadcast::Sender<crate::rubric::RubricEvaluationUpdate>,
    created_at: DateTime<Utc>,
}

impl VivaRoom {
    /// Creates a new `VivaRoom` with an isolated CRDT document and broadcast channels.
    #[must_use]
    pub fn new(room_code: impl Into<String>) -> Self {
        let (tx_crdt, _) = broadcast::channel(CRDT_BROADCAST_CAPACITY);
        let (tx_awareness, _) = broadcast::channel(AWARENESS_BROADCAST_CAPACITY);
        let (tx_rubric, _) = broadcast::channel(RUBRIC_BROADCAST_CAPACITY);
        Self {
            room_code: room_code.into(),
            doc: Arc::new(VivaDoc::new()),
            tx_crdt,
            tx_awareness,
            tx_rubric,
            created_at: Utc::now(),
        }
    }

    /// Room code identifier.
    #[must_use]
    pub fn room_code(&self) -> &str {
        &self.room_code
    }

    /// Reference to the room's CRDT document.
    #[must_use]
    pub fn doc(&self) -> &VivaDoc {
        &self.doc
    }

    /// Timestamp when room was created.
    #[must_use]
    pub const fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    /// Broadcasts a binary CRDT update to all connected peers in this room.
    ///
    /// # Errors
    /// Returns [`VivaError::CrdtSyncError`] if broadcasting fails.
    pub fn broadcast_crdt_update(&self, update: Vec<u8>) -> Result<usize, VivaError> {
        self.tx_crdt
            .send(update)
            .map_err(|e| VivaError::CrdtSyncError(e.to_string()))
    }

    /// Broadcasts an awareness envelope to all connected peers in this room.
    ///
    /// # Errors
    /// Returns [`VivaError::ProtocolError`] if broadcasting fails.
    pub fn broadcast_awareness(&self, envelope: AwarenessEnvelope) -> Result<usize, VivaError> {
        self.tx_awareness
            .send(envelope)
            .map_err(|e| VivaError::ProtocolError(e.to_string()))
    }

    /// Broadcasts a rubric evaluation update to evaluator peers in this room.
    ///
    /// # Errors
    /// Returns [`VivaError::ProtocolError`] if broadcasting fails.
    pub fn broadcast_rubric(
        &self,
        update: crate::rubric::RubricEvaluationUpdate,
    ) -> Result<usize, VivaError> {
        self.tx_rubric
            .send(update)
            .map_err(|e| VivaError::ProtocolError(e.to_string()))
    }

    /// Subscribes to the room's binary CRDT update stream.
    #[must_use]
    pub fn subscribe_crdt(&self) -> broadcast::Receiver<Vec<u8>> {
        self.tx_crdt.subscribe()
    }

    /// Subscribes to the room's awareness update stream.
    #[must_use]
    pub fn subscribe_awareness(&self) -> broadcast::Receiver<AwarenessEnvelope> {
        self.tx_awareness.subscribe()
    }

    /// Subscribes to the room's rubric evaluation update stream.
    #[must_use]
    pub fn subscribe_rubric(&self) -> broadcast::Receiver<crate::rubric::RubricEvaluationUpdate> {
        self.tx_rubric.subscribe()
    }
}

/// Concurrent thread-safe manager maintaining active viva rooms in memory.
#[derive(Clone, Default)]
pub struct VivaRoomManager {
    rooms: Arc<RwLock<HashMap<String, Arc<VivaRoom>>>>,
}

impl VivaRoomManager {
    /// Creates a new empty `VivaRoomManager`.
    #[must_use]
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Retrieves an existing room by code, or creates and caches a new one.
    #[must_use]
    pub fn get_or_create_room(&self, room_code: &str) -> Arc<VivaRoom> {
        let mut map = self
            .rooms
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        map.entry(room_code.to_string())
            .or_insert_with(|| Arc::new(VivaRoom::new(room_code)))
            .clone()
    }

    /// Retrieves an existing room by code if it exists.
    #[must_use]
    pub fn get_room(&self, room_code: &str) -> Option<Arc<VivaRoom>> {
        let map = self
            .rooms
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        map.get(room_code).cloned()
    }

    /// Returns the number of active rooms currently managed.
    #[must_use]
    pub fn room_count(&self) -> usize {
        let map = self
            .rooms
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        map.len()
    }

    /// Removes a room from management by code.
    pub fn remove_room(&self, room_code: &str) -> Option<Arc<VivaRoom>> {
        let mut map = self
            .rooms
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        map.remove(room_code)
    }
}

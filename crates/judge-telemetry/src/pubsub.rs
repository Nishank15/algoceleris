//! Redis Pub/Sub telemetry relayer and channel routing.

use futures_util::StreamExt;
use redis::AsyncCommands;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::errors::TelemetryError;
use crate::models::TelemetryEvent;

/// Constructs standard Redis Pub/Sub channel identifier for an assessment.
#[must_use]
pub fn format_telemetry_channel(assessment_id: Uuid) -> String {
    format!("campus:proctor:{assessment_id}:telemetry")
}

/// Manages async Redis Pub/Sub message dispatch and real-time event broadcasting.
#[derive(Clone)]
pub struct TelemetryRelay {
    client: Option<redis::Client>,
    local_tx: broadcast::Sender<TelemetryEvent>,
}

impl TelemetryRelay {
    /// Capacity of the local fallback broadcast ring buffer.
    pub const LOCAL_BROADCAST_CAPACITY: usize = 1024;

    /// Creates an in-memory relayer without external Redis dependency (for testing/isolated runs).
    #[must_use]
    pub fn new_in_memory() -> Self {
        let (local_tx, _) = broadcast::channel(Self::LOCAL_BROADCAST_CAPACITY);
        Self {
            client: None,
            local_tx,
        }
    }

    /// Initializes a relayer connected to an external Redis server.
    ///
    /// # Errors
    /// Returns [`TelemetryError::ConnectionError`] if Redis client initialization fails.
    pub fn new(redis_url: &str) -> Result<Self, TelemetryError> {
        let client = redis::Client::open(redis_url)
            .map_err(|e| TelemetryError::ConnectionError(format!("invalid redis url: {e}")))?;
        let (local_tx, _) = broadcast::channel(Self::LOCAL_BROADCAST_CAPACITY);
        Ok(Self {
            client: Some(client),
            local_tx,
        })
    }

    /// Returns the standard channel name for an assessment.
    #[must_use]
    pub fn channel_name(&self, assessment_id: Uuid) -> String {
        format_telemetry_channel(assessment_id)
    }

    /// Publishes a telemetry event to Redis Pub/Sub and the local broadcast channel.
    ///
    /// # Errors
    /// Returns [`TelemetryError`] if serialization or Redis publication fails.
    pub async fn publish(&self, event: &TelemetryEvent) -> Result<(), TelemetryError> {
        let payload = serde_json::to_string(event)
            .map_err(|e| TelemetryError::SerializationError(e.to_string()))?;

        // 1. Broadcast locally
        let _ = self.local_tx.send(event.clone());

        // 2. Publish to Redis if configured
        if let Some(ref client) = self.client {
            let mut conn = client
                .get_multiplexed_async_connection()
                .await
                .map_err(TelemetryError::Redis)?;
            let channel = format_telemetry_channel(event.assessment_id);
            conn.publish::<_, _, ()>(channel, payload)
                .await
                .map_err(TelemetryError::Redis)?;
        }

        Ok(())
    }

    /// Subscribes to local in-memory event stream.
    #[must_use]
    pub fn subscribe_local(&self) -> broadcast::Receiver<TelemetryEvent> {
        self.local_tx.subscribe()
    }

    /// Subscribes to Redis Pub/Sub stream for a given assessment, yielding raw JSON payloads.
    ///
    /// # Errors
    /// Returns [`TelemetryError`] if Redis connection or subscription fails.
    pub async fn subscribe_redis(
        &self,
        assessment_id: Uuid,
    ) -> Result<
        impl futures_util::Stream<Item = Result<TelemetryEvent, TelemetryError>>,
        TelemetryError,
    > {
        let client = self.client.as_ref().ok_or_else(|| {
            TelemetryError::ConnectionError("redis client not configured".to_string())
        })?;

        let mut pubsub = client
            .get_async_pubsub()
            .await
            .map_err(TelemetryError::Redis)?;

        let channel = format_telemetry_channel(assessment_id);
        pubsub
            .subscribe(&channel)
            .await
            .map_err(TelemetryError::Redis)?;

        let stream = pubsub.into_on_message().map(|msg| {
            let payload: String = msg.get_payload().map_err(TelemetryError::Redis)?;
            serde_json::from_str::<TelemetryEvent>(&payload)
                .map_err(|e| TelemetryError::SerializationError(e.to_string()))
        });

        Ok(stream)
    }
}

impl Default for TelemetryRelay {
    fn default() -> Self {
        Self::new_in_memory()
    }
}

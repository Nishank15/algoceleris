//! Proctoring telemetry mesh aggregator.

use crate::pubsub::TelemetryRelay;

/// Central telemetry mesh coordinating event ingestion and Pub/Sub routing.
#[derive(Clone, Default)]
pub struct TelemetryMesh {
    relay: TelemetryRelay,
}

impl TelemetryMesh {
    /// Creates a new in-memory `TelemetryMesh`.
    #[must_use]
    pub fn new() -> Self {
        Self {
            relay: TelemetryRelay::new_in_memory(),
        }
    }

    /// Creates a `TelemetryMesh` with a custom [`TelemetryRelay`].
    #[must_use]
    pub fn with_relay(relay: TelemetryRelay) -> Self {
        Self { relay }
    }

    /// Returns a reference to the inner [`TelemetryRelay`].
    #[must_use]
    pub fn relay(&self) -> &TelemetryRelay {
        &self.relay
    }
}

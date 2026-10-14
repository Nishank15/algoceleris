//! # judge-telemetry
//!
//! Proctoring telemetry ingestion, WebSocket telemetry relayer,
//! and Token-Bucket rate limiting for `AlgoCeleris` / Cloud-Judge V2.

pub mod errors;
pub mod mesh;
pub mod models;
pub mod pubsub;
pub mod rate_limit;
pub mod ws;

pub use errors::TelemetryError;
pub use mesh::TelemetryMesh;
pub use models::{
    CandidateProctorState, ProctorAlertFrame, TelemetryEvent, TelemetryEventType,
};
pub use pubsub::{format_telemetry_channel, TelemetryRelay};
pub use rate_limit::{TokenBucket, DEFAULT_BURST_CAPACITY, DEFAULT_REFILL_RATE};
pub use ws::handle_telemetry_socket;

//! # judge-viva
//!
//! Real-time collaborative interview engine, WebSocket session pooling,
//! Yrs CRDT buffer synchronization, and private rubric isolation.

pub mod awareness;
pub mod crdt;
pub mod errors;
pub mod pubsub;
pub mod room;
pub mod rubric;
pub mod ws;

pub use awareness::{AwarenessEnvelope, AwarenessMessage, CursorPosition, PeerPresence};
pub use crdt::VivaDoc;
pub use errors::VivaError;
pub use pubsub::{format_viva_channel, VivaClusterMessage, VivaRedisRelay};
pub use room::{VivaRoom, VivaRoomManager};
pub use rubric::{persist_rubric_evaluation, RubricEvaluationUpdate};
pub use ws::{handle_viva_socket, VivaWsClientMessage, VivaWsServerMessage};

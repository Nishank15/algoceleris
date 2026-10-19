//! Service-layer runtime pieces shared by the gateway route handlers.
//!
//! The modules here hold the stateful machinery a handler delegates to: the
//! model-backed AI debugging pipeline and the per-user quota limiter that protects
//! it.

pub mod llm;
pub mod rate_limit;

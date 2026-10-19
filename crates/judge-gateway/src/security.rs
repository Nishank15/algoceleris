//! Edge security policy: defensive response headers and an explicit CORS allow-list.
//!
//! This module replaces the previous blanket `CorsLayer::permissive()`. Two policies are
//! enforced here:
//!
//! 1. **CORS** — only the configured browser origins (local dev servers and the `HAProxy` edge)
//!    may read responses, and only the headers the client actually sends are accepted.
//! 2. **Response hardening** — every response carries a baseline header set, including on
//!    short-circuited preflights and 404s, because the middleware is the outermost layer.
//!
//! Both policies are overridable per environment so that a production edge can tighten the
//! origin list and the CSP without a code change.

use std::sync::OnceLock;
use std::time::Duration;

use axum::extract::Request;
use axum::http::{header, HeaderName, HeaderValue, Method};
use axum::middleware::Next;
use axum::response::Response;
use tower_http::cors::{AllowOrigin, CorsLayer};

/// `X-Content-Type-Options` — stops MIME sniffing of API responses.
const X_CONTENT_TYPE_OPTIONS: HeaderName = HeaderName::from_static("x-content-type-options");
/// `X-Frame-Options` — refuses framing of gateway responses.
const X_FRAME_OPTIONS: HeaderName = HeaderName::from_static("x-frame-options");
/// `Referrer-Policy` — trims path/query detail from cross-origin referrers.
const REFERRER_POLICY: HeaderName = HeaderName::from_static("referrer-policy");
/// `Content-Security-Policy` — restricts what a document served by the edge may load.
const CONTENT_SECURITY_POLICY: HeaderName = HeaderName::from_static("content-security-policy");
/// `X-User-ID` — guest/user identity header sent by the judge client.
const X_USER_ID: HeaderName = HeaderName::from_static("x-user-id");
/// `X-Org-ID` — tenant selector read by [`crate::extractors`] when resolving org scope.
const X_ORG_ID: HeaderName = HeaderName::from_static("x-org-id");

/// Origins allowed to call the API from a browser when `CORS_ALLOWED_ORIGINS` is unset.
///
/// These are the local development surfaces only: the rsbuild dev server (`:3000`) and the
/// `HAProxy` edge (`:8080`, plus bare `:80`). Production deployments are expected to set
/// `CORS_ALLOWED_ORIGINS` explicitly.
pub const DEFAULT_ALLOWED_ORIGINS: &[&str] = &[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost",
    "http://127.0.0.1",
];

/// Baseline CSP when `CONTENT_SECURITY_POLICY` is unset.
///
/// Deliberately development-friendly: rsbuild's dev server and the Monaco editor require
/// inline styles and `eval`, and the client opens WebSocket streams to the local edge. A
/// production deployment should supply a stricter policy (no `unsafe-inline`/`unsafe-eval`)
/// through the environment variable.
pub const DEFAULT_CONTENT_SECURITY_POLICY: &str = "default-src 'self'; \
     script-src 'self' 'unsafe-inline' 'unsafe-eval'; \
     style-src 'self' 'unsafe-inline'; \
     img-src 'self' data: blob:; \
     font-src 'self' data:; \
     connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:*; \
     frame-ancestors 'none'; \
     base-uri 'self'; \
     object-src 'none'";

/// Origins for the CORS layer: `CORS_ALLOWED_ORIGINS` (comma separated) or the dev defaults.
///
/// Values that are not valid single origin header values are skipped rather than failing the
/// boot, so a typo in the environment cannot take the gateway down.
fn configured_origins() -> Vec<HeaderValue> {
    let raw = std::env::var("CORS_ALLOWED_ORIGINS")
        .ok()
        .filter(|value| !value.trim().is_empty());

    let candidates: Vec<String> = match raw {
        Some(value) => value
            .split(',')
            .map(str::trim)
            .filter(|origin| !origin.is_empty())
            .map(ToString::to_string)
            .collect(),
        None => DEFAULT_ALLOWED_ORIGINS
            .iter()
            .map(|origin| (*origin).to_string())
            .collect(),
    };

    let origins: Vec<HeaderValue> = candidates
        .into_iter()
        .filter_map(|origin| {
            if let Ok(value) = HeaderValue::from_str(&origin) {
                Some(value)
            } else {
                tracing::warn!(origin = %origin, "Ignoring invalid CORS origin");
                None
            }
        })
        .collect();

    if origins.is_empty() {
        DEFAULT_ALLOWED_ORIGINS
            .iter()
            .filter_map(|origin| HeaderValue::from_str(origin).ok())
            .collect()
    } else {
        origins
    }
}

/// Builds the CORS layer for the gateway router.
///
/// Requirements this satisfies:
/// * only the configured origins may read responses (`AllowOrigin::list`, never a wildcard),
/// * credentials are permitted **only** for those origins, because the client sends
///   `credentials: 'include'` — a wildcard origin is incompatible with credentialed requests,
///   so the previous `permissive()` configuration silently broke every cross-origin call,
/// * only the request headers the client actually uses are accepted, so the browser cannot be
///   induced to send arbitrary credentialed headers.
pub fn cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(configured_origins()))
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            X_USER_ID,
            X_ORG_ID,
        ])
        .allow_credentials(true)
        .max_age(Duration::from_secs(600))
}

/// Resolves the CSP value once per process: `CONTENT_SECURITY_POLICY` or the dev default.
fn csp_value() -> HeaderValue {
    static CSP: OnceLock<HeaderValue> = OnceLock::new();

    CSP.get_or_init(|| {
        let configured = std::env::var("CONTENT_SECURITY_POLICY")
            .ok()
            .filter(|value| !value.trim().is_empty());

        match configured {
            Some(value) => HeaderValue::from_str(value.trim()).unwrap_or_else(|_| {
                tracing::warn!("Ignoring malformed CONTENT_SECURITY_POLICY value");
                HeaderValue::from_static(DEFAULT_CONTENT_SECURITY_POLICY)
            }),
            None => HeaderValue::from_static(DEFAULT_CONTENT_SECURITY_POLICY),
        }
    })
    .clone()
}

/// Attaches the baseline defensive headers to a response.
///
/// Mount this as the **outermost** layer: that way the headers are present on responses the
/// inner layers generate themselves (CORS preflight replies, trace/compression output) as well
/// as on handler output and on the 404 fallback.
pub async fn attach_security_headers(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;

    let headers = response.headers_mut();
    headers.insert(X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    headers.insert(X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    headers.insert(
        REFERRER_POLICY,
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(CONTENT_SECURITY_POLICY, csp_value());

    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_origins_are_concrete_origins_never_wildcards() {
        for origin in DEFAULT_ALLOWED_ORIGINS {
            assert!(
                origin.starts_with("http://"),
                "{origin} must be a concrete origin"
            );
            assert!(!origin.contains('*'), "{origin} must not be a wildcard");
        }
    }

    #[test]
    fn default_csp_forbids_framing_and_object_embedding() {
        assert!(DEFAULT_CONTENT_SECURITY_POLICY.contains("frame-ancestors 'none'"));
        assert!(DEFAULT_CONTENT_SECURITY_POLICY.contains("object-src 'none'"));
        assert!(DEFAULT_CONTENT_SECURITY_POLICY.contains("default-src 'self'"));
    }

    #[test]
    fn csp_default_parses_as_a_header_value() {
        assert!(HeaderValue::from_str(DEFAULT_CONTENT_SECURITY_POLICY).is_ok());
    }

    #[test]
    fn configured_origins_are_never_empty_and_always_parseable() {
        // Env-independent: an unset, blank, or wholly invalid override must still leave the
        // gateway with a usable allow-list, and every entry must be a valid header value.
        let origins = configured_origins();
        assert!(
            !origins.is_empty(),
            "the gateway must always expose a non-empty origin allow-list"
        );
        for origin in &origins {
            assert!(!origin.is_empty(), "blank origins must be filtered out");
        }
    }
}

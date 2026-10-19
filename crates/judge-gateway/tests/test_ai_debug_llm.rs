//! Model-backed AI debug behavior against a local mock provider.
//!
//! The mock speaks the `OpenAI` chat-completions dialect on loopback, so these tests
//! exercise configuration parsing, prompt assembly, strict response parsing, quota
//! enforcement, and every degradation path without calling a real model.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::OnceLock;
use std::thread;

use axum::body::Body;
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE, RETRY_AFTER};
use axum::http::{HeaderMap, Request, StatusCode};
use judge_gateway::auth::{encode_access_token, DEFAULT_JWT_SECRET};
use judge_gateway::create_router;
use judge_gateway::routes::AIDebugResponse;
use judge_gateway::services::rate_limit::FREE_TIER_LIMIT;
use judge_gateway::state::AppState;
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;

/// Marker that makes the mock provider answer with a non-JSON message.
const TRIGGER_MALFORMED: &str = "MOCK_TRIGGER_MALFORMED";
/// Marker that makes the mock provider answer with HTTP 500.
const TRIGGER_ERROR: &str = "MOCK_TRIGGER_ERROR";

/// Base URL of the mock provider, started once per test binary.
fn provider_base_url() -> &'static str {
    static BASE_URL: OnceLock<String> = OnceLock::new();
    BASE_URL.get_or_init(|| {
        let listener = TcpListener::bind("127.0.0.1:0").expect("mock provider must bind");
        let address = listener
            .local_addr()
            .expect("mock provider must expose an address");
        thread::spawn(move || serve_provider(&listener));
        format!("http://{address}/v1")
    })
}

/// Points the gateway at the mock provider. Idempotent, so parallel tests agree on the
/// same environment values.
fn configure_provider() {
    static CONFIGURED: OnceLock<()> = OnceLock::new();
    CONFIGURED.get_or_init(|| {
        std::env::set_var("LLM_API_KEY", "mock-key");
        std::env::set_var("LLM_BASE_URL", provider_base_url());
        std::env::set_var("LLM_MODEL", "mock-model");
    });
}

/// Serves mock completions until the test binary exits.
fn serve_provider(listener: &TcpListener) {
    for stream in listener.incoming() {
        let Ok(stream) = stream else { continue };
        thread::spawn(move || {
            let _ = handle_connection(stream);
        });
    }
}

/// Reads one HTTP request and answers with the canned provider behavior.
fn handle_connection(mut stream: TcpStream) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;

    let mut content_length = 0_usize;
    loop {
        let mut header = String::new();
        if reader.read_line(&mut header)? == 0 || header.trim().is_empty() {
            break;
        }
        let lowercase = header.to_ascii_lowercase();
        if let Some(value) = lowercase.strip_prefix("content-length:") {
            content_length = value.trim().parse().unwrap_or(0);
        }
    }

    let mut body = vec![0_u8; content_length];
    reader.read_exact(&mut body)?;
    let prompt = String::from_utf8_lossy(&body).to_string();

    let (status, response_body) = mock_response(&prompt);
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response_body}",
        response_body.len()
    );
    stream.write_all(response.as_bytes())?;
    stream.flush()
}

/// Canned provider behavior, keyed off markers in the submitted prompt.
fn mock_response(prompt: &str) -> (&'static str, String) {
    if prompt.contains(TRIGGER_MALFORMED) {
        return ("200 OK", "the model declined to answer".to_string());
    }
    if prompt.contains(TRIGGER_ERROR) {
        return (
            "500 Internal Server Error",
            json!({ "error": "provider exploded" }).to_string(),
        );
    }

    let analysis = json!({
        "advice": "Index the complement instead of rescanning.",
        "root_cause": "The nested scan revisits every pair.",
        "fix_explanation": "Store each element in a hash map as you go.",
        "complexity_analysis": "O(N) time and O(N) space.",
        "fixed_code": "print(42)\n",
    });
    let envelope = json!({
        "choices": [
            { "message": { "role": "assistant", "content": analysis.to_string() } }
        ],
    });

    ("200 OK", envelope.to_string())
}

/// Mints an access token with the given role, which is the tier signal.
fn token_for(role: &str) -> String {
    encode_access_token(
        &Uuid::new_v4().to_string(),
        "ai-debug-tester",
        "ai-debug@campus.edu",
        role,
        DEFAULT_JWT_SECRET,
        None,
    )
    .expect("test token must encode")
}

fn ai_debug_body(code: &str) -> Value {
    json!({
        "user_id": "usr-pro-dev",
        "language": "python",
        "source_code": code,
        "problem_slug": "two-sum",
        "problem_title": "1. Two Sum",
        "problem_description": "Return the indices of the two numbers.",
        "error_diagnostics": "Wrong Answer on test 3",
        "failing_test_cases": [
            { "id": 3, "input": "[2,7,11,15], 9", "expected": "[0,1]", "actual": "[]" }
        ],
    })
}

async fn post_ai_debug(
    app: &axum::Router,
    path: &str,
    body: &Value,
    token: Option<&str>,
) -> (StatusCode, HeaderMap, Value) {
    let mut builder = Request::builder()
        .method("POST")
        .uri(path)
        .header(CONTENT_TYPE, "application/json");
    if let Some(token) = token {
        builder = builder.header(AUTHORIZATION, format!("Bearer {token}"));
    }

    let request = builder
        .body(Body::from(body.to_string()))
        .expect("request must build");
    let response = app
        .clone()
        .oneshot(request)
        .await
        .expect("router must answer");
    let status = response.status();
    let headers = response.headers().clone();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body must be readable");
    let value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);

    (status, headers, value)
}

fn source_header(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("x-ai-debug-source")
        .and_then(|value| value.to_str().ok())
}

#[tokio::test]
async fn model_backed_debug_returns_the_parsed_analysis() {
    configure_provider();
    let app = create_router(AppState::new_test());
    let token = token_for("free");

    let (status, headers, body) = post_ai_debug(
        &app,
        "/api/v1/ai/debug",
        &ai_debug_body("def two_sum(): return []"),
        Some(&token),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(source_header(&headers), Some("llm"));

    let response: AIDebugResponse =
        serde_json::from_value(body).expect("model answer must satisfy the client contract");
    assert_eq!(
        response.advice,
        "Index the complement instead of rescanning."
    );
    assert_eq!(response.root_cause, "The nested scan revisits every pair.");
    assert_eq!(
        response.fix_explanation,
        "Store each element in a hash map as you go."
    );
    assert_eq!(response.complexity_analysis, "O(N) time and O(N) space.");
    assert_eq!(response.fixed_code.as_deref(), Some("print(42)"));

    // The patch is derived from the rewrite, so the diff matches the code it patches.
    let diff = response.code_diff.expect("rewrite must produce a diff");
    assert!(diff.starts_with("--- a/solution.py\n+++ b/solution.py\n"));
    assert!(diff.contains("\n+print(42)\n"));
}

#[tokio::test]
async fn subscription_scoped_alias_is_model_backed_too() {
    configure_provider();
    let app = create_router(AppState::new_test());
    let token = token_for("free");

    let (status, headers, body) = post_ai_debug(
        &app,
        "/api/v1/subscriptions/ai-debug",
        &ai_debug_body("def two_sum(): return []"),
        Some(&token),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(source_header(&headers), Some("llm"));
    assert_eq!(
        body["advice"].as_str(),
        Some("Index the complement instead of rescanning.")
    );
}

#[tokio::test]
async fn anonymous_model_backed_requests_are_rejected() {
    configure_provider();
    let app = create_router(AppState::new_test());

    let (status, headers, _) = post_ai_debug(
        &app,
        "/api/v1/ai/debug",
        &ai_debug_body("def two_sum(): return []"),
        None,
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert!(source_header(&headers).is_none());
}

#[tokio::test]
async fn free_tier_quota_returns_429_with_retry_after() {
    configure_provider();
    let app = create_router(AppState::new_test());
    let token = token_for("free");

    for request in 1..=FREE_TIER_LIMIT {
        let (status, _, _) = post_ai_debug(
            &app,
            "/api/v1/ai/debug",
            &ai_debug_body("def two_sum(): return []"),
            Some(&token),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "request {request} must be admitted");
    }

    let (status, headers, body) = post_ai_debug(
        &app,
        "/api/v1/ai/debug",
        &ai_debug_body("def two_sum(): return []"),
        Some(&token),
    )
    .await;

    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
    assert!(headers.get(RETRY_AFTER).is_some());
    assert_eq!(
        body["type"].as_str(),
        Some("urn:problem-type:too-many-requests")
    );
    assert!(body["detail"]
        .as_str()
        .unwrap_or_default()
        .contains("free tier"));
}

#[tokio::test]
async fn pro_tier_tokens_get_the_higher_quota() {
    configure_provider();
    let app = create_router(AppState::new_test());
    let token = token_for("pro");

    // One request beyond the free allowance proves the pro threshold applies.
    for request in 1..=FREE_TIER_LIMIT + 1 {
        let (status, _, _) = post_ai_debug(
            &app,
            "/api/v1/ai/debug",
            &ai_debug_body("def two_sum(): return []"),
            Some(&token),
        )
        .await;
        assert_eq!(
            status,
            StatusCode::OK,
            "pro request {request} must be admitted"
        );
    }
}

#[tokio::test]
async fn malformed_provider_payloads_degrade_to_deterministic() {
    configure_provider();
    let app = create_router(AppState::new_test());
    let token = token_for("free");

    let code = format!("def two_sum():\n    # {TRIGGER_MALFORMED}\n    return []");
    let (status, headers, body) = post_ai_debug(
        &app,
        "/api/v1/ai/debug",
        &ai_debug_body(&code),
        Some(&token),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(source_header(&headers), Some("deterministic-fallback"));
    assert!(body.get("fixed_code").is_none());
    assert!(body["complexity_analysis"]
        .as_str()
        .unwrap_or_default()
        .contains("loop construct"));
}

#[tokio::test]
async fn provider_errors_degrade_to_deterministic() {
    configure_provider();
    let app = create_router(AppState::new_test());
    let token = token_for("free");

    let code = format!("def two_sum():\n    # {TRIGGER_ERROR}\n    return []");
    let (status, headers, body) = post_ai_debug(
        &app,
        "/api/v1/ai/debug",
        &ai_debug_body(&code),
        Some(&token),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(source_header(&headers), Some("deterministic-fallback"));
    assert!(body["root_cause"]
        .as_str()
        .unwrap_or_default()
        .contains("Wrong Answer on test 3"));
}

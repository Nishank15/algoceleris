//! Offline AI debug behavior: without `LLM_*` configuration the endpoint answers with
//! the deterministic analysis and never depends on an upstream provider.

use axum::body::Body;
use axum::http::header::{CONTENT_TYPE, RETRY_AFTER};
use axum::http::{HeaderMap, Request, StatusCode};
use judge_gateway::create_router;
use judge_gateway::state::AppState;
use serde_json::{json, Value};
use tower::ServiceExt;

/// Builds a router with the model backend explicitly disabled.
fn offline_app() -> axum::Router {
    for name in ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"] {
        std::env::remove_var(name);
    }
    create_router(AppState::new_test())
}

/// Posts the workspace payload the SPA sends, optionally authenticated.
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
        builder = builder.header("Authorization", format!("Bearer {token}"));
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

/// Payload mirroring `ProblemWorkspacePage`'s `requestAIDebug` call.
fn spa_payload() -> Value {
    json!({
        "user_id": "usr-pro-dev",
        "language": "cpp",
        "source_code": "for (int i = 0; i < n; ++i) { for (int j = 0; j < n; ++j) {} }",
        "problem_slug": "two-sum",
        "problem_title": "1. Two Sum",
        "problem_description": "Find two numbers that add to the target.",
        "error_diagnostics": "Wrong Answer on test 3",
        "failing_test_cases": [
            { "id": 3, "input": "[2,7,11,15], 9", "expected": "[0,1]", "actual": "[]" }
        ],
    })
}

fn source_header(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("x-ai-debug-source")
        .and_then(|value| value.to_str().ok())
}

#[tokio::test]
async fn anonymous_offline_debug_returns_the_deterministic_analysis() {
    let app = offline_app();

    let (status, headers, body) =
        post_ai_debug(&app, "/api/v1/ai/debug", &spa_payload(), None).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(source_header(&headers), Some("deterministic"));

    for field in [
        "advice",
        "root_cause",
        "fix_explanation",
        "complexity_analysis",
    ] {
        let value = body[field].as_str().unwrap_or_default();
        assert!(!value.is_empty(), "{field} must be present and non-empty");
    }

    let root_cause = body["root_cause"].as_str().unwrap_or_default();
    assert!(root_cause.contains("Wrong Answer on test 3"));
    // Offline analysis never fabricates a rewrite, so the modal keeps "Apply Fix" disabled.
    assert!(body.get("fixed_code").is_none());
    assert!(body.get("code_diff").is_none());
}

#[tokio::test]
async fn subscription_scoped_alias_answers_the_same_way() {
    let app = offline_app();

    let (status, headers, body) =
        post_ai_debug(&app, "/api/v1/subscriptions/ai-debug", &spa_payload(), None).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(source_header(&headers), Some("deterministic"));
    assert!(body["complexity_analysis"]
        .as_str()
        .unwrap_or_default()
        .contains("quadratic"));
}

#[tokio::test]
async fn submissions_without_code_are_rejected() {
    let app = offline_app();
    let payload = json!({ "language": "cpp", "source_code": "   " });

    let (status, _, body) = post_ai_debug(&app, "/api/v1/ai/debug", &payload, None).await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["status"].as_u64(), Some(400));
    assert_ne!(body["detail"].as_str().unwrap_or_default(), "");
}

#[tokio::test]
async fn offline_requests_are_not_quota_limited() {
    let app = offline_app();

    // Free tier admits five model-backed requests per window; the offline path costs
    // nothing, so the same session keeps answering.
    for request in 1..=7 {
        let (status, _, _) = post_ai_debug(&app, "/api/v1/ai/debug", &spa_payload(), None).await;
        assert_eq!(
            status,
            StatusCode::OK,
            "offline request {request} must be admitted"
        );
    }

    // No quota response is ever produced without a provider.
    let (status, headers, _) = post_ai_debug(&app, "/api/v1/ai/debug", &spa_payload(), None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(headers.get(RETRY_AFTER).is_none());
}

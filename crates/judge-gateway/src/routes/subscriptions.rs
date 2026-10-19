//! Subscription monetization & AI debugging endpoints.

use axum::{
    extract::{Path, State},
    http::{HeaderMap, HeaderName, HeaderValue},
    response::IntoResponse,
    Json,
};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

use crate::errors::GatewayError;
use crate::extractors::OptionalUser;
use crate::services::llm;
use crate::services::rate_limit::{self, SubscriptionTier};
use crate::state::AppState;

/// Environment variable holding the Razorpay key secret used to verify payment signatures.
pub const RAZORPAY_KEY_SECRET_ENV: &str = "RAZORPAY_KEY_SECRET";

/// Response header naming the analysis path that produced a diagnosis.
const X_AI_DEBUG_SOURCE: HeaderName = HeaderName::from_static("x-ai-debug-source");

/// User entitlement payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntitlementsResponse {
    pub user_id: String,
    pub tier: String,
    pub entitlements: Vec<String>,
}

/// Inbound Stripe checkout session request.
#[derive(Debug, Clone, Deserialize)]
pub struct StripeCheckoutRequest {
    pub user_id: String,
    pub email: String,
}

/// Outbound Stripe checkout session response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StripeCheckoutResponse {
    pub session_id: String,
    pub checkout_url: String,
    pub amount_total: u64,
    pub currency: String,
}

/// Inbound Razorpay order request.
#[derive(Debug, Clone, Deserialize)]
pub struct RazorpayOrderRequest {
    pub user_id: String,
    pub email: String,
    pub amount: u64,
    pub currency: String,
}

/// Outbound Razorpay order response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RazorpayOrderResponse {
    pub order_id: String,
    pub amount: u64,
    pub currency: String,
    pub key_id: String,
}

/// Inbound Razorpay verification request.
#[derive(Debug, Clone, Deserialize)]
pub struct RazorpayVerifyRequest {
    pub user_id: String,
    pub razorpay_order_id: String,
    pub razorpay_payment_id: String,
    pub razorpay_signature: String,
}

/// Outbound Razorpay verification response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RazorpayVerifyResponse {
    pub status: String,
    pub user_id: String,
    pub tier: String,
    pub message: String,
}

/// Inbound AI debugging request.
///
/// The SPA posts the client-oriented field names (`source_code`, `problem_title`,
/// `problem_description`, `error_diagnostics`); the aliases below let that payload deserialize
/// alongside the canonical names rather than failing the request with a `422` before analysis
/// starts. `problem_slug` is preferred when resolving catalog metadata, with `problem_title`
/// accepted as a fallback handle.
#[derive(Debug, Clone, Deserialize)]
pub struct AIDebugRequest {
    /// Submitted source code to analyse.
    #[serde(alias = "source_code")]
    pub code: String,
    /// Language the submission is written in.
    pub language: String,
    /// Catalog slug of the problem the submission belongs to.
    #[serde(default)]
    pub problem_slug: Option<String>,
    /// Human-readable problem title.
    #[serde(default)]
    pub problem_title: Option<String>,
    /// Problem statement excerpt, used when no catalog entry resolves.
    #[serde(default)]
    pub problem_description: Option<String>,
    /// Compiler or judge diagnostics reported for the failing case.
    #[serde(default, alias = "error_diagnostics")]
    pub error_message: Option<String>,
    /// Failing test cases with expected and actual output.
    #[serde(default)]
    pub failing_test_cases: Vec<llm::FailingCase>,
}

/// Outbound AI debugging response.
///
/// Field names mirror the client contract consumed by `AIDebugModal`, which renders `root_cause`,
/// `complexity_analysis` and `fix_explanation` side by side and surfaces `advice` as the headline
/// takeaway. Patch fields are omitted rather than sent empty when no rewrite was produced, so the
/// client can tell "no patch" apart from "empty patch".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIDebugResponse {
    /// Diagnosed fault behind the observed failure.
    pub root_cause: String,
    /// What the proposed change does and why it addresses the root cause.
    pub fix_explanation: String,
    /// Estimated time and space cost of the submitted solution.
    pub complexity_analysis: String,
    /// Single-sentence takeaway highlighted at the top of the client modal.
    pub advice: String,
    /// Rewritten source, present only when the analysis produced a patch.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fixed_code: Option<String>,
    /// Unified diff of the patch, present only when the analysis produced a patch.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code_diff: Option<String>,
}

/// Handler for `GET /api/v1/subscriptions/entitlements/{user_id}`.
///
/// # Errors
/// Returns [`GatewayError`].
pub async fn get_entitlements_handler(
    State(_state): State<AppState>,
    Path(user_id): Path<String>,
) -> Result<impl IntoResponse, GatewayError> {
    Ok(Json(EntitlementsResponse {
        user_id,
        tier: "free".to_string(),
        entitlements: vec![
            "submission_evaluation".to_string(),
            "contest_participation".to_string(),
        ],
    }))
}

/// Handler for `POST /api/v1/subscriptions/stripe/create-checkout-session`.
///
/// # Errors
/// Returns [`GatewayError`].
pub async fn create_stripe_checkout_handler(
    State(_state): State<AppState>,
    Json(req): Json<StripeCheckoutRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    Ok(Json(StripeCheckoutResponse {
        session_id: format!("cs_mock_{}", req.user_id),
        checkout_url: "https://checkout.stripe.com/test".to_string(),
        amount_total: 1499,
        currency: "USD".to_string(),
    }))
}

/// Handler for `POST /api/v1/subscriptions/razorpay/create-order`.
///
/// # Errors
/// Returns [`GatewayError`].
pub async fn create_razorpay_order_handler(
    State(_state): State<AppState>,
    Json(req): Json<RazorpayOrderRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    Ok(Json(RazorpayOrderResponse {
        order_id: format!("order_mock_{}", req.user_id),
        amount: req.amount,
        currency: req.currency,
        key_id: "rzp_test_mock".to_string(),
    }))
}

/// Verifies a Razorpay payment signature in constant time.
///
/// Razorpay signs `"{razorpay_order_id}|{razorpay_payment_id}"` with `HMAC-SHA256` keyed by the
/// account's key secret and transmits the lowercase hex digest as `razorpay_signature`.
///
/// # Errors
/// Returns a human-readable reason when the signature is not valid hexadecimal, the key secret is
/// unusable, or the computed MAC does not match the supplied signature.
fn verify_razorpay_signature(
    key_secret: &str,
    razorpay_order_id: &str,
    razorpay_payment_id: &str,
    razorpay_signature: &str,
) -> Result<(), String> {
    let signature_bytes = hex::decode(razorpay_signature)
        .map_err(|_| "razorpay_signature is not valid hexadecimal".to_string())?;

    let mut mac = Hmac::<Sha256>::new_from_slice(key_secret.as_bytes())
        .map_err(|_| "invalid Razorpay key secret".to_string())?;
    mac.update(format!("{razorpay_order_id}|{razorpay_payment_id}").as_bytes());

    mac.verify_slice(&signature_bytes)
        .map_err(|_| "Razorpay signature verification failed".to_string())
}

/// Handler for `POST /api/v1/subscriptions/razorpay/verify-payment`.
///
/// Fails closed: the user tier is only upgraded when the supplied `razorpay_signature` is a valid
/// `HMAC-SHA256` digest over `"{razorpay_order_id}|{razorpay_payment_id}"` keyed by
/// [`RAZORPAY_KEY_SECRET_ENV`].
///
/// # Errors
/// Returns [`GatewayError::BadRequest`] when required fields are empty or the signature is not
/// hexadecimal, [`GatewayError::Unauthorized`] when the signature does not match, and
/// [`GatewayError::InternalError`] when the server has no key secret configured.
pub async fn verify_razorpay_payment_handler(
    State(_state): State<AppState>,
    Json(req): Json<RazorpayVerifyRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let order_id = req.razorpay_order_id.trim();
    let payment_id = req.razorpay_payment_id.trim();
    let signature = req.razorpay_signature.trim();

    if order_id.is_empty() || payment_id.is_empty() || signature.is_empty() {
        return Err(GatewayError::BadRequest(
            "razorpay_order_id, razorpay_payment_id and razorpay_signature are required"
                .to_string(),
        ));
    }

    let key_secret = match std::env::var(RAZORPAY_KEY_SECRET_ENV) {
        Ok(secret) if !secret.is_empty() => secret,
        _ => {
            tracing::error!(
                "{RAZORPAY_KEY_SECRET_ENV} is not configured; refusing to verify Razorpay payments"
            );
            return Err(GatewayError::InternalError(
                "Razorpay payment verification is not configured".to_string(),
            ));
        }
    };

    if let Err(reason) = verify_razorpay_signature(&key_secret, order_id, payment_id, signature) {
        tracing::warn!("Rejected Razorpay verification for order {order_id}: {reason}");
        return Err(if reason.contains("hexadecimal") {
            GatewayError::BadRequest(reason)
        } else {
            GatewayError::Unauthorized("Invalid Razorpay payment signature".to_string())
        });
    }

    Ok(Json(RazorpayVerifyResponse {
        status: "success".to_string(),
        user_id: req.user_id,
        tier: "pro".to_string(),
        message: "Payment successfully verified".to_string(),
    }))
}

/// Counts the loop constructs in a submission, used to estimate its asymptotic cost.
fn count_loop_constructs(code: &str) -> usize {
    ["for ", "for(", "while ", "while(", "foreach", "loop {"]
        .iter()
        .map(|needle| code.matches(needle).count())
        .sum()
}

/// Handler for `POST /api/v1/ai/debug`.
///
/// The diagnosis is model-backed whenever [`llm::LlmConfig::from_env`] finds an API key: the
/// prompt carries the problem metadata (resolved from the server-side catalog when the request
/// names a slug), the submission, and the judge diagnostics, and the model answers with the
/// [`AIDebugResponse`] schema. Requests are accounted against a per-user quota before inference,
/// and any provider failure degrades to [`deterministic_debug_response`].
///
/// Without a key the deterministic analysis answers immediately, so local development and offline
/// deployments never depend on an upstream. The `x-ai-debug-source` response header reports which
/// path produced the diagnosis.
///
/// # Errors
/// Returns [`GatewayError::BadRequest`] when the submission carries no code to analyse,
/// [`GatewayError::Unauthorized`] when the model backend is configured but the caller is
/// anonymous, and [`GatewayError::TooManyRequests`] when the caller's quota is exhausted.
pub async fn ai_debug_handler(
    State(state): State<AppState>,
    OptionalUser(user): OptionalUser,
    Json(req): Json<AIDebugRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let code = req.code.trim();
    if code.is_empty() {
        return Err(GatewayError::BadRequest(
            "code must not be empty".to_string(),
        ));
    }

    let context = assemble_debug_context(&state, &req).await;
    let (response, source) = match llm::LlmConfig::from_env() {
        Some(config) => {
            let Some(user) = user else {
                return Err(GatewayError::Unauthorized(
                    "AI debugging requires an authenticated session while the model backend is \
                     configured"
                        .to_string(),
                ));
            };

            let tier = SubscriptionTier::from_role(&user.claims.role);
            let decision = state
                .ai_debug_limiter
                .check(&user.user_id.to_string(), tier)
                .await;
            if !decision.allowed {
                return Err(GatewayError::TooManyRequests {
                    detail: format!(
                        "AI debug quota exhausted for the {} tier: {} requests per {} minutes. \
                         Retry in {} seconds.",
                        tier.label(),
                        decision.limit,
                        rate_limit::AI_DEBUG_WINDOW_SECONDS / 60,
                        decision.retry_after_seconds
                    ),
                    retry_after_seconds: decision.retry_after_seconds,
                });
            }

            match llm::diagnose(&config, &context).await {
                Ok(response) => (response, "llm"),
                Err(error) => {
                    tracing::warn!(
                        %error,
                        user_id = %user.user_id,
                        "ai debug model call failed; serving the deterministic analysis"
                    );
                    (deterministic_debug_response(&req), "deterministic-fallback")
                }
            }
        }
        None => (deterministic_debug_response(&req), "deterministic"),
    };

    let mut headers = HeaderMap::new();
    headers.insert(X_AI_DEBUG_SOURCE, HeaderValue::from_static(source));
    Ok((headers, Json(response)))
}

/// Derives a diagnosis deterministically from the submitted source and diagnostics.
///
/// Used when no model backend is configured and whenever the provider fails, so the endpoint
/// always answers: the counted loop constructs drive the complexity estimate and the reported
/// error text drives the root-cause section. Patch fields stay absent because no rewrite is
/// produced, and every claim is phrased as an estimate.
fn deterministic_debug_response(req: &AIDebugRequest) -> AIDebugResponse {
    let loops = count_loop_constructs(req.code.trim());
    let failing_case = req
        .error_message
        .as_deref()
        .map(str::trim)
        .filter(|message| !message.is_empty())
        .map_or_else(
            || "No diagnostic text was supplied with the request.".to_string(),
            |message| format!("The judge reported: {message}."),
        );

    let (root_cause, fix_explanation, complexity_analysis, advice) = if loops > 1 {
        (
            format!(
                "{failing_case} {loops} loop constructs were counted in the submission, so the \
                 solution is rescanning the input inside a loop instead of completing it in a \
                 single pass."
            ),
            "Collapse the inner pass into one traversal by accumulating what you would otherwise \
             rescan for — a complement, a running aggregate, or a visited set — into a hash map \
             keyed by the value under test."
                .to_string(),
            format!(
                "Estimated upper bound: quadratic or worse, with {loops} loop constructs counted \
                 over the same input. A hash-map accumulator brings the dominant term down to \
                 O(N) time at the cost of O(N) space."
            ),
            "Replace the nested scan with a hash-map lookup so each element is visited once."
                .to_string(),
        )
    } else {
        (
            format!(
                "{failing_case} The control flow is flat ({loops} loop construct(s) counted), so \
                 the fault is in how a specific input is handled rather than in the overall \
                 approach."
            ),
            "Walk the boundary inputs explicitly: empty collection, single element, repeated \
             values, negative and zero magnitudes, and the largest input the constraints allow."
                .to_string(),
            format!(
                "Estimated cost: linear in the input, with {loops} loop construct(s) counted and \
                 no nested rescanning detected."
            ),
            "Reproduce the failing input locally and assert on it before changing the algorithm."
                .to_string(),
        )
    };

    AIDebugResponse {
        root_cause,
        fix_explanation,
        complexity_analysis,
        advice,
        fixed_code: None,
        code_diff: None,
    }
}

/// Problem metadata resolved from the server-side catalog.
struct CatalogMetadata {
    /// Display title.
    title: String,
    /// Problem statement.
    description: String,
    /// Statement constraints, one per entry.
    constraints: Vec<String>,
}

/// Assembles the diagnostic context, preferring server-side catalog metadata.
async fn assemble_debug_context(state: &AppState, req: &AIDebugRequest) -> llm::DebugContext {
    let lookup_key = non_empty(req.problem_slug.as_deref().or(req.problem_title.as_deref()));
    let metadata = match lookup_key {
        Some(key) => lookup_catalog_problem(state, key).await,
        None => None,
    };

    let (problem_title, problem_description, constraints) = match metadata {
        Some(metadata) => (
            Some(metadata.title),
            Some(metadata.description),
            metadata.constraints,
        ),
        None => (
            req.problem_title.clone(),
            req.problem_description.clone(),
            Vec::new(),
        ),
    };

    llm::DebugContext {
        problem_title,
        problem_description,
        constraints,
        language: req.language.clone(),
        code: req.code.clone(),
        diagnostics: req.error_message.clone(),
        failing_cases: req.failing_test_cases.clone(),
    }
}

/// Looks a problem up in PostgreSQL first and in the canonical catalog second.
async fn lookup_catalog_problem(state: &AppState, key: &str) -> Option<CatalogMetadata> {
    if let Some(pool) = state.db.as_ref() {
        if let Ok(Some(record)) =
            judge_db::repositories::problem::get_problem_by_id(pool.inner(), key).await
        {
            return Some(CatalogMetadata {
                title: record.title,
                description: record.description,
                constraints: json_string_list(&record.constraints),
            });
        }
        // Unseeded or standalone datasets fall through to the in-memory catalog.
    }

    judge_db::problem_catalog::find(key).map(|problem| CatalogMetadata {
        title: problem.title.to_string(),
        description: problem.description.to_string(),
        constraints: problem
            .constraints
            .iter()
            .map(|constraint| (*constraint).to_string())
            .collect(),
    })
}

/// Collects string entries from a JSON array column.
fn json_string_list(value: &serde_json::Value) -> Vec<String> {
    value
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

/// Returns the trimmed view of `value` when it carries content.
fn non_empty(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|key| !key.is_empty())
}

#[cfg(test)]
mod tests {
    use super::{
        count_loop_constructs, deterministic_debug_response, verify_razorpay_signature,
        AIDebugRequest, AIDebugResponse,
    };

    const SECRET: &str = "mock_rzp_secret_key_v2";
    const ORDER_ID: &str = "order_test_123";
    const PAYMENT_ID: &str = "pay_test_456";
    /// Known-answer vector: `HMAC-SHA256("mock_rzp_secret_key_v2", "order_test_123|pay_test_456")`.
    const VALID_SIGNATURE: &str =
        "0b53ba2e86156e5cba8932d65f43a407facd2a2b81a241f691577d76eba92f03";

    #[test]
    fn accepts_correctly_signed_payment() {
        assert!(verify_razorpay_signature(SECRET, ORDER_ID, PAYMENT_ID, VALID_SIGNATURE).is_ok());
    }

    #[test]
    fn accepts_uppercase_hex_signature() {
        let upper = VALID_SIGNATURE.to_uppercase();
        // `hex::decode` accepts mixed case, so a valid digest is not rejected on casing alone.
        assert!(verify_razorpay_signature(SECRET, ORDER_ID, PAYMENT_ID, &upper).is_ok());
    }

    #[test]
    fn rejects_tampered_signature() {
        let tampered = format!("{}0", &VALID_SIGNATURE[..VALID_SIGNATURE.len() - 1]);
        assert!(verify_razorpay_signature(SECRET, ORDER_ID, PAYMENT_ID, &tampered).is_err());
    }

    #[test]
    fn rejects_signature_for_different_order_or_payment() {
        assert!(
            verify_razorpay_signature(SECRET, "order_other", PAYMENT_ID, VALID_SIGNATURE).is_err()
        );
        assert!(verify_razorpay_signature(SECRET, ORDER_ID, "pay_other", VALID_SIGNATURE).is_err());
    }

    #[test]
    fn rejects_signature_under_different_secret() {
        assert!(
            verify_razorpay_signature("wrong_secret", ORDER_ID, PAYMENT_ID, VALID_SIGNATURE)
                .is_err()
        );
    }

    #[test]
    fn rejects_empty_and_non_hexadecimal_signature() {
        assert!(verify_razorpay_signature(SECRET, ORDER_ID, PAYMENT_ID, "").is_err());
        assert!(verify_razorpay_signature(SECRET, ORDER_ID, PAYMENT_ID, "not-hex").is_err());
    }

    #[test]
    fn accepts_the_ai_debug_payload_the_spa_sends() {
        // Shapes mirror `ProblemWorkspacePage`'s `requestAIDebug` call and `aiDebug` in api.ts.
        let payload = serde_json::json!({
            "user_id": "usr-pro-dev",
            "language": "cpp",
            "source_code": "for (int i = 0; i < n; ++i) {}",
            "problem_slug": "two-sum",
            "problem_title": "1. Two Sum",
            "problem_description": "Find two numbers that add to the target.",
            "error_diagnostics": "Wrong Answer on test 3",
            "failing_test_cases": [
                { "id": 3, "input": "[2,7,11,15], 9", "expected": "[0,1]", "actual": "[]" }
            ],
        });

        let req: AIDebugRequest =
            serde_json::from_value(payload).expect("SPA payload must deserialize");

        assert_eq!(req.code, "for (int i = 0; i < n; ++i) {}");
        assert_eq!(req.language, "cpp");
        assert_eq!(req.problem_slug.as_deref(), Some("two-sum"));
        assert_eq!(req.problem_title.as_deref(), Some("1. Two Sum"));
        assert_eq!(
            req.problem_description.as_deref(),
            Some("Find two numbers that add to the target.")
        );
        assert_eq!(req.error_message.as_deref(), Some("Wrong Answer on test 3"));
        assert_eq!(req.failing_test_cases.len(), 1);
        assert_eq!(req.failing_test_cases[0].id, Some(3));
        assert_eq!(req.failing_test_cases[0].expected.as_deref(), Some("[0,1]"));
    }

    #[test]
    fn accepts_the_ai_debug_payload_with_canonical_field_names() {
        let payload = serde_json::json!({
            "code": "while (x > 0) { x -= 1; }",
            "language": "cpp",
            "problem_slug": "two-sum",
            "error_message": "Time Limit Exceeded",
        });

        let req: AIDebugRequest =
            serde_json::from_value(payload).expect("canonical payload must deserialize");

        assert_eq!(req.code, "while (x > 0) { x -= 1; }");
        assert_eq!(req.problem_slug.as_deref(), Some("two-sum"));
        assert_eq!(req.error_message.as_deref(), Some("Time Limit Exceeded"));
        assert!(req.failing_test_cases.is_empty());
    }

    #[test]
    fn deterministic_analysis_flags_nested_scans() {
        let request = AIDebugRequest {
            code: "for (;;) { for (;;) {} }".to_string(),
            language: "cpp".to_string(),
            problem_slug: None,
            problem_title: Some("two-sum".to_string()),
            problem_description: None,
            error_message: Some("Time Limit Exceeded".to_string()),
            failing_test_cases: Vec::new(),
        };

        let response = deterministic_debug_response(&request);

        assert!(response.root_cause.contains("2 loop constructs"));
        assert!(response.root_cause.contains("Time Limit Exceeded"));
        assert!(response.complexity_analysis.contains("quadratic"));
        // No rewrite is produced, so the client disables "Apply Fix" instead of padding it.
        assert!(response.fixed_code.is_none());
        assert!(response.code_diff.is_none());
    }

    #[test]
    fn ai_debug_response_supplies_every_field_the_modal_renders() {
        let response = AIDebugResponse {
            root_cause: "diagnosed fault".to_string(),
            fix_explanation: "how the change helps".to_string(),
            complexity_analysis: "estimated cost".to_string(),
            advice: "headline takeaway".to_string(),
            fixed_code: None,
            code_diff: None,
        };

        let json = serde_json::to_value(&response).expect("response must serialize");

        for field in [
            "root_cause",
            "fix_explanation",
            "complexity_analysis",
            "advice",
        ] {
            let value = json
                .get(field)
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            assert!(!value.is_empty(), "{field} must be present and non-empty");
        }

        // Absent patches must be omitted so the client disables "Apply Fix" instead of
        // rendering an empty rewrite.
        assert!(json.get("fixed_code").is_none());
        assert!(json.get("code_diff").is_none());
    }

    #[test]
    fn counts_loop_constructs_across_languages() {
        assert_eq!(count_loop_constructs("return a + b;"), 0);
        assert_eq!(count_loop_constructs("for (int i = 0; i < n; ++i) {}"), 1);
        assert_eq!(count_loop_constructs("while (x > 0) { x -= 1; }"), 1);
        assert_eq!(
            count_loop_constructs("for i in range(n):\n    total += i"),
            1
        );
        assert_eq!(
            count_loop_constructs("for (;;) { for (;;) { while (true) {} } }"),
            3
        );
    }
}

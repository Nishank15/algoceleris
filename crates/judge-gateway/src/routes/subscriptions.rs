//! Subscription monetization & AI debugging endpoints.

use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::errors::GatewayError;
use crate::state::AppState;

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
#[derive(Debug, Clone, Deserialize)]
pub struct AIDebugRequest {
    pub code: String,
    pub language: String,
    pub problem_slug: Option<String>,
    pub error_message: Option<String>,
}

/// Outbound AI debugging response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIDebugResponse {
    pub advice: String,
    pub complexity_analysis: String,
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

/// Handler for `POST /api/v1/subscriptions/razorpay/verify-payment`.
///
/// # Errors
/// Returns [`GatewayError`].
pub async fn verify_razorpay_payment_handler(
    State(_state): State<AppState>,
    Json(req): Json<RazorpayVerifyRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    Ok(Json(RazorpayVerifyResponse {
        status: "success".to_string(),
        user_id: req.user_id,
        tier: "pro".to_string(),
        message: "Payment successfully verified".to_string(),
    }))
}

/// Handler for `POST /api/v1/ai/debug`.
///
/// # Errors
/// Returns [`GatewayError`].
pub async fn ai_debug_handler(
    State(_state): State<AppState>,
    Json(req): Json<AIDebugRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let advice = if req.code.contains("for") && req.code.contains("for") {
        "Notice the nested loop: the time complexity is currently O(N^2). Consider using a hash map to look up complements in O(1) time.".to_string()
    } else {
        "Review boundary cases such as single element collections and negative values.".to_string()
    };

    Ok(Json(AIDebugResponse {
        advice,
        complexity_analysis: "Time: O(N), Space: O(N)".to_string(),
    }))
}

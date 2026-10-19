#![allow(clippy::too_many_lines)]

use axum::body::Body;
use axum::http::header::{COOKIE, SET_COOKIE};
use axum::http::{Request, StatusCode};
use judge_gateway::auth::{
    decode_access_token, encode_access_token, encode_refresh_token, hash_password, verify_password,
    TokenStore, DEFAULT_JWT_SECRET,
};
use judge_gateway::errors::{GatewayError, ProblemDetails};
use judge_gateway::routes::{HealthResponse, TokenResponse};
use judge_gateway::state::AppState;
use judge_gateway::{create_router, ACCESS_TOKEN_EXPIRATION_SECONDS};
use tower::ServiceExt;
use uuid::Uuid;

#[tokio::test]
async fn test_health_endpoints() {
    let state = AppState::new_test();
    let app = create_router(state);

    // 1. Test GET /health
    let req = Request::builder()
        .uri("/health")
        .body(Body::empty())
        .expect("failed to build request");

    let resp = app
        .clone()
        .oneshot(req)
        .await
        .expect("failed to execute request");
    assert_eq!(resp.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .expect("failed to read body");
    let health: HealthResponse =
        serde_json::from_slice(&bytes).expect("failed to deserialize HealthResponse");

    assert_eq!(health.status, "healthy");
    assert_eq!(health.broker, "InMemoryQueueBroker");
    assert_eq!(health.database, "disconnected");
    assert_eq!(health.rate_limiter, "InMemoryLimiter");
    assert_eq!(health.ai_assistant, "GeminiDebugAssistant");
    assert_eq!(health.bloom_filter, "in_memory");

    // 2. Test GET /api/v1/health
    let req_v1 = Request::builder()
        .uri("/api/v1/health")
        .body(Body::empty())
        .expect("failed to build request");

    let resp_v1 = app
        .oneshot(req_v1)
        .await
        .expect("failed to execute request");
    assert_eq!(resp_v1.status(), StatusCode::OK);

    let bytes_v1 = axum::body::to_bytes(resp_v1.into_body(), usize::MAX)
        .await
        .expect("failed to read body");
    let health_v1: HealthResponse =
        serde_json::from_slice(&bytes_v1).expect("failed to deserialize HealthResponse");
    assert_eq!(health_v1.status, "healthy");
}

#[test]
fn test_argon2id_password_hashing() -> Result<(), GatewayError> {
    let plain_password = "SuperSecretP@ssw0rd!2026";

    // 1. Hash with RFC 9106 production parameters
    let hashed = hash_password(plain_password)?;

    // 2. Assert PHC format strictly specifies argon2id, m=65536, t=2, p=4
    assert!(
        hashed.starts_with("$argon2id$v=19$m=65536,t=2,p=4$"),
        "Hash format does not conform to RFC 9106 ($t=2, m=65536, p=4$): {hashed}"
    );

    // 3. Verify valid password
    assert!(
        verify_password(plain_password, &hashed),
        "Failed to verify valid password against hash"
    );

    // 4. Verify bad password rejected
    assert!(
        !verify_password("WrongPassword123", &hashed),
        "Accepted incorrect password"
    );

    // 5. Verify empty password rejected
    assert!(!verify_password("", &hashed), "Accepted empty password");

    Ok(())
}

#[test]
fn test_access_jwt_generation_claims_and_expiration() -> Result<(), GatewayError> {
    let user_id = Uuid::new_v4().to_string();
    let username = "alice_dev";
    let email = "alice@example.com";
    let role = "pro";
    let secret = DEFAULT_JWT_SECRET;

    // 1. Generate normal access token (15 mins)
    let token = encode_access_token(&user_id, username, email, role, secret, None)?;
    let claims = decode_access_token(&token, secret)?;

    assert_eq!(claims.sub, user_id);
    assert_eq!(claims.username, username);
    assert_eq!(claims.email, email);
    assert_eq!(claims.role, role);
    assert_eq!(claims.r#type, "access");
    assert_eq!(claims.exp - claims.iat, ACCESS_TOKEN_EXPIRATION_SECONDS);

    // 2. Signature verification / tamper rejection
    let tampered_token = format!("{token}tampered");
    let tamper_res = decode_access_token(&tampered_token, secret);
    assert!(
        matches!(tamper_res, Err(GatewayError::Unauthorized(_))),
        "Expected Unauthorized for tampered token"
    );

    // 3. Expiration enforcement
    let expired_token = encode_access_token(
        &user_id,
        username,
        email,
        role,
        secret,
        Some(-120), // Expired 120 seconds in past
    )?;
    let expire_res = decode_access_token(&expired_token, secret);
    assert!(
        matches!(expire_res, Err(GatewayError::TokenExpired(_))),
        "Expected TokenExpired for expired token"
    );

    Ok(())
}

#[tokio::test]
async fn test_refresh_token_family_rotation_and_replay_protection() -> Result<(), GatewayError> {
    let token_store = TokenStore::new_in_memory();
    let user_id = Uuid::new_v4().to_string();
    let secret = DEFAULT_JWT_SECRET;

    // 1. Issue initial Refresh Token T1 with family F1
    let (t1_str, t1_id, f1_id) = encode_refresh_token(&user_id, None, secret, None)?;
    token_store
        .register_refresh_token(&t1_id, &f1_id, &user_id, 86400)
        .await?;

    // 2. Legitimate Rotation: Exchange T1 for T2
    let (t2_str, t2_id) = token_store
        .validate_and_cycle_refresh_token(&t1_id, &f1_id, &user_id, secret)
        .await?;
    assert_ne!(t1_id, t2_id);

    // 3. Legitimate Rotation: Exchange T2 for T3
    let (_t3_str, t3_id) = token_store
        .validate_and_cycle_refresh_token(&t2_id, &f1_id, &user_id, secret)
        .await?;
    assert_ne!(t2_id, t3_id);

    // 4. Adversary / Replay Attack: Re-present already consumed token T1
    let replay_err = token_store
        .validate_and_cycle_refresh_token(&t1_id, &f1_id, &user_id, secret)
        .await;

    assert!(
        matches!(replay_err, Err(GatewayError::ReplayDetected(_))),
        "Expected ReplayDetected on reuse of T1, got: {replay_err:?}"
    );

    // 5. Assert entire family F1 revoked: Even the latest legitimate token T3 is now rejected
    let t3_res = token_store
        .validate_and_cycle_refresh_token(&t3_id, &f1_id, &user_id, secret)
        .await;
    assert!(
        matches!(t3_res, Err(GatewayError::Unauthorized(_))),
        "Expected Unauthorized for T3 following family revocation, got: {t3_res:?}"
    );

    let _ = (t1_str, t2_str);
    Ok(())
}

#[tokio::test]
async fn test_auth_http_login_refresh_logout_flow() {
    let state = AppState::new_test();
    let app = create_router(state);

    // 1. Failed login with invalid credentials
    let bad_login_body = serde_json::json!({
        "username": "testuser",
        "password": "wrong_password"
    });
    let bad_req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/login")
        .header("content-type", "application/json")
        .body(Body::from(bad_login_body.to_string()))
        .unwrap();

    let bad_resp = app.clone().oneshot(bad_req).await.unwrap();
    assert_eq!(bad_resp.status(), StatusCode::UNAUTHORIZED);

    let bad_bytes = axum::body::to_bytes(bad_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let problem: ProblemDetails = serde_json::from_slice(&bad_bytes).unwrap();
    assert_eq!(problem.status, 401);
    assert_eq!(problem.r#type, "urn:problem-type:invalid-credentials");

    // 2. Successful login
    let login_body = serde_json::json!({
        "username": "testuser",
        "password": "password123"
    });
    let login_req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/login")
        .header("content-type", "application/json")
        .body(Body::from(login_body.to_string()))
        .unwrap();

    let login_resp = app.clone().oneshot(login_req).await.unwrap();
    assert_eq!(login_resp.status(), StatusCode::OK);

    // Extract HttpOnly refresh token cookie
    let set_cookie_hdr = login_resp
        .headers()
        .get(SET_COOKIE)
        .expect("Missing Set-Cookie header")
        .to_str()
        .unwrap()
        .to_string();
    assert!(set_cookie_hdr.contains("HttpOnly"));
    assert!(set_cookie_hdr.contains("SameSite=Lax"));
    assert!(set_cookie_hdr.contains("refresh_token="));

    let refresh_cookie_val = set_cookie_hdr.split(';').next().unwrap().trim().to_string();

    let login_bytes = axum::body::to_bytes(login_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let token_resp: TokenResponse = serde_json::from_slice(&login_bytes).unwrap();
    assert_eq!(token_resp.token_type, "bearer");
    assert_eq!(token_resp.user.username, "testuser");
    assert_ne!(token_resp.access_token, "");

    // 3. Successful token refresh using cookie
    let refresh_req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/refresh")
        .header(COOKIE, &refresh_cookie_val)
        .body(Body::empty())
        .unwrap();

    let refresh_resp = app.clone().oneshot(refresh_req).await.unwrap();
    assert_eq!(refresh_resp.status(), StatusCode::OK);

    let new_set_cookie = refresh_resp
        .headers()
        .get(SET_COOKIE)
        .expect("Missing Set-Cookie in refresh response")
        .to_str()
        .unwrap()
        .to_string();
    let new_refresh_cookie = new_set_cookie.split(';').next().unwrap().trim().to_string();

    assert_ne!(refresh_cookie_val, new_refresh_cookie);

    // 4. Replay attack over HTTP: Re-use previous refresh cookie
    let replay_req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/refresh")
        .header(COOKIE, &refresh_cookie_val)
        .body(Body::empty())
        .unwrap();

    let replay_resp = app.clone().oneshot(replay_req).await.unwrap();
    assert_eq!(replay_resp.status(), StatusCode::UNAUTHORIZED);

    let replay_bytes = axum::body::to_bytes(replay_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let replay_problem: ProblemDetails = serde_json::from_slice(&replay_bytes).unwrap();
    assert_eq!(replay_problem.r#type, "urn:problem-type:replay-detected");

    // 5. Logout endpoint
    let logout_req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/logout")
        .header(COOKIE, &new_refresh_cookie)
        .body(Body::empty())
        .unwrap();

    let logout_resp = app.oneshot(logout_req).await.unwrap();
    assert_eq!(logout_resp.status(), StatusCode::OK);

    let logout_cookie = logout_resp
        .headers()
        .get(SET_COOKIE)
        .expect("Missing Set-Cookie in logout response")
        .to_str()
        .unwrap();
    assert!(logout_cookie.contains("Max-Age=0"));
}

#[tokio::test]
async fn test_signup_and_registration_flow() {
    let state = AppState::new_test();
    let app = create_router(state);

    // 1. Availability check: fresh username and email should be available
    let check_user_req = Request::builder()
        .uri("/api/v1/auth/check-availability?username=newcoder")
        .body(Body::empty())
        .unwrap();
    let check_user_resp = app.clone().oneshot(check_user_req).await.unwrap();
    assert_eq!(check_user_resp.status(), StatusCode::OK);
    let check_user_bytes = axum::body::to_bytes(check_user_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let check_avail: judge_gateway::routes::AvailabilityResponse =
        serde_json::from_slice(&check_user_bytes).unwrap();
    assert!(check_avail.available);
    assert_eq!(check_avail.field, "username");

    // 2. Short username rejected with 400
    let short_body = serde_json::json!({
        "username": "ab",
        "email": "valid@example.com",
        "password": "valid_password_123"
    });
    let short_req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/signup")
        .header("content-type", "application/json")
        .body(Body::from(short_body.to_string()))
        .unwrap();
    let short_resp = app.clone().oneshot(short_req).await.unwrap();
    assert_eq!(short_resp.status(), StatusCode::BAD_REQUEST);

    // 3. Successful signup on /api/v1/auth/signup
    let signup_body = serde_json::json!({
        "username": "newcoder",
        "email": "newcoder@test.com",
        "password": "secure_password_999",
        "college_name": "MIT"
    });
    let signup_req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/signup")
        .header("content-type", "application/json")
        .body(Body::from(signup_body.to_string()))
        .unwrap();

    let signup_resp = app.clone().oneshot(signup_req).await.unwrap();
    assert_eq!(signup_resp.status(), StatusCode::CREATED);

    let signup_cookie = signup_resp
        .headers()
        .get(SET_COOKIE)
        .expect("Missing Set-Cookie header on signup")
        .to_str()
        .unwrap()
        .to_string();
    assert!(signup_cookie.contains("HttpOnly"));
    assert!(signup_cookie.contains("refresh_token="));

    let signup_bytes = axum::body::to_bytes(signup_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let token_resp: TokenResponse = serde_json::from_slice(&signup_bytes).unwrap();
    assert_eq!(token_resp.user.username, "newcoder");
    assert_eq!(token_resp.user.email, "newcoder@test.com");
    assert_eq!(token_resp.user.account_type, "free");
    assert_eq!(token_resp.user.college_name, Some("MIT".to_string()));

    // 4. Duplicate username rejected with 409 Conflict (RFC 7807)
    let dup_user_body = serde_json::json!({
        "username": "newcoder",
        "email": "another@test.com",
        "password": "another_password_123"
    });
    let dup_user_req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/register")
        .header("content-type", "application/json")
        .body(Body::from(dup_user_body.to_string()))
        .unwrap();
    let dup_user_resp = app.clone().oneshot(dup_user_req).await.unwrap();
    assert_eq!(dup_user_resp.status(), StatusCode::CONFLICT);

    // 5. Duplicate email rejected with 409 Conflict (RFC 7807)
    let dup_email_body = serde_json::json!({
        "username": "anotheruser",
        "email": "newcoder@test.com",
        "password": "another_password_123"
    });
    let dup_email_req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/register")
        .header("content-type", "application/json")
        .body(Body::from(dup_email_body.to_string()))
        .unwrap();
    let dup_email_resp = app.clone().oneshot(dup_email_req).await.unwrap();
    assert_eq!(dup_email_resp.status(), StatusCode::CONFLICT);

    // 6. Availability check now reports false for taken username
    let check_taken_req = Request::builder()
        .uri("/api/v1/auth/check-availability?username=newcoder")
        .body(Body::empty())
        .unwrap();
    let check_taken_resp = app.clone().oneshot(check_taken_req).await.unwrap();
    assert_eq!(check_taken_resp.status(), StatusCode::OK);
    let check_taken_bytes = axum::body::to_bytes(check_taken_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let check_taken: judge_gateway::routes::AvailabilityResponse =
        serde_json::from_slice(&check_taken_bytes).unwrap();
    assert!(!check_taken.available);

    // 7. Verify /api/v1/auth/me returns the signed-in user profile
    let me_req = Request::builder()
        .uri("/api/v1/auth/me")
        .header(
            "authorization",
            format!("Bearer {}", token_resp.access_token),
        )
        .body(Body::empty())
        .unwrap();
    let me_resp = app.clone().oneshot(me_req).await.unwrap();
    assert_eq!(me_resp.status(), StatusCode::OK);
    let me_bytes = axum::body::to_bytes(me_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let me_user: judge_gateway::routes::UserResponse = serde_json::from_slice(&me_bytes).unwrap();
    assert_eq!(me_user.username, "newcoder");
    assert_eq!(me_user.email, "newcoder@test.com");
    assert_eq!(me_user.account_type, "free");

    // 8. Sign in with the newly registered user on /api/v1/auth/login
    let relogin_body = serde_json::json!({
        "identifier": "newcoder",
        "password": "secure_password_999"
    });
    let relogin_req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/login")
        .header("content-type", "application/json")
        .body(Body::from(relogin_body.to_string()))
        .unwrap();
    let relogin_resp = app.oneshot(relogin_req).await.unwrap();
    assert_eq!(relogin_resp.status(), StatusCode::OK);
}

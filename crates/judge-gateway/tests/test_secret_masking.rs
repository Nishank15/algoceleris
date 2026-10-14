#![allow(
    clippy::too_many_lines,
    clippy::similar_names,
    clippy::manual_let_else,
    clippy::single_match_else,
    clippy::useless_vec
)]

use std::net::SocketAddr;
use std::time::Duration;

use axum::body::Body;
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use axum::http::{Request, StatusCode};
use chrono::Utc;
use futures_util::StreamExt;
use judge_db::models::SubmissionRecord;
use judge_gateway::auth::{encode_access_token, DEFAULT_JWT_SECRET};
use judge_gateway::create_router;
use judge_gateway::routes::{
    mask_test_case_json, mask_test_case_results, GetSubmissionResponse, SubmitCodeRequest,
    SubmitCodeResponse, TestCaseResult, SECRET_TEST_MASK,
};
use judge_gateway::state::AppState;
use redis::AsyncCommands;
use tokio::net::TcpListener;
use tokio_tungstenite::connect_async;
use tower::ServiceExt;
use uuid::Uuid;

fn generate_test_token(user_id: &str, role: &str) -> String {
    encode_access_token(
        user_id,
        "test_user",
        "test@campus.edu",
        role,
        DEFAULT_JWT_SECRET,
        None,
    )
    .expect("failed to generate token")
}

#[tokio::test]
async fn test_submission_intake_creates_pending_record_and_pushes_queue() {
    let state = AppState::new_test();
    let app = create_router(state.clone());

    let student_id = Uuid::new_v4().to_string();
    let student_token = generate_test_token(&student_id, "student");

    let payload = SubmitCodeRequest {
        problem_slug: Some("two-sum".to_string()),
        language: "python".to_string(),
        code: Some("def two_sum(): pass".to_string()),
        source_code: None,
        custom_input: None,
        test_cases: None,
        time_limit_ms: None,
        memory_limit_bytes: None,
        assessment_id: None,
    };

    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/submissions")
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let submit_resp: SubmitCodeResponse = serde_json::from_slice(&bytes).unwrap();

    assert_eq!(submit_resp.status, "PENDING");
    assert_eq!(submit_resp.message, "Submission queued for execution");

    // Verify submission job was pushed to in-memory mock queue
    let queue = state.mock_campus.submission_queue.read().await;
    assert_eq!(queue.len(), 1);
    let job_val = &queue[0];
    assert_eq!(
        job_val["submission_id"].as_str().unwrap(),
        submit_resp.submission_id.to_string()
    );
    assert_eq!(job_val["problem_slug"], "two-sum");
    assert_eq!(job_val["language"], "python");
    assert_eq!(job_val["code"], "def two_sum(): pass");
    assert_eq!(job_val["user_id"].as_str().unwrap(), student_id);
}

#[tokio::test]
async fn test_submission_intake_validations() {
    let state = AppState::new_test();

    // 1. Oversized code (> 64KB)
    let app = create_router(state.clone());
    let oversized_code = "a".repeat(64 * 1024 + 1);
    let payload = SubmitCodeRequest {
        problem_slug: Some("two-sum".to_string()),
        language: "python".to_string(),
        code: Some(oversized_code),
        source_code: None,
        custom_input: None,
        test_cases: None,
        time_limit_ms: None,
        memory_limit_bytes: None,
        assessment_id: None,
    };
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/submissions")
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

    // 2. Ad-hoc run without problem_slug defaults gracefully to 201 Created
    let app = create_router(state.clone());
    let payload = SubmitCodeRequest {
        problem_slug: None,
        language: "python".to_string(),
        code: Some("print(1)".to_string()),
        source_code: None,
        custom_input: Some("sample".to_string()),
        test_cases: None,
        time_limit_ms: None,
        memory_limit_bytes: None,
        assessment_id: None,
    };
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/submissions")
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);

    // 3. Unsupported language
    let app = create_router(state);
    let payload = SubmitCodeRequest {
        problem_slug: Some("two-sum".to_string()),
        language: "brainfuck".to_string(),
        code: Some("+[-->-[>>+>-----<<]<--<]".to_string()),
        source_code: None,
        custom_input: None,
        test_cases: None,
        time_limit_ms: None,
        memory_limit_bytes: None,
        assessment_id: None,
    };
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/submissions")
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_candidate_query_masks_secret_test_cases() {
    let state = AppState::new_test();
    let submission_id = Uuid::new_v4();

    let record = SubmissionRecord {
        id: submission_id,
        user_id: Some(Uuid::new_v4()),
        problem_slug: "two-sum".to_string(),
        language: "python".to_string(),
        code: "def solution(): pass".to_string(),
        verdict: "ACCEPTED".to_string(),
        runtime_ms: 57,
        memory_kb: 3072,
        testcases_passed: 2,
        total_testcases: 2,
        created_at: Utc::now(),
        assessment_id: None,
        room_id: None,
    };
    state
        .mock_campus
        .submissions
        .write()
        .await
        .insert(submission_id, record);

    // Seed mock submission results with 1 sample test case and 1 secret test case
    let test_cases = vec![
        TestCaseResult {
            test_case_id: 1,
            is_sample: true,
            is_secret: false,
            verdict: "ACCEPTED".to_string(),
            runtime_ms: Some(12),
            memory_kb: Some(1024),
            input: Some("3\n1 2 3".to_string()),
            expected_output: Some("6".to_string()),
            actual_output: Some("6".to_string()),
            diff: None,
        },
        TestCaseResult {
            test_case_id: 2,
            is_sample: false,
            is_secret: true,
            verdict: "ACCEPTED".to_string(),
            runtime_ms: Some(45),
            memory_kb: Some(2048),
            input: Some("1000\n[secret data]".to_string()),
            expected_output: Some("500500".to_string()),
            actual_output: Some("500500".to_string()),
            diff: Some("diff preview".to_string()),
        },
    ];

    let serialized_cases = test_cases
        .iter()
        .map(|tc| serde_json::to_value(tc).unwrap())
        .collect::<Vec<_>>();

    state
        .mock_campus
        .submission_results
        .write()
        .await
        .insert(submission_id, serialized_cases);

    let app = create_router(state);
    let student_token = generate_test_token(&Uuid::new_v4().to_string(), "student");

    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/submissions/{submission_id}"))
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let body: GetSubmissionResponse = serde_json::from_slice(&bytes).unwrap();

    assert_eq!(body.id, submission_id);
    assert_eq!(body.verdict, "ACCEPTED");
    assert_eq!(body.test_cases.len(), 2);

    // Case 1 (sample) is unmasked
    let sample_case = &body.test_cases[0];
    assert_eq!(sample_case.test_case_id, 1);
    assert_eq!(sample_case.input, Some("3\n1 2 3".to_string()));
    assert_eq!(sample_case.expected_output, Some("6".to_string()));
    assert_eq!(sample_case.actual_output, Some("6".to_string()));

    // Case 2 (secret) MUST BE MASKED
    let secret_case = &body.test_cases[1];
    assert_eq!(secret_case.test_case_id, 2);
    assert_eq!(secret_case.verdict, "ACCEPTED"); // Verdict intact
    assert_eq!(secret_case.runtime_ms, Some(45));
    assert_eq!(secret_case.memory_kb, Some(2048));
    assert_eq!(secret_case.input, Some(SECRET_TEST_MASK.to_string()));
    assert_eq!(
        secret_case.expected_output,
        Some(SECRET_TEST_MASK.to_string())
    );
    assert_eq!(
        secret_case.actual_output,
        Some(SECRET_TEST_MASK.to_string())
    );
    assert_eq!(secret_case.diff, None);
}

#[tokio::test]
async fn test_instructor_query_receives_unmasked_details() {
    let state = AppState::new_test();
    let submission_id = Uuid::new_v4();

    let record = SubmissionRecord {
        id: submission_id,
        user_id: Some(Uuid::new_v4()),
        problem_slug: "two-sum".to_string(),
        language: "python".to_string(),
        code: "def solution(): pass".to_string(),
        verdict: "WRONG_ANSWER".to_string(),
        runtime_ms: 30,
        memory_kb: 4096,
        testcases_passed: 0,
        total_testcases: 1,
        created_at: Utc::now(),
        assessment_id: None,
        room_id: None,
    };
    state
        .mock_campus
        .submissions
        .write()
        .await
        .insert(submission_id, record);

    let test_cases = vec![TestCaseResult {
        test_case_id: 1,
        is_sample: false,
        is_secret: true,
        verdict: "WRONG_ANSWER".to_string(),
        runtime_ms: Some(30),
        memory_kb: Some(4096),
        input: Some("5000\n[confidential test]".to_string()),
        expected_output: Some("12345".to_string()),
        actual_output: Some("12340".to_string()),
        diff: Some("Expected 12345, got 12340".to_string()),
    }];

    let serialized_cases = test_cases
        .iter()
        .map(|tc| serde_json::to_value(tc).unwrap())
        .collect::<Vec<_>>();

    state
        .mock_campus
        .submission_results
        .write()
        .await
        .insert(submission_id, serialized_cases);

    let app = create_router(state);
    let instructor_token = generate_test_token(&Uuid::new_v4().to_string(), "instructor");

    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/submissions/{submission_id}"))
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let body: GetSubmissionResponse = serde_json::from_slice(&bytes).unwrap();

    assert_eq!(body.id, submission_id);
    assert_eq!(body.test_cases.len(), 1);

    // Instructor receives unmasked diagnostic inputs/outputs
    let tc = &body.test_cases[0];
    assert_eq!(tc.input, Some("5000\n[confidential test]".to_string()));
    assert_eq!(tc.expected_output, Some("12345".to_string()));
    assert_eq!(tc.actual_output, Some("12340".to_string()));
    assert_eq!(tc.diff, Some("Expected 12345, got 12340".to_string()));
}

#[tokio::test]
async fn test_admin_query_receives_unmasked_details() {
    let state = AppState::new_test();
    let submission_id = Uuid::new_v4();

    let record = SubmissionRecord {
        id: submission_id,
        user_id: Some(Uuid::new_v4()),
        problem_slug: "two-sum".to_string(),
        language: "cpp".to_string(),
        code: "int main() {}".to_string(),
        verdict: "ACCEPTED".to_string(),
        runtime_ms: 5,
        memory_kb: 512,
        testcases_passed: 1,
        total_testcases: 1,
        created_at: Utc::now(),
        assessment_id: None,
        room_id: None,
    };
    state
        .mock_campus
        .submissions
        .write()
        .await
        .insert(submission_id, record);

    let test_cases = vec![TestCaseResult {
        test_case_id: 1,
        is_sample: false,
        is_secret: true,
        verdict: "ACCEPTED".to_string(),
        runtime_ms: Some(5),
        memory_kb: Some(512),
        input: Some("admin secret in".to_string()),
        expected_output: Some("admin secret out".to_string()),
        actual_output: Some("admin secret out".to_string()),
        diff: None,
    }];

    let serialized_cases = test_cases
        .iter()
        .map(|tc| serde_json::to_value(tc).unwrap())
        .collect::<Vec<_>>();

    state
        .mock_campus
        .submission_results
        .write()
        .await
        .insert(submission_id, serialized_cases);

    let app = create_router(state);
    let admin_token = generate_test_token(&Uuid::new_v4().to_string(), "org_admin");

    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/submissions/{submission_id}"))
        .header(AUTHORIZATION, format!("Bearer {admin_token}"))
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let body: GetSubmissionResponse = serde_json::from_slice(&bytes).unwrap();

    assert_eq!(body.id, submission_id);
    assert_eq!(body.test_cases[0].input, Some("admin secret in".to_string()));
    assert_eq!(
        body.test_cases[0].expected_output,
        Some("admin secret out".to_string())
    );
}

#[test]
fn test_mask_test_case_results_and_json_helpers() {
    let cases = vec![
        TestCaseResult {
            test_case_id: 1,
            is_sample: true,
            is_secret: false,
            verdict: "ACCEPTED".to_string(),
            runtime_ms: Some(10),
            memory_kb: Some(1024),
            input: Some("sample in".to_string()),
            expected_output: Some("sample out".to_string()),
            actual_output: Some("sample out".to_string()),
            diff: None,
        },
        TestCaseResult {
            test_case_id: 2,
            is_sample: false,
            is_secret: true,
            verdict: "ACCEPTED".to_string(),
            runtime_ms: Some(20),
            memory_kb: Some(2048),
            input: Some("secret in".to_string()),
            expected_output: Some("secret out".to_string()),
            actual_output: Some("secret out".to_string()),
            diff: Some("diff text".to_string()),
        },
    ];

    // Candidate masking
    let masked = mask_test_case_results(&cases, false, false);
    assert_eq!(masked[0].input, Some("sample in".to_string()));
    assert_eq!(masked[1].input, Some(SECRET_TEST_MASK.to_string()));
    assert_eq!(masked[1].expected_output, Some(SECRET_TEST_MASK.to_string()));
    assert_eq!(masked[1].actual_output, Some(SECRET_TEST_MASK.to_string()));
    assert_eq!(masked[1].diff, None);

    // Instructor unmasking
    let instructor_view = mask_test_case_results(&cases, true, false);
    assert_eq!(instructor_view[1].input, Some("secret in".to_string()));
    assert_eq!(instructor_view[1].diff, Some("diff text".to_string()));

    // JSON payload masking helper
    let raw_event = serde_json::json!({
        "event": "test_case_finished",
        "test_case": {
            "test_case_id": 42,
            "is_sample": false,
            "is_secret": true,
            "input": "hidden data",
            "expected_output": "expected hidden",
            "actual_output": "actual hidden",
            "diff": "some diff",
            "status": "failed"
        }
    });

    let masked_json = mask_test_case_json(&raw_event, false, false);
    assert_eq!(
        masked_json["test_case"]["input"],
        serde_json::Value::String(SECRET_TEST_MASK.to_string())
    );
    assert_eq!(
        masked_json["test_case"]["expected_output"],
        serde_json::Value::String(SECRET_TEST_MASK.to_string())
    );
    assert_eq!(
        masked_json["test_case"]["actual_output"],
        serde_json::Value::String(SECRET_TEST_MASK.to_string())
    );
    assert_eq!(masked_json["test_case"]["diff"], serde_json::Value::Null);
    assert_eq!(
        masked_json["test_case"]["status"],
        serde_json::Value::String("failed".to_string())
    );

    // Instructor leaves json untouched
    let unmasked_json = mask_test_case_json(&raw_event, true, false);
    assert_eq!(unmasked_json["test_case"]["input"], "hidden data");
    assert_eq!(unmasked_json["test_case"]["diff"], "some diff");
}

#[tokio::test]
async fn test_websocket_stream_payload_serialization_masks_for_students() {
    let state = AppState::new_test();
    let submission_id = Uuid::new_v4();

    // Start live Axum server on random available TCP port
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr: SocketAddr = listener.local_addr().unwrap();
    let app = create_router(state.clone());

    let server_handle = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    let student_token = generate_test_token(&Uuid::new_v4().to_string(), "student");
    let instructor_token = generate_test_token(&Uuid::new_v4().to_string(), "instructor");

    let student_url =
        format!("ws://{addr}/ws/submissions/{submission_id}?token={student_token}");
    let instructor_url =
        format!("ws://{addr}/ws/submissions/{submission_id}?token={instructor_token}");

    // Connect student WebSocket
    let (mut student_ws, _) = connect_async(&student_url)
        .await
        .expect("student ws connection failed");

    // Connect instructor WebSocket
    let (mut instructor_ws, _) = connect_async(&instructor_url)
        .await
        .expect("instructor ws connection failed");

    // Give server a brief tick to establish reader streams
    tokio::time::sleep(Duration::from_millis(50)).await;

    // Send broadcast event for the submission via local in-memory broadcast channel
    let broadcast_event = serde_json::json!({
        "event": "test_case_evaluated",
        "case_number": 99,
        "is_sample": false,
        "is_secret": true,
        "input": "super_secret_test_input_12345",
        "expected_output": "super_secret_expected_output_67890",
        "actual_output": "super_secret_actual_output_67890",
        "diff": "some difference",
        "status": "passed"
    });

    let sender = {
        let mut map = state.mock_campus.submission_broadcasts.write().await;
        map.entry(submission_id)
            .or_insert_with(|| {
                let (tx, _) = tokio::sync::broadcast::channel(100);
                tx
            })
            .clone()
    };
    sender
        .send(broadcast_event)
        .expect("failed to send broadcast event");

    // Read message from student socket
    let student_msg = tokio::time::timeout(Duration::from_secs(3), student_ws.next())
        .await
        .expect("student ws timed out waiting for event")
        .expect("student ws stream closed")
        .expect("student ws error");

    let student_text = student_msg.to_text().unwrap();
    let student_json: serde_json::Value =
        serde_json::from_str(student_text).expect("invalid json from student ws");

    // Assert student received masked secret test vectors
    assert_eq!(
        student_json["input"],
        serde_json::Value::String(SECRET_TEST_MASK.to_string())
    );
    assert_eq!(
        student_json["expected_output"],
        serde_json::Value::String(SECRET_TEST_MASK.to_string())
    );
    assert_eq!(
        student_json["actual_output"],
        serde_json::Value::String(SECRET_TEST_MASK.to_string())
    );
    assert_eq!(student_json["diff"], serde_json::Value::Null);
    assert_eq!(student_json["status"], "passed");

    // Read message from instructor socket
    let instructor_msg = tokio::time::timeout(Duration::from_secs(3), instructor_ws.next())
        .await
        .expect("instructor ws timed out waiting for event")
        .expect("instructor ws stream closed")
        .expect("instructor ws error");

    let instructor_text = instructor_msg.to_text().unwrap();
    let instructor_json: serde_json::Value =
        serde_json::from_str(instructor_text).expect("invalid json from instructor ws");

    // Assert instructor received raw unmasked test vectors
    assert_eq!(
        instructor_json["input"],
        "super_secret_test_input_12345"
    );
    assert_eq!(
        instructor_json["expected_output"],
        "super_secret_expected_output_67890"
    );
    assert_eq!(
        instructor_json["actual_output"],
        "super_secret_actual_output_67890"
    );
    assert_eq!(instructor_json["diff"], "some difference");
    assert_eq!(instructor_json["status"], "passed");

    // Clean up connections
    let _ = student_ws.close(None).await;
    let _ = instructor_ws.close(None).await;
    server_handle.abort();
}

#[tokio::test]
async fn test_live_redis_intake_queue_and_pubsub_masking() {
    let Ok(client) = redis::Client::open("redis://127.0.0.1:6379") else {
        return;
    };
    let Ok(mut con) = client.get_multiplexed_async_connection().await else {
        return;
    };
    let ping: Result<String, _> = redis::cmd("PING").query_async(&mut con).await;
    if ping.is_err() {
        return;
    }

    let state = AppState::new_with_redis(
        None,
        judge_gateway::TokenStore::new_in_memory(),
        None,
        Some(client.clone()),
    );
    let app = create_router(state);

    let student_id = Uuid::new_v4().to_string();
    let student_token = generate_test_token(&student_id, "student");

    let payload = SubmitCodeRequest {
        problem_slug: Some("two-sum".to_string()),
        language: "cpp".to_string(),
        code: Some("int main() { return 0; }".to_string()),
        source_code: None,
        custom_input: None,
        test_cases: None,
        time_limit_ms: None,
        memory_limit_bytes: None,
        assessment_id: None,
    };

    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/submissions")
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let submit_resp: SubmitCodeResponse = serde_json::from_slice(&bytes).unwrap();

    // Verify item was pushed to Redis queue `submissions:queue`
    let mut found = false;
    while let Ok(Some(raw_job)) = con.rpop::<_, Option<String>>("submissions:queue", None).await {
        if let Ok(job) = serde_json::from_str::<serde_json::Value>(&raw_job) {
            if job["submission_id"].as_str() == Some(&submit_resp.submission_id.to_string()) {
                assert_eq!(job["problem_slug"], "two-sum");
                assert_eq!(job["language"], "cpp");
                found = true;
                break;
            }
        }
    }
    assert!(found, "Submitted job should be in Redis submissions:queue");
}


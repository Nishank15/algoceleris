#![allow(
    clippy::too_many_lines,
    clippy::similar_names,
    clippy::manual_let_else,
    clippy::single_match_else
)]

use axum::body::Body;
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use axum::http::{Request, StatusCode};
use chrono::{Duration, Utc};
use judge_gateway::auth::{encode_access_token, DEFAULT_JWT_SECRET};
use judge_gateway::create_router;
use judge_gateway::errors::ProblemDetails;
use judge_gateway::routes::{
    AssessmentResponse, CohortResponse, ForceSubmitResponse, GrantAccommodationResponse,
    OrganizationResponse, SubmitAssessmentResponse,
};
use judge_gateway::state::AppState;
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

/// Helper bootstrapping test organization, cohort, and returning IDs with auth token.
async fn setup_test_hierarchy(
    app: &axum::Router,
    instructor_token: &str,
) -> (Uuid, Uuid) {
    let org_payload = serde_json::json!({
        "name": "Department of Computer Science",
        "slug": format!("cs-dept-{}", &Uuid::new_v4().to_string()[..8]),
        "domain_whitelist": ["campus.edu"]
    });
    let org_req = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/orgs")
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&org_payload).unwrap()))
        .unwrap();

    let org_resp = app.clone().oneshot(org_req).await.unwrap();
    assert_eq!(org_resp.status(), StatusCode::CREATED);
    let org_bytes = axum::body::to_bytes(org_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let org: OrganizationResponse = serde_json::from_slice(&org_bytes).unwrap();

    let cohort_payload = serde_json::json!({
        "name": "Algorithms Fall 2026",
        "code": format!("CS-{}", &Uuid::new_v4().to_string()[..6]),
        "term": "Fall 2026",
        "is_active": true
    });
    let cohort_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/orgs/{}/cohorts", org.id))
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&cohort_payload).unwrap()))
        .unwrap();

    let cohort_resp = app.clone().oneshot(cohort_req).await.unwrap();
    assert_eq!(cohort_resp.status(), StatusCode::CREATED);
    let cohort_bytes = axum::body::to_bytes(cohort_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let cohort: CohortResponse = serde_json::from_slice(&cohort_bytes).unwrap();

    (org.id, cohort.id)
}

#[tokio::test]
async fn test_chronological_timeline_validation_rejects_malformed_dates() {
    let state = AppState::new_test();
    let app = create_router(state);

    let instructor_id = Uuid::new_v4().to_string();
    let instructor_token = generate_test_token(&instructor_id, "instructor");
    let (_org_id, cohort_id) = setup_test_hierarchy(&app, &instructor_token).await;

    let now = Utc::now();

    // 1. Inverted publish_at > starts_at
    let malformed_1 = serde_json::json!({
        "cohort_id": cohort_id,
        "title": "Invalid Publish Date Exam",
        "publish_at": now + Duration::hours(2),
        "starts_at": now + Duration::hours(1),
        "due_at": now + Duration::hours(3),
        "cutoff_at": now + Duration::hours(4),
    });
    let req1 = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/assessments")
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&malformed_1).unwrap()))
        .unwrap();
    let resp1 = app.clone().oneshot(req1).await.unwrap();
    assert_eq!(resp1.status(), StatusCode::BAD_REQUEST);

    let bytes1 = axum::body::to_bytes(resp1.into_body(), usize::MAX)
        .await
        .unwrap();
    let prob1: ProblemDetails = serde_json::from_slice(&bytes1).unwrap();
    assert_eq!(prob1.status, 400);
    assert!(prob1.detail.contains("Timeline violation"));

    // 2. Inverted starts_at > due_at
    let malformed_2 = serde_json::json!({
        "cohort_id": cohort_id,
        "title": "Invalid Due Date Exam",
        "publish_at": now,
        "starts_at": now + Duration::hours(3),
        "due_at": now + Duration::hours(2),
        "cutoff_at": now + Duration::hours(4),
    });
    let req2 = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/assessments")
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&malformed_2).unwrap()))
        .unwrap();
    let resp2 = app.clone().oneshot(req2).await.unwrap();
    assert_eq!(resp2.status(), StatusCode::BAD_REQUEST);

    // 3. Inverted due_at > cutoff_at
    let malformed_3 = serde_json::json!({
        "cohort_id": cohort_id,
        "title": "Invalid Cutoff Exam",
        "publish_at": now,
        "starts_at": now + Duration::hours(1),
        "due_at": now + Duration::hours(4),
        "cutoff_at": now + Duration::hours(3),
    });
    let req3 = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/assessments")
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&malformed_3).unwrap()))
        .unwrap();
    let resp3 = app.clone().oneshot(req3).await.unwrap();
    assert_eq!(resp3.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_on_time_submission_accepts_with_zero_deduction() {
    let state = AppState::new_test();
    let app = create_router(state);

    let instructor_id = Uuid::new_v4().to_string();
    let instructor_token = generate_test_token(&instructor_id, "instructor");
    let student_id = Uuid::new_v4().to_string();
    let student_token = generate_test_token(&student_id, "student");

    let (_org_id, cohort_id) = setup_test_hierarchy(&app, &instructor_token).await;

    let now = Utc::now();
    let create_payload = serde_json::json!({
        "cohort_id": cohort_id,
        "title": "Midterm Exam On-Time",
        "publish_at": now - Duration::hours(2),
        "starts_at": now - Duration::hours(1),
        "due_at": now + Duration::hours(1),
        "cutoff_at": now + Duration::hours(2),
        "late_penalty_percent_per_hour": 10.0,
        "max_late_penalty_percent": 100.0,
        "problem_slugs": ["two-sum", "reverse-linked-list"]
    });

    let create_req = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/assessments")
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&create_payload).unwrap()))
        .unwrap();

    let create_resp = app.clone().oneshot(create_req).await.unwrap();
    assert_eq!(create_resp.status(), StatusCode::CREATED);
    let create_bytes = axum::body::to_bytes(create_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let assessment: AssessmentResponse = serde_json::from_slice(&create_bytes).unwrap();

    // Student submits on-time
    let submit_payload = serde_json::json!({
        "problem_slug": "two-sum",
        "language": "cpp",
        "source_code": "#include <iostream>\nint main() { return 0; }",
        "raw_score": 100.0,
        "submitted_at": now
    });
    let submit_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/assessments/{}/submit", assessment.id))
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&submit_payload).unwrap()))
        .unwrap();

    let submit_resp = app.clone().oneshot(submit_req).await.unwrap();
    assert_eq!(submit_resp.status(), StatusCode::CREATED);

    let submit_bytes = axum::body::to_bytes(submit_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let result: SubmitAssessmentResponse = serde_json::from_slice(&submit_bytes).unwrap();

    assert_eq!(result.raw_score, 100.0);
    assert_eq!(result.late_penalty_deduction, 0.0);
    assert_eq!(result.final_score, 100.0);
    assert!(!result.is_late);
    assert_eq!(result.eval_verdict, "ACCEPTED");
}

#[tokio::test]
async fn test_grace_period_submission_calculates_ceiling_hour_late_penalty() {
    let state = AppState::new_test();
    let app = create_router(state);

    let instructor_id = Uuid::new_v4().to_string();
    let instructor_token = generate_test_token(&instructor_id, "instructor");
    let student_id = Uuid::new_v4().to_string();
    let student_token = generate_test_token(&student_id, "student");

    let (_org_id, cohort_id) = setup_test_hierarchy(&app, &instructor_token).await;

    let base_time = Utc::now();
    let due_at = base_time;
    let cutoff_at = base_time + Duration::hours(3);

    let create_payload = serde_json::json!({
        "cohort_id": cohort_id,
        "title": "Grace Period Exam",
        "publish_at": base_time - Duration::hours(2),
        "starts_at": base_time - Duration::hours(1),
        "due_at": due_at,
        "cutoff_at": cutoff_at,
        "late_penalty_percent_per_hour": 15.0,
        "max_late_penalty_percent": 60.0
    });

    let create_req = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/assessments")
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&create_payload).unwrap()))
        .unwrap();

    let create_resp = app.clone().oneshot(create_req).await.unwrap();
    let create_bytes = axum::body::to_bytes(create_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let assessment: AssessmentResponse = serde_json::from_slice(&create_bytes).unwrap();

    // 1. Submit 45 minutes late -> ceil(45/60) = 1 hour late -> 15% penalty
    let sub1_time = due_at + Duration::minutes(45);
    let submit_payload_1 = serde_json::json!({
        "raw_score": 100.0,
        "submitted_at": sub1_time
    });
    let submit_req1 = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/assessments/{}/submit", assessment.id))
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&submit_payload_1).unwrap()))
        .unwrap();

    let resp1 = app.clone().oneshot(submit_req1).await.unwrap();
    assert_eq!(resp1.status(), StatusCode::CREATED);
    let bytes1 = axum::body::to_bytes(resp1.into_body(), usize::MAX)
        .await
        .unwrap();
    let res1: SubmitAssessmentResponse = serde_json::from_slice(&bytes1).unwrap();

    assert!(res1.is_late);
    assert_eq!(res1.raw_score, 100.0);
    assert_eq!(res1.late_penalty_deduction, 15.0);
    assert_eq!(res1.final_score, 85.0);

    // 2. Submit 75 minutes late -> ceil(75/60) = 2 hours late -> 30% penalty
    let sub2_time = due_at + Duration::minutes(75);
    let submit_payload_2 = serde_json::json!({
        "raw_score": 90.0,
        "submitted_at": sub2_time
    });
    let submit_req2 = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/assessments/{}/submit", assessment.id))
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&submit_payload_2).unwrap()))
        .unwrap();

    let resp2 = app.clone().oneshot(submit_req2).await.unwrap();
    assert_eq!(resp2.status(), StatusCode::CREATED);
    let bytes2 = axum::body::to_bytes(resp2.into_body(), usize::MAX)
        .await
        .unwrap();
    let res2: SubmitAssessmentResponse = serde_json::from_slice(&bytes2).unwrap();

    assert!(res2.is_late);
    assert_eq!(res2.raw_score, 90.0);
    // 30% of 90.0 = 27.0 deduction, final score = 63.0
    assert_eq!(res2.late_penalty_deduction, 27.0);
    assert_eq!(res2.final_score, 63.0);
}

#[tokio::test]
async fn test_post_cutoff_submission_strictly_rejected_with_403() {
    let state = AppState::new_test();
    let app = create_router(state);

    let instructor_id = Uuid::new_v4().to_string();
    let instructor_token = generate_test_token(&instructor_id, "instructor");
    let student_id = Uuid::new_v4().to_string();
    let student_token = generate_test_token(&student_id, "student");

    let (_org_id, cohort_id) = setup_test_hierarchy(&app, &instructor_token).await;

    let base_time = Utc::now();
    let cutoff_at = base_time + Duration::hours(1);

    let create_payload = serde_json::json!({
        "cohort_id": cohort_id,
        "title": "Strict Cutoff Exam",
        "publish_at": base_time - Duration::hours(2),
        "starts_at": base_time - Duration::hours(1),
        "due_at": base_time + Duration::minutes(30),
        "cutoff_at": cutoff_at,
    });

    let create_req = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/assessments")
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&create_payload).unwrap()))
        .unwrap();

    let create_resp = app.clone().oneshot(create_req).await.unwrap();
    let create_bytes = axum::body::to_bytes(create_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let assessment: AssessmentResponse = serde_json::from_slice(&create_bytes).unwrap();

    // Submit 5 minutes AFTER cutoff_at
    let post_cutoff_time = cutoff_at + Duration::minutes(5);
    let submit_payload = serde_json::json!({
        "raw_score": 100.0,
        "submitted_at": post_cutoff_time
    });

    let submit_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/assessments/{}/submit", assessment.id))
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&submit_payload).unwrap()))
        .unwrap();

    let submit_resp = app.clone().oneshot(submit_req).await.unwrap();
    assert_eq!(submit_resp.status(), StatusCode::FORBIDDEN);

    let bytes = axum::body::to_bytes(submit_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let problem: ProblemDetails = serde_json::from_slice(&bytes).unwrap();

    assert_eq!(problem.status, 403);
    assert_eq!(problem.r#type, "urn:problem-type:forbidden");
    assert!(
        problem.detail.contains("assessment_cutoff_passed"),
        "Expected error detail to indicate cutoff passed, got: {}",
        problem.detail
    );
}

#[tokio::test]
async fn test_premature_submission_before_starts_at_rejected_with_403() {
    let state = AppState::new_test();
    let app = create_router(state);

    let instructor_id = Uuid::new_v4().to_string();
    let instructor_token = generate_test_token(&instructor_id, "instructor");
    let student_id = Uuid::new_v4().to_string();
    let student_token = generate_test_token(&student_id, "student");

    let (_org_id, cohort_id) = setup_test_hierarchy(&app, &instructor_token).await;

    let base_time = Utc::now();
    let starts_at = base_time + Duration::hours(1);

    let create_payload = serde_json::json!({
        "cohort_id": cohort_id,
        "title": "Future Exam",
        "publish_at": base_time - Duration::hours(1),
        "starts_at": starts_at,
        "due_at": base_time + Duration::hours(2),
        "cutoff_at": base_time + Duration::hours(3),
    });

    let create_req = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/assessments")
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&create_payload).unwrap()))
        .unwrap();

    let create_resp = app.clone().oneshot(create_req).await.unwrap();
    let create_bytes = axum::body::to_bytes(create_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let assessment: AssessmentResponse = serde_json::from_slice(&create_bytes).unwrap();

    // Student submits before starts_at
    let premature_time = base_time + Duration::minutes(10);
    let submit_payload = serde_json::json!({
        "raw_score": 100.0,
        "submitted_at": premature_time
    });

    let submit_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/assessments/{}/submit", assessment.id))
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&submit_payload).unwrap()))
        .unwrap();

    let submit_resp = app.clone().oneshot(submit_req).await.unwrap();
    assert_eq!(submit_resp.status(), StatusCode::FORBIDDEN);

    let bytes = axum::body::to_bytes(submit_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let problem: ProblemDetails = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(problem.status, 403);
    assert!(problem.detail.contains("assessment_not_started"));
}

#[tokio::test]
async fn test_time_accommodation_extends_submission_window() {
    let state = AppState::new_test();
    let app = create_router(state);

    let instructor_id = Uuid::new_v4().to_string();
    let instructor_token = generate_test_token(&instructor_id, "instructor");
    let student_a_id = Uuid::new_v4().to_string();
    let student_a_token = generate_test_token(&student_a_id, "student");
    let student_b_id = Uuid::new_v4().to_string();
    let student_b_token = generate_test_token(&student_b_id, "student");

    let (_org_id, cohort_id) = setup_test_hierarchy(&app, &instructor_token).await;

    let base_time = Utc::now();
    let due_at = base_time;
    let cutoff_at = base_time + Duration::minutes(30);

    let create_payload = serde_json::json!({
        "cohort_id": cohort_id,
        "title": "Accommodation Window Exam",
        "publish_at": base_time - Duration::hours(2),
        "starts_at": base_time - Duration::hours(1),
        "due_at": due_at,
        "cutoff_at": cutoff_at,
        "late_penalty_percent_per_hour": 10.0,
    });

    let create_req = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/assessments")
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&create_payload).unwrap()))
        .unwrap();

    let create_resp = app.clone().oneshot(create_req).await.unwrap();
    let create_bytes = axum::body::to_bytes(create_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let assessment: AssessmentResponse = serde_json::from_slice(&create_bytes).unwrap();

    // Faculty grants +30m accommodation to Student A
    let acc_payload = serde_json::json!({
        "user_id": student_a_id,
        "extension_minutes": 30,
        "reason": "Accessibility time accommodation"
    });
    let acc_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/assessments/{}/accommodations", assessment.id))
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&acc_payload).unwrap()))
        .unwrap();

    let acc_resp = app.clone().oneshot(acc_req).await.unwrap();
    assert_eq!(acc_resp.status(), StatusCode::OK);
    let acc_bytes = axum::body::to_bytes(acc_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let acc_res: GrantAccommodationResponse = serde_json::from_slice(&acc_bytes).unwrap();
    assert_eq!(acc_res.total_extension_minutes, 30);
    assert_eq!(acc_res.effective_cutoff_at, cutoff_at + Duration::minutes(30));

    // Time: cutoff_at + 15m (45m after due_at)
    let submit_time = cutoff_at + Duration::minutes(15);

    // 1. Student B (no accommodation) attempts submit -> REJECTED 403
    let submit_payload_b = serde_json::json!({
        "raw_score": 100.0,
        "submitted_at": submit_time
    });
    let submit_req_b = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/assessments/{}/submit", assessment.id))
        .header(AUTHORIZATION, format!("Bearer {student_b_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&submit_payload_b).unwrap()))
        .unwrap();

    let resp_b = app.clone().oneshot(submit_req_b).await.unwrap();
    assert_eq!(resp_b.status(), StatusCode::FORBIDDEN);

    // 2. Student A (with +30m accommodation) submits -> ACCEPTED 201
    let submit_payload_a = serde_json::json!({
        "raw_score": 100.0,
        "submitted_at": submit_time
    });
    let submit_req_a = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/assessments/{}/submit", assessment.id))
        .header(AUTHORIZATION, format!("Bearer {student_a_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&submit_payload_a).unwrap()))
        .unwrap();

    let resp_a = app.clone().oneshot(submit_req_a).await.unwrap();
    assert_eq!(resp_a.status(), StatusCode::CREATED);
    let bytes_a = axum::body::to_bytes(resp_a.into_body(), usize::MAX)
        .await
        .unwrap();
    let res_a: SubmitAssessmentResponse = serde_json::from_slice(&bytes_a).unwrap();
    // Due_at was extended by 30 min, so at T+45min they are 15 min past effective due -> 1 hour late -> 10% penalty
    assert_eq!(res_a.raw_score, 100.0);
    assert_eq!(res_a.late_penalty_deduction, 10.0);
    assert_eq!(res_a.final_score, 90.0);
}

#[tokio::test]
async fn test_faculty_force_submit_and_status_transition() {
    let state = AppState::new_test();
    let app = create_router(state);

    let instructor_id = Uuid::new_v4().to_string();
    let instructor_token = generate_test_token(&instructor_id, "instructor");
    let student_id = Uuid::new_v4().to_string();
    let student_token = generate_test_token(&student_id, "student");

    let (_org_id, cohort_id) = setup_test_hierarchy(&app, &instructor_token).await;

    let now = Utc::now();
    let create_payload = serde_json::json!({
        "cohort_id": cohort_id,
        "title": "Exam with Force Submit",
        "publish_at": now - Duration::hours(2),
        "starts_at": now - Duration::hours(1),
        "due_at": now + Duration::hours(1),
        "cutoff_at": now + Duration::hours(2),
    });

    let create_req = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/assessments")
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&create_payload).unwrap()))
        .unwrap();

    let create_resp = app.clone().oneshot(create_req).await.unwrap();
    let create_bytes = axum::body::to_bytes(create_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let assessment: AssessmentResponse = serde_json::from_slice(&create_bytes).unwrap();

    // 1. Force submit candidate session
    let force_payload = serde_json::json!({
        "user_id": student_id,
        "reason": "proctor_invoked_submission"
    });
    let force_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/assessments/{}/force-submit", assessment.id))
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&force_payload).unwrap()))
        .unwrap();

    let force_resp = app.clone().oneshot(force_req).await.unwrap();
    assert_eq!(force_resp.status(), StatusCode::OK);
    let force_bytes = axum::body::to_bytes(force_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let force_res: ForceSubmitResponse = serde_json::from_slice(&force_bytes).unwrap();
    assert_eq!(force_res.status, "FORCED_SUBMITTED");

    // 2. Transition status to CLOSED
    let status_payload = serde_json::json!({
        "status": "CLOSED"
    });
    let status_req = Request::builder()
        .method("PATCH")
        .uri(format!("/api/v1/campus/assessments/{}/status", assessment.id))
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&status_payload).unwrap()))
        .unwrap();

    let status_resp = app.clone().oneshot(status_req).await.unwrap();
    assert_eq!(status_resp.status(), StatusCode::OK);

    // 3. Subsequent submit attempt is rejected with 403
    let submit_payload = serde_json::json!({
        "raw_score": 100.0,
        "submitted_at": now
    });
    let submit_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/assessments/{}/submit", assessment.id))
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&submit_payload).unwrap()))
        .unwrap();

    let submit_resp = app.clone().oneshot(submit_req).await.unwrap();
    assert_eq!(submit_resp.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_live_postgres_assessment_lifecycle_if_available() {
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:5432/cloud_judge".to_string());

    let pool = match judge_db::create_connection_pool(&db_url, 5).await {
        Ok(p) => p,
        Err(_) => {
            eprintln!("PostgreSQL not reachable; skipping live test");
            return;
        }
    };

    let state = AppState::new(
        Some(pool.clone()),
        judge_gateway::auth::TokenStore::new_in_memory(),
        None,
    );
    let app = create_router(state);

    let instructor_id = Uuid::new_v4();
    // Insert instructor user
    let _ = sqlx::query(
        r"
        INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at)
        VALUES ($1, $2, $3, 'dummy_hash', 'free', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
        ",
    )
    .bind(instructor_id)
    .bind(format!("inst_{}", &instructor_id.to_string()[..8]))
    .bind(format!("inst_{}@campus.edu", &instructor_id.to_string()[..8]))
    .execute(pool.inner())
    .await;

    let instructor_token = generate_test_token(&instructor_id.to_string(), "instructor");
    let student_id = Uuid::new_v4();
    let _ = sqlx::query(
        r"
        INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at)
        VALUES ($1, $2, $3, 'dummy_hash', 'free', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
        ",
    )
    .bind(student_id)
    .bind(format!("stud_{}", &student_id.to_string()[..8]))
    .bind(format!("stud_{}@campus.edu", &student_id.to_string()[..8]))
    .execute(pool.inner())
    .await;

    let student_token = generate_test_token(&student_id.to_string(), "student");

    let (org_id, cohort_id) = setup_test_hierarchy(&app, &instructor_token).await;

    // Enroll student in organization
    sqlx::query(
        r"
        INSERT INTO org_memberships (id, org_id, user_id, cohort_id, role, status, created_at)
        VALUES ($1, $2, $3, $4, 'student', 'active', NOW())
        ",
    )
    .bind(Uuid::new_v4())
    .bind(org_id)
    .bind(student_id)
    .bind(cohort_id)
    .execute(pool.inner())
    .await
    .unwrap();

    let now = Utc::now();
    let create_payload = serde_json::json!({
        "org_id": org_id,
        "cohort_id": cohort_id,
        "title": "Live Database Exam",
        "publish_at": now - Duration::hours(1),
        "starts_at": now - Duration::minutes(30),
        "due_at": now + Duration::hours(1),
        "cutoff_at": now + Duration::hours(2),
        "late_penalty_percent_per_hour": 10.0,
    });

    let create_req = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/assessments")
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&create_payload).unwrap()))
        .unwrap();

    let create_resp = app.clone().oneshot(create_req).await.unwrap();
    assert_eq!(create_resp.status(), StatusCode::CREATED);
    let create_bytes = axum::body::to_bytes(create_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let assessment: AssessmentResponse = serde_json::from_slice(&create_bytes).unwrap();

    // Submit live on-time
    let submit_payload = serde_json::json!({
        "raw_score": 100.0,
        "submitted_at": now
    });
    let submit_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/assessments/{}/submit", assessment.id))
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&submit_payload).unwrap()))
        .unwrap();

    let submit_resp = app.clone().oneshot(submit_req).await.unwrap();
    assert_eq!(submit_resp.status(), StatusCode::CREATED);
    let submit_bytes = axum::body::to_bytes(submit_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let res: SubmitAssessmentResponse = serde_json::from_slice(&submit_bytes).unwrap();
    assert_eq!(res.final_score, 100.0);
    assert!(!res.is_late);
}

use axum::body::Body;
use axum::http::{Request, StatusCode};
use judge_gateway::{create_router, AppState};
use serde_json::Value;
use tower::ServiceExt;

#[tokio::test]
async fn test_campus_phase32_lab_engine_and_dynamic_analytics() {
    let state = AppState::new_test();
    let app = create_router(state);

    // 1. GET /api/v1/campus/vit-chennai/labs
    let req = Request::builder()
        .uri("/api/v1/campus/vit-chennai/labs")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let labs_json: Value = serde_json::from_slice(&bytes).unwrap();
    let labs_arr = labs_json.as_array().expect("Expected array of labs");
    assert!(
        labs_arr.len() >= 4,
        "Should have at least 4 pre-seeded labs"
    );

    let lab11 = labs_arr
        .iter()
        .find(|l| l["id"] == "bacs101-lab-11")
        .expect("Lab 11 exists");
    assert_eq!(lab11["code"], "LAB-11");
    assert_eq!(lab11["status"], "active");
    assert_eq!(lab11["clo"], "CLO-3");

    // 2. GET initial analytics BEFORE activity
    let req = Request::builder()
        .uri("/api/v1/campus/vit-chennai/analytics/student")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let initial_analytics: Value = serde_json::from_slice(&bytes).unwrap();
    let initial_code_runs = initial_analytics["code_runs_count"].as_u64().unwrap();
    let initial_completed = initial_analytics["completed_labs_count"].as_u64().unwrap();
    let initial_active = initial_analytics["active_labs_count"].as_u64().unwrap();
    assert_eq!(initial_completed, 3);
    assert_eq!(initial_active, 1);

    // 3. GET lab detail /api/v1/campus/vit-chennai/labs/bacs101-lab-11
    let req = Request::builder()
        .uri("/api/v1/campus/vit-chennai/labs/bacs101-lab-11")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let detail_json: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(detail_json["lab"]["id"], "bacs101-lab-11");
    assert!(
        detail_json["lab"]["practice_problems"]
            .as_array()
            .unwrap()
            .len()
            >= 2
    );
    assert_eq!(detail_json["student_progress"]["status"], "In Progress");

    // 4. Record RUN_CODE activity
    let req = Request::builder()
        .uri("/api/v1/campus/vit-chennai/labs/bacs101-lab-11/activity")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&serde_json::json!({
                "event_type": "RUN_CODE",
                "stage": "practice",
                "active_seconds": 120,
                "details": { "problem_id": 1, "testcases_passed": 5 }
            }))
            .unwrap(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 5. Verify analytics dynamically updated code_runs_count!
    let req = Request::builder()
        .uri("/api/v1/campus/vit-chennai/analytics/student")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let updated_analytics: Value = serde_json::from_slice(&bytes).unwrap();
    let new_code_runs = updated_analytics["code_runs_count"].as_u64().unwrap();
    assert_eq!(
        new_code_runs,
        initial_code_runs + 1,
        "Code runs should have dynamically incremented by 1"
    );

    // 6. Submit the lab: POST /api/v1/campus/vit-chennai/labs/bacs101-lab-11/submit
    let req = Request::builder()
        .uri("/api/v1/campus/vit-chennai/labs/bacs101-lab-11/submit")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&serde_json::json!({
                "practice_code": { "1": "class Solution {}" },
                "challenging_code": "class WorkStealingQueue {}",
                "mcq_answers": { "1": 1, "2": 2, "3": 1, "4": 2 },
                "self_rating": 5,
                "feedback": "Flawless concurrent primitives."
            }))
            .unwrap(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let submit_resp: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(submit_resp["status"], "Evaluated");
    assert_eq!(submit_resp["obtained_marks"], 19.5);

    // 7. Verify analytics dynamically moved lab from Active to Completed!
    let req = Request::builder()
        .uri("/api/v1/campus/vit-chennai/analytics/student")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let post_submit_analytics: Value = serde_json::from_slice(&bytes).unwrap();
    let final_completed = post_submit_analytics["completed_labs_count"]
        .as_u64()
        .unwrap();
    let final_active = post_submit_analytics["active_labs_count"].as_u64().unwrap();
    assert_eq!(
        final_completed,
        initial_completed + 1,
        "Completed labs should dynamically increase by 1"
    );
    assert_eq!(
        final_active,
        initial_active - 1,
        "Active labs should dynamically decrease by 1"
    );

    // 8. Test Faculty lab creation: POST /api/v1/campus/vit-chennai/labs
    let faculty_token = judge_gateway::auth::encode_access_token(
        "30000000-0000-0000-0000-000000000004",
        "demofaculty",
        "demofaculty@vit.ac.in",
        "faculty",
        judge_gateway::auth::DEFAULT_JWT_SECRET,
        None,
    )
    .expect("failed to generate faculty token");

    let req = Request::builder()
        .uri("/api/v1/campus/vit-chennai/labs")
        .method("POST")
        .header("content-type", "application/json")
        .header("Authorization", format!("Bearer {faculty_token}"))
        .body(Body::from(serde_json::to_vec(&serde_json::json!({
            "title": "Week 12: Distributed Consensus & Raft Log Replication",
            "course_code": "BACS101",
            "course_name": "Problem Solving Using Java",
            "code": "LAB-12",
            "deadline": "Nov 15, 2026 · 11:59 PM",
            "duration_minutes": 180,
            "max_marks": 20.0,
            "clo": "CLO-4",
            "description": "Implement Raft leader election and append-entries RPC log replication."
        })).unwrap()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    // 9. Test Admin audit: GET /api/v1/campus/vit-chennai/admin/audit
    let admin_token = judge_gateway::auth::encode_access_token(
        "30000000-0000-0000-0000-000000000006",
        "demoadmin",
        "demoadmin@vit.ac.in",
        "org_admin",
        judge_gateway::auth::DEFAULT_JWT_SECRET,
        None,
    )
    .expect("failed to generate admin token");

    let req = Request::builder()
        .uri("/api/v1/campus/vit-chennai/admin/audit")
        .method("GET")
        .header("Authorization", format!("Bearer {admin_token}"))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let audit_resp: Value = serde_json::from_slice(&bytes).unwrap();
    assert!(audit_resp["runtime_status"]
        .as_str()
        .unwrap()
        .contains("Automated evaluation"));
    assert!(audit_resp["seccomp_status"]
        .as_str()
        .unwrap()
        .contains("Runtime protection"));
    assert!(!audit_resp["security_audit_events"]
        .as_array()
        .unwrap()
        .is_empty());
    assert!(!audit_resp["plagiarism_scans"]
        .as_array()
        .unwrap()
        .is_empty());
}

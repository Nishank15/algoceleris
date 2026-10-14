#![allow(
    clippy::too_many_lines,
    clippy::similar_names,
    clippy::manual_let_else,
    clippy::single_match_else,
    clippy::useless_vec
)]

use axum::body::Body;
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use axum::http::{Request, StatusCode};
use chrono::{Duration, Utc};
use judge_core::models::RubricCriterion;
use judge_db::models::{InterviewRoomRecord, OrgMembershipRecord, ProctorEventCounts};
use judge_gateway::auth::{encode_access_token, DEFAULT_JWT_SECRET};
use judge_gateway::create_router;
use judge_gateway::errors::ProblemDetails;
use judge_gateway::routes::{
    AssessmentResponse, CohortResponse, OrganizationResponse, ProctorCockpitResponse,
    ProvisionVivaRequest, ProvisionVivaResponse, UpdateVivaRubricRequest, VivaRubricResponse,
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

async fn setup_test_assessment(
    app: &axum::Router,
    instructor_token: &str,
) -> (Uuid, Uuid, Uuid) {
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

    let now = Utc::now();
    let create_payload = serde_json::json!({
        "org_id": org.id,
        "cohort_id": cohort.id,
        "title": "Algorithms Exam",
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

    (org.id, cohort.id, assessment.id)
}

#[tokio::test]
async fn test_proctor_cockpit_returns_aggregated_anomaly_counts_and_risk_tiering() {
    let state = AppState::new_test();
    let app = create_router(state.clone());
    let instructor_id = Uuid::new_v4().to_string();
    let instructor_token = generate_test_token(&instructor_id, "instructor");

    let (org_id, cohort_id, assessment_id) =
        setup_test_assessment(&app, &instructor_token).await;

    let cand_low = Uuid::new_v4();
    let cand_elevated = Uuid::new_v4();
    let cand_critical = Uuid::new_v4();
    let now = Utc::now();

    for (uid, name) in [
        (cand_low, "Alice Low"),
        (cand_elevated, "Bob Elevated"),
        (cand_critical, "Charlie Critical"),
    ] {
        let mem = OrgMembershipRecord {
            id: Uuid::new_v4(),
            org_id,
            user_id: uid,
            cohort_id: Some(cohort_id),
            role: "student".to_string(),
            status: "active".to_string(),
            created_at: now,
        };
        state
            .mock_campus
            .memberships
            .write()
            .await
            .insert((org_id, uid), mem);

        state
            .mock_campus
            .users
            .write()
            .await
            .insert(uid, (name.to_string(), format!("{name}@campus.edu")));
    }

    // 1 tab switch (5 pts) -> Low (<15)
    state
        .mock_campus
        .candidate_proctor_counts
        .write()
        .await
        .insert(
            (assessment_id, cand_low),
            ProctorEventCounts {
                total: 1,
                tab_switches: 1,
                fullscreen_exits: 0,
                paste_bursts: 0,
            },
        );

    // 2 tab switches + 1 fullscreen exit (2*5 + 10 = 20 pts) -> Elevated (15..=34)
    state
        .mock_campus
        .candidate_proctor_counts
        .write()
        .await
        .insert(
            (assessment_id, cand_elevated),
            ProctorEventCounts {
                total: 3,
                tab_switches: 2,
                fullscreen_exits: 1,
                paste_bursts: 0,
            },
        );

    // 1 tab switch + 2 fullscreen exits + 1 paste burst (5 + 20 + 15 = 40 pts) -> Critical (>=35)
    state
        .mock_campus
        .candidate_proctor_counts
        .write()
        .await
        .insert(
            (assessment_id, cand_critical),
            ProctorEventCounts {
                total: 4,
                tab_switches: 1,
                fullscreen_exits: 2,
                paste_bursts: 1,
            },
        );

    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/campus/assessments/{assessment_id}/cockpit"))
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let body: ProctorCockpitResponse = serde_json::from_slice(&bytes).unwrap();

    assert_eq!(body.assessment_id, assessment_id);
    assert_eq!(body.cohort_id, cohort_id);
    assert_eq!(body.total_candidates, 3);
    assert_eq!(body.active_candidates, 3);
    assert_eq!(body.high_risk_count, 2); // 1 elevated + 1 critical

    let low_cand = body
        .candidates
        .iter()
        .find(|c| c.user_id == cand_low)
        .expect("low candidate missing");
    assert_eq!(low_cand.risk_score, 5);
    assert_eq!(low_cand.risk_severity, "low");
    assert_eq!(low_cand.tab_switches, 1);
    assert_eq!(low_cand.status, "in_progress");

    let elev_cand = body
        .candidates
        .iter()
        .find(|c| c.user_id == cand_elevated)
        .expect("elevated candidate missing");
    assert_eq!(elev_cand.risk_score, 20);
    assert_eq!(elev_cand.risk_severity, "elevated");
    assert_eq!(elev_cand.fullscreen_exits, 1);

    let crit_cand = body
        .candidates
        .iter()
        .find(|c| c.user_id == cand_critical)
        .expect("critical candidate missing");
    assert_eq!(crit_cand.risk_score, 40);
    assert_eq!(crit_cand.risk_severity, "critical");
    assert_eq!(crit_cand.paste_bursts, 1);
}

#[tokio::test]
async fn test_student_accessing_cockpit_endpoint_returns_403_forbidden() {
    let state = AppState::new_test();
    let assessment_id = Uuid::new_v4();

    let app = create_router(state);
    let student_token = generate_test_token(&Uuid::new_v4().to_string(), "student");

    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/campus/assessments/{assessment_id}/cockpit"))
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let problem: ProblemDetails = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(problem.status, 403);
    assert_eq!(problem.r#type, "urn:problem-type:forbidden");
}

#[tokio::test]
async fn test_viva_escalation_successfully_provisions_new_room_record() {
    let state = AppState::new_test();
    let app = create_router(state.clone());
    let instructor_id = Uuid::new_v4();
    let instructor_token = generate_test_token(&instructor_id.to_string(), "instructor");

    let (_org_id, _cohort_id, assessment_id) =
        setup_test_assessment(&app, &instructor_token).await;

    let candidate_id = Uuid::new_v4();
    let payload = ProvisionVivaRequest {
        candidate_user_id: candidate_id,
        language: Some("cpp".to_string()),
        problem_slug: None,
    };

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/v1/campus/assessments/{assessment_id}/viva/provision"
        ))
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let provision_resp: ProvisionVivaResponse = serde_json::from_slice(&bytes).unwrap();

    assert!(provision_resp.room_code.starts_with("VIVA-"));
    assert_eq!(provision_resp.assessment_id, Some(assessment_id));
    assert_eq!(provision_resp.host_user_id, instructor_id);
    assert_eq!(provision_resp.candidate_user_id, Some(candidate_id));
    assert_eq!(provision_resp.language, "cpp");
    assert_eq!(provision_resp.status, "waiting");

    // Verify interview room record stored in mock state
    let rooms = state.mock_campus.interview_rooms.read().await;
    let room = rooms
        .get(&provision_resp.room_code)
        .expect("room should exist in mock campus state");
    assert_eq!(room.id, provision_resp.id);
    assert_eq!(room.candidate_user_id, Some(candidate_id));
    assert_eq!(room.language, "cpp");
}

#[tokio::test]
async fn test_private_rubric_endpoint_permits_instructor_and_rejects_candidates() {
    let state = AppState::new_test();
    let room_code = "VIVA-TEST-RUBRIC-01".to_string();
    let now = Utc::now();

    let record = InterviewRoomRecord {
        id: Uuid::new_v4(),
        room_code: room_code.clone(),
        org_id: Some(Uuid::new_v4()),
        assessment_id: Some(Uuid::new_v4()),
        host_user_id: Uuid::new_v4(),
        candidate_user_id: Some(Uuid::new_v4()),
        language: "python".to_string(),
        status: "active".to_string(),
        editor_code: "def solve(): pass".to_string(),
        interviewer_notes: "Initial confidential baseline".to_string(),
        rubric_scores: serde_json::json!({ "correctness": 20.0 }),
        created_at: now,
        updated_at: now,
    };
    state
        .mock_campus
        .interview_rooms
        .write()
        .await
        .insert(room_code.clone(), record);

    let student_token = generate_test_token(&Uuid::new_v4().to_string(), "student");
    let instructor_token = generate_test_token(&Uuid::new_v4().to_string(), "instructor");

    // 1. Candidate attempts GET rubric -> 403 Forbidden
    let app = create_router(state.clone());
    let get_req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/campus/viva/{room_code}/rubric"))
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .body(Body::empty())
        .unwrap();
    let get_resp = app.oneshot(get_req).await.unwrap();
    assert_eq!(get_resp.status(), StatusCode::FORBIDDEN);

    // 2. Candidate attempts PATCH rubric -> 403 Forbidden
    let app = create_router(state.clone());
    let patch_payload = UpdateVivaRubricRequest {
        rubric_scores: serde_json::json!({ "correctness": 100.0 }),
        interviewer_notes: Some("Hacked score".to_string()),
        criteria: None,
    };
    let patch_req = Request::builder()
        .method("PATCH")
        .uri(format!("/api/v1/campus/viva/{room_code}/rubric"))
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&patch_payload).unwrap()))
        .unwrap();
    let patch_resp = app.oneshot(patch_req).await.unwrap();
    assert_eq!(patch_resp.status(), StatusCode::FORBIDDEN);

    // 3. Instructor performs GET rubric -> 200 OK
    let app = create_router(state.clone());
    let inst_get_req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/campus/viva/{room_code}/rubric"))
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .body(Body::empty())
        .unwrap();
    let inst_get_resp = app.oneshot(inst_get_req).await.unwrap();
    assert_eq!(inst_get_resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(inst_get_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let rubric_resp: VivaRubricResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(rubric_resp.room_code, room_code);
    assert_eq!(
        rubric_resp.interviewer_notes,
        "Initial confidential baseline"
    );

    // 4. Instructor updates rubric with valid criteria (weights sum to 100.0%) -> 200 OK
    let crit1 = RubricCriterion {
        id: Uuid::new_v4(),
        name: "Code Correctness".to_string(),
        weight: 60.0,
        max_points: 100.0,
    };
    let crit2 = RubricCriterion {
        id: Uuid::new_v4(),
        name: "Code Complexity".to_string(),
        weight: 40.0,
        max_points: 100.0,
    };

    let valid_patch_payload = UpdateVivaRubricRequest {
        rubric_scores: serde_json::json!({
            crit1.id.to_string(): 85.0,
            crit2.id.to_string(): 90.0,
        }),
        interviewer_notes: Some("Excellent complexity analysis by candidate.".to_string()),
        criteria: Some(vec![crit1.clone(), crit2.clone()]),
    };

    let app = create_router(state.clone());
    let valid_patch_req = Request::builder()
        .method("PATCH")
        .uri(format!("/api/v1/campus/viva/{room_code}/rubric"))
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&valid_patch_payload).unwrap()))
        .unwrap();
    let valid_patch_resp = app.oneshot(valid_patch_req).await.unwrap();
    assert_eq!(valid_patch_resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(valid_patch_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let updated_rubric: VivaRubricResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(
        updated_rubric.interviewer_notes,
        "Excellent complexity analysis by candidate."
    );
    assert_eq!(
        updated_rubric.rubric_scores[crit1.id.to_string()],
        85.0
    );

    // 5. Instructor attempts update with UNBALANCED criteria (weights sum to 80.0%) -> 400 Bad Request
    let unbalanced_criteria = vec![
        RubricCriterion {
            id: Uuid::new_v4(),
            name: "Criterion 1".to_string(),
            weight: 50.0,
            max_points: 100.0,
        },
        RubricCriterion {
            id: Uuid::new_v4(),
            name: "Criterion 2".to_string(),
            weight: 30.0, // 50 + 30 = 80.0 != 100.0
            max_points: 100.0,
        },
    ];

    let unbalanced_patch_payload = UpdateVivaRubricRequest {
        rubric_scores: serde_json::json!({ "some_key": 10.0 }),
        interviewer_notes: Some("Test notes".to_string()),
        criteria: Some(unbalanced_criteria),
    };

    let app = create_router(state);
    let unbal_req = Request::builder()
        .method("PATCH")
        .uri(format!("/api/v1/campus/viva/{room_code}/rubric"))
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::to_vec(&unbalanced_patch_payload).unwrap(),
        ))
        .unwrap();
    let unbal_resp = app.oneshot(unbal_req).await.unwrap();
    assert_eq!(unbal_resp.status(), StatusCode::BAD_REQUEST);

    let bytes = axum::body::to_bytes(unbal_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let problem: ProblemDetails = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(problem.status, 400);
    assert_eq!(problem.title, "Unbalanced Rubric Weights");
}

#[tokio::test]
async fn test_live_postgres_cockpit_and_viva_if_available() {
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
        judge_gateway::TokenStore::new_in_memory(),
        None,
    );
    let app = create_router(state);

    let instructor_id = Uuid::new_v4();
    let instructor_token = generate_test_token(&instructor_id.to_string(), "instructor");

    // Insert instructor user
    let _ = sqlx::query(
        r"
        INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at)
        VALUES ($1, $2, $3, 'dummy_hash', 'campus', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
        ",
    )
    .bind(instructor_id)
    .bind(format!("inst_{}", &instructor_id.to_string()[..8]))
    .bind(format!("inst_{}@campus.edu", &instructor_id.to_string()[..8]))
    .execute(pool.inner())
    .await;

    let (_org_id, _cohort_id, assessment_id) =
        setup_test_assessment(&app, &instructor_token).await;

    // Test GET cockpit against live database
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/campus/assessments/{assessment_id}/cockpit"))
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .body(Body::empty())
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    // Test POST viva provision against live database
    let candidate_id = Uuid::new_v4();
    let _ = sqlx::query(
        r"
        INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at)
        VALUES ($1, $2, $3, 'dummy_hash', 'free', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
        ",
    )
    .bind(candidate_id)
    .bind(format!("cand_{}", &candidate_id.to_string()[..8]))
    .bind(format!("cand_{}@campus.edu", &candidate_id.to_string()[..8]))
    .execute(pool.inner())
    .await;

    let prov_req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/v1/campus/assessments/{assessment_id}/viva/provision"
        ))
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::to_vec(&ProvisionVivaRequest {
                candidate_user_id: candidate_id,
                language: Some("java".to_string()),
                problem_slug: Some("viva-two-sum".to_string()),
            })
            .unwrap(),
        ))
        .unwrap();

    let prov_resp = app.clone().oneshot(prov_req).await.unwrap();
    let status = prov_resp.status();
    let bytes = axum::body::to_bytes(prov_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    assert_eq!(
        status,
        StatusCode::CREATED,
        "Body: {}",
        String::from_utf8_lossy(&bytes)
    );
    let provision_resp: ProvisionVivaResponse = serde_json::from_slice(&bytes).unwrap();
    assert!(provision_resp.room_code.starts_with("VIVA-"));

    // Clean up
    let _ = sqlx::query("DELETE FROM interview_rooms WHERE room_code = $1")
        .bind(&provision_resp.room_code)
        .execute(pool.inner())
        .await;
    let _ = sqlx::query("DELETE FROM assessments WHERE id = $1")
        .bind(assessment_id)
        .execute(pool.inner())
        .await;
}

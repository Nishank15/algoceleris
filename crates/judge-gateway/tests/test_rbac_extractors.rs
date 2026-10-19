#![allow(clippy::too_many_lines)]

use axum::body::Body;
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use axum::http::{Request, StatusCode};
use judge_gateway::auth::{encode_access_token, DEFAULT_JWT_SECRET};
use judge_gateway::create_router;
use judge_gateway::errors::ProblemDetails;
use judge_gateway::routes::{
    BatchIngestResponse, CohortResponse, OrganizationResponse, RosterMemberResponse,
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

#[tokio::test]
async fn test_unauthenticated_request_returns_401() {
    let state = AppState::new_test();
    let app = create_router(state);

    let org_id = Uuid::new_v4();
    let req = Request::builder()
        .uri(format!("/api/v1/campus/orgs/{org_id}"))
        .body(Body::empty())
        .expect("failed to build request");

    let resp = app.oneshot(req).await.expect("failed to execute request");
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .expect("failed to read body");
    let problem: ProblemDetails =
        serde_json::from_slice(&bytes).expect("failed to parse problem details");

    assert_eq!(problem.status, 401);
    assert_eq!(problem.r#type, "urn:problem-type:unauthorized");
}

#[tokio::test]
async fn test_student_attempting_instructor_action_returns_403() {
    let state = AppState::new_test();
    let app = create_router(state);

    let student_id = Uuid::new_v4().to_string();
    let student_token = generate_test_token(&student_id, "student");

    let cohort_id = Uuid::new_v4();
    let req = Request::builder()
        .uri(format!("/api/v1/campus/cohorts/{cohort_id}/roster"))
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .body(Body::empty())
        .expect("failed to build request");

    let resp = app.oneshot(req).await.expect("failed to execute request");
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .expect("failed to read body");
    let problem: ProblemDetails =
        serde_json::from_slice(&bytes).expect("failed to parse problem details");

    assert_eq!(problem.status, 403);
    assert_eq!(problem.r#type, "urn:problem-type:forbidden");
    assert!(problem.detail.contains("Required role instructor"));
}

#[tokio::test]
async fn test_org_admin_creates_cohort_and_batch_roster_and_instructor_reads() {
    let state = AppState::new_test();
    let app = create_router(state);

    let admin_id = Uuid::new_v4().to_string();
    let admin_token = generate_test_token(&admin_id, "org_admin");

    // 1. OrgAdmin creates Organization
    let create_org_payload = serde_json::json!({
        "name": "School of Computer Science",
        "slug": "scs-campus",
        "domain_whitelist": ["campus.edu", "university.ac.in"],
        "branding_config": { "accent": "#e4f222" }
    });
    let org_req = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/orgs")
        .header(AUTHORIZATION, format!("Bearer {admin_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(create_org_payload.to_string()))
        .expect("failed to build org request");

    let org_resp = app
        .clone()
        .oneshot(org_req)
        .await
        .expect("failed to create org");
    assert_eq!(org_resp.status(), StatusCode::CREATED);

    let org_bytes = axum::body::to_bytes(org_resp.into_body(), usize::MAX)
        .await
        .expect("failed to read org body");
    let org: OrganizationResponse =
        serde_json::from_slice(&org_bytes).expect("failed to deserialize OrganizationResponse");
    assert_eq!(org.slug, "scs-campus");
    assert_eq!(org.domain_whitelist, vec!["campus.edu", "university.ac.in"]);

    // 2. OrgAdmin creates Cohort within Organization
    let create_cohort_payload = serde_json::json!({
        "name": "Advanced Algorithms 2026",
        "code": "CS-401-2026",
        "term": "Spring 2026",
        "is_active": true
    });
    let cohort_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/orgs/{}/cohorts", org.id))
        .header(AUTHORIZATION, format!("Bearer {admin_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(create_cohort_payload.to_string()))
        .expect("failed to build cohort request");

    let cohort_resp = app
        .clone()
        .oneshot(cohort_req)
        .await
        .expect("failed to create cohort");
    assert_eq!(cohort_resp.status(), StatusCode::CREATED);

    let cohort_bytes = axum::body::to_bytes(cohort_resp.into_body(), usize::MAX)
        .await
        .expect("failed to read cohort body");
    let cohort: CohortResponse =
        serde_json::from_slice(&cohort_bytes).expect("failed to deserialize CohortResponse");
    assert_eq!(cohort.code, "CS-401-2026");
    assert_eq!(cohort.org_id, org.id);

    // 3. OrgAdmin executes Batch Roster Ingestion
    let batch_payload = serde_json::json!({
        "cohort_id": cohort.id,
        "members": [
            {
                "email": "student1@campus.edu",
                "username": "student_one",
                "role": "student"
            },
            {
                "email": "student2@university.ac.in",
                "username": "student_two",
                "role": "student"
            }
        ]
    });
    let batch_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/campus/orgs/{}/members/batch", org.id))
        .header(AUTHORIZATION, format!("Bearer {admin_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(batch_payload.to_string()))
        .expect("failed to build batch request");

    let batch_resp = app
        .clone()
        .oneshot(batch_req)
        .await
        .expect("failed to batch ingest");
    assert_eq!(batch_resp.status(), StatusCode::OK);

    let batch_bytes = axum::body::to_bytes(batch_resp.into_body(), usize::MAX)
        .await
        .expect("failed to read batch body");
    let batch: BatchIngestResponse =
        serde_json::from_slice(&batch_bytes).expect("failed to deserialize BatchIngestResponse");
    assert_eq!(batch.imported_count, 2);
    assert_eq!(batch.members.len(), 2);

    // 4. Instructor accesses Cohort Roster successfully (200 OK)
    let instructor_id = Uuid::new_v4().to_string();
    let instructor_token = generate_test_token(&instructor_id, "instructor");

    let roster_req = Request::builder()
        .uri(format!("/api/v1/campus/cohorts/{}/roster", cohort.id))
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .body(Body::empty())
        .expect("failed to build roster request");

    let roster_resp = app
        .clone()
        .oneshot(roster_req)
        .await
        .expect("failed to get roster");
    assert_eq!(roster_resp.status(), StatusCode::OK);

    let roster_bytes = axum::body::to_bytes(roster_resp.into_body(), usize::MAX)
        .await
        .expect("failed to read roster body");
    let roster: Vec<RosterMemberResponse> =
        serde_json::from_slice(&roster_bytes).expect("failed to deserialize roster");
    assert_eq!(roster.len(), 2);
    assert!(roster.iter().any(|m| m.email == "student1@campus.edu"));
    assert!(roster
        .iter()
        .any(|m| m.email == "student2@university.ac.in"));

    // 5. Enforce Student accessing organization details
    let student_token = generate_test_token(&Uuid::new_v4().to_string(), "student");
    let get_org_req = Request::builder()
        .uri(format!("/api/v1/campus/orgs/{}", org.id))
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .body(Body::empty())
        .expect("failed to build get org request");

    let get_org_resp = app.oneshot(get_org_req).await.expect("failed to get org");
    assert_eq!(get_org_resp.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_live_postgres_rbac_and_batch_ingest() {
    let db_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://postgres:postgres@localhost:5432/cloud_judge".to_string()
    });

    if let Ok(pool) = judge_db::create_connection_pool(&db_url, 5).await {
        let state = AppState::new(
            Some(pool.clone()),
            judge_gateway::auth::TokenStore::new_in_memory(),
            None,
        );
        let app = create_router(state);

        let admin_id = Uuid::new_v4();
        // Insert admin user into PostgreSQL
        sqlx::query(
            r"
            INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at)
            VALUES ($1, $2, $3, 'dummy_hash', 'free', NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            ",
        )
        .bind(admin_id)
        .bind(format!("admin_{}", &admin_id.to_string()[..8]))
        .bind(format!("admin_{}@campus.edu", &admin_id.to_string()[..8]))
        .execute(pool.inner())
        .await
        .expect("Failed to insert test admin user into users table");

        let admin_token = generate_test_token(&admin_id.to_string(), "org_admin");

        // 1. Create Organization in live PostgreSQL
        let slug = format!("live-org-{}", &Uuid::new_v4().to_string()[..8]);
        let create_org_payload = serde_json::json!({
            "name": "Live Faculty",
            "slug": slug,
            "domain_whitelist": ["campus.edu"]
        });
        let org_req = Request::builder()
            .method("POST")
            .uri("/api/v1/campus/orgs")
            .header(AUTHORIZATION, format!("Bearer {admin_token}"))
            .header(CONTENT_TYPE, "application/json")
            .body(Body::from(create_org_payload.to_string()))
            .unwrap();

        let org_resp = app.clone().oneshot(org_req).await.unwrap();
        let status = org_resp.status();
        let org_bytes = axum::body::to_bytes(org_resp.into_body(), usize::MAX)
            .await
            .unwrap();
        if status != StatusCode::CREATED {
            let body_str = String::from_utf8_lossy(&org_bytes);
            panic!("Expected 201 CREATED, got {status}: {body_str}");
        }
        let org: OrganizationResponse = serde_json::from_slice(&org_bytes).unwrap();

        // 2. Create Cohort in live PostgreSQL
        let cohort_code = format!("CODE-{}", &Uuid::new_v4().to_string()[..6]);
        let cohort_payload = serde_json::json!({
            "name": "Live Cohort",
            "code": cohort_code,
            "term": "Fall 2026"
        });
        let cohort_req = Request::builder()
            .method("POST")
            .uri(format!("/api/v1/campus/orgs/{}/cohorts", org.id))
            .header(AUTHORIZATION, format!("Bearer {admin_token}"))
            .header(CONTENT_TYPE, "application/json")
            .body(Body::from(cohort_payload.to_string()))
            .unwrap();

        let cohort_resp = app.clone().oneshot(cohort_req).await.unwrap();
        assert_eq!(cohort_resp.status(), StatusCode::CREATED);

        let cohort_bytes = axum::body::to_bytes(cohort_resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let cohort: CohortResponse = serde_json::from_slice(&cohort_bytes).unwrap();

        // 3. Batch Ingest student into live PostgreSQL
        let student_email = format!("student_{}@campus.edu", &Uuid::new_v4().to_string()[..8]);
        let batch_payload = serde_json::json!({
            "cohort_id": cohort.id,
            "members": [
                {
                    "email": student_email,
                    "role": "student"
                }
            ]
        });
        let batch_req = Request::builder()
            .method("POST")
            .uri(format!("/api/v1/campus/orgs/{}/members/batch", org.id))
            .header(AUTHORIZATION, format!("Bearer {admin_token}"))
            .header(CONTENT_TYPE, "application/json")
            .body(Body::from(batch_payload.to_string()))
            .unwrap();

        let batch_resp = app.clone().oneshot(batch_req).await.unwrap();
        assert_eq!(batch_resp.status(), StatusCode::OK);

        // 4. Cleanup test records
        let _ = sqlx::query("DELETE FROM org_memberships WHERE org_id = $1")
            .bind(org.id)
            .execute(pool.inner())
            .await;
        let _ = sqlx::query("DELETE FROM cohorts WHERE org_id = $1")
            .bind(org.id)
            .execute(pool.inner())
            .await;
        let _ = sqlx::query("DELETE FROM organizations WHERE id = $1")
            .bind(org.id)
            .execute(pool.inner())
            .await;
        let _ = sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(admin_id)
            .execute(pool.inner())
            .await;
    }
}

#[tokio::test]
async fn test_phase36_student_cannot_create_lab_or_view_audit() {
    let state = AppState::new_test();
    let app = create_router(state);

    let student_id = Uuid::new_v4().to_string();
    let student_token = generate_test_token(&student_id, "student");

    // 1. Student attempting POST /api/v1/campus/vit-chennai/labs -> 403 Forbidden
    let create_lab_payload = serde_json::json!({
        "title": "Unauthorized Lab",
        "course_code": "CS101",
        "course_name": "Intro to CS",
        "code": "lab-unauth",
        "deadline": "2026-12-31T23:59:59Z",
        "duration_minutes": 60,
        "max_marks": 100.0,
        "clo": "CLO-1",
        "description": "Student should not be able to create this lab"
    });

    let lab_req = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/vit-chennai/labs")
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(create_lab_payload.to_string()))
        .expect("failed to build lab request");

    let lab_resp = app.clone().oneshot(lab_req).await.expect("request failed");
    assert_eq!(lab_resp.status(), StatusCode::FORBIDDEN);

    let bytes = axum::body::to_bytes(lab_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let problem: ProblemDetails = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(problem.status, 403);
    assert_eq!(problem.r#type, "urn:problem-type:forbidden");
    assert!(problem.detail.contains("insufficient_campus_permissions"));
    assert!(problem.detail.contains("Required role instructor"));

    // 2. Student attempting GET /api/v1/campus/vit-chennai/admin/audit -> 403 Forbidden
    let audit_req = Request::builder()
        .method("GET")
        .uri("/api/v1/campus/vit-chennai/admin/audit")
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .body(Body::empty())
        .expect("failed to build audit request");

    let audit_resp = app
        .clone()
        .oneshot(audit_req)
        .await
        .expect("request failed");
    assert_eq!(audit_resp.status(), StatusCode::FORBIDDEN);

    let audit_bytes = axum::body::to_bytes(audit_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let audit_problem: ProblemDetails = serde_json::from_slice(&audit_bytes).unwrap();
    assert_eq!(audit_problem.status, 403);
    assert!(audit_problem
        .detail
        .contains("insufficient_campus_permissions"));
    assert!(audit_problem.detail.contains("Required role org_admin"));

    // 3. Student attempting POST /api/v1/campus/orgs/vit-chennai/roster -> 403 Forbidden
    let add_member_payload = serde_json::json!({
        "email": "hacker@campus.edu",
        "username": "hacker",
        "role": "org_admin"
    });

    let roster_req = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/orgs/vit-chennai/roster")
        .header(AUTHORIZATION, format!("Bearer {student_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(add_member_payload.to_string()))
        .expect("failed to build roster request");

    let roster_resp = app
        .clone()
        .oneshot(roster_req)
        .await
        .expect("request failed");
    assert_eq!(roster_resp.status(), StatusCode::FORBIDDEN);

    let roster_bytes = axum::body::to_bytes(roster_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let roster_problem: ProblemDetails = serde_json::from_slice(&roster_bytes).unwrap();
    assert_eq!(roster_problem.status, 403);
    assert!(roster_problem
        .detail
        .contains("insufficient_campus_permissions"));
    assert!(roster_problem.detail.contains("Required role org_admin"));
}

#[tokio::test]
async fn test_phase36_instructor_and_admin_tier_permissions() {
    let state = AppState::new_test();
    let app = create_router(state);

    let instructor_id = Uuid::new_v4().to_string();
    let instructor_token = generate_test_token(&instructor_id, "instructor");

    let admin_id = Uuid::new_v4().to_string();
    let admin_token = generate_test_token(&admin_id, "org_admin");

    // 1. Instructor can create lab -> 201 Created
    let create_lab_payload = serde_json::json!({
        "title": "Algorithms Lab 01",
        "course_code": "CS201",
        "course_name": "Data Structures",
        "code": "lab-01",
        "deadline": "2026-12-31T23:59:59Z",
        "duration_minutes": 90,
        "max_marks": 50.0,
        "clo": "CLO-2",
        "description": "Authorized instructor created lab"
    });

    let lab_req = Request::builder()
        .method("POST")
        .uri("/api/v1/campus/vit-chennai/labs")
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(create_lab_payload.to_string()))
        .expect("failed to build lab request");

    let lab_resp = app.clone().oneshot(lab_req).await.expect("request failed");
    assert_eq!(lab_resp.status(), StatusCode::CREATED);

    // 2. Instructor cannot view admin audit -> 403 Forbidden
    let audit_req_instructor = Request::builder()
        .method("GET")
        .uri("/api/v1/campus/vit-chennai/admin/audit")
        .header(AUTHORIZATION, format!("Bearer {instructor_token}"))
        .body(Body::empty())
        .expect("failed to build audit request");

    let audit_resp_instructor = app
        .clone()
        .oneshot(audit_req_instructor)
        .await
        .expect("request failed");
    assert_eq!(audit_resp_instructor.status(), StatusCode::FORBIDDEN);

    // 3. Admin can view admin audit -> 200 OK
    let audit_req_admin = Request::builder()
        .method("GET")
        .uri("/api/v1/campus/vit-chennai/admin/audit")
        .header(AUTHORIZATION, format!("Bearer {admin_token}"))
        .body(Body::empty())
        .expect("failed to build audit request");

    let audit_resp_admin = app
        .clone()
        .oneshot(audit_req_admin)
        .await
        .expect("request failed");
    assert_eq!(audit_resp_admin.status(), StatusCode::OK);
}

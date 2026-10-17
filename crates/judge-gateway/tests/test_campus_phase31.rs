//! Integration tests for Milestone v4.3 Phase 31: Multi-Tenant Campus Portal Endpoints.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use judge_gateway::create_router;
use judge_gateway::routes::{
    CampusLoginRequest, CampusLoginResponse, CampusOrgSummary, CampusProvisionRequest,
    CampusProvisionResponse, RosterMemberResponse,
};
use judge_gateway::state::AppState;
use tower::ServiceExt;

#[tokio::test]
async fn test_campus_phase31_complete_lifecycle() {
    let state = AppState::new_test();
    let app = create_router(state.clone());

    // 1. GET /api/v1/campus/orgs: Lists registered universities
    let req = Request::builder()
        .uri("/api/v1/campus/orgs")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let orgs: Vec<CampusOrgSummary> = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(orgs.len(), 3);

    let vit = orgs.iter().find(|o| o.slug == "vit-chennai").unwrap();
    assert_eq!(vit.name, "VIT Chennai");
    assert!(vit.student_count >= 1200);
    assert!(vit.domain_whitelist.contains(&"vitstudent.ac.in".to_string()));

    let iitm = orgs.iter().find(|o| o.slug == "iitm").unwrap();
    assert_eq!(iitm.name, "IIT Madras");

    // 2. POST /api/v1/campus/orgs/provision: Provision new university tenant
    let provision_payload = CampusProvisionRequest {
        org_name: "NIT Trichy".to_string(),
        org_slug: "nitt".to_string(),
        admin_name: "Dr. K. Swaminathan".to_string(),
        admin_email: "dean.academic@nitt.edu".to_string(),
        admin_password: Some("Trichy@2026".to_string()),
        tier: "Enterprise Campus".to_string(),
        allowed_domains: vec!["nitt.edu".to_string()],
        expected_students: Some(800),
        payment_ref: Some("PO-NIT-2026-001".to_string()),
    };

    let req = Request::builder()
        .uri("/api/v1/campus/orgs/provision")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&provision_payload).unwrap()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let prov_res: CampusProvisionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(prov_res.org_slug, "nitt");
    assert_eq!(prov_res.admin_email, "dean.academic@nitt.edu");
    assert!(!prov_res.access_token.is_empty(), "Must return real JWT token");
    assert_eq!(prov_res.user.role, "org_admin");

    // Re-verify that nitt appears in the catalog
    let req = Request::builder()
        .uri("/api/v1/campus/orgs")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let orgs_updated: Vec<CampusOrgSummary> = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(orgs_updated.len(), 4);
    assert!(orgs_updated.iter().any(|o| o.slug == "nitt"));

    // 3. POST /api/v1/campus/auth/login: Authenticate against vit-chennai
    // 3a. Student login with Registration Number
    let student_login = CampusLoginRequest {
        org_slug: "vit-chennai".to_string(),
        identifier: "25BAI1234".to_string(),
        password: "Campus@2026".to_string(),
        role: "student".to_string(),
    };

    let req = Request::builder()
        .uri("/api/v1/campus/auth/login")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&student_login).unwrap()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let login_res: CampusLoginResponse = serde_json::from_slice(&bytes).unwrap();
    assert!(!login_res.access_token.is_empty());
    assert_eq!(login_res.user.role, "student");
    assert_eq!(login_res.user.reg_number, "25BAI1234");
    assert_eq!(login_res.user.org_slug, "vit-chennai");

    // 3b. Faculty login with Faculty ID
    let faculty_login = CampusLoginRequest {
        org_slug: "vit-chennai".to_string(),
        identifier: "FAC-9842".to_string(),
        password: "Campus@2026".to_string(),
        role: "faculty".to_string(),
    };

    let req = Request::builder()
        .uri("/api/v1/campus/auth/login")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&faculty_login).unwrap()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let login_res: CampusLoginResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(login_res.user.role, "faculty");
    assert_eq!(login_res.user.reg_number, "FAC-9842");

    // 4. GET & POST /api/v1/campus/orgs/{org_slug}/roster
    let req = Request::builder()
        .uri("/api/v1/campus/orgs/vit-chennai/roster?role=student")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let roster: Vec<RosterMemberResponse> = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(roster.len(), 3);
    assert!(roster.iter().all(|m| m.role == "student"));

    // Add new member to roster
    let new_member = serde_json::json!({
        "email": "divya.nair2025@vitstudent.ac.in",
        "username": "divyanair",
        "role": "student",
        "reg_number": "25BCE1999"
    });

    let req = Request::builder()
        .uri("/api/v1/campus/orgs/vit-chennai/roster")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&new_member).unwrap()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let created_member: RosterMemberResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(created_member.email, "divya.nair2025@vitstudent.ac.in");

    // Verify roster length increased to 4
    let req = Request::builder()
        .uri("/api/v1/campus/orgs/vit-chennai/roster?role=student")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let roster_after: Vec<RosterMemberResponse> = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(roster_after.len(), 4);
}

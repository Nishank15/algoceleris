//! Integration tests for Milestone v4.3 Hackathon Platform endpoints and dynamic state persistence.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use judge_gateway::create_router;
use judge_gateway::routes::{
    HackathonDetailResponse, HackathonRegisterResponse, HackathonSubmissionResponse,
    HackathonSummary, HackathonTeamResponse, HackathonUpvoteResponse,
};
use judge_gateway::state::AppState;
use tower::ServiceExt;

#[tokio::test]
async fn test_hackathons_catalog_and_dynamic_lifecycle() {
    let state = AppState::new_test();
    let app = create_router(state.clone());

    // 1. List hackathons
    let req = Request::builder()
        .uri("/api/v1/hackathons")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let hackathons: Vec<HackathonSummary> = serde_json::from_slice(&bytes).unwrap();
    assert!(!hackathons.is_empty());

    let devshouse = hackathons
        .iter()
        .find(|h| h.slug == "devshouse-26")
        .expect("DevsHouse '26 must exist");
    assert_eq!(devshouse.registered_count, 1420);
    assert!(devshouse.is_flagship);

    // 2. Get detail
    let req = Request::builder()
        .uri("/api/v1/hackathons/devshouse-26")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let detail: HackathonDetailResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(detail.title, "DevsHouse '26");
    assert_eq!(detail.teams.len(), 3);
    assert_eq!(detail.matchmaking.len(), 4);
    assert_eq!(detail.showcase.len(), 2);

    // 3. Register user
    let reg_payload = serde_json::json!({
        "participant_name": "Aayush Sharma",
        "email": "aayush.s@vitstudent.ac.in",
        "university_or_org": "VIT Chennai",
        "track_preference": "Rust & High-Performance Systems"
    });

    let req = Request::builder()
        .uri("/api/v1/hackathons/devshouse-26/register")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&reg_payload).unwrap()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let reg_res: HackathonRegisterResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(reg_res.status, "CONFIRMED");
    assert_eq!(reg_res.registered_count, 1421);

    // 4. Create team (generates 6-character code)
    let team_payload = serde_json::json!({
        "action": "create",
        "team_name": "KernelPanik",
        "member_name": "Aayush Sharma",
        "member_email": "aayush.s@vitstudent.ac.in",
        "track": "Rust & High-Performance Systems"
    });

    let req = Request::builder()
        .uri("/api/v1/hackathons/devshouse-26/teams")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&team_payload).unwrap()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let team_res: HackathonTeamResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(team_res.team_name, "KernelPanik");
    assert_eq!(team_res.invite_code.len(), 6);
    let created_code = team_res.invite_code.clone();

    // 5. Join team using the generated 6-character code
    let join_payload = serde_json::json!({
        "action": "join",
        "invite_code": created_code,
        "member_name": "Karthik R",
        "member_email": "karthik.r@vitstudent.ac.in"
    });

    let req = Request::builder()
        .uri("/api/v1/hackathons/devshouse-26/teams")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&join_payload).unwrap()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let join_res: HackathonTeamResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(join_res.members_count, 2);

    // 6. Submit final project
    let sub_payload = serde_json::json!({
        "project_title": "AetherKV",
        "tagline": "Lock-free persistent key-value store with seccomp sandbox",
        "track": "Rust & High-Performance Systems",
        "team_name": "KernelPanik",
        "github_url": "https://github.com/aayush/aether-kv",
        "live_url": "https://aether.algoceleris.dev"
    });

    let req = Request::builder()
        .uri("/api/v1/hackathons/devshouse-26/submissions")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&sub_payload).unwrap()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let sub_res: HackathonSubmissionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(sub_res.project_title, "AetherKV");
    let project_id = sub_res.project_id.clone();

    // 7. Upvote the project
    let req = Request::builder()
        .uri(format!(
            "/api/v1/hackathons/devshouse-26/submissions/{}/upvote",
            project_id
        ))
        .method("POST")
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let upvote_res: HackathonUpvoteResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(upvote_res.upvotes, 2); // 1 initial + 1 upvote

    // 8. Re-fetch detail and verify complete dynamic synchronization
    let req = Request::builder()
        .uri("/api/v1/hackathons/devshouse-26")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let updated_detail: HackathonDetailResponse = serde_json::from_slice(&bytes).unwrap();

    // Dynamically incremented registered count: 1420 + 1 = 1421
    assert_eq!(updated_detail.registered_count, 1421);
    // Team count: 3 initial + 1 new = 4
    assert_eq!(updated_detail.teams.len(), 4);
    // Showcase items: 2 initial + 1 new = 3
    assert_eq!(updated_detail.showcase.len(), 3);

    let submitted_item = updated_detail
        .showcase
        .iter()
        .find(|item| item.id == project_id)
        .expect("Submitted project must be in showcase");
    assert_eq!(submitted_item.project_title, "AetherKV");
    assert_eq!(submitted_item.upvotes, 2);
}

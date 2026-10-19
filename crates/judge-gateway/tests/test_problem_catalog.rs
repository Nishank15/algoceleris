//! Server-authoritative problem catalog and test-case ingestion regression tests.

#![allow(
    clippy::too_many_lines,
    clippy::similar_names,
    clippy::manual_let_else,
    clippy::single_match_else
)]

use axum::body::Body;
use axum::http::header::CONTENT_TYPE;
use axum::http::{Request, StatusCode};
use judge_gateway::create_router;
use judge_gateway::routes::{Problem, SubmitCodeRequest, SubmitCodeResponse};
use judge_gateway::state::AppState;
use tower::ServiceExt;

/// Hidden inputs must never appear in any public response.
const TWO_SUM_HIDDEN_INPUTS: [&str; 2] = ["5\n1 5 3 7 9\n12", "6\n-3 4 3 90 2 1\n0"];

fn submit_payload(problem_slug: &str, mode: Option<&str>, custom_input: Option<&str>) -> Vec<u8> {
    let payload = SubmitCodeRequest {
        problem_slug: Some(problem_slug.to_string()),
        language: "python".to_string(),
        code: Some("print('hi')".to_string()),
        source_code: None,
        custom_input: custom_input.map(str::to_string),
        test_cases: Some(serde_json::json!([
            {
                "id": 1,
                "input_data": "CHEAT-INPUT",
                "expected_output": "CHEATED",
                "is_sample": true
            }
        ])),
        mode: mode.map(str::to_string),
        time_limit_ms: None,
        memory_limit_bytes: None,
        assessment_id: None,
    };
    serde_json::to_vec(&payload).unwrap()
}

async fn decode_json<T: serde::de::DeserializeOwned>(resp: axum::response::Response) -> T {
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

#[tokio::test]
async fn test_problem_catalog_serves_sample_cases_only() {
    let state = AppState::new_test();
    let app = create_router(state);

    // 1. List endpoint returns the full catalog with sample cases only.
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/problems")
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let raw_body = String::from_utf8(bytes.to_vec()).unwrap();
    let problems: Vec<Problem> = serde_json::from_slice(&bytes).unwrap();

    assert_eq!(
        problems.len(),
        12,
        "catalog must expose every seeded problem"
    );
    for problem in &problems {
        assert!(
            !problem.sample_cases.is_empty(),
            "{} must expose its sample cases",
            problem.id
        );
        assert!(
            problem.sample_cases.iter().all(|case| case.is_sample),
            "{} must only expose sample cases",
            problem.id
        );
    }
    for hidden in TWO_SUM_HIDDEN_INPUTS {
        assert!(
            !raw_body.contains(hidden),
            "hidden input leaked into the public catalog: {hidden:?}"
        );
    }

    // 2. Single-problem endpoint hydrates the workspace.
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/problems/two-sum")
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let raw_body = String::from_utf8(bytes.to_vec()).unwrap();
    let problem: Problem = serde_json::from_slice(&bytes).unwrap();

    assert_eq!(problem.id, "two-sum");
    assert_eq!(problem.title, "1. Two Sum");
    assert_eq!(problem.difficulty, "Easy");
    assert_eq!(problem.sample_cases.len(), 3);
    assert_eq!(problem.sample_cases[0].input_data, "4\n2 7 11 15\n9");
    assert_eq!(problem.sample_cases[0].expected_output, "0 1");
    assert_eq!(problem.time_limit_ms, 2000);
    assert_eq!(problem.memory_limit_bytes, 268_435_456);
    for hidden in TWO_SUM_HIDDEN_INPUTS {
        assert!(
            !raw_body.contains(hidden),
            "hidden input leaked into the single-problem response: {hidden:?}"
        );
    }

    // 3. Unknown slugs stay 404.
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/problems/not-a-problem")
        .body(Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_submission_ignores_client_supplied_test_cases() {
    let state = AppState::new_test();
    let app = create_router(state.clone());

    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/submissions")
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(submit_payload("two-sum", None, None)))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);
    let _: SubmitCodeResponse = decode_json(resp).await;

    let queue = state.mock_campus.submission_queue.read().await;
    assert_eq!(queue.len(), 1);
    let queued = &queue[0];
    let cases = queued["test_cases"]
        .as_array()
        .expect("queued job carries cases");

    // Full submissions receive every server-stored case: 3 samples + 2 hidden.
    assert_eq!(cases.len(), 5, "grading must use the server case list");
    assert!(cases.iter().all(|case| case["input_data"] != "CHEAT-INPUT"));
    assert!(cases
        .iter()
        .all(|case| case["expected_output"] != "CHEATED"));
    assert_eq!(cases[3]["input_data"], TWO_SUM_HIDDEN_INPUTS[0]);
    assert_eq!(cases[3]["is_sample"], false);
    assert_eq!(cases[4]["input_data"], TWO_SUM_HIDDEN_INPUTS[1]);
    assert_eq!(queued["code"], "print('hi')");
}

#[tokio::test]
async fn test_submission_mode_and_custom_input_scope_case_list() {
    // 1. `mode: run` grades public sample cases only.
    let state = AppState::new_test();
    let app = create_router(state.clone());
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/submissions")
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(submit_payload("two-sum", Some("run"), None)))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);

    {
        let queue = state.mock_campus.submission_queue.read().await;
        let cases = queue[0]["test_cases"].as_array().unwrap();
        assert_eq!(cases.len(), 3, "sample runs must stop at the sample cases");
        assert!(cases.iter().all(|case| case["is_sample"] == true));
    }

    // 2. An explicit ad-hoc input replaces the catalog for that run.
    let state = AppState::new_test();
    let app = create_router(state.clone());
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/submissions")
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(submit_payload(
            "two-sum",
            Some("run"),
            Some("1\n2 3\n5"),
        )))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);

    let queue = state.mock_campus.submission_queue.read().await;
    let cases = queue[0]["test_cases"].as_array().unwrap();
    assert_eq!(cases.len(), 1);
    assert_eq!(cases[0]["input_data"], "1\n2 3\n5");
    assert_eq!(cases[0]["expected_output"], "");
}

#[tokio::test]
async fn test_live_postgres_problem_catalog_is_seeded_and_authoritative() {
    let db_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://postgres:postgres@localhost:5432/cloud_judge".to_string()
    });

    let pool = match judge_db::create_connection_pool(&db_url, 5).await {
        Ok(p) => p,
        Err(_) => {
            eprintln!("PostgreSQL not reachable; skipping live problem catalog test");
            return;
        }
    };

    // Seed through the same startup path the gateway uses.
    judge_gateway::routes::problems::init_problem_catalog(pool.inner())
        .await
        .expect("problem catalog initialization must succeed");

    let state = AppState::new(
        Some(pool.clone()),
        judge_gateway::TokenStore::new_in_memory(),
        None,
    );
    let app = create_router(state.clone());

    // 1. Public catalog is served from PostgreSQL and stays sample-only.
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/problems/two-sum")
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let raw_body = String::from_utf8(bytes.to_vec()).unwrap();
    let problem: Problem = serde_json::from_slice(&bytes).unwrap();

    let catalog_problem = judge_db::problem_catalog::find("two-sum").expect("catalog entry");
    assert_eq!(problem.title, catalog_problem.title);
    assert_eq!(problem.sample_cases.len(), 3);
    for hidden in TWO_SUM_HIDDEN_INPUTS {
        assert!(
            !raw_body.contains(hidden),
            "hidden input leaked from PostgreSQL: {hidden:?}"
        );
    }

    // 2. A forged submission is graded against the persisted cases instead.
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/submissions")
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(submit_payload("two-sum", None, None)))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);
    let submission: SubmitCodeResponse = decode_json(resp).await;

    {
        let queue = state.mock_campus.submission_queue.read().await;
        let queued = queue
            .iter()
            .find(|job| job["submission_id"] == submission.submission_id.to_string())
            .expect("submission job must be queued");
        let cases = queued["test_cases"].as_array().unwrap();
        assert_eq!(cases.len(), catalog_problem.cases.len());
        assert!(cases
            .iter()
            .all(|case| case["expected_output"] != "CHEATED"));

        // The persisted hidden cases are the same rows the catalog defines.
        let hidden = cases
            .iter()
            .filter(|case| case["is_sample"] == false)
            .collect::<Vec<_>>();
        assert_eq!(hidden.len(), 2);
        assert_eq!(hidden[0]["input_data"], TWO_SUM_HIDDEN_INPUTS[0]);
    }

    // Keep the live submissions history clean: the synthetic verification submission
    // has no owner and no user-visible meaning.
    let _ = sqlx::query("DELETE FROM submissions WHERE id = $1")
        .bind(submission.submission_id)
        .execute(pool.inner())
        .await;
}

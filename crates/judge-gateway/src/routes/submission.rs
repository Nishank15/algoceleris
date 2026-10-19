//! Code submission intake, Redis queue dispatch, live WebSocket streaming, and secret test suite masking.

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::http::header::AUTHORIZATION;
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Utc};
use futures_util::{SinkExt, StreamExt};
use judge_db::models::SubmissionRecord;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::token::decode_access_token;
use crate::errors::GatewayError;
use crate::extractors::{role_level, OptionalUser};
use crate::state::AppState;

/// Mask constant applied to secret institutional test vectors.
pub const SECRET_TEST_MASK: &str = "[SECRET TEST MASKED]";

/// Individual test case execution result representation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TestCaseResult {
    /// Unique test case index.
    pub test_case_id: u32,
    /// Whether this is a publicly visible sample case.
    pub is_sample: bool,
    /// Whether this is an institutional secret test case.
    pub is_secret: bool,
    /// Outcome verdict: `ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, etc.
    pub verdict: String,
    /// Execution runtime in milliseconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_ms: Option<u64>,
    /// Memory consumption in kilobytes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_kb: Option<u64>,
    /// Standard input vector (masked for secret cases).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input: Option<String>,
    /// Expected output (masked for secret cases).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_output: Option<String>,
    /// Program output (masked for secret cases).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual_output: Option<String>,
    /// Difference diagnostics (null for secret cases).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diff: Option<String>,
}

/// Masks secret test cases for students/candidates.
///
/// If `is_instructor` or `is_grades_released` is true, returns full unmasked test details.
/// For student queries during unreleased evaluation, replaces secret test `input`,
/// `expected_output`, and `actual_output` with `"[SECRET TEST MASKED]"`, and sets `diff` to `None`.
#[must_use]
pub fn mask_test_case_results(
    results: &[TestCaseResult],
    is_instructor: bool,
    is_grades_released: bool,
) -> Vec<TestCaseResult> {
    if is_instructor || is_grades_released {
        return results.to_vec();
    }

    results
        .iter()
        .map(|tc| {
            let mut masked = tc.clone();
            if tc.is_secret || !tc.is_sample {
                if masked.input.is_some() {
                    masked.input = Some(SECRET_TEST_MASK.to_string());
                }
                if masked.expected_output.is_some() {
                    masked.expected_output = Some(SECRET_TEST_MASK.to_string());
                }
                if masked.actual_output.is_some() {
                    masked.actual_output = Some(SECRET_TEST_MASK.to_string());
                }
                masked.diff = None;
            }
            masked
        })
        .collect()
}

/// Recursively masks secret test cases in dynamic JSON event structures.
#[must_use]
pub fn mask_test_case_json(
    val: &serde_json::Value,
    is_instructor: bool,
    is_grades_released: bool,
) -> serde_json::Value {
    if is_instructor || is_grades_released {
        return val.clone();
    }

    match val {
        serde_json::Value::Object(map) => {
            let is_secret = map
                .get("is_secret")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(false)
                || map
                    .get("is_sample")
                    .and_then(serde_json::Value::as_bool)
                    .is_some_and(|b| !b);

            let mut new_map = serde_json::Map::new();
            for (k, v) in map {
                if is_secret
                    && matches!(
                        k.as_str(),
                        "input"
                            | "input_data"
                            | "expected_output"
                            | "actual_output"
                            | "stdout"
                            | "stderr"
                    )
                {
                    new_map.insert(
                        k.clone(),
                        serde_json::Value::String(SECRET_TEST_MASK.to_string()),
                    );
                } else if is_secret && k == "diff" {
                    new_map.insert(k.clone(), serde_json::Value::Null);
                } else {
                    new_map.insert(
                        k.clone(),
                        mask_test_case_json(v, is_instructor, is_grades_released),
                    );
                }
            }
            serde_json::Value::Object(new_map)
        }
        serde_json::Value::Array(arr) => {
            let new_arr = arr
                .iter()
                .map(|item| mask_test_case_json(item, is_instructor, is_grades_released))
                .collect();
            serde_json::Value::Array(new_arr)
        }
        other => other.clone(),
    }
}

/// Server-authoritative test case injected into worker payloads and job records.
///
/// These are resolved from the problem catalog (PostgreSQL, or the in-memory catalog in
/// standalone mode) and can never be supplied by the browser.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ServerTestCase {
    /// 1-based position within the problem's case list.
    pub id: u32,
    /// Standard input fed to the candidate program.
    pub input_data: String,
    /// Expected standard output.
    pub expected_output: String,
    /// Whether the case is publicly visible as a sample.
    pub is_sample: bool,
}

/// Asynchronous evaluation job pushed to `submissions:queue`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmissionJob {
    /// Unique submission identifier.
    pub submission_id: Uuid,
    /// Submitting user UUID if authenticated.
    pub user_id: Option<Uuid>,
    /// Problem slug.
    pub problem_slug: String,
    /// Programming language (`cpp`, `python`, `java`).
    pub language: String,
    /// Source code.
    pub code: String,
    /// Server-authoritative test cases for this evaluation.
    #[serde(default)]
    pub test_cases: Vec<ServerTestCase>,
    /// Associated assessment UUID if institutional attempt.
    pub assessment_id: Option<Uuid>,
    /// Ingestion timestamp.
    pub submitted_at: DateTime<Utc>,
}

/// Request payload for submitting code.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitCodeRequest {
    /// Target problem slug.
    #[serde(alias = "problem_id", alias = "problemId", alias = "slug", default)]
    pub problem_slug: Option<String>,
    /// Target language (`cpp`, `python`, `java`).
    pub language: String,
    /// Source code string (max 64KB).
    #[serde(default)]
    pub code: Option<String>,
    /// Optional legacy alias for source code string.
    #[serde(alias = "sourceCode", default)]
    pub source_code: Option<String>,
    /// Optional custom test input for ad-hoc executions.
    #[serde(default)]
    pub custom_input: Option<String>,
    /// Legacy client-supplied test cases.
    ///
    /// Deliberately ignored: grading criteria are resolved server-side from the problem
    /// catalog. The field is still accepted so older clients keep parsing.
    #[serde(default)]
    pub test_cases: Option<serde_json::Value>,
    /// Evaluation scope: `run` grades only the problem's public sample cases, `submit`
    /// (the default) grades every server-stored case.
    #[serde(default)]
    pub mode: Option<String>,
    /// Optional time limit in ms.
    #[serde(default)]
    pub time_limit_ms: Option<u64>,
    /// Optional memory limit in bytes.
    #[serde(default)]
    pub memory_limit_bytes: Option<u64>,
    /// Optional assessment identifier if submitted under exam mode.
    #[serde(default)]
    pub assessment_id: Option<Uuid>,
}

impl SubmitCodeRequest {
    /// Returns extracted source code from `code` or `source_code`.
    #[must_use]
    pub fn get_code(&self) -> &str {
        self.code
            .as_deref()
            .or(self.source_code.as_deref())
            .unwrap_or("")
    }
}

/// Response payload following submission intake.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitCodeResponse {
    /// Generated submission UUID.
    pub submission_id: Uuid,
    /// Initial intake status (`PENDING`).
    pub status: String,
    /// Status message.
    pub message: String,
}

/// Detailed submission report with masked test case results.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetSubmissionResponse {
    /// Submission UUID.
    pub id: Uuid,
    /// Submitting user UUID if known.
    pub user_id: Option<Uuid>,
    /// Problem slug.
    pub problem_slug: String,
    /// Language.
    pub language: String,
    /// Overall verdict (`PENDING`, `ACCEPTED`, `WRONG_ANSWER`, etc.).
    pub verdict: String,
    /// Total execution runtime in ms.
    pub runtime_ms: i32,
    /// Memory consumption in KB.
    pub memory_kb: i32,
    /// Test cases passed.
    pub testcases_passed: i32,
    /// Total test cases evaluated.
    pub total_testcases: i32,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Associated assessment UUID.
    pub assessment_id: Option<Uuid>,
    /// Granular test case diagnostics (masked according to caller permissions).
    pub test_cases: Vec<TestCaseResult>,
    /// Full structured report object for frontend rendering.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub report: Option<serde_json::Value>,
}

/// Query parameters for WebSocket stream authentication.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct StreamParams {
    /// Optional JWT bearer token for WebSocket handshake.
    pub token: Option<String>,
}

/// Resolves the authoritative test cases for a submission.
///
/// The browser cannot influence verification criteria: cases always come from the
/// problem catalog, either from PostgreSQL or — when no database is attached — from the
/// in-memory canonical catalog. `sample_only` restricts grading to public sample cases
/// (used by "Run"), while full submissions receive every stored case, hidden ones
/// included. Unknown slugs fall back to the caller's ad-hoc input, if any.
///
/// # Errors
/// Returns [`GatewayError::Database`] if the problem lookup fails.
pub async fn resolve_server_test_cases(
    state: &AppState,
    problem_slug: &str,
    sample_only: bool,
) -> Result<Vec<ServerTestCase>, GatewayError> {
    let mut cases = Vec::new();

    if let Some(ref pool) = state.db {
        if let Some(problem) =
            judge_db::repositories::problem::get_problem_by_id(pool.inner(), problem_slug).await?
        {
            let records = judge_db::repositories::problem::list_problem_test_cases(
                pool.inner(),
                &problem.id,
                sample_only,
            )
            .await?;
            cases = records
                .into_iter()
                .map(|case| ServerTestCase {
                    id: u32::try_from(case.ordinal).unwrap_or_default(),
                    input_data: case.input_data,
                    expected_output: case.expected_output,
                    is_sample: case.is_sample,
                })
                .collect();
        }
    } else if let Some(problem) = judge_db::problem_catalog::find(problem_slug) {
        cases = problem
            .cases
            .iter()
            .filter(|case| !sample_only || case.is_sample)
            .map(|case| ServerTestCase {
                id: u32::try_from(case.ordinal).unwrap_or_default(),
                input_data: case.input_data.to_string(),
                expected_output: case.expected_output.to_string(),
                is_sample: case.is_sample,
            })
            .collect();
    }

    Ok(cases)
}

/// Handler for `POST /api/v1/submissions`.
///
/// Intake endpoint validating code and dispatching evaluation jobs to Redis queue
/// `submissions:queue`. Test cases are resolved server-side from the problem catalog;
/// client-supplied `test_cases` are ignored.
///
/// # Errors
/// Returns [`GatewayError::BadRequest`] on unsupported language or code exceeding 64KB.
#[allow(clippy::cast_precision_loss, clippy::too_many_lines)]
pub async fn submit_code_handler(
    State(state): State<AppState>,
    OptionalUser(auth): OptionalUser,
    Json(req): Json<SubmitCodeRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    // 1. Language validation
    let lang = match req.language.to_lowercase().as_str() {
        "cpp" | "c++" => "cpp",
        "python" | "py" => "python",
        "java" => "java",
        other => {
            return Err(GatewayError::BadRequest(format!(
                "Unsupported language: {other}"
            )))
        }
    };

    let code = req.get_code().to_string();

    // 2. Code size boundary validation (max 64KB)
    if code.len() > 65_536 {
        return Err(GatewayError::BadRequest(
            "Code exceeds maximum size limit of 64KB".to_string(),
        ));
    }

    // 3. Problem slug resolution (defaults to "custom-run" if missing or empty for ad-hoc executions)
    let problem_slug = req
        .problem_slug
        .filter(|s| !s.trim().is_empty())
        .map_or_else(|| "custom-run".to_string(), |s| s.trim().to_lowercase());

    // 4. Server-authoritative evaluation criteria. Client-supplied `test_cases` are
    //    ignored on purpose: the browser must not be able to pick the grading oracle.
    //    An explicit ad-hoc input replaces the catalog cases for that run.
    let sample_only = req
        .mode
        .as_deref()
        .is_some_and(|mode| mode.trim().eq_ignore_ascii_case("run"));
    let custom_input = req.custom_input.as_deref().filter(|s| !s.is_empty());
    let mut test_cases = if custom_input.is_some() {
        Vec::new()
    } else {
        resolve_server_test_cases(&state, &problem_slug, sample_only).await?
    };
    if test_cases.is_empty() {
        if let Some(custom_input) = custom_input {
            test_cases.push(ServerTestCase {
                id: 999,
                input_data: custom_input.to_string(),
                expected_output: String::new(),
                is_sample: true,
            });
        }
    }

    let submission_id = Uuid::new_v4();
    let user_id = auth.map(|a| a.user_id);
    let now = Utc::now();

    // 5. Persistence
    if let Some(ref pool) = state.db {
        let _ = judge_db::repositories::submission::create_submission(
            pool.inner(),
            submission_id,
            user_id,
            &problem_slug,
            lang,
            &code,
            req.assessment_id,
        )
        .await?;
    } else {
        let mut subs = state.mock_campus.submissions.write().await;
        subs.insert(
            submission_id,
            SubmissionRecord {
                id: submission_id,
                user_id,
                problem_slug: problem_slug.clone(),
                language: lang.to_string(),
                code: code.clone(),
                verdict: "PENDING".to_string(),
                runtime_ms: 0,
                memory_kb: 0,
                testcases_passed: 0,
                total_testcases: 0,
                created_at: now,
                assessment_id: req.assessment_id,
                room_id: None,
            },
        );
    }

    // 6. Job dispatch to Redis queues
    let job = SubmissionJob {
        submission_id,
        user_id,
        problem_slug: problem_slug.clone(),
        language: lang.to_string(),
        code: code.clone(),
        test_cases: test_cases.clone(),
        assessment_id: req.assessment_id,
        submitted_at: now,
    };
    let job_json =
        serde_json::to_string(&job).map_err(|e| GatewayError::InternalError(e.to_string()))?;

    // Create worker payload compatible with both Python worker and Rust engine
    let worker_job = serde_json::json!({
        "submission_id": submission_id.to_string(),
        "problem_slug": problem_slug,
        "language": lang,
        "source_code": code,
        "code": code,
        "time_limit_ms": req.time_limit_ms.unwrap_or(2000),
        "memory_limit_bytes": req.memory_limit_bytes.unwrap_or(268_435_456),
        "test_cases": test_cases,
        "submitted_at": now.timestamp_millis() as f64 / 1000.0,
    });
    let worker_payload_str = worker_job.to_string();

    if let Some(ref client) = state.redis_client {
        if let Ok(mut conn) = client.get_multiplexed_async_connection().await {
            let _: () = conn
                .lpush("submissions:queue", &job_json)
                .await
                .map_err(GatewayError::Redis)?;
            let _: Result<(), _> = conn.lpush("judge:submissions", &worker_payload_str).await;
        }
    } else {
        let mut queue = state.mock_campus.submission_queue.write().await;
        queue.push(serde_json::to_value(&job).unwrap_or_default());
    }

    Ok((
        StatusCode::CREATED,
        Json(SubmitCodeResponse {
            submission_id,
            status: "PENDING".to_string(),
            message: "Submission queued for execution".to_string(),
        }),
    ))
}

/// Handler for `GET /api/v1/submissions/{id}`.
///
/// Retrieves submission record and test case results, applying secret test masking for candidates.
///
/// # Errors
/// Returns [`GatewayError::NotFound`] if submission does not exist.
#[allow(clippy::too_many_lines)]
pub async fn get_submission_handler(
    State(state): State<AppState>,
    Path(submission_id_str): Path<String>,
    OptionalUser(auth): OptionalUser,
) -> Result<impl IntoResponse, GatewayError> {
    let is_instructor = auth
        .as_ref()
        .is_some_and(|a| role_level(&a.claims.role) >= 30);
    let submission_id = Uuid::parse_str(&submission_id_str).unwrap_or_else(|_| Uuid::nil());

    let rec = if let Some(ref pool) = state.db {
        judge_db::repositories::submission::get_submission_by_id(pool.inner(), submission_id)
            .await?
    } else {
        let subs = state.mock_campus.submissions.read().await;
        subs.get(&submission_id).cloned()
    };

    let (rec, masked_cases, final_report) = if let Some(rec) = rec {
        // Retrieve raw test case results from mock store or evaluation cache
        let raw_cases = {
            let results_map = state.mock_campus.submission_results.read().await;
            results_map
                .get(&submission_id)
                .map(|list| {
                    list.iter()
                        .filter_map(|v| serde_json::from_value::<TestCaseResult>(v.clone()).ok())
                        .collect::<Vec<TestCaseResult>>()
                })
                .unwrap_or_default()
        };

        // Secret Test Masking Invariant
        let masked = mask_test_case_results(&raw_cases, is_instructor, false);
        let redis_rep = if rec.verdict == "PENDING" {
            let mut found = None;
            if let Some(ref client) = state.redis_client {
                if let Ok(mut con) = client.get_multiplexed_async_connection().await {
                    let key = format!("judge:status:{submission_id_str}");
                    if let Ok(Some(s)) = con.hget::<_, _, Option<String>>(&key, "report").await {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&s) {
                            found = Some(val);
                        }
                    }
                }
            }
            found
        } else {
            None
        };

        let rep = redis_rep.unwrap_or_else(|| {
            serde_json::json!({
                "submission_id": rec.id.to_string(),
                "verdict": rec.verdict,
                "test_cases_passed": rec.testcases_passed,
                "total_test_cases": rec.total_testcases,
                "max_time_ms": rec.runtime_ms,
                "max_memory_bytes": i64::from(rec.memory_kb) * 1024,
                "test_case_results": masked.iter().map(|tc| serde_json::json!({
                    "test_case_id": tc.test_case_id,
                    "verdict": tc.verdict,
                    "execution_time_ms": tc.runtime_ms.unwrap_or(0),
                    "memory_used_bytes": tc.memory_kb.unwrap_or(0) * 1024,
                    "stdout": tc.actual_output.as_deref().unwrap_or(""),
                    "stderr": "",
                    "diff": tc.diff,
                })).collect::<Vec<_>>(),
            })
        });
        (rec, masked, Some(rep))
    } else {
        // Fallback: Check Redis judge:status:{submission_id_str}
        let mut redis_report = None;
        if let Some(ref client) = state.redis_client {
            if let Ok(mut con) = client.get_multiplexed_async_connection().await {
                let key = format!("judge:status:{submission_id_str}");
                if let Ok(Some(s)) = con.hget::<_, _, Option<String>>(&key, "report").await {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&s) {
                        redis_report = Some(val);
                    }
                }
            }
        }

        if let Some(rep) = redis_report {
            let verdict = rep
                .get("verdict")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("INTERNAL_ERROR")
                .to_string();
            let passed = i32::try_from(
                rep.get("test_cases_passed")
                    .and_then(serde_json::Value::as_i64)
                    .unwrap_or(0),
            )
            .unwrap_or(0);
            let total = i32::try_from(
                rep.get("total_test_cases")
                    .and_then(serde_json::Value::as_i64)
                    .unwrap_or(0),
            )
            .unwrap_or(0);
            let time_ms = i32::try_from(
                rep.get("max_time_ms")
                    .and_then(serde_json::Value::as_i64)
                    .unwrap_or(0),
            )
            .unwrap_or(0);
            let mem_bytes = rep
                .get("max_memory_bytes")
                .and_then(serde_json::Value::as_i64)
                .unwrap_or(0);
            let mem_kb = i32::try_from(mem_bytes / 1024).unwrap_or(0);
            let dummy = SubmissionRecord {
                id: submission_id,
                user_id: None,
                problem_slug: "two-sum".to_string(),
                language: "cpp".to_string(),
                code: String::new(),
                verdict,
                runtime_ms: time_ms,
                memory_kb: mem_kb,
                testcases_passed: passed,
                total_testcases: total,
                created_at: Utc::now(),
                assessment_id: None,
                room_id: None,
            };
            (dummy, Vec::new(), Some(rep))
        } else {
            return Err(GatewayError::NotFound(format!(
                "Submission '{submission_id_str}' not found"
            )));
        }
    };

    Ok(Json(GetSubmissionResponse {
        id: rec.id,
        user_id: rec.user_id,
        problem_slug: rec.problem_slug,
        language: rec.language,
        verdict: rec.verdict,
        runtime_ms: rec.runtime_ms,
        memory_kb: rec.memory_kb,
        testcases_passed: rec.testcases_passed,
        total_testcases: rec.total_testcases,
        created_at: rec.created_at,
        assessment_id: rec.assessment_id,
        test_cases: masked_cases,
        report: final_report,
    }))
}

/// Determines stream caller role from query token or Authorization header.
fn determine_stream_role(params: &StreamParams, headers: &HeaderMap, jwt_secret: &str) -> bool {
    if let Some(ref token) = params.token {
        if let Ok(claims) = decode_access_token(token, jwt_secret) {
            return role_level(&claims.role) >= 30;
        }
    }

    if let Some(auth_val) = headers.get(AUTHORIZATION) {
        if let Ok(s) = auth_val.to_str() {
            let token = s
                .strip_prefix("Bearer ")
                .or_else(|| s.strip_prefix("bearer "))
                .unwrap_or(s)
                .trim();
            if let Ok(claims) = decode_access_token(token, jwt_secret) {
                return role_level(&claims.role) >= 30;
            }
        }
    }

    false
}

/// Handler for `GET /ws/submissions/{id}`.
///
/// Upgrades HTTP request to WebSocket streaming live test execution progress from Redis Pub/Sub,
/// strictly enforcing the Secret Test Masking Invariant.
pub async fn submission_stream_handler(
    ws: WebSocketUpgrade,
    Path(submission_id_str): Path<String>,
    Query(params): Query<StreamParams>,
    headers: HeaderMap,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let is_instructor = determine_stream_role(&params, &headers, &state.jwt_secret);
    ws.on_upgrade(move |socket| {
        handle_submission_socket(socket, submission_id_str, is_instructor, state)
    })
}

/// Manages active WebSocket connection streaming live test case outcomes.
#[allow(clippy::too_many_lines)]
async fn handle_submission_socket(
    socket: WebSocket,
    submission_id_str: String,
    is_instructor: bool,
    state: AppState,
) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // 1. Check if submission already finished in Redis status store
    if let Some(ref client) = state.redis_client {
        if let Ok(mut con) = client.get_multiplexed_async_connection().await {
            let key = format!("judge:status:{submission_id_str}");
            if let Ok(Some(status)) = con.hget::<_, _, Option<String>>(&key, "status").await {
                if status == "COMPLETED" || status == "FAILED" {
                    let ev_type = if status == "FAILED" {
                        "compilation_failed"
                    } else {
                        "completed"
                    };
                    let report: Option<String> = con.hget(&key, "report").await.ok().flatten();
                    let report_val =
                        report.and_then(|r| serde_json::from_str::<serde_json::Value>(&r).ok());
                    let event = serde_json::json!({
                        "event_type": ev_type,
                        "submission_id": submission_id_str,
                        "data": report_val.unwrap_or_else(|| serde_json::json!({ "status": status })),
                    });
                    let _ = ws_sender
                        .send(Message::Text(event.to_string().into()))
                        .await;
                    return;
                }
            }
        }
    }

    // 2. Redis Pub/Sub subscriptions
    let mut redis_stream = if let Some(ref client) = state.redis_client {
        if let Ok(mut pubsub) = client.get_async_pubsub().await {
            let ch1 = format!("submissions:{submission_id_str}:events");
            let ch2 = format!("judge:events:{submission_id_str}");
            let _ = pubsub.subscribe(&ch1).await;
            let _ = pubsub.subscribe(&ch2).await;
            Some(pubsub.into_on_message())
        } else {
            None
        }
    } else {
        None
    };

    // 3. Local in-memory broadcast bus subscription
    let mut local_rx = if let Ok(parsed_uuid) = Uuid::parse_str(&submission_id_str) {
        let mut map = state.mock_campus.submission_broadcasts.write().await;
        let tx = map.entry(parsed_uuid).or_insert_with(|| {
            let (tx, _) = tokio::sync::broadcast::channel(100);
            tx
        });
        Some(tx.subscribe())
    } else {
        None
    };

    // Client receive watchdog
    let mut client_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            if matches!(msg, Message::Close(_)) {
                break;
            }
        }
    });

    let mut event_count = 0;
    let fallback_deadline = tokio::time::sleep(tokio::time::Duration::from_millis(2500));
    tokio::pin!(fallback_deadline);

    loop {
        tokio::select! {
            _ = &mut client_task => break,
            Some(redis_msg) = async {
                match redis_stream.as_mut() {
                    Some(st) => st.next().await,
                    None => std::future::pending().await,
                }
            } => {
                if let Ok(payload_str) = redis_msg.get_payload::<String>() {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&payload_str) {
                        event_count += 1;
                        let masked = mask_test_case_json(&val, is_instructor, false);
                        let ev_type = masked.get("event_type").and_then(|e| e.as_str()).unwrap_or("");
                        let is_terminal = ev_type == "completed" || ev_type == "compilation_failed";
                        if ws_sender.send(Message::Text(masked.to_string().into())).await.is_err() || is_terminal {
                            break;
                        }
                    }
                }
            }
            Ok(local_val) = async {
                match local_rx.as_mut() {
                    Some(rx) => rx.recv().await,
                    None => std::future::pending().await,
                }
            } => {
                event_count += 1;
                let masked = mask_test_case_json(&local_val, is_instructor, false);
                let ev_type = masked.get("event_type").and_then(|e| e.as_str()).unwrap_or("");
                let is_terminal = ev_type == "completed" || ev_type == "compilation_failed";
                if ws_sender.send(Message::Text(masked.to_string().into())).await.is_err() || is_terminal {
                    break;
                }
            }
            () = &mut fallback_deadline, if event_count == 0 => {
                // No worker produced any event before the deadline. Fail closed instead of
                // fabricating a passing verdict: report an internal error with zero cases passed.
                let timeout_event = serde_json::json!({
                    "event_type": "completed",
                    "submission_id": submission_id_str,
                    "data": {
                        "verdict": "INTERNAL_ERROR",
                        "test_cases_passed": 0,
                        "total_test_cases": 0,
                        "message": "Evaluation timed out or worker unavailable",
                    }
                });
                let _ = ws_sender.send(Message::Text(timeout_event.to_string().into())).await;
                break;
            }
        }
    }
}

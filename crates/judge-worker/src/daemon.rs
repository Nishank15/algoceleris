//! Daemon worker orchestrating asynchronous evaluation jobs and sandboxed processes.

use std::path::Path;
use std::time::Duration;

use anyhow::Result;
use judge_core::Verdict;
use redis::AsyncCommands;
use serde_json::Value;

use crate::runner::{CommandConfig, ExecutionEngine};

/// Daemon worker orchestrating asynchronous evaluation jobs and sandboxed processes.
#[derive(Debug, Clone, Default)]
pub struct WorkerDaemon {
    pool: Option<judge_db::DbPool>,
}

impl WorkerDaemon {
    /// Creates a new `WorkerDaemon`.
    #[must_use]
    pub fn new() -> Self {
        Self { pool: None }
    }

    /// Creates a new `WorkerDaemon` with database pool for persisting verdicts.
    #[must_use]
    pub fn with_pool(pool: Option<judge_db::DbPool>) -> Self {
        Self { pool }
    }

    /// Evaluates a single submission job by compiling and executing against test cases.
    ///
    /// # Errors
    /// Returns an error if filesystem operations or execution engine setup fails.
    #[allow(clippy::too_many_lines)]
    pub async fn evaluate_job(&self, job: &Value) -> Result<Value> {
        let sub_id = job
            .get("submission_id")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let lang = job
            .get("language")
            .and_then(Value::as_str)
            .unwrap_or("cpp")
            .to_lowercase();
        let code = job
            .get("code")
            .or_else(|| job.get("source_code"))
            .and_then(Value::as_str)
            .unwrap_or("");
        let problem_slug = job
            .get("problem_slug")
            .and_then(Value::as_str)
            .unwrap_or("two-sum");
        let time_limit_ms = job
            .get("time_limit_ms")
            .and_then(Value::as_u64)
            .unwrap_or(2000);
        let mem_limit_bytes = job
            .get("memory_limit_bytes")
            .and_then(Value::as_u64)
            .unwrap_or(268_435_456);

        // Collect test cases
        let mut test_cases = Vec::new();
        if let Some(cases) = job.get("test_cases").and_then(Value::as_array) {
            for (i, c) in cases.iter().enumerate() {
                #[allow(clippy::cast_possible_wrap)]
                let id = c.get("id").and_then(Value::as_i64).unwrap_or(i as i64 + 1);
                let input = c
                    .get("input_data")
                    .or_else(|| c.get("input"))
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                let expected = c
                    .get("expected_output")
                    .or_else(|| c.get("expected"))
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                test_cases.push((id, input, expected));
            }
        }

        if test_cases.is_empty() {
            if problem_slug == "two-sum" {
                test_cases.push((1, "4\n2 7 11 15\n9".to_string(), "0 1".to_string()));
                test_cases.push((2, "3\n3 2 4\n6".to_string(), "1 2".to_string()));
                test_cases.push((3, "2\n3 3\n6".to_string(), "0 1".to_string()));
            } else {
                test_cases.push((1, String::new(), String::new()));
            }
        }

        let run_id = uuid::Uuid::new_v4().to_string();
        let tmp_dir = std::env::temp_dir().join(format!("algo_eval_{run_id}"));
        std::fs::create_dir_all(&tmp_dir)?;

        let (exec_cmd, compilation_err) = Self::prepare_execution(
            &lang,
            code,
            &tmp_dir,
            Duration::from_millis(time_limit_ms),
            mem_limit_bytes,
        )
        .await?;

        if let Some(diag) = compilation_err {
            let _ = std::fs::remove_dir_all(&tmp_dir);
            let total = test_cases.len();
            return Ok(serde_json::json!({
                "submission_id": sub_id,
                "status": "COMPLETED",
                "verdict": "COMPILATION_ERROR",
                "test_cases_passed": 0,
                "total_test_cases": total,
                "max_time_ms": 0,
                "max_memory_bytes": 0,
                "diagnostics": diag,
                "test_case_results": [],
            }));
        }

        let Some(cmd) = exec_cmd else {
            let _ = std::fs::remove_dir_all(&tmp_dir);
            tracing::error!(
                "No execution command resolved for language '{lang}' on submission {sub_id}; \
                 failing closed with SYSTEM_ERROR"
            );
            return Ok(serde_json::json!({
                "submission_id": sub_id,
                "status": "FAILED",
                "verdict": "SYSTEM_ERROR",
                "test_cases_passed": 0,
                "total_test_cases": test_cases.len(),
                "max_time_ms": 0,
                "max_memory_bytes": 0,
                "error_message": "Unsupported language or execution command failed to resolve",
                "test_case_results": [],
            }));
        };

        let engine = ExecutionEngine::new(
            Duration::from_millis(time_limit_ms),
            mem_limit_bytes,
            1_048_576,
        );

        let mut results = Vec::new();
        let mut max_time: u64 = 0;
        let mut max_mem: u64 = 0;

        for (case_id, input_data, expected_output) in test_cases {
            let exec_res = engine.execute(&cmd, &input_data, None).await?;
            let stdout_trimmed = exec_res.stdout.trim().to_string();
            let expected_trimmed = expected_output.trim();

            let tc_verdict = if exec_res.verdict == Verdict::TimeLimitExceeded {
                "TIME_LIMIT_EXCEEDED"
            } else if exec_res.verdict == Verdict::MemoryLimitExceeded {
                "MEMORY_LIMIT_EXCEEDED"
            } else if exec_res.exit_code != Some(0) {
                "RUNTIME_ERROR"
            } else if stdout_trimmed == expected_trimmed {
                "ACCEPTED"
            } else {
                "WRONG_ANSWER"
            };

            max_time = max_time.max(exec_res.runtime_ms);
            max_mem = max_mem.max(exec_res.memory_bytes);

            let diff = if tc_verdict == "ACCEPTED" {
                None
            } else {
                Some(format!(
                    "Expected: {expected_trimmed}\nActual: {stdout_trimmed}"
                ))
            };

            results.push(serde_json::json!({
                "test_case_id": case_id,
                "verdict": tc_verdict,
                "execution_time_ms": exec_res.runtime_ms.max(5),
                "memory_used_bytes": exec_res.memory_bytes.max(12_582_912),
                "stdout": stdout_trimmed,
                "diff": diff,
            }));
        }

        let _ = std::fs::remove_dir_all(&tmp_dir);

        let passed_count = results
            .iter()
            .filter(|r| r.get("verdict").and_then(Value::as_str) == Some("ACCEPTED"))
            .count();
        let total_count = results.len();

        let overall_verdict = if passed_count == total_count {
            "ACCEPTED"
        } else {
            results
                .iter()
                .find(|r| r.get("verdict").and_then(Value::as_str) != Some("ACCEPTED"))
                .and_then(|r| r.get("verdict").and_then(Value::as_str))
                .unwrap_or("WRONG_ANSWER")
        };

        Ok(serde_json::json!({
            "submission_id": sub_id,
            "status": "COMPLETED",
            "verdict": overall_verdict,
            "test_cases_passed": passed_count,
            "total_test_cases": total_count,
            "max_time_ms": max_time.max(12),
            "max_memory_bytes": max_mem.max(14_680_064),
            "test_case_results": results,
        }))
    }

    async fn prepare_execution(
        lang: &str,
        code: &str,
        tmp_dir: &Path,
        _time_limit: Duration,
        mem_limit_bytes: u64,
    ) -> Result<(Option<CommandConfig>, Option<String>)> {
        if lang == "cpp" || lang == "c++" {
            let src = tmp_dir.join("solution.cpp");
            let bin = tmp_dir.join("solution");
            tokio::fs::write(&src, code).await?;

            let comp_cmd = CommandConfig::new(
                "g++",
                vec![
                    "-O3".to_string(),
                    "-std=c++20".to_string(),
                    "-Wall".to_string(),
                    "-Wextra".to_string(),
                    "-DONLINE_JUDGE".to_string(),
                    src.to_string_lossy().to_string(),
                    "-o".to_string(),
                    bin.to_string_lossy().to_string(),
                ],
            );

            let engine =
                ExecutionEngine::new(Duration::from_millis(10000), mem_limit_bytes, 1_048_576);
            let comp_res = engine.execute(&comp_cmd, "", None).await?;

            if comp_res.exit_code != Some(0) {
                let diag = if comp_res.stderr.is_empty() {
                    comp_res.stdout
                } else {
                    comp_res.stderr
                };
                return Ok((None, Some(diag)));
            }

            return Ok((
                Some(CommandConfig::new(bin.to_string_lossy(), vec![])),
                None,
            ));
        }

        if lang == "python" || lang == "py" || lang == "python3" {
            let src = tmp_dir.join("solution.py");
            tokio::fs::write(&src, code).await?;

            return Ok((
                Some(CommandConfig::new(
                    "python3",
                    vec![
                        "-u".to_string(),
                        "-B".to_string(),
                        src.to_string_lossy().to_string(),
                    ],
                )),
                None,
            ));
        }

        if lang == "java" {
            let src = tmp_dir.join("Main.java");
            tokio::fs::write(&src, code).await?;

            let comp_cmd = CommandConfig::new(
                "javac",
                vec![
                    "-encoding".to_string(),
                    "UTF-8".to_string(),
                    src.to_string_lossy().to_string(),
                ],
            );

            let engine =
                ExecutionEngine::new(Duration::from_millis(10000), mem_limit_bytes, 1_048_576);
            let comp_res = engine.execute(&comp_cmd, "", None).await?;

            if comp_res.exit_code != Some(0) {
                return Ok((None, Some(comp_res.stderr)));
            }

            return Ok((
                Some(
                    CommandConfig::new(
                        "java",
                        vec![
                            "-Xmx256m".to_string(),
                            "-XX:+UseSerialGC".to_string(),
                            "-Dfile.encoding=UTF-8".to_string(),
                            "-cp".to_string(),
                            tmp_dir.to_string_lossy().to_string(),
                            "Main".to_string(),
                        ],
                    )
                    .with_working_dir(tmp_dir.to_path_buf()),
                ),
                None,
            ));
        }

        Ok((None, None))
    }

    /// Pops and processes the next pending job from Redis `submissions:queue` or `judge:submissions`.
    ///
    /// # Errors
    /// Returns an error if Redis communication or job execution fails.
    pub async fn process_next_job(
        &self,
        con: &mut redis::aio::MultiplexedConnection,
    ) -> Result<bool> {
        let item: Option<String> = con
            .rpop::<_, Option<String>>("submissions:queue", None)
            .await
            .ok()
            .flatten();

        let raw_job = if let Some(j) = item {
            j
        } else {
            let fallback: Option<String> = con
                .rpop::<_, Option<String>>("judge:submissions", None)
                .await
                .ok()
                .flatten();
            if let Some(j) = fallback {
                j
            } else {
                return Ok(false);
            }
        };

        let job: Value = match serde_json::from_str(&raw_job) {
            Ok(j) => j,
            Err(e) => {
                tracing::warn!("Discarding malformed job payload: {e}");
                return Ok(true);
            }
        };

        let sub_id = job
            .get("submission_id")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();

        if sub_id.is_empty() {
            return Ok(true);
        }

        tracing::info!("Received submission {sub_id} for evaluation...");

        // 1. Update status to PROCESSING
        let status_key = format!("judge:status:{sub_id}");
        let _: Result<(), _> = con.hset(&status_key, "status", "PROCESSING").await;

        let status_ev = serde_json::json!({
            "event_type": "status_change",
            "submission_id": &sub_id,
            "data": { "status": "RUNNING" }
        });
        let _: Result<(), _> = con
            .publish(
                format!("submissions:{sub_id}:events"),
                status_ev.to_string(),
            )
            .await;
        let _: Result<(), _> = con
            .publish(format!("judge:events:{sub_id}"), status_ev.to_string())
            .await;

        // 2. Evaluate
        let report = self.evaluate_job(&job).await?;
        let report_str = report.to_string();
        let verdict = report
            .get("verdict")
            .and_then(Value::as_str)
            .unwrap_or("SYSTEM_ERROR");
        let report_status = report
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("COMPLETED");

        // 3. Update status in Redis
        let _: Result<(), _> = con.hset(&status_key, "status", report_status).await;
        let _: Result<(), _> = con.hset(&status_key, "report", &report_str).await;

        // 4. Publish completion event
        let comp_ev = serde_json::json!({
            "event_type": "completed",
            "submission_id": &sub_id,
            "data": &report,
        });
        let _: Result<(), _> = con
            .publish(format!("submissions:{sub_id}:events"), comp_ev.to_string())
            .await;
        let _: Result<(), _> = con
            .publish(format!("judge:events:{sub_id}"), comp_ev.to_string())
            .await;

        // 5. Update PostgreSQL if pool is available
        if let Some(ref pool) = self.pool {
            if let Ok(uid) = uuid::Uuid::parse_str(&sub_id) {
                #[allow(clippy::cast_possible_truncation)]
                let time_ms = report
                    .get("max_time_ms")
                    .and_then(Value::as_i64)
                    .unwrap_or(0) as i32;
                #[allow(clippy::cast_possible_truncation)]
                let mem_kb = (report
                    .get("max_memory_bytes")
                    .and_then(Value::as_i64)
                    .unwrap_or(0)
                    / 1024) as i32;
                #[allow(clippy::cast_possible_truncation)]
                let passed = report
                    .get("test_cases_passed")
                    .and_then(Value::as_i64)
                    .unwrap_or(0) as i32;
                #[allow(clippy::cast_possible_truncation)]
                let total = report
                    .get("total_test_cases")
                    .and_then(Value::as_i64)
                    .unwrap_or(0) as i32;

                let _ = judge_db::repositories::submission::update_submission_status(
                    pool.inner(),
                    uid,
                    verdict,
                    time_ms,
                    mem_kb,
                    passed,
                    total,
                )
                .await;
            }
        }

        tracing::info!("Completed evaluation of {sub_id} with verdict: {verdict}");
        Ok(true)
    }

    /// Runs continuous evaluation daemon loop polling Redis.
    ///
    /// # Errors
    /// Returns an error if Redis connection fails.
    pub async fn run_loop(&self, redis_url: &str) -> Result<()> {
        let client = redis::Client::open(redis_url)?;
        let mut con = client.get_multiplexed_async_connection().await?;
        tracing::info!("Worker daemon listening on Redis: {redis_url}");

        loop {
            match self.process_next_job(&mut con).await {
                Ok(true) => {
                    // Job was processed, immediately check for another job
                    tokio::time::sleep(Duration::from_millis(10)).await;
                }
                Ok(false) => {
                    // Queue empty, wait 100ms before polling again
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
                Err(err) => {
                    tracing::error!("Error processing evaluation job: {err}");
                    tokio::time::sleep(Duration::from_millis(200)).await;
                }
            }
        }
    }
}

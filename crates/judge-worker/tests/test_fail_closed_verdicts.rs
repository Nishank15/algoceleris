//! Regression tests for fail-closed behaviour when no execution command can be resolved.

use judge_worker::daemon::WorkerDaemon;
use serde_json::json;

/// A language with no configured runner must never be reported as accepted.
#[tokio::test]
async fn unsupported_language_fails_closed_with_system_error() {
    let daemon = WorkerDaemon::new();

    let job = json!({
        "submission_id": "11111111-1111-4111-8111-111111111111",
        "language": "haskell",
        "code": "main = putStrLn \"hello\"",
        "problem_slug": "two-sum",
        "test_cases": [
            { "id": 1, "input_data": "1", "expected_output": "1" },
            { "id": 2, "input_data": "2", "expected_output": "2" }
        ]
    });

    let report = daemon.evaluate_job(&job).await.expect("job evaluates");

    assert_eq!(report["status"], "FAILED");
    assert_eq!(report["verdict"], "SYSTEM_ERROR");
    assert_eq!(report["test_cases_passed"], 0);
    assert_eq!(report["total_test_cases"], 2);
    assert!(
        report["error_message"]
            .as_str()
            .is_some_and(|m| m.contains("Unsupported language")),
        "expected an explanatory error_message, got {:?}",
        report["error_message"]
    );
    assert_ne!(report["verdict"], "ACCEPTED");
}

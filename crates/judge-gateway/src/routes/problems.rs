//! Problem catalog endpoints: listing and single problem lookup.
//!
//! The catalog is server-authoritative. Definitions and test cases live in PostgreSQL
//! (seeded from [`judge_db::problem_catalog`]) and only sample cases are ever
//! serialized to clients; hidden cases never leave the gateway. When no database is
//! attached (standalone mode) the same catalog is served from memory.

use std::collections::HashMap;

use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::errors::GatewayError;
use crate::state::AppState;
use judge_db::models::{ProblemRecord, ProblemTestCaseRecord};
use judge_db::problem_catalog::{self, CatalogProblem};

/// Sample test case structure.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TestCaseItem {
    pub id: u32,
    pub input_data: String,
    pub expected_output: String,
    pub is_sample: bool,
}

/// Problem metadata and specification.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Problem {
    pub id: String,
    pub title: String,
    pub difficulty: String,
    #[serde(rename = "acceptanceRate")]
    pub acceptance_rate: f64,
    pub tags: Vec<String>,
    pub description: String,
    pub constraints: Vec<String>,
    #[serde(rename = "sampleCases")]
    pub sample_cases: Vec<TestCaseItem>,
    #[serde(rename = "timeLimitMs")]
    pub time_limit_ms: u64,
    #[serde(rename = "memoryLimitBytes")]
    pub memory_limit_bytes: u64,
}

/// Creates the problem catalog tables (if missing) and seeds the canonical catalog.
///
/// The seed is idempotent, so this runs on every gateway start and only inserts rows
/// that are not present yet.
///
/// # Errors
/// Returns [`judge_db::DbError`] if DDL or seeding fails.
pub async fn init_problem_catalog(pool: &sqlx::PgPool) -> Result<u64, judge_db::DbError> {
    sqlx::query(
        r"
        CREATE TABLE IF NOT EXISTS problems (
            id VARCHAR(100) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            difficulty VARCHAR(20) NOT NULL,
            time_limit_ms INTEGER NOT NULL DEFAULT 2000,
            memory_limit_bytes BIGINT NOT NULL DEFAULT 268435456,
            description TEXT NOT NULL,
            constraints JSON NOT NULL DEFAULT '[]'::json,
            tags JSON NOT NULL DEFAULT '[]'::json,
            acceptance_rate FLOAT8 NOT NULL DEFAULT 0.0,
            is_published BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ",
    )
    .execute(pool)
    .await
    .map_err(judge_db::DbError::Sqlx)?;

    sqlx::query(
        r"
        CREATE INDEX IF NOT EXISTS ix_problems_published ON problems(is_published);
        ",
    )
    .execute(pool)
    .await
    .map_err(judge_db::DbError::Sqlx)?;

    sqlx::query(
        r"
        CREATE TABLE IF NOT EXISTS problem_test_cases (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            problem_id VARCHAR(100) NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
            input_data TEXT NOT NULL,
            expected_output TEXT NOT NULL,
            is_sample BOOLEAN NOT NULL DEFAULT FALSE,
            ordinal INTEGER NOT NULL,
            CONSTRAINT uq_problem_test_cases_ordinal UNIQUE(problem_id, ordinal)
        );
        ",
    )
    .execute(pool)
    .await
    .map_err(judge_db::DbError::Sqlx)?;

    sqlx::query(
        r"
        CREATE INDEX IF NOT EXISTS ix_problem_test_cases_problem_id
            ON problem_test_cases(problem_id);
        ",
    )
    .execute(pool)
    .await
    .map_err(judge_db::DbError::Sqlx)?;

    judge_db::repositories::problem::seed_problem_catalog(pool).await
}

/// Handler for `GET /api/v1/problems`.
///
/// # Errors
/// Returns [`GatewayError`].
pub async fn list_problems_handler(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, GatewayError> {
    if let Some(ref pool) = state.db {
        let records =
            judge_db::repositories::problem::list_published_problems(pool.inner()).await?;
        let sample_cases =
            judge_db::repositories::problem::list_all_sample_test_cases(pool.inner()).await?;

        let mut cases_by_problem: HashMap<String, Vec<TestCaseItem>> = HashMap::new();
        for case in sample_cases {
            cases_by_problem
                .entry(case.problem_id.clone())
                .or_default()
                .push(test_case_item(case));
        }

        let problems = records
            .into_iter()
            .map(|record| {
                let cases = cases_by_problem.remove(&record.id).unwrap_or_default();
                problem_from_record(record, cases)
            })
            .collect::<Vec<_>>();
        Ok(Json(problems))
    } else {
        Ok(Json(
            problem_catalog::catalog()
                .iter()
                .map(|p| problem_from_catalog(p, true))
                .collect::<Vec<_>>(),
        ))
    }
}

/// Handler for `GET /api/v1/problems/{slug}`.
///
/// # Errors
/// Returns [`GatewayError::NotFound`] if the problem does not exist.
pub async fn get_problem_handler(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<impl IntoResponse, GatewayError> {
    let clean_slug = slug.trim().to_lowercase();

    if let Some(ref pool) = state.db {
        let Some(record) =
            judge_db::repositories::problem::get_problem_by_id(pool.inner(), &clean_slug).await?
        else {
            return Err(problem_not_found(&slug));
        };
        if !record.is_published {
            return Err(problem_not_found(&slug));
        }
        let cases = judge_db::repositories::problem::list_problem_test_cases(
            pool.inner(),
            &clean_slug,
            true,
        )
        .await?;
        Ok(Json(problem_from_record(
            record,
            cases.into_iter().map(test_case_item).collect(),
        )))
    } else {
        problem_catalog::find(&clean_slug)
            .map(|p| Json(problem_from_catalog(p, true)))
            .ok_or_else(|| problem_not_found(&slug))
    }
}

fn problem_not_found(slug: &str) -> GatewayError {
    GatewayError::NotFound(format!("Problem '{slug}' not found"))
}

/// Converts a persisted test case row into its public DTO (sample cases only are ever
/// passed here).
fn test_case_item(case: ProblemTestCaseRecord) -> TestCaseItem {
    TestCaseItem {
        id: u32::try_from(case.ordinal).unwrap_or_default(),
        input_data: case.input_data,
        expected_output: case.expected_output,
        is_sample: case.is_sample,
    }
}

/// Assembles the public DTO from a persisted problem row and its sample cases.
fn problem_from_record(record: ProblemRecord, sample_cases: Vec<TestCaseItem>) -> Problem {
    Problem {
        id: record.id,
        title: record.title,
        difficulty: record.difficulty,
        acceptance_rate: record.acceptance_rate,
        tags: string_list(record.tags),
        description: record.description,
        constraints: string_list(record.constraints),
        sample_cases,
        time_limit_ms: u64::try_from(record.time_limit_ms).unwrap_or_default(),
        memory_limit_bytes: u64::try_from(record.memory_limit_bytes).unwrap_or_default(),
    }
}

/// Assembles the public DTO from the in-memory canonical catalog.
fn problem_from_catalog(problem: &CatalogProblem, sample_only: bool) -> Problem {
    Problem {
        id: problem.id.to_string(),
        title: problem.title.to_string(),
        difficulty: problem.difficulty.to_string(),
        acceptance_rate: problem.acceptance_rate,
        tags: problem.tags.iter().map(|tag| (*tag).to_string()).collect(),
        description: problem.description.to_string(),
        constraints: problem
            .constraints
            .iter()
            .map(|item| (*item).to_string())
            .collect(),
        sample_cases: problem
            .cases
            .iter()
            .filter(|case| !sample_only || case.is_sample)
            .map(|case| TestCaseItem {
                id: u32::try_from(case.ordinal).unwrap_or_default(),
                input_data: case.input_data.to_string(),
                expected_output: case.expected_output.to_string(),
                is_sample: case.is_sample,
            })
            .collect(),
        time_limit_ms: u64::try_from(problem.time_limit_ms).unwrap_or_default(),
        memory_limit_bytes: u64::try_from(problem.memory_limit_bytes).unwrap_or_default(),
    }
}

/// Deserializes a JSONB string array, tolerating unexpected shapes.
fn string_list(value: serde_json::Value) -> Vec<String> {
    serde_json::from_value(value).unwrap_or_default()
}

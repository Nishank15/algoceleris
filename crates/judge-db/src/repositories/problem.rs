//! Problem catalog persistence: definitions, test cases, and idempotent seeding.

use sqlx::PgPool;

use crate::errors::DbError;
use crate::models::{ProblemRecord, ProblemTestCaseRecord};
use crate::problem_catalog;

/// Returns every published problem, ordered by slug.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if the query fails.
pub async fn list_published_problems(pool: &PgPool) -> Result<Vec<ProblemRecord>, DbError> {
    sqlx::query_as::<_, ProblemRecord>(
        r"
        SELECT id, title, difficulty, time_limit_ms, memory_limit_bytes, description,
               constraints, tags, acceptance_rate, is_published, created_at
        FROM problems
        WHERE is_published = TRUE
        ORDER BY id
        ",
    )
    .fetch_all(pool)
    .await
    .map_err(DbError::Sqlx)
}

/// Looks up a single problem by slug.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if the query fails.
pub async fn get_problem_by_id(
    pool: &PgPool,
    problem_id: &str,
) -> Result<Option<ProblemRecord>, DbError> {
    sqlx::query_as::<_, ProblemRecord>(
        r"
        SELECT id, title, difficulty, time_limit_ms, memory_limit_bytes, description,
               constraints, tags, acceptance_rate, is_published, created_at
        FROM problems
        WHERE id = $1
        ",
    )
    .bind(problem_id)
    .fetch_optional(pool)
    .await
    .map_err(DbError::Sqlx)
}

/// Lists a problem's test cases ordered by ordinal.
///
/// When `sample_only` is set, hidden cases are filtered out at the database so they
/// can never reach a public response.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if the query fails.
pub async fn list_problem_test_cases(
    pool: &PgPool,
    problem_id: &str,
    sample_only: bool,
) -> Result<Vec<ProblemTestCaseRecord>, DbError> {
    sqlx::query_as::<_, ProblemTestCaseRecord>(
        r"
        SELECT id, problem_id, input_data, expected_output, is_sample, ordinal
        FROM problem_test_cases
        WHERE problem_id = $1 AND ($2 = FALSE OR is_sample = TRUE)
        ORDER BY ordinal
        ",
    )
    .bind(problem_id)
    .bind(sample_only)
    .fetch_all(pool)
    .await
    .map_err(DbError::Sqlx)
}

/// Lists every sample test case across all problems, ordered by problem and ordinal.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if the query fails.
pub async fn list_all_sample_test_cases(
    pool: &PgPool,
) -> Result<Vec<ProblemTestCaseRecord>, DbError> {
    sqlx::query_as::<_, ProblemTestCaseRecord>(
        r"
        SELECT id, problem_id, input_data, expected_output, is_sample, ordinal
        FROM problem_test_cases
        WHERE is_sample = TRUE
        ORDER BY problem_id, ordinal
        ",
    )
    .fetch_all(pool)
    .await
    .map_err(DbError::Sqlx)
}

/// Seeds the canonical catalog into PostgreSQL, skipping rows that already exist.
///
/// The seed is idempotent, so it is safe to run on every gateway start: definitions and
/// cases that are already present are left untouched and only missing rows are inserted.
///
/// # Errors
/// Returns [`DbError::Sqlx`] if an insert fails.
pub async fn seed_problem_catalog(pool: &PgPool) -> Result<u64, DbError> {
    let mut inserted = 0_u64;
    for problem in problem_catalog::catalog() {
        let result = sqlx::query(
            r"
            INSERT INTO problems (
                id, title, difficulty, time_limit_ms, memory_limit_bytes, description,
                constraints, tags, acceptance_rate, is_published, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW())
            ON CONFLICT (id) DO NOTHING
            ",
        )
        .bind(problem.id)
        .bind(problem.title)
        .bind(problem.difficulty)
        .bind(problem.time_limit_ms)
        .bind(problem.memory_limit_bytes)
        .bind(problem.description)
        .bind(serde_json::json!(problem.constraints))
        .bind(serde_json::json!(problem.tags))
        .bind(problem.acceptance_rate)
        .execute(pool)
        .await
        .map_err(DbError::Sqlx)?;
        inserted += result.rows_affected();

        for case in problem.cases {
            sqlx::query(
                r"
                INSERT INTO problem_test_cases (
                    id, problem_id, input_data, expected_output, is_sample, ordinal
                )
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
                ON CONFLICT (problem_id, ordinal) DO NOTHING
                ",
            )
            .bind(problem.id)
            .bind(case.input_data)
            .bind(case.expected_output)
            .bind(case.is_sample)
            .bind(case.ordinal)
            .execute(pool)
            .await
            .map_err(DbError::Sqlx)?;
        }
    }

    Ok(inserted)
}

/// Problem catalog repository wrapper struct.
#[derive(Debug, Clone)]
pub struct ProblemRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> ProblemRepository<'a> {
    #[must_use]
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Lists published problems.
    ///
    /// # Errors
    /// Returns [`DbError`] if the query fails.
    pub async fn list_published(&self) -> Result<Vec<ProblemRecord>, DbError> {
        list_published_problems(self.pool).await
    }

    /// Fetches a problem by slug.
    ///
    /// # Errors
    /// Returns [`DbError`] if the query fails.
    pub async fn get(&self, problem_id: &str) -> Result<Option<ProblemRecord>, DbError> {
        get_problem_by_id(self.pool, problem_id).await
    }

    /// Lists test cases for a problem.
    ///
    /// # Errors
    /// Returns [`DbError`] if the query fails.
    pub async fn list_test_cases(
        &self,
        problem_id: &str,
        sample_only: bool,
    ) -> Result<Vec<ProblemTestCaseRecord>, DbError> {
        list_problem_test_cases(self.pool, problem_id, sample_only).await
    }

    /// Seeds the canonical catalog.
    ///
    /// # Errors
    /// Returns [`DbError`] if the seed fails.
    pub async fn seed_catalog(&self) -> Result<u64, DbError> {
        seed_problem_catalog(self.pool).await
    }
}

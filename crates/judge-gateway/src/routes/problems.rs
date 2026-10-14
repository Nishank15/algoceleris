//! Problem catalog endpoints: listing and single problem lookup.

use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::errors::GatewayError;
use crate::state::AppState;

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

#[allow(clippy::too_many_lines)]
fn get_problem_catalog() -> Vec<Problem> {
    vec![
        Problem {
            id: "two-sum".to_string(),
            title: "1. Two Sum".to_string(),
            difficulty: "Easy".to_string(),
            acceptance_rate: 49.5,
            tags: vec!["Array".to_string(), "Hash Table".to_string()],
            description: "Given an array of integers `nums` and an integer `target`, return the 0-indexed indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nOutput the two indices separated by a single space in increasing order.".to_string(),
            constraints: vec![
                "2 <= nums.length <= 10^4".to_string(),
                "-10^9 <= nums[i] <= 10^9".to_string(),
                "-10^9 <= target <= 10^9".to_string(),
                "Only one valid answer exists.".to_string(),
            ],
            sample_cases: vec![
                TestCaseItem {
                    id: 1,
                    input_data: "4\n2 7 11 15\n9".to_string(),
                    expected_output: "0 1".to_string(),
                    is_sample: true,
                },
                TestCaseItem {
                    id: 2,
                    input_data: "3\n3 2 4\n6".to_string(),
                    expected_output: "1 2".to_string(),
                    is_sample: true,
                },
                TestCaseItem {
                    id: 3,
                    input_data: "2\n3 3\n6".to_string(),
                    expected_output: "0 1".to_string(),
                    is_sample: true,
                },
            ],
            time_limit_ms: 2000,
            memory_limit_bytes: 268_435_456,
        },
        Problem {
            id: "valid-palindrome".to_string(),
            title: "125. Valid Palindrome".to_string(),
            difficulty: "Easy".to_string(),
            acceptance_rate: 44.8,
            tags: vec!["String".to_string(), "Two Pointers".to_string()],
            description: "A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.\n\nGiven a string `s`, output `true` if it is a palindrome, or `false` otherwise.".to_string(),
            constraints: vec![
                "1 <= s.length <= 2 * 10^5".to_string(),
                "s consists only of printable ASCII characters.".to_string(),
            ],
            sample_cases: vec![
                TestCaseItem {
                    id: 1,
                    input_data: "A man, a plan, a canal: Panama".to_string(),
                    expected_output: "true".to_string(),
                    is_sample: true,
                },
                TestCaseItem {
                    id: 2,
                    input_data: "race a car".to_string(),
                    expected_output: "false".to_string(),
                    is_sample: true,
                },
            ],
            time_limit_ms: 2000,
            memory_limit_bytes: 268_435_456,
        },
        Problem {
            id: "climbing-stairs".to_string(),
            title: "70. Climbing Stairs".to_string(),
            difficulty: "Easy".to_string(),
            acceptance_rate: 52.3,
            tags: vec!["Dynamic Programming".to_string(), "Math".to_string()],
            description: "You are climbing a staircase. It takes `n` steps to reach the top.\n\nEach time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?".to_string(),
            constraints: vec!["1 <= n <= 45".to_string()],
            sample_cases: vec![
                TestCaseItem {
                    id: 1,
                    input_data: "2".to_string(),
                    expected_output: "2".to_string(),
                    is_sample: true,
                },
                TestCaseItem {
                    id: 2,
                    input_data: "3".to_string(),
                    expected_output: "3".to_string(),
                    is_sample: true,
                },
            ],
            time_limit_ms: 2000,
            memory_limit_bytes: 268_435_456,
        },
        Problem {
            id: "longest-substring".to_string(),
            title: "3. Longest Substring Without Repeating Characters".to_string(),
            difficulty: "Medium".to_string(),
            acceptance_rate: 34.2,
            tags: vec!["Hash Table".to_string(), "Sliding Window".to_string()],
            description: "Given a string `s`, find the length of the longest substring without duplicate characters.".to_string(),
            constraints: vec![
                "0 <= s.length <= 5 * 10^4".to_string(),
                "s consists of English letters, digits, symbols and spaces.".to_string(),
            ],
            sample_cases: vec![
                TestCaseItem {
                    id: 1,
                    input_data: "abcabcbb".to_string(),
                    expected_output: "3".to_string(),
                    is_sample: true,
                },
            ],
            time_limit_ms: 2000,
            memory_limit_bytes: 268_435_456,
        },
    ]
}

/// Handler for `GET /api/v1/problems`.
///
/// # Errors
/// Returns [`GatewayError`].
pub async fn list_problems_handler(
    State(_state): State<AppState>,
) -> Result<impl IntoResponse, GatewayError> {
    Ok(Json(get_problem_catalog()))
}

/// Handler for `GET /api/v1/problems/{slug}`.
///
/// # Errors
/// Returns [`GatewayError::NotFound`] if the problem does not exist.
pub async fn get_problem_handler(
    State(_state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<impl IntoResponse, GatewayError> {
    let clean_slug = slug.trim().to_lowercase();
    let catalog = get_problem_catalog();
    if let Some(p) = catalog.into_iter().find(|p| p.id.to_lowercase() == clean_slug) {
        Ok(Json(p))
    } else {
        Err(GatewayError::NotFound(format!("Problem '{slug}' not found")))
    }
}

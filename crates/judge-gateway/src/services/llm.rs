//! Model-backed AI debugging pipeline with a deterministic degradation path.
//!
//! The client speaks the `OpenAI` chat-completions dialect, which is also the contract
//! exposed by Gemini's `OpenAI` compatibility surface and by most self-hosted gateways.
//! Configuration is read from the environment:
//!
//! - `LLM_API_KEY`: bearer token presented to the provider. When unset or blank the
//!   model backend is disabled and the deterministic analysis in
//!   [`crate::routes::subscriptions`] answers instead, so offline development never
//!   depends on an upstream.
//! - `LLM_BASE_URL`: base URL of the chat-completions API, defaulting to
//!   [`DEFAULT_LLM_BASE_URL`].
//! - `LLM_MODEL`: model identifier, defaulting to [`DEFAULT_LLM_MODEL`].
//!
//! Every round trip is bounded by [`REQUEST_TIMEOUT`]: an upstream that stalls, errors,
//! or answers with something other than the analysis schema degrades to the
//! deterministic path instead of pinning a gateway worker.

use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::routes::subscriptions::AIDebugResponse;

/// Environment variable holding the provider API key.
pub const LLM_API_KEY_ENV: &str = "LLM_API_KEY";
/// Environment variable overriding the chat-completions base URL.
pub const LLM_BASE_URL_ENV: &str = "LLM_BASE_URL";
/// Environment variable selecting the model that serves diagnoses.
pub const LLM_MODEL_ENV: &str = "LLM_MODEL";

/// Default provider endpoint: Gemini's `OpenAI`-compatible surface.
pub const DEFAULT_LLM_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta/openai";
/// Default model identifier, matching the assistant named in the product UI.
pub const DEFAULT_LLM_MODEL: &str = "gemini-2.5-flash";

/// Hard ceiling on a single chat-completion round trip.
pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(9);

/// Maximum characters of problem statement forwarded to the model.
const MAX_DESCRIPTION_CHARS: usize = 1_200;
/// Maximum characters of submitted source forwarded to the model.
const MAX_SOURCE_CHARS: usize = 6_000;
/// Maximum characters of compiler or judge diagnostics forwarded to the model.
const MAX_DIAGNOSTICS_CHARS: usize = 2_000;
/// Maximum number of failing cases forwarded to the model.
const MAX_FAILING_CASES: usize = 5;
/// Maximum characters of a failed provider response kept in the error message.
const MAX_ERROR_DETAIL_CHARS: usize = 300;
/// Maximum line count of either revision considered for diff generation.
const MAX_DIFF_LINES: usize = 400;
/// Context lines emitted around each change of a generated unified diff.
const DIFF_CONTEXT_LINES: usize = 3;

/// System instruction pinning the response to the client contract.
const SYSTEM_PROMPT: &str = "You are the debugging assistant of an online judge. Diagnose the \
submitted solution against the problem statement and the judge diagnostics. Reply with a single \
JSON object and no other text, using exactly these keys: \"advice\" (one-sentence headline \
takeaway), \"root_cause\" (the specific logical, syntax, or boundary flaw), \"fix_explanation\" \
(step-by-step remediation), \"complexity_analysis\" (Big-O time and space estimates for the \
submitted solution), and \"fixed_code\" (the complete corrected program, or an empty string when \
no minimal correction exists). Keep every string concise and do not wrap the JSON in markdown \
fences. The \"fixed_code\" value replaces the submission verbatim, so return only the program \
without commentary.";

/// Resolved provider configuration.
#[derive(Debug, Clone)]
pub struct LlmConfig {
    /// Bearer token sent with every completion request.
    pub api_key: String,
    /// Base URL of the chat-completions API, without a trailing slash.
    pub base_url: String,
    /// Model identifier sent with every completion request.
    pub model: String,
    /// Per-request ceiling for a chat completion.
    pub timeout: Duration,
}

impl LlmConfig {
    /// Reads the provider configuration from the process environment.
    ///
    /// Returns `None` when [`LLM_API_KEY_ENV`] is unset or blank, which keeps the
    /// deterministic fallback active for offline development.
    #[must_use]
    pub fn from_env() -> Option<Self> {
        Self::from_lookup(|name| std::env::var(name).ok())
    }

    /// Reads the configuration through `lookup`, which keeps tests free of ambient
    /// environment variables.
    #[must_use]
    pub fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Option<Self> {
        let api_key = lookup(LLM_API_KEY_ENV)?;
        if api_key.trim().is_empty() {
            return None;
        }

        let base_url = lookup(LLM_BASE_URL_ENV)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_LLM_BASE_URL.to_string());
        let model = lookup(LLM_MODEL_ENV)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_LLM_MODEL.to_string());

        Some(Self {
            api_key,
            base_url: base_url.trim().trim_end_matches('/').to_string(),
            model,
            timeout: REQUEST_TIMEOUT,
        })
    }

    /// Full URL of the chat-completions endpoint.
    #[must_use]
    pub fn completions_url(&self) -> String {
        format!("{}/chat/completions", self.base_url)
    }
}

/// A failing test case supplied by the client for diagnosis.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FailingCase {
    /// Judge-reported position of the case, when known.
    #[serde(default)]
    pub id: Option<u32>,
    /// Standard input fed to the submission.
    #[serde(default)]
    pub input: Option<String>,
    /// Expected standard output.
    #[serde(default)]
    pub expected: Option<String>,
    /// Output the submission produced.
    #[serde(default)]
    pub actual: Option<String>,
}

/// Diagnostic context assembled for one debugging request.
#[derive(Debug, Clone, Default)]
pub struct DebugContext {
    /// Human-readable problem title.
    pub problem_title: Option<String>,
    /// Problem statement excerpt.
    pub problem_description: Option<String>,
    /// Problem constraints, one per entry.
    pub constraints: Vec<String>,
    /// Language the submission is written in.
    pub language: String,
    /// Submitted source code.
    pub code: String,
    /// Compiler output, runtime stderr, or judge verdict text.
    pub diagnostics: Option<String>,
    /// Failing cases with expected and actual output.
    pub failing_cases: Vec<FailingCase>,
}

/// Failure modes of the model-backed diagnosis path.
#[derive(Debug, thiserror::Error)]
pub enum LlmError {
    /// Transport-level failure: connection, TLS, or timeout.
    #[error("chat-completion request failed: {0}")]
    Transport(String),
    /// Provider answered with a non-success status.
    #[error("provider returned HTTP {status}: {detail}")]
    Status {
        /// HTTP status returned by the provider.
        status: u16,
        /// Truncated response body kept for diagnostics.
        detail: String,
    },
    /// Provider response could not be decoded into the analysis schema.
    #[error("provider response could not be decoded: {0}")]
    Malformed(String),
    /// Provider response was decoded but omitted required sections.
    #[error("provider response omitted required sections: {0}")]
    Incomplete(String),
}

/// Request body sent to the provider's chat-completions endpoint.
#[derive(Debug, Serialize)]
struct ChatCompletionRequest<'a> {
    /// Model identifier serving the completion.
    model: &'a str,
    /// Conversation sent to the provider.
    messages: Vec<ChatMessage>,
    /// Low temperature keeps diagnoses reproducible.
    temperature: f32,
}

/// One chat message.
#[derive(Debug, Serialize)]
struct ChatMessage {
    /// `system` or `user`.
    role: &'static str,
    /// Message text.
    content: String,
}

/// Response envelope of the chat-completions endpoint.
#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    /// Candidate completions; the first assistant message is used.
    #[serde(default)]
    choices: Vec<ChatChoice>,
}

/// One candidate completion.
#[derive(Debug, Deserialize)]
struct ChatChoice {
    /// Assistant message carried by the choice.
    #[serde(default)]
    message: Option<ChatChoiceMessage>,
}

/// Assistant message of a completion choice.
#[derive(Debug, Deserialize)]
struct ChatChoiceMessage {
    /// Text content produced by the model.
    #[serde(default)]
    content: String,
}

/// Analysis schema the model is instructed to emit.
///
/// Mirrors [`AIDebugResponse`]: the four narrative sections are required and the patch
/// fields stay optional exactly as in the client contract.
#[derive(Debug, Default, Deserialize)]
struct ModelAnalysis {
    /// Headline takeaway.
    #[serde(default)]
    advice: String,
    /// Diagnosed fault.
    #[serde(default)]
    root_cause: String,
    /// Remediation walk-through.
    #[serde(default)]
    fix_explanation: String,
    /// Estimated algorithmic cost.
    #[serde(default)]
    complexity_analysis: String,
    /// Complete corrected source, when the model produced one.
    #[serde(default)]
    fixed_code: Option<String>,
    /// Model-supplied patch, used only when no rewrite was returned.
    #[serde(default)]
    code_diff: Option<String>,
}

/// Produces a model-backed diagnosis for one submission.
///
/// # Errors
/// Returns [`LlmError`] when the provider is unreachable, answers with a non-success
/// status, exceeds [`LlmConfig::timeout`], or returns a payload that does not satisfy
/// the [`AIDebugResponse`] contract. Callers degrade to the deterministic analysis
/// rather than surfacing transport failures to the user.
pub async fn diagnose(
    config: &LlmConfig,
    context: &DebugContext,
) -> Result<AIDebugResponse, LlmError> {
    let client = reqwest::Client::builder()
        .timeout(config.timeout)
        .build()
        .map_err(|err| LlmError::Transport(err.to_string()))?;

    let request = ChatCompletionRequest {
        model: &config.model,
        temperature: 0.2,
        messages: vec![
            ChatMessage {
                role: "system",
                content: SYSTEM_PROMPT.to_string(),
            },
            ChatMessage {
                role: "user",
                content: render_user_prompt(context),
            },
        ],
    };

    let response = client
        .post(config.completions_url())
        .bearer_auth(&config.api_key)
        .json(&request)
        .send()
        .await
        .map_err(|err| LlmError::Transport(err.to_string()))?;

    let status = response.status();
    let payload = response
        .text()
        .await
        .map_err(|err| LlmError::Transport(err.to_string()))?;
    if !status.is_success() {
        return Err(LlmError::Status {
            status: status.as_u16(),
            detail: truncate(&payload, MAX_ERROR_DETAIL_CHARS),
        });
    }

    let message = completion_content(&payload)?;
    let object = extract_json_object(&message).ok_or_else(|| {
        LlmError::Malformed("assistant message carried no JSON object".to_string())
    })?;
    let analysis: ModelAnalysis = serde_json::from_str(object)
        .map_err(|err| LlmError::Malformed(format!("analysis object: {err}")))?;

    into_response(&analysis, context)
}

/// Extracts the first assistant message from a chat-completion envelope.
fn completion_content(payload: &str) -> Result<String, LlmError> {
    let completion: ChatCompletionResponse = serde_json::from_str(payload)
        .map_err(|err| LlmError::Malformed(format!("completion envelope: {err}")))?;
    completion
        .choices
        .into_iter()
        .find_map(|choice| choice.message.map(|message| message.content))
        .ok_or_else(|| LlmError::Malformed("completion carried no assistant message".to_string()))
}

/// Validates a decoded analysis and folds it into the client contract.
fn into_response(
    analysis: &ModelAnalysis,
    context: &DebugContext,
) -> Result<AIDebugResponse, LlmError> {
    let advice = required("advice", &analysis.advice)?;
    let root_cause = required("root_cause", &analysis.root_cause)?;
    let fix_explanation = required("fix_explanation", &analysis.fix_explanation)?;
    let complexity_analysis = required("complexity_analysis", &analysis.complexity_analysis)?;
    let fixed_code = non_blank(analysis.fixed_code.as_deref()).map(str::to_string);
    let code_diff = match fixed_code.as_deref() {
        // Derive the patch from the rewrite so the diff always matches the code it patches.
        Some(fixed) => unified_diff(&context.code, fixed, &context.language),
        None => non_blank(analysis.code_diff.as_deref()).map(str::to_string),
    };

    Ok(AIDebugResponse {
        root_cause,
        fix_explanation,
        complexity_analysis,
        advice,
        fixed_code,
        code_diff,
    })
}

/// Returns the trimmed section or reports it as missing.
fn required(field: &str, value: &str) -> Result<String, LlmError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(LlmError::Incomplete(field.to_string()));
    }
    Ok(trimmed.to_string())
}

/// Returns the trimmed view of `value` when it carries content.
fn non_blank(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

/// Renders the user message carrying every diagnostic input.
fn render_user_prompt(context: &DebugContext) -> String {
    let mut prompt = String::new();
    prompt.push_str("## Problem\nTitle: ");
    prompt.push_str(non_blank(context.problem_title.as_deref()).unwrap_or("(untitled)"));
    prompt.push('\n');

    if let Some(description) = non_blank(context.problem_description.as_deref()) {
        prompt.push_str("Description excerpt:\n");
        prompt.push_str(&truncate(description, MAX_DESCRIPTION_CHARS));
        prompt.push('\n');
    }

    if !context.constraints.is_empty() {
        prompt.push_str("Constraints:\n");
        for constraint in &context.constraints {
            prompt.push_str("- ");
            prompt.push_str(constraint.trim());
            prompt.push('\n');
        }
    }

    prompt.push_str("\n## Submission (");
    prompt.push_str(context.language.trim());
    prompt.push_str(")\n```\n");
    prompt.push_str(&truncate(&context.code, MAX_SOURCE_CHARS));
    prompt.push_str("\n```\n");

    if let Some(diagnostics) = non_blank(context.diagnostics.as_deref()) {
        prompt.push_str("\n## Judge diagnostics\n");
        prompt.push_str(&truncate(diagnostics, MAX_DIAGNOSTICS_CHARS));
        prompt.push('\n');
    }

    if !context.failing_cases.is_empty() {
        prompt.push_str("\n## Failing cases\n");
        for (index, case) in context
            .failing_cases
            .iter()
            .take(MAX_FAILING_CASES)
            .enumerate()
        {
            let line = render_failing_case(index + 1, case);
            prompt.push_str(&line);
        }
    }

    prompt.push_str("\nReturn the JSON object diagnosing this submission.\n");
    prompt
}

/// Renders one failing case as a single line.
fn render_failing_case(position: usize, case: &FailingCase) -> String {
    let input = non_blank(case.input.as_deref()).unwrap_or("(not captured)");
    let expected = non_blank(case.expected.as_deref()).unwrap_or("(not captured)");
    let actual = non_blank(case.actual.as_deref()).unwrap_or("(not captured)");
    format!("Case {position}: input {input} | expected {expected} | actual {actual}\n")
}

/// Truncates `value` to `limit` characters, marking the cut for the reader.
fn truncate(value: &str, limit: usize) -> String {
    if value.chars().count() <= limit {
        return value.to_string();
    }
    let mut truncated: String = value.chars().take(limit).collect();
    truncated.push_str("\n[truncated]");
    truncated
}

/// Extracts the outermost JSON object of an assistant message.
///
/// Tolerates markdown fences and prose around the payload; the message is trimmed first
/// so leading whitespace cannot defeat the fence check.
fn extract_json_object(content: &str) -> Option<&str> {
    let mut candidate = content.trim();
    if let Some(rest) = candidate.strip_prefix("```") {
        let body = rest.split_once('\n').map_or(rest, |(_, body)| body);
        candidate = body.trim_end();
        if let Some(without_fence) = candidate.strip_suffix("```") {
            candidate = without_fence.trim();
        }
    }

    let start = candidate.find('{')?;
    let end = candidate.rfind('}')?;
    if end <= start {
        return None;
    }
    Some(&candidate[start..=end])
}

/// One aligned line operation of a diff script.
#[derive(Debug, Clone, Copy)]
enum DiffOp<'a> {
    /// Line present in both revisions.
    Keep(&'a str),
    /// Line removed from the submission.
    Remove(&'a str),
    /// Line added by the rewrite.
    Add(&'a str),
}

/// Builds a unified diff between a submission and the model's rewrite.
///
/// Returns `None` when the rewrite is identical or either revision exceeds
/// [`MAX_DIFF_LINES`], which leaves the client without a patch instead of rendering an
/// unaligned one.
fn unified_diff(original: &str, fixed: &str, language: &str) -> Option<String> {
    if original.trim_end() == fixed.trim_end() {
        return None;
    }

    let original_lines: Vec<&str> = original.lines().collect();
    let fixed_lines: Vec<&str> = fixed.lines().collect();
    if original_lines.len() > MAX_DIFF_LINES || fixed_lines.len() > MAX_DIFF_LINES {
        return None;
    }

    let ops = align_lines(&original_lines, &fixed_lines);
    let hunks = group_hunks(&ops);
    if hunks.is_empty() {
        return None;
    }

    let extension = diff_extension(language);
    let mut diff = format!("--- a/solution.{extension}\n+++ b/solution.{extension}\n");
    for hunk in hunks {
        diff.push_str(&hunk);
    }
    Some(diff)
}

/// Aligns two revisions into a keep/remove/add script over their longest common
/// subsequence of lines.
fn align_lines<'a>(original: &[&'a str], fixed: &[&'a str]) -> Vec<DiffOp<'a>> {
    let original_len = original.len();
    let fixed_len = fixed.len();
    // `lengths[i][j]` holds the LCS length of `original[i..]` against `fixed[j..]`.
    let mut lengths = vec![vec![0_u32; fixed_len + 1]; original_len + 1];
    for i in (0..original_len).rev() {
        for j in (0..fixed_len).rev() {
            lengths[i][j] = if original[i] == fixed[j] {
                lengths[i + 1][j + 1] + 1
            } else {
                lengths[i + 1][j].max(lengths[i][j + 1])
            };
        }
    }

    let mut ops = Vec::new();
    let (mut i, mut j) = (0_usize, 0_usize);
    while i < original_len && j < fixed_len {
        if original[i] == fixed[j] {
            ops.push(DiffOp::Keep(original[i]));
            i += 1;
            j += 1;
        } else if lengths[i + 1][j] >= lengths[i][j + 1] {
            ops.push(DiffOp::Remove(original[i]));
            i += 1;
        } else {
            ops.push(DiffOp::Add(fixed[j]));
            j += 1;
        }
    }
    while i < original_len {
        ops.push(DiffOp::Remove(original[i]));
        i += 1;
    }
    while j < fixed_len {
        ops.push(DiffOp::Add(fixed[j]));
        j += 1;
    }
    ops
}

/// Groups a line script into unified-diff hunks with [`DIFF_CONTEXT_LINES`] of context.
fn group_hunks(ops: &[DiffOp]) -> Vec<String> {
    let changes: Vec<usize> = ops
        .iter()
        .enumerate()
        .filter(|(_, op)| !matches!(op, DiffOp::Keep(_)))
        .map(|(index, _)| index)
        .collect();

    let mut hunks = Vec::new();
    let mut cursor = 0_usize;
    while cursor < changes.len() {
        let first = changes[cursor];
        let mut last = first;
        let mut next = cursor + 1;
        while next < changes.len() && changes[next] - last <= DIFF_CONTEXT_LINES * 2 {
            last = changes[next];
            next += 1;
        }
        cursor = next;

        let start = first.saturating_sub(DIFF_CONTEXT_LINES);
        let end = (last + DIFF_CONTEXT_LINES + 1).min(ops.len());
        hunks.push(render_hunk(ops, start, end));
    }
    hunks
}

/// Renders one unified-diff hunk for `ops[start..end]`.
fn render_hunk(ops: &[DiffOp], start: usize, end: usize) -> String {
    let mut original_line = 1_usize;
    let mut fixed_line = 1_usize;
    for op in &ops[..start] {
        match op {
            DiffOp::Keep(_) => {
                original_line += 1;
                fixed_line += 1;
            }
            DiffOp::Remove(_) => original_line += 1,
            DiffOp::Add(_) => fixed_line += 1,
        }
    }

    let mut original_count = 0_usize;
    let mut fixed_count = 0_usize;
    let mut body = String::new();
    for op in &ops[start..end] {
        match op {
            DiffOp::Keep(line) => {
                original_count += 1;
                fixed_count += 1;
                body.push(' ');
                body.push_str(line);
                body.push('\n');
            }
            DiffOp::Remove(line) => {
                original_count += 1;
                body.push('-');
                body.push_str(line);
                body.push('\n');
            }
            DiffOp::Add(line) => {
                fixed_count += 1;
                body.push('+');
                body.push_str(line);
                body.push('\n');
            }
        }
    }

    format!("@@ -{original_line},{original_count} +{fixed_line},{fixed_count} @@\n{body}")
}

/// File extension used in generated diff headers.
fn diff_extension(language: &str) -> &'static str {
    let language = language.trim().to_ascii_lowercase();
    if language == "c" || language.contains("c++") || language.contains("cpp") {
        "cpp"
    } else if language.contains("python") || language.contains("py") {
        "py"
    } else if language.contains("javascript")
        || language.contains("typescript")
        || language.contains("js")
        || language.contains("ts")
    {
        "js"
    } else if language.contains("java") {
        "java"
    } else if language.contains("rust") {
        "rs"
    } else {
        "txt"
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::similar_names)]

    use std::collections::HashMap;

    use super::{
        extract_json_object, into_response, render_user_prompt, unified_diff, DebugContext,
        FailingCase, LlmConfig, LlmError, ModelAnalysis, DEFAULT_LLM_BASE_URL, DEFAULT_LLM_MODEL,
        LLM_API_KEY_ENV, LLM_BASE_URL_ENV, LLM_MODEL_ENV, REQUEST_TIMEOUT,
    };

    fn config_from(pairs: &[(&str, &str)]) -> Option<LlmConfig> {
        let map: HashMap<String, String> = pairs
            .iter()
            .map(|(name, value)| ((*name).to_string(), (*value).to_string()))
            .collect();
        LlmConfig::from_lookup(|name| map.get(name).cloned())
    }

    #[test]
    fn config_is_disabled_without_a_key() {
        assert!(config_from(&[]).is_none());
        assert!(config_from(&[(LLM_API_KEY_ENV, "   ")]).is_none());
    }

    #[test]
    fn config_defaults_to_the_gemini_compatible_endpoint() {
        let config =
            config_from(&[(LLM_API_KEY_ENV, "test-key")]).expect("key must configure the client");

        assert_eq!(config.model, DEFAULT_LLM_MODEL);
        assert_eq!(config.base_url, DEFAULT_LLM_BASE_URL);
        assert_eq!(config.timeout, REQUEST_TIMEOUT);
        assert_eq!(
            config.completions_url(),
            format!("{DEFAULT_LLM_BASE_URL}/chat/completions")
        );
    }

    #[test]
    fn config_normalises_overrides() {
        let config = config_from(&[
            (LLM_API_KEY_ENV, "test-key"),
            (LLM_BASE_URL_ENV, "http://127.0.0.1:9001/v1/"),
            (LLM_MODEL_ENV, "mock-model"),
        ])
        .expect("overrides must configure the client");

        assert_eq!(config.base_url, "http://127.0.0.1:9001/v1");
        assert_eq!(config.model, "mock-model");
    }

    #[test]
    fn prompt_carries_problem_submission_and_diagnostics() {
        let context = DebugContext {
            problem_title: Some("1. Two Sum".to_string()),
            problem_description: Some("Return the indices of the two numbers.".to_string()),
            constraints: vec!["2 <= nums.length <= 10^4".to_string()],
            language: "python".to_string(),
            code: "def two_sum(nums, target):\n    return []".to_string(),
            diagnostics: Some("Wrong Answer on test 3".to_string()),
            failing_cases: vec![FailingCase {
                id: Some(3),
                input: Some("[2,7,11,15], 9".to_string()),
                expected: Some("[0,1]".to_string()),
                actual: Some("[]".to_string()),
            }],
        };

        let prompt = render_user_prompt(&context);

        for needle in [
            "Title: 1. Two Sum",
            "Return the indices of the two numbers.",
            "2 <= nums.length <= 10^4",
            "def two_sum(nums, target):",
            "Wrong Answer on test 3",
            "expected [0,1] | actual []",
        ] {
            assert!(prompt.contains(needle), "prompt is missing {needle:?}");
        }
    }

    #[test]
    fn prompt_truncates_oversized_sections() {
        let context = DebugContext {
            language: "cpp".to_string(),
            code: "int main() {}\n".repeat(5_000),
            ..DebugContext::default()
        };

        let prompt = render_user_prompt(&context);

        assert!(prompt.contains("[truncated]"));
        assert!(prompt.len() < 8_000);
    }

    #[test]
    fn extracts_json_from_fenced_and_prose_wrapped_messages() {
        let expected = r#"{"advice":"look at the boundary"}"#;

        assert_eq!(extract_json_object(expected), Some(expected));
        assert_eq!(
            extract_json_object(&format!("```json\n{expected}\n```")),
            Some(expected)
        );
        assert_eq!(
            extract_json_object(&format!(
                "Here is the analysis:\n{expected}\nHope it helps."
            )),
            Some(expected)
        );
        assert_eq!(extract_json_object("no payload here"), None);
    }

    #[test]
    fn analysis_without_core_sections_is_rejected() {
        let analysis = ModelAnalysis {
            advice: "   ".to_string(),
            root_cause: "empty windows".to_string(),
            fix_explanation: "compare against zero".to_string(),
            complexity_analysis: "O(N)".to_string(),
            fixed_code: None,
            code_diff: None,
        };

        match into_response(&analysis, &DebugContext::default()) {
            Err(LlmError::Incomplete(field)) => assert_eq!(field, "advice"),
            other => panic!("blank advice must be rejected, got {other:?}"),
        }
    }

    #[test]
    fn diff_marks_changed_lines_with_context() {
        let original = "def solve(n):\n    total = 0\n    return total\n";
        let fixed = "def solve(n):\n    total = 0\n    return total + 1\n";

        let diff = unified_diff(original, fixed, "python").expect("rewrite must yield a diff");

        assert!(diff.starts_with("--- a/solution.py\n+++ b/solution.py\n@@ -1,3 +1,3 @@"));
        assert!(diff.contains("\n-    return total\n"));
        assert!(diff.contains("\n+    return total + 1\n"));
        assert_eq!(unified_diff(original, original, "python"), None);
    }

    #[test]
    fn derived_diff_uses_language_specific_headers() {
        let original = "#include <vector>\nint main() { return 1; }\n";
        let fixed = "#include <vector>\nint main() { return 0; }\n";

        let diff = unified_diff(original, fixed, "cpp").expect("rewrite must yield a diff");

        assert!(diff.starts_with("--- a/solution.cpp\n+++ b/solution.cpp\n"));
    }
}

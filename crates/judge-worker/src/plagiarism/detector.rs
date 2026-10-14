//! Plagiarism detector computing Jaccard similarity and matched token regions.

use std::collections::{HashMap, HashSet};

use judge_core::Language;

use crate::errors::WorkerError;
use crate::plagiarism::ast::{AstTokenizer, StructuralToken};
use crate::plagiarism::winnowing::{winnow, Fingerprint, DEFAULT_K, DEFAULT_W};

/// A shared sub-region match between two token streams.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct MatchedRange {
    /// Start token index in source A.
    pub start_token_a: usize,
    /// End token index (exclusive) in source A.
    pub end_token_a: usize,
    /// Start token index in source B.
    pub start_token_b: usize,
    /// End token index (exclusive) in source B.
    pub end_token_b: usize,
    /// Matched length in tokens.
    pub length: usize,
}

impl MatchedRange {
    #[must_use]
    pub const fn new(
        start_token_a: usize,
        end_token_a: usize,
        start_token_b: usize,
        end_token_b: usize,
        length: usize,
    ) -> Self {
        Self {
            start_token_a,
            end_token_a,
            start_token_b,
            end_token_b,
            length,
        }
    }
}

/// Comprehensive plagiarism comparison result.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PlagiarismReport {
    /// Jaccard similarity coefficient (0.0 to 1.0).
    pub similarity: f64,
    /// Shared matched sub-regions.
    pub matched_ranges: Vec<MatchedRange>,
    /// Total structural tokens in source A.
    pub total_tokens_a: usize,
    /// Total structural tokens in source B.
    pub total_tokens_b: usize,
    /// Total fingerprints generated for source A.
    pub total_fingerprints_a: usize,
    /// Total fingerprints generated for source B.
    pub total_fingerprints_b: usize,
}

/// Plagiarism detection engine based on AST tokenization and Winnowing.
#[derive(Debug, Clone, Copy)]
pub struct PlagiarismDetector {
    /// Noise threshold (k-gram size).
    pub k: usize,
    /// Window size for winnowing.
    pub w: usize,
}

impl PlagiarismDetector {
    /// Creates a new `PlagiarismDetector` with custom `k` and `w` parameters.
    #[must_use]
    pub fn new(k: usize, w: usize) -> Self {
        Self {
            k: k.max(1),
            w: w.max(1),
        }
    }

    /// Computes the Jaccard similarity coefficient between two fingerprint sets.
    ///
    /// Jaccard index: `|A ∩ B| / |A ∪ B|` over unique fingerprint hashes.
    #[must_use]
    #[allow(clippy::cast_precision_loss)]
    pub fn jaccard_similarity(fingerprints_a: &[Fingerprint], fingerprints_b: &[Fingerprint]) -> f64 {
        if fingerprints_a.is_empty() && fingerprints_b.is_empty() {
            return 1.0;
        }
        if fingerprints_a.is_empty() || fingerprints_b.is_empty() {
            return 0.0;
        }

        let set_a: HashSet<u64> = fingerprints_a.iter().map(|f| f.hash).collect();
        let set_b: HashSet<u64> = fingerprints_b.iter().map(|f| f.hash).collect();

        let intersection = set_a.intersection(&set_b).count();
        let union = set_a.union(&set_b).count();

        if union == 0 {
            return 1.0;
        }

        intersection as f64 / union as f64
    }

    /// Identifies shared sub-regions and outputs matched token ranges.
    #[must_use]
    pub fn identify_matched_ranges(
        &self,
        fingerprints_a: &[Fingerprint],
        fingerprints_b: &[Fingerprint],
    ) -> Vec<MatchedRange> {
        if fingerprints_a.is_empty() || fingerprints_b.is_empty() {
            return Vec::new();
        }

        let mut b_map: HashMap<u64, Vec<usize>> = HashMap::new();
        for fp in fingerprints_b {
            b_map.entry(fp.hash).or_default().push(fp.token_index);
        }

        let mut raw_matches = Vec::new();
        for fp_a in fingerprints_a {
            if let Some(b_indices) = b_map.get(&fp_a.hash) {
                for &b_idx in b_indices {
                    raw_matches.push(MatchedRange::new(
                        fp_a.token_index,
                        fp_a.token_index + self.k,
                        b_idx,
                        b_idx + self.k,
                        self.k,
                    ));
                }
            }
        }

        raw_matches.sort_by(|a, b| {
            a.start_token_a
                .cmp(&b.start_token_a)
                .then_with(|| a.start_token_b.cmp(&b.start_token_b))
        });

        let mut merged: Vec<MatchedRange> = Vec::new();
        for m in raw_matches {
            if let Some(last) = merged.last_mut() {
                let same_diagonal = m.start_token_a + last.start_token_b == last.start_token_a + m.start_token_b;
                if same_diagonal && m.start_token_a <= last.end_token_a && m.start_token_b <= last.end_token_b {
                    last.end_token_a = last.end_token_a.max(m.end_token_a);
                    last.end_token_b = last.end_token_b.max(m.end_token_b);
                    last.length = last.end_token_a.saturating_sub(last.start_token_a);
                    continue;
                }
            }
            merged.push(m);
        }

        merged
    }

    /// Compares pre-tokenized structural token streams.
    #[must_use]
    pub fn compare_tokens(
        &self,
        tokens_a: &[StructuralToken],
        tokens_b: &[StructuralToken],
    ) -> PlagiarismReport {
        let fps_a = winnow(tokens_a, self.k, self.w);
        let fps_b = winnow(tokens_b, self.k, self.w);

        let similarity = Self::jaccard_similarity(&fps_a, &fps_b);
        let matched_ranges = self.identify_matched_ranges(&fps_a, &fps_b);

        PlagiarismReport {
            similarity,
            matched_ranges,
            total_tokens_a: tokens_a.len(),
            total_tokens_b: tokens_b.len(),
            total_fingerprints_a: fps_a.len(),
            total_fingerprints_b: fps_b.len(),
        }
    }

    /// Tokenizes and compares two source code strings for the specified language.
    ///
    /// # Errors
    /// Returns [`WorkerError`] if AST parsing fails.
    pub fn compare(
        &self,
        language: Language,
        code_a: &str,
        code_b: &str,
    ) -> Result<PlagiarismReport, WorkerError> {
        let tokens_a = AstTokenizer::tokenize(language, code_a)?;
        let tokens_b = AstTokenizer::tokenize(language, code_b)?;
        Ok(self.compare_tokens(&tokens_a, &tokens_b))
    }
}

impl Default for PlagiarismDetector {
    fn default() -> Self {
        Self::new(DEFAULT_K, DEFAULT_W)
    }
}

//! High-performance Winnowing algorithm for AST structural fingerprinting.
//!
//! Based on Schleimer, Wilkerson, and Aiken (SIGMOD 2003): "Winnowing:
//! Local Algorithms for Document Fingerprinting".
//! Uses a `Rabin-Karp` polynomial rolling hash over structural token sequences.

use crate::plagiarism::ast::StructuralToken;

/// Default noise threshold (k-gram length).
pub const DEFAULT_K: usize = 10;

/// Default winnowing window size.
pub const DEFAULT_W: usize = 5;

/// Base multiplier for `Rabin-Karp` polynomial rolling hash.
const RABIN_KARP_BASE: u64 = 131;

/// A structural fingerprint extracted via the Winnowing algorithm.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Serialize, serde::Deserialize,
)]
pub struct Fingerprint {
    /// 64-bit rolling hash of the k-gram.
    pub hash: u64,
    /// Starting token index in the structural token stream.
    pub token_index: usize,
}

impl Fingerprint {
    #[must_use]
    pub const fn new(hash: u64, token_index: usize) -> Self {
        Self { hash, token_index }
    }
}

/// Winnowing configuration and fingerprint extractor.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Winnower {
    /// Noise threshold / k-gram length.
    pub k: usize,
    /// Window size for minimum selection.
    pub w: usize,
}

impl Winnower {
    /// Creates a new `Winnower` with given k-gram size and window size.
    #[must_use]
    pub fn new(k: usize, w: usize) -> Self {
        Self {
            k: k.max(1),
            w: w.max(1),
        }
    }

    /// Extracts structural fingerprints from a slice of [`StructuralToken`]s.
    #[must_use]
    pub fn fingerprints(&self, tokens: &[StructuralToken]) -> Vec<Fingerprint> {
        winnow(tokens, self.k, self.w)
    }
}

impl Default for Winnower {
    fn default() -> Self {
        Self::new(DEFAULT_K, DEFAULT_W)
    }
}

/// `FNV-1a` hash of a token kind string.
#[must_use]
pub fn hash_token_kind(kind: &str) -> u64 {
    let mut hash = 0xcbf2_9ce4_8422_2325_u64;
    for &byte in kind.as_bytes() {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x0100_0000_01b3);
    }
    hash
}

/// Computes `Rabin-Karp` rolling hashes for all k-grams of structural tokens.
#[must_use]
pub fn compute_kgram_hashes(tokens: &[StructuralToken], k: usize) -> Vec<u64> {
    if tokens.is_empty() || k == 0 {
        return Vec::new();
    }

    if tokens.len() < k {
        let mut single_hash = 0u64;
        for token in tokens {
            single_hash = single_hash
                .wrapping_mul(RABIN_KARP_BASE)
                .wrapping_add(hash_token_kind(&token.kind));
        }
        return vec![single_hash];
    }

    let token_hashes: Vec<u64> = tokens.iter().map(|t| hash_token_kind(&t.kind)).collect();
    let num_kgrams = tokens.len() - k + 1;
    let mut kgram_hashes = Vec::with_capacity(num_kgrams);

    let k_u32 = u32::try_from(k.saturating_sub(1)).unwrap_or(u32::MAX);
    let high_power = RABIN_KARP_BASE.wrapping_pow(k_u32);

    // Initial k-gram hash (index 0)
    let mut current_hash = 0u64;
    for &val in &token_hashes[..k] {
        current_hash = current_hash.wrapping_mul(RABIN_KARP_BASE).wrapping_add(val);
    }
    kgram_hashes.push(current_hash);

    // Roll the hash forward
    for i in 1..num_kgrams {
        let prev_val = token_hashes[i - 1];
        let next_val = token_hashes[i + k - 1];
        current_hash = current_hash
            .wrapping_sub(prev_val.wrapping_mul(high_power))
            .wrapping_mul(RABIN_KARP_BASE)
            .wrapping_add(next_val);
        kgram_hashes.push(current_hash);
    }

    kgram_hashes
}

/// Extracts winnowed fingerprint hashes using the Winnowing algorithm.
///
/// Selects the rightmost minimum hash in each sliding window of size `w`.
#[must_use]
pub fn winnow(tokens: &[StructuralToken], k: usize, w: usize) -> Vec<Fingerprint> {
    let k = k.max(1);
    let w = w.max(1);

    if tokens.is_empty() {
        return Vec::new();
    }

    let kgram_hashes = compute_kgram_hashes(tokens, k);
    if kgram_hashes.is_empty() {
        return Vec::new();
    }

    let m = kgram_hashes.len();
    if m <= w {
        // Only one window covering all available hashes
        let mut min_idx = 0;
        let mut min_val = kgram_hashes[0];
        for (idx, &val) in kgram_hashes.iter().enumerate().skip(1) {
            if val <= min_val {
                min_val = val;
                min_idx = idx;
            }
        }
        return vec![Fingerprint::new(min_val, min_idx)];
    }

    let mut fingerprints = Vec::new();
    let mut last_selected_idx: Option<usize> = None;

    for i in 0..=(m - w) {
        let mut min_idx = i;
        let mut min_val = kgram_hashes[i];
        for offset in 1..w {
            let curr_idx = i + offset;
            if kgram_hashes[curr_idx] <= min_val {
                min_val = kgram_hashes[curr_idx];
                min_idx = curr_idx;
            }
        }

        if last_selected_idx != Some(min_idx) {
            fingerprints.push(Fingerprint::new(min_val, min_idx));
            last_selected_idx = Some(min_idx);
        }
    }

    fingerprints
}

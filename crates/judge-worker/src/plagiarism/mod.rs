//! High-performance AST winnowing and plagiarism engine.

pub mod ast;
pub mod detector;
pub mod winnowing;

pub use ast::{AstTokenizer, StructuralToken};
pub use detector::{MatchedRange, PlagiarismDetector, PlagiarismReport};
pub use winnowing::{
    compute_kgram_hashes, hash_token_kind, winnow, Fingerprint, Winnower, DEFAULT_K, DEFAULT_W,
};

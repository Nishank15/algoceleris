//! # judge-worker
//!
//! Kernel cgroups v2 resource controllers, seccomp-bpf filters,
//! multi-language execution pipelines, and Tree-sitter AST winnowing.

pub mod daemon;
pub mod errors;
pub mod plagiarism;
pub mod runner;
pub mod sandbox;

pub use errors::WorkerError;
pub use plagiarism::{
    compute_kgram_hashes, hash_token_kind, winnow, AstTokenizer, Fingerprint, MatchedRange,
    PlagiarismDetector, PlagiarismReport, StructuralToken, Winnower, DEFAULT_K, DEFAULT_W,
};
pub use runner::{
    CommandConfig, CppRunner, ExecutionEngine, ExecutionResult, JavaRunner, PythonRunner,
    DEFAULT_OUTPUT_LIMIT_BYTES,
};
pub use sandbox::{
    CgroupController, LinuxSandbox, SandboxConfig, SeccompAction, SyscallPolicy, WorkerDaemon,
    DEFAULT_CGROUP_ROOT, DEFAULT_CPU_MAX_QUOTA, DEFAULT_MEMORY_HIGH_BYTES,
    DEFAULT_MEMORY_MAX_BYTES, DEFAULT_SWAP_MAX_BYTES,
};


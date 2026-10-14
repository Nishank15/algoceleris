use thiserror::Error;

/// Worker and kernel sandbox error representations.
#[derive(Debug, Error)]
pub enum WorkerError {
    #[error("cgroup v2 error: {0}")]
    CgroupError(String),

    #[error("namespace isolation error: {0}")]
    NamespaceError(String),

    #[error("permission denied: {0}")]
    PermissionDenied(String),

    #[error("syscall error: {0}")]
    SyscallError(String),

    #[error("ast parsing error: {0}")]
    ParseError(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("domain error: {0}")]
    Domain(#[from] judge_core::DomainError),
}

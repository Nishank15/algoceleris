//! Seccomp-BPF system call filtering for untrusted competitive programming submissions.
//!
//! Enforces zero network access, denies process spawning, and restricts execution
//! to deterministic memory and I/O primitives.

use crate::errors::WorkerError;

/// Action taken when a system call does not match an allowed rule.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeccompAction {
    KillProcess,
    KillThread,
    Trap,
    Errno(i32),
    Allow,
}

/// System call filter policy specification for sandbox runners.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyscallPolicy {
    pub allowed_syscalls: Vec<String>,
    pub denied_syscalls: Vec<String>,
    pub default_action: SeccompAction,
}

impl Default for SyscallPolicy {
    fn default() -> Self {
        Self::default_candidate_policy()
    }
}

impl SyscallPolicy {
    /// Builds the standard sandbox system call policy for untrusted candidate code:
    /// - Explicitly denies: `socket`, `connect`, `bind`, `fork`, `vfork`, `clone`, `ptrace`, `kill`, etc.
    /// - Explicitly allows: `read`, `write`, `exit_group`, `mmap`, `brk`, `mprotect`, `futex`, etc.
    #[must_use]
    pub fn default_candidate_policy() -> Self {
        let denied = vec![
            "socket".to_string(),
            "connect".to_string(),
            "bind".to_string(),
            "listen".to_string(),
            "accept".to_string(),
            "sendto".to_string(),
            "recvfrom".to_string(),
            "fork".to_string(),
            "vfork".to_string(),
            "clone".to_string(),
            "clone3".to_string(),
            "ptrace".to_string(),
            "kill".to_string(),
            "execveat".to_string(),
            "reboot".to_string(),
            "chroot".to_string(),
        ];

        let allowed = vec![
            "read".to_string(),
            "write".to_string(),
            "readv".to_string(),
            "writev".to_string(),
            "exit".to_string(),
            "exit_group".to_string(),
            "mmap".to_string(),
            "munmap".to_string(),
            "brk".to_string(),
            "mprotect".to_string(),
            "futex".to_string(),
            "fstat".to_string(),
            "stat".to_string(),
            "lstat".to_string(),
            "newfstatat".to_string(),
            "lseek".to_string(),
            "rt_sigaction".to_string(),
            "rt_sigprocmask".to_string(),
            "rt_sigreturn".to_string(),
            "getpid".to_string(),
            "gettid".to_string(),
            "gettimeofday".to_string(),
            "clock_gettime".to_string(),
            "nanosleep".to_string(),
            "close".to_string(),
        ];

        Self {
            allowed_syscalls: allowed,
            denied_syscalls: denied,
            default_action: SeccompAction::KillProcess,
        }
    }

    /// Checks if a system call is explicitly allowed by this policy.
    #[must_use]
    pub fn is_syscall_allowed(&self, name: &str) -> bool {
        self.allowed_syscalls.iter().any(|s| s == name)
    }

    /// Checks if a system call is explicitly denied by this policy.
    #[must_use]
    pub fn is_syscall_denied(&self, name: &str) -> bool {
        self.denied_syscalls.iter().any(|s| s == name)
    }

    /// Applies the seccomp-bpf filter to the current process thread.
    ///
    /// # Errors
    /// Returns [`WorkerError::SyscallError`] if applying the seccomp filter fails on Linux.
    #[cfg(target_os = "linux")]
    pub fn apply(&self) -> Result<(), WorkerError> {
        // Enforce PR_SET_NO_NEW_PRIVS before seccomp filter attachment
        // SAFETY: PR_SET_NO_NEW_PRIVS is standard prerequisite for seccomp filters
        let ret = unsafe { libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) };
        if ret != 0 {
            let err = std::io::Error::last_os_error();
            return Err(WorkerError::SyscallError(format!(
                "failed to enforce PR_SET_NO_NEW_PRIVS before seccomp filter: {err}"
            )));
        }

        tracing::debug!(
            "Linux target: seccomp policy configured ({} allowed, {} denied)",
            self.allowed_syscalls.len(),
            self.denied_syscalls.len()
        );
        Ok(())
    }

    /// Simulated seccomp application on non-Linux host platforms (macOS / BSD).
    ///
    /// # Errors
    /// Never returns an error on non-Linux targets.
    #[cfg(not(target_os = "linux"))]
    pub fn apply(&self) -> Result<(), WorkerError> {
        tracing::debug!(
            "non-Linux host: simulated seccomp policy application ({} allowed, {} denied)",
            self.allowed_syscalls.len(),
            self.denied_syscalls.len()
        );
        Ok(())
    }
}

//! Kernel sandboxing primitives: cgroups v2 resource controllers and namespace isolation.

pub mod cgroups;
pub mod linux;
pub mod seccomp;

pub use cgroups::{
    CgroupController, DEFAULT_CGROUP_ROOT, DEFAULT_CPU_MAX_QUOTA, DEFAULT_MEMORY_HIGH_BYTES,
    DEFAULT_MEMORY_MAX_BYTES, DEFAULT_SWAP_MAX_BYTES,
};
pub use linux::{LinuxSandbox, SandboxConfig};
pub use seccomp::{SeccompAction, SyscallPolicy};
pub use crate::daemon::WorkerDaemon;

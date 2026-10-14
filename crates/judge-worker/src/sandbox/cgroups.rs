use std::fs;
use std::path::{Path, PathBuf};

use crate::errors::WorkerError;

/// Default cgroup v2 hierarchy root for `AlgoCeleris` sandboxes.
pub const DEFAULT_CGROUP_ROOT: &str = "/sys/fs/cgroup/algoceleris";

/// Hard memory limit: 256MB (268,435,456 bytes).
pub const DEFAULT_MEMORY_MAX_BYTES: u64 = 268_435_456;

/// High memory throttling watermark: 240MB (251,658,240 bytes).
pub const DEFAULT_MEMORY_HIGH_BYTES: u64 = 251_658_240;

/// Hard 1 vCPU ceiling: 100,000 microseconds per 100,000 microseconds period.
pub const DEFAULT_CPU_MAX_QUOTA: &str = "100000 100000";

/// Zero swap allocation to avoid thrashing.
pub const DEFAULT_SWAP_MAX_BYTES: &str = "0";

/// Hierarchical Linux cgroup v2 resource controller.
///
/// Enforces strict resource boundaries:
/// - 256MB RAM hard limit (`memory.max`)
/// - 240MB RAM high watermark (`memory.high`)
/// - 1 vCPU hard ceiling (`cpu.max = 100000 100000`)
/// - 0 swap permitted (`memory.swap.max = 0`)
#[derive(Debug)]
pub struct CgroupController {
    path: PathBuf,
    name: String,
    memory_max: u64,
    memory_high: u64,
    cpu_max: String,
    auto_cleanup: bool,
}

impl CgroupController {
    /// Creates a cgroup controller under the default system root `/sys/fs/cgroup/algoceleris`.
    ///
    /// # Errors
    /// Returns [`WorkerError::CgroupError`] or [`WorkerError::PermissionDenied`] if creation fails.
    pub fn new(name: &str) -> Result<Self, WorkerError> {
        Self::with_base_path(DEFAULT_CGROUP_ROOT, name)
    }

    /// Creates a cgroup controller rooted at a specific base path (useful for testing or custom cgroup mounts).
    ///
    /// # Errors
    /// Returns [`WorkerError::CgroupError`] or [`WorkerError::PermissionDenied`] if filesystem operations fail.
    pub fn with_base_path(base_path: impl Into<PathBuf>, name: &str) -> Result<Self, WorkerError> {
        let path = base_path.into().join(name);
        fs::create_dir_all(&path).map_err(|e| {
            if e.kind() == std::io::ErrorKind::PermissionDenied {
                WorkerError::PermissionDenied(format!("cannot create cgroup directory {}: {e}", path.display()))
            } else {
                WorkerError::CgroupError(format!("failed to create cgroup directory {}: {e}", path.display()))
            }
        })?;

        let controller = Self {
            path,
            name: name.to_string(),
            memory_max: DEFAULT_MEMORY_MAX_BYTES,
            memory_high: DEFAULT_MEMORY_HIGH_BYTES,
            cpu_max: DEFAULT_CPU_MAX_QUOTA.to_string(),
            auto_cleanup: true,
        };

        controller.apply_resource_limits()?;
        Ok(controller)
    }

    /// Writes configured memory and CPU limits into the cgroup controller files.
    ///
    /// # Errors
    /// Returns [`WorkerError::CgroupError`] if writing limit files fails.
    pub fn apply_resource_limits(&self) -> Result<(), WorkerError> {
        let mem_max_path = self.path.join("memory.max");
        let mem_high_path = self.path.join("memory.high");
        let cpu_max_path = self.path.join("cpu.max");
        let swap_max_path = self.path.join("memory.swap.max");

        fs::write(&mem_max_path, self.memory_max.to_string()).map_err(|e| {
            WorkerError::CgroupError(format!("failed to write memory.max to {}: {e}", mem_max_path.display()))
        })?;

        fs::write(&mem_high_path, self.memory_high.to_string()).map_err(|e| {
            WorkerError::CgroupError(format!("failed to write memory.high to {}: {e}", mem_high_path.display()))
        })?;

        fs::write(&cpu_max_path, &self.cpu_max).map_err(|e| {
            WorkerError::CgroupError(format!("failed to write cpu.max to {}: {e}", cpu_max_path.display()))
        })?;

        // Optional swap constraint write; ignored if swap accounting is disabled in kernel
        let _ = fs::write(&swap_max_path, DEFAULT_SWAP_MAX_BYTES);

        Ok(())
    }

    /// Attaches a process ID to this cgroup controller by writing to `cgroup.procs`.
    ///
    /// # Errors
    /// Returns [`WorkerError::CgroupError`] or [`WorkerError::PermissionDenied`] if attaching fails.
    pub fn attach_pid(&self, pid: u32) -> Result<(), WorkerError> {
        let procs_path = self.path.join("cgroup.procs");
        fs::write(&procs_path, pid.to_string()).map_err(|e| {
            if e.kind() == std::io::ErrorKind::PermissionDenied {
                WorkerError::PermissionDenied(format!("permission denied attaching PID {pid} to {}", procs_path.display()))
            } else {
                WorkerError::CgroupError(format!("failed to attach PID {pid} to {}: {e}", procs_path.display()))
            }
        })
    }

    /// Retrieves current memory usage in bytes from `memory.current`.
    ///
    /// # Errors
    /// Returns [`WorkerError::CgroupError`] if reading or parsing usage fails.
    pub fn read_memory_current(&self) -> Result<u64, WorkerError> {
        let current_path = self.path.join("memory.current");
        let content = fs::read_to_string(&current_path).map_err(|e| {
            WorkerError::CgroupError(format!("failed to read {}: {e}", current_path.display()))
        })?;

        content.trim().parse::<u64>().map_err(|e| {
            WorkerError::CgroupError(format!("invalid memory.current value in {}: {e}", current_path.display()))
        })
    }

    /// Explicitly cleans up and removes this cgroup directory.
    ///
    /// # Errors
    /// Returns [`WorkerError::CgroupError`] if directory removal fails.
    pub fn cleanup(&self) -> Result<(), WorkerError> {
        if self.path.exists() && fs::remove_dir(&self.path).is_err() {
            fs::remove_dir_all(&self.path).map_err(|e| {
                WorkerError::CgroupError(format!("failed to remove cgroup directory {}: {e}", self.path.display()))
            })?;
        }
        Ok(())
    }

    /// Returns the path to this cgroup directory.
    #[must_use]
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Returns the cgroup name.
    #[must_use]
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Returns the configured memory limit in bytes.
    #[must_use]
    pub fn memory_max(&self) -> u64 {
        self.memory_max
    }

    /// Returns the configured memory high watermark in bytes.
    #[must_use]
    pub fn memory_high(&self) -> u64 {
        self.memory_high
    }

    /// Returns the configured CPU allocation quota string.
    #[must_use]
    pub fn cpu_max(&self) -> &str {
        &self.cpu_max
    }

    /// Configures whether automatic cleanup on drop is enabled.
    pub fn set_auto_cleanup(&mut self, enabled: bool) {
        self.auto_cleanup = enabled;
    }
}

impl Drop for CgroupController {
    fn drop(&mut self) {
        if self.auto_cleanup && self.path.exists() && fs::remove_dir(&self.path).is_err() {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}

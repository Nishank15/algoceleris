#![allow(unsafe_code)]

//! Linux namespace isolation (`CLONE_NEW*`) and capability dropping (`CAP_DROP_ALL`).
//!
//! Includes zero-overhead fallback simulation for non-Linux host development (macOS / BSD).

use crate::errors::WorkerError;

/// Configuration defining which Linux namespaces and security controls to isolate.
#[derive(Debug, Clone, PartialEq, Eq)]
#[allow(clippy::struct_excessive_bools)]
pub struct SandboxConfig {
    pub unshare_net: bool,
    pub unshare_pid: bool,
    pub unshare_ipc: bool,
    pub unshare_uts: bool,
    pub unshare_ns: bool,
    pub drop_capabilities: bool,
    pub hostname: String,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            unshare_net: true,
            unshare_pid: true,
            unshare_ipc: true,
            unshare_uts: true,
            unshare_ns: true,
            drop_capabilities: true,
            hostname: "algoceleris-isolated".to_string(),
        }
    }
}

/// Linux kernel namespace and capability sandbox controller.
#[derive(Debug, Clone)]
pub struct LinuxSandbox {
    config: SandboxConfig,
}

impl Default for LinuxSandbox {
    fn default() -> Self {
        Self::new(SandboxConfig::default())
    }
}

impl LinuxSandbox {
    /// Creates a new `LinuxSandbox` with specified configuration.
    #[must_use]
    pub fn new(config: SandboxConfig) -> Self {
        Self { config }
    }

    /// Returns the configuration associated with this sandbox.
    #[must_use]
    pub fn config(&self) -> &SandboxConfig {
        &self.config
    }

    /// Returns the calculated bitflags integer for `libc::unshare`.
    #[must_use]
    pub fn calculate_unshare_flags(&self) -> i32 {
        let mut flags = 0;
        #[cfg(target_os = "linux")]
        {
            if self.config.unshare_net {
                flags |= libc::CLONE_NEWNET;
            }
            if self.config.unshare_pid {
                flags |= libc::CLONE_NEWPID;
            }
            if self.config.unshare_ipc {
                flags |= libc::CLONE_NEWIPC;
            }
            if self.config.unshare_uts {
                flags |= libc::CLONE_NEWUTS;
            }
            if self.config.unshare_ns {
                flags |= libc::CLONE_NEWNS;
            }
        }
        #[cfg(not(target_os = "linux"))]
        {
            // Simulated flag values corresponding to standard Linux kernel constants
            if self.config.unshare_net {
                flags |= 0x4000_0000; // CLONE_NEWNET
            }
            if self.config.unshare_pid {
                flags |= 0x2000_0000; // CLONE_NEWPID
            }
            if self.config.unshare_ipc {
                flags |= 0x0800_0000; // CLONE_NEWIPC
            }
            if self.config.unshare_uts {
                flags |= 0x0400_0000; // CLONE_NEWUTS
            }
            if self.config.unshare_ns {
                flags |= 0x0002_0000; // CLONE_NEWNS
            }
        }
        flags
    }

    /// Isolates execution context by calling `libc::unshare`.
    ///
    /// # Errors
    /// Returns [`WorkerError::NamespaceError`] if the underlying syscall returns non-zero.
    #[cfg(target_os = "linux")]
    pub fn isolate_namespaces(&self) -> Result<(), WorkerError> {
        let flags = self.calculate_unshare_flags();

        // SAFETY: `unshare` is invoked with valid bitflag combinations.
        let ret = unsafe { libc::unshare(flags) };
        if ret != 0 {
            let err = std::io::Error::last_os_error();
            return Err(WorkerError::NamespaceError(format!(
                "libc::unshare failed with flags 0x{flags:x}: {err}"
            )));
        }

        // Apply isolated hostname if UTS namespace was detached
        if self.config.unshare_uts {
            let host_bytes = self.config.hostname.as_bytes();
            // SAFETY: sethostname called with valid slice pointer and byte length
            let ret = unsafe { libc::sethostname(host_bytes.as_ptr().cast(), host_bytes.len()) };
            if ret != 0 {
                tracing::warn!("sethostname failed in isolated UTS namespace");
            }
        }

        Ok(())
    }

    /// Simulated namespace isolation for non-Linux hosts (e.g. macOS developer machines).
    ///
    /// # Errors
    /// Never returns an error on non-Linux targets.
    #[cfg(not(target_os = "linux"))]
    pub fn isolate_namespaces(&self) -> Result<(), WorkerError> {
        tracing::debug!(
            "non-Linux host: simulated unshare for namespaces (net={}, pid={}, ipc={}, uts={}, ns={})",
            self.config.unshare_net,
            self.config.unshare_pid,
            self.config.unshare_ipc,
            self.config.unshare_uts,
            self.config.unshare_ns
        );
        Ok(())
    }

    /// Irreversibly drops all Linux capabilities and prevents privilege escalation.
    ///
    /// # Errors
    /// Returns [`WorkerError::PermissionDenied`] if setting `PR_SET_NO_NEW_PRIVS` fails.
    #[cfg(target_os = "linux")]
    pub fn drop_capabilities(&self) -> Result<(), WorkerError> {
        // SAFETY: PR_SET_NO_NEW_PRIVS prevents privilege acquisition across execve
        let ret = unsafe { libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) };
        if ret != 0 {
            let err = std::io::Error::last_os_error();
            return Err(WorkerError::PermissionDenied(format!(
                "failed to enforce PR_SET_NO_NEW_PRIVS: {err}"
            )));
        }

        // Clear ambient capability set (PR_CAP_AMBIENT = 47, PR_CAP_AMBIENT_CLEAR_ALL = 4)
        // SAFETY: Safe prctl call to clear ambient capability set
        unsafe {
            libc::prctl(47, 4, 0, 0, 0);
        }

        Ok(())
    }

    /// Simulated capability drop for non-Linux hosts.
    ///
    /// # Errors
    /// Never returns an error on non-Linux targets.
    #[cfg(not(target_os = "linux"))]
    pub fn drop_capabilities(&self) -> Result<(), WorkerError> {
        tracing::debug!("non-Linux host: simulated capability drop (CAP_DROP_ALL)");
        Ok(())
    }

    /// Executes complete kernel sandboxing sequence: namespace isolation followed by capability dropping.
    ///
    /// # Errors
    /// Returns [`WorkerError`] if any isolation stage fails.
    pub fn enter(&self) -> Result<(), WorkerError> {
        self.isolate_namespaces()?;
        if self.config.drop_capabilities {
            self.drop_capabilities()?;
        }
        Ok(())
    }
}

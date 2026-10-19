use std::process::Stdio;
use std::time::{Duration, Instant};

use judge_core::Verdict;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;

use crate::errors::WorkerError;
use crate::runner::CommandConfig;
use crate::sandbox::CgroupController;

/// Default stdout/stderr capture buffer ceiling: 1MB (1,048,576 bytes).
pub const DEFAULT_OUTPUT_LIMIT_BYTES: usize = 1_048_576;

/// Default wall-clock timeout: 1000ms.
pub const DEFAULT_TIME_LIMIT: Duration = Duration::from_millis(1000);

/// Default memory limit: 256MB.
pub const DEFAULT_MEMORY_LIMIT_BYTES: u64 = 268_435_456;

/// Telemetry and evaluation output from a sandboxed execution run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecutionResult {
    pub verdict: Verdict,
    pub runtime_ms: u64,
    pub memory_bytes: u64,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub stdout_truncated: bool,
}

/// Core dispatcher executing sandboxed processes with cgroup tracking, timeouts, and I/O truncation.
#[derive(Debug, Clone)]
pub struct ExecutionEngine {
    time_limit: Duration,
    memory_limit_bytes: u64,
    output_limit_bytes: usize,
}

impl Default for ExecutionEngine {
    fn default() -> Self {
        Self {
            time_limit: DEFAULT_TIME_LIMIT,
            memory_limit_bytes: DEFAULT_MEMORY_LIMIT_BYTES,
            output_limit_bytes: DEFAULT_OUTPUT_LIMIT_BYTES,
        }
    }
}

impl ExecutionEngine {
    /// Creates an execution engine with customized constraints.
    #[must_use]
    pub fn new(time_limit: Duration, memory_limit_bytes: u64, output_limit_bytes: usize) -> Self {
        Self {
            time_limit,
            memory_limit_bytes,
            output_limit_bytes,
        }
    }

    /// Truncates raw byte output to a specified size limit, converting to lossy UTF-8.
    #[must_use]
    pub fn truncate_output(raw: &[u8], limit: usize) -> (String, bool) {
        if raw.len() > limit {
            let slice = &raw[..limit];
            (String::from_utf8_lossy(slice).to_string(), true)
        } else {
            (String::from_utf8_lossy(raw).to_string(), false)
        }
    }

    /// Spawns and supervises target process execution.
    ///
    /// # Errors
    /// Returns [`WorkerError::SyscallError`] or [`WorkerError::Io`] if process spawning fails.
    pub async fn execute(
        &self,
        command: &CommandConfig,
        test_input: &str,
        cgroup: Option<&CgroupController>,
    ) -> Result<ExecutionResult, WorkerError> {
        let mut cmd = Command::new(&command.program);
        cmd.args(&command.args);
        for (k, v) in &command.env {
            cmd.env(k, v);
        }
        if let Some(dir) = &command.working_dir {
            cmd.current_dir(dir);
        }

        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let start = Instant::now();
        let mut child = cmd.spawn().map_err(WorkerError::Io)?;

        // Attach process to cgroup controller if provided
        if let Some(cg) = cgroup {
            if let Some(pid) = child.id() {
                let _ = cg.attach_pid(pid);
            }
        }

        // Asynchronously stream stdin input and close pipe
        if let Some(mut stdin) = child.stdin.take() {
            let input_bytes = test_input.as_bytes().to_vec();
            tokio::spawn(async move {
                let _ = stdin.write_all(&input_bytes).await;
                let _ = stdin.shutdown().await;
            });
        }

        let stdout_pipe = child.stdout.take();
        let stderr_pipe = child.stderr.take();
        let limit = self.output_limit_bytes;

        let stdout_task = tokio::spawn(async move {
            if let Some(pipe) = stdout_pipe {
                read_bounded_stream(pipe, limit).await.unwrap_or_default()
            } else {
                (Vec::new(), false)
            }
        });

        let stderr_task = tokio::spawn(async move {
            if let Some(pipe) = stderr_pipe {
                read_bounded_stream(pipe, limit).await.unwrap_or_default()
            } else {
                (Vec::new(), false)
            }
        });

        // Enforce wall-clock timeout
        match tokio::time::timeout(self.time_limit, child.wait()).await {
            Ok(Ok(status)) => {
                #[allow(clippy::cast_possible_truncation)]
                let runtime_ms = start.elapsed().as_millis() as u64;

                let (stdout_raw, stdout_truncated) = stdout_task.await.unwrap_or_default();
                let (stderr_raw, _) = stderr_task.await.unwrap_or_default();

                let stdout = String::from_utf8_lossy(&stdout_raw).to_string();
                let stderr = String::from_utf8_lossy(&stderr_raw).to_string();

                let memory_bytes = cgroup
                    .and_then(|cg| cg.read_memory_current().ok())
                    .unwrap_or(0);

                let verdict = if memory_bytes > self.memory_limit_bytes {
                    Verdict::MemoryLimitExceeded
                } else if !status.success() {
                    Verdict::RuntimeError
                } else {
                    Verdict::Accepted
                };

                Ok(ExecutionResult {
                    verdict,
                    runtime_ms,
                    memory_bytes,
                    exit_code: status.code(),
                    stdout,
                    stderr,
                    stdout_truncated,
                })
            }
            Ok(Err(e)) => Err(WorkerError::SyscallError(format!("wait failed: {e}"))),
            Err(_) => {
                // Timeout exceeded
                let _ = child.kill().await;
                #[allow(clippy::cast_possible_truncation)]
                let runtime_ms = self.time_limit.as_millis() as u64;

                let (stdout_raw, stdout_truncated) = stdout_task.await.unwrap_or_default();
                let (stderr_raw, _) = stderr_task.await.unwrap_or_default();

                Ok(ExecutionResult {
                    verdict: Verdict::TimeLimitExceeded,
                    runtime_ms,
                    memory_bytes: 0,
                    exit_code: None,
                    stdout: String::from_utf8_lossy(&stdout_raw).to_string(),
                    stderr: String::from_utf8_lossy(&stderr_raw).to_string(),
                    stdout_truncated,
                })
            }
        }
    }
}

async fn read_bounded_stream<R: AsyncRead + Unpin>(
    mut reader: R,
    limit: usize,
) -> std::io::Result<(Vec<u8>, bool)> {
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 8192];
    let mut truncated = false;

    loop {
        let n = reader.read(&mut chunk).await?;
        if n == 0 {
            break;
        }
        if buffer.len() + n > limit {
            let remaining = limit.saturating_sub(buffer.len());
            buffer.extend_from_slice(&chunk[..remaining]);
            truncated = true;
            break;
        }
        buffer.extend_from_slice(&chunk[..n]);
    }

    Ok((buffer, truncated))
}

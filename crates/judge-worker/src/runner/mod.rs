//! Multi-language sandboxed execution runners and asynchronous process engine.

pub mod cpp;
pub mod engine;
pub mod java;
pub mod python;

use std::path::PathBuf;

pub use cpp::CppRunner;
pub use engine::{ExecutionEngine, ExecutionResult, DEFAULT_OUTPUT_LIMIT_BYTES};
pub use java::JavaRunner;
pub use python::PythonRunner;

/// Specification of a command line execution configuration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandConfig {
    pub program: String,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
    pub working_dir: Option<PathBuf>,
}

impl CommandConfig {
    /// Constructs a new command specification with program path and arguments.
    #[must_use]
    pub fn new(program: impl Into<String>, args: Vec<String>) -> Self {
        Self {
            program: program.into(),
            args,
            env: Vec::new(),
            working_dir: None,
        }
    }

    /// Appends an environment variable to the process configuration.
    #[must_use]
    pub fn with_env(mut self, key: impl Into<String>, val: impl Into<String>) -> Self {
        self.env.push((key.into(), val.into()));
        self
    }

    /// Configures the working directory for execution.
    #[must_use]
    pub fn with_working_dir(mut self, dir: impl Into<PathBuf>) -> Self {
        self.working_dir = Some(dir.into());
        self
    }
}

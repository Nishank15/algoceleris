use std::path::Path;

use judge_core::Language;

use crate::runner::CommandConfig;

/// Runner for Python 3.12 sandboxed execution.
#[derive(Debug, Default)]
pub struct PythonRunner;

impl PythonRunner {
    /// Returns the language handled by this runner.
    #[must_use]
    pub fn language() -> Language {
        Language::Python
    }

    /// Formats the Python interpreter command with `-u` (unbuffered stdout/stderr)
    /// and `-B` (suppress writing bytecode `.pyc` files).
    #[must_use]
    pub fn execution_command(source_file: &Path) -> CommandConfig {
        let args = vec![
            "-u".to_string(),
            "-B".to_string(),
            source_file.to_string_lossy().to_string(),
        ];
        CommandConfig::new("python3", args)
    }
}

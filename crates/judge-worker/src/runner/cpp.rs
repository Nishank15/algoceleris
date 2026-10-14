use std::path::Path;

use judge_core::Language;

use crate::runner::CommandConfig;

/// Runner for GCC C++20 compilation and sandboxed execution.
#[derive(Debug, Default)]
pub struct CppRunner;

impl CppRunner {
    /// Returns the language handled by this runner.
    #[must_use]
    pub fn language() -> Language {
        Language::Cpp
    }

    /// Formats the compilation command using GCC with `-std=c++20`, optimization `-O3`, and `-DONLINE_JUDGE`.
    #[must_use]
    pub fn compile_command(source_file: &Path, output_binary: &Path) -> CommandConfig {
        let args = vec![
            "-O3".to_string(),
            "-std=c++20".to_string(),
            "-Wall".to_string(),
            "-Wextra".to_string(),
            "-DONLINE_JUDGE".to_string(),
            source_file.to_string_lossy().to_string(),
            "-o".to_string(),
            output_binary.to_string_lossy().to_string(),
        ];
        CommandConfig::new("g++", args)
    }

    /// Formats the binary execution command for compiled candidate code.
    #[must_use]
    pub fn execution_command(binary_path: &Path) -> CommandConfig {
        CommandConfig::new(binary_path.to_string_lossy().to_string(), vec![])
    }
}

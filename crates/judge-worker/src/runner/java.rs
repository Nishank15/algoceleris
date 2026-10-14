use std::path::Path;

use judge_core::Language;

use crate::runner::CommandConfig;

/// Runner for Java 21 `OpenJDK` compilation and JVM execution.
#[derive(Debug, Default)]
pub struct JavaRunner;

impl JavaRunner {
    /// Returns the language handled by this runner.
    #[must_use]
    pub fn language() -> Language {
        Language::Java
    }

    /// Formats the javac compilation command.
    #[must_use]
    pub fn compile_command(source_file: &Path) -> CommandConfig {
        let args = vec![
            "-encoding".to_string(),
            "UTF-8".to_string(),
            source_file.to_string_lossy().to_string(),
        ];
        CommandConfig::new("javac", args)
    }

    /// Formats the JVM sandboxed execution command:
    /// `-Xmx256m` memory ceiling, `-Xms32m`, `-XX:+UseSerialGC` single-core GC, and UTF-8 encoding.
    #[must_use]
    pub fn execution_command(classpath_dir: &Path, class_name: &str) -> CommandConfig {
        let args = vec![
            "-Xmx256m".to_string(),
            "-Xms32m".to_string(),
            "-XX:+UseSerialGC".to_string(),
            "-Dfile.encoding=UTF-8".to_string(),
            "-cp".to_string(),
            classpath_dir.to_string_lossy().to_string(),
            class_name.to_string(),
        ];
        CommandConfig::new("java", args)
    }
}

use std::path::Path;
use std::time::Duration;

use judge_core::{Language, Verdict};
use judge_worker::{
    CommandConfig, CppRunner, ExecutionEngine, JavaRunner, PythonRunner, SyscallPolicy,
};

#[test]
fn test_runner_argument_formatting_across_languages() {
    // 1. C++ runner assertions
    assert_eq!(CppRunner::language(), Language::Cpp);
    let cpp_compile =
        CppRunner::compile_command(Path::new("/tmp/solution.cpp"), Path::new("/tmp/solution"));
    assert_eq!(cpp_compile.program, "g++");
    assert!(cpp_compile.args.contains(&"-std=c++20".to_string()));
    assert!(cpp_compile.args.contains(&"-O3".to_string()));
    assert!(cpp_compile.args.contains(&"-DONLINE_JUDGE".to_string()));
    assert_eq!(
        cpp_compile.args.last().expect("last arg is binary"),
        "/tmp/solution"
    );

    let cpp_exec = CppRunner::execution_command(Path::new("/tmp/solution"));
    assert_eq!(cpp_exec.program, "/tmp/solution");
    assert_eq!(cpp_exec.args, Vec::<String>::new());

    // 2. Python runner assertions
    assert_eq!(PythonRunner::language(), Language::Python);
    let py_exec = PythonRunner::execution_command(Path::new("/tmp/solution.py"));
    assert_eq!(py_exec.program, "python3");
    assert_eq!(py_exec.args, vec!["-u", "-B", "/tmp/solution.py"]);

    // 3. Java runner assertions
    assert_eq!(JavaRunner::language(), Language::Java);
    let java_compile = JavaRunner::compile_command(Path::new("/tmp/Solution.java"));
    assert_eq!(java_compile.program, "javac");
    assert_eq!(
        java_compile.args,
        vec!["-encoding", "UTF-8", "/tmp/Solution.java"]
    );

    let java_exec = JavaRunner::execution_command(Path::new("/tmp"), "Solution");
    assert_eq!(java_exec.program, "java");
    assert!(java_exec.args.contains(&"-Xmx256m".to_string()));
    assert!(java_exec.args.contains(&"-XX:+UseSerialGC".to_string()));
    assert!(java_exec
        .args
        .contains(&"-Dfile.encoding=UTF-8".to_string()));
    assert_eq!(java_exec.args.last().expect("class name"), "Solution");
}

#[test]
fn test_seccomp_policy_allow_deny_rules() {
    let policy = SyscallPolicy::default_candidate_policy();

    // Denied system calls
    assert!(policy.is_syscall_denied("socket"));
    assert!(policy.is_syscall_denied("connect"));
    assert!(policy.is_syscall_denied("bind"));
    assert!(policy.is_syscall_denied("fork"));
    assert!(policy.is_syscall_denied("vfork"));
    assert!(policy.is_syscall_denied("clone"));
    assert!(policy.is_syscall_denied("ptrace"));
    assert!(policy.is_syscall_denied("kill"));

    // Allowed system calls
    assert!(policy.is_syscall_allowed("read"));
    assert!(policy.is_syscall_allowed("write"));
    assert!(policy.is_syscall_allowed("mmap"));
    assert!(policy.is_syscall_allowed("brk"));
    assert!(policy.is_syscall_allowed("exit_group"));
    assert!(policy.is_syscall_allowed("futex"));

    assert!(policy.apply().is_ok());
}

#[test]
fn test_output_truncation_logic() {
    // Under limit
    let small_input = b"small output";
    let (out, truncated) = ExecutionEngine::truncate_output(small_input, 100);
    assert_eq!(out, "small output");
    assert!(!truncated);

    // Over limit
    let large_input = vec![b'x'; 2048];
    let (truncated_out, truncated) = ExecutionEngine::truncate_output(&large_input, 512);
    assert_eq!(truncated_out.len(), 512);
    assert!(truncated);
}

#[tokio::test]
async fn test_timeout_handling_converting_to_time_limit_exceeded() {
    let engine = ExecutionEngine::new(Duration::from_millis(100), 268_435_456, 1_048_576);

    // Command that sleeps for 1 second (1000ms), exceeding the 100ms timeout
    let command = CommandConfig::new(
        "python3",
        vec!["-c".to_string(), "import time; time.sleep(1.0)".to_string()],
    );

    let result = engine
        .execute(&command, "", None)
        .await
        .expect("execution supervisor succeeds");

    assert_eq!(result.verdict, Verdict::TimeLimitExceeded);
    assert!(
        result.runtime_ms >= 90,
        "runtime should reflect timeout duration: {}",
        result.runtime_ms
    );
}

#[tokio::test]
async fn test_mock_execution_pipeline_returns_valid_output_and_telemetry() {
    let engine = ExecutionEngine::new(Duration::from_millis(2000), 268_435_456, 1_048_576);

    let script = r#"
import sys
line = sys.stdin.read().strip()
print(f"OUTPUT: {line}")
sys.stderr.write("DEBUG_LOG: execution completed\n")
"#;

    let command = CommandConfig::new("python3", vec!["-c".to_string(), script.to_string()]);

    let input_data = "42\n100 200";
    let result = engine
        .execute(&command, input_data, None)
        .await
        .expect("execution succeeds");

    assert_eq!(result.verdict, Verdict::Accepted);
    assert_eq!(result.exit_code, Some(0));
    assert!(result.stdout.contains("OUTPUT: 42\n100 200"));
    assert!(result.stderr.contains("DEBUG_LOG: execution completed"));
    assert!(!result.stdout_truncated);
}

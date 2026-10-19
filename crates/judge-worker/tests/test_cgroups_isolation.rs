use std::fs;

use judge_worker::{
    CgroupController, LinuxSandbox, SandboxConfig, WorkerDaemon, WorkerError,
    DEFAULT_CPU_MAX_QUOTA, DEFAULT_MEMORY_HIGH_BYTES, DEFAULT_MEMORY_MAX_BYTES,
    DEFAULT_SWAP_MAX_BYTES,
};
use uuid::Uuid;

#[test]
fn test_cgroup_constants_and_parameter_formatting() {
    assert_eq!(DEFAULT_MEMORY_MAX_BYTES, 268_435_456); // 256MB
    assert_eq!(DEFAULT_MEMORY_HIGH_BYTES, 251_658_240); // 240MB
    assert_eq!(DEFAULT_CPU_MAX_QUOTA, "100000 100000"); // 1 vCPU
    assert_eq!(DEFAULT_SWAP_MAX_BYTES, "0"); // 0 swap

    let parts: Vec<&str> = DEFAULT_CPU_MAX_QUOTA.split_whitespace().collect();
    assert_eq!(parts.len(), 2);
    let quota: u64 = parts[0].parse().expect("valid quota");
    let period: u64 = parts[1].parse().expect("valid period");
    assert_eq!(quota, 100_000);
    assert_eq!(period, 100_000);
    assert_eq!(quota / period, 1);
}

#[test]
fn test_cgroup_controller_with_mock_filesystem() {
    let base_dir = std::env::temp_dir().join(format!("cgroup_test_{}", Uuid::new_v4()));
    let cgroup_name = "submission_sandbox_1";

    let controller = CgroupController::with_base_path(&base_dir, cgroup_name)
        .expect("controller creation with mock base path");

    let cg_path = base_dir.join(cgroup_name);
    assert!(cg_path.exists());
    assert_eq!(controller.path(), cg_path.as_path());
    assert_eq!(controller.name(), cgroup_name);
    assert_eq!(controller.memory_max(), DEFAULT_MEMORY_MAX_BYTES);
    assert_eq!(controller.memory_high(), DEFAULT_MEMORY_HIGH_BYTES);
    assert_eq!(controller.cpu_max(), DEFAULT_CPU_MAX_QUOTA);

    // Verify written limit files
    let mem_max_content =
        fs::read_to_string(cg_path.join("memory.max")).expect("memory.max readable");
    assert_eq!(mem_max_content, DEFAULT_MEMORY_MAX_BYTES.to_string());

    let mem_high_content =
        fs::read_to_string(cg_path.join("memory.high")).expect("memory.high readable");
    assert_eq!(mem_high_content, DEFAULT_MEMORY_HIGH_BYTES.to_string());

    let cpu_max_content = fs::read_to_string(cg_path.join("cpu.max")).expect("cpu.max readable");
    assert_eq!(cpu_max_content, DEFAULT_CPU_MAX_QUOTA);

    // Test attaching a PID
    controller.attach_pid(4242).expect("attach pid succeeds");
    let procs_content =
        fs::read_to_string(cg_path.join("cgroup.procs")).expect("cgroup.procs readable");
    assert_eq!(procs_content, "4242");

    // Test automatic drop cleanup
    drop(controller);
    assert!(
        !cg_path.exists(),
        "cgroup directory should be cleaned up on drop"
    );
    let _ = fs::remove_dir_all(&base_dir);
}

#[test]
fn test_linux_sandbox_flags_and_mock_isolation() {
    let sandbox = LinuxSandbox::default();
    let config = sandbox.config();

    assert!(config.unshare_net);
    assert!(config.unshare_pid);
    assert!(config.unshare_ipc);
    assert!(config.unshare_uts);
    assert!(config.unshare_ns);
    assert!(config.drop_capabilities);
    assert_eq!(config.hostname, "algoceleris-isolated");

    let full_flags = sandbox.calculate_unshare_flags();
    assert_ne!(full_flags, 0);

    // Test partial configuration
    let partial_config = SandboxConfig {
        unshare_net: false,
        unshare_pid: true,
        unshare_ipc: false,
        unshare_uts: false,
        unshare_ns: false,
        drop_capabilities: false,
        hostname: "test-box".to_string(),
    };
    let partial_sandbox = LinuxSandbox::new(partial_config);
    let partial_flags = partial_sandbox.calculate_unshare_flags();
    assert_ne!(partial_flags, 0);
    assert_ne!(partial_flags, full_flags);

    // Test entering sandbox
    let result = sandbox.enter();
    assert!(result.is_ok(), "entering sandbox should succeed");
}

#[test]
fn test_worker_daemon_and_error_representations() {
    let _daemon = WorkerDaemon::new();

    let err = WorkerError::CgroupError("out of memory ceiling exceeded".to_string());
    assert_eq!(
        err.to_string(),
        "cgroup v2 error: out of memory ceiling exceeded"
    );

    let ns_err = WorkerError::NamespaceError("unshare failed: operation not permitted".to_string());
    assert_eq!(
        ns_err.to_string(),
        "namespace isolation error: unshare failed: operation not permitted"
    );

    let perm_err = WorkerError::PermissionDenied("insufficient privileges for cgroup".to_string());
    assert_eq!(
        perm_err.to_string(),
        "permission denied: insufficient privileges for cgroup"
    );
}

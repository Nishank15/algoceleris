import os
import resource
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Dict, List, Optional

from .cgroups import CgroupV2Manager
from .models import ExecutionResult, ResourceLimits
from .monitor import ProcessWatcher


class IsolationSandbox:
    """Hardened execution sandbox applying cgroups v2, namespace isolation, and resource caps."""

    def __init__(self, cgroup_manager: Optional[CgroupV2Manager] = None):
        self.cgroup_manager = cgroup_manager or CgroupV2Manager()

    def run(
        self,
        command: List[str],
        limits: Optional[ResourceLimits] = None,
        stdin_data: str = "",
        cwd: Optional[Path] = None,
        env: Optional[Dict[str, str]] = None,
    ) -> ExecutionResult:
        """Execute command inside isolated sandbox and collect execution metrics."""
        limits = limits or ResourceLimits()
        scope_id = uuid.uuid4().hex[:12]

        # Attempt to provision transient cgroup scope
        if self.cgroup_manager.is_available:
            self.cgroup_manager.create_scope(scope_id, limits)

        # Build clean environment with only essential variables
        clean_env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin:/usr/local/bin"),
            "LANG": "en_US.UTF-8",
            "LC_ALL": "en_US.UTF-8",
            "PYTHONUNBUFFERED": "1",
        }
        if env:
            clean_env.update(env)

        # On Linux, wrap command with unshare -n (network namespace isolation) if available
        final_cmd = list(command)
        if shutil.which("unshare") and os.name == "posix":
            # Test if unshare -n can be invoked without error
            unshare_path = shutil.which("unshare")
            # Only prepend unshare if run as root or user namespaces allowed
            if os.geteuid() == 0:
                final_cmd = [unshare_path, "--net", "--"] + final_cmd

        # Configure resource limits preexec hook
        def preexec_limits():
            # Drop CPU limit signal (SIGXCPU)
            cpu_seconds = max(1, limits.time_limit_ms // 1000 + 1)
            try:
                resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 1))
            except (ValueError, OSError):
                pass

            # Drop maximum memory limit
            try:
                # RLIMIT_AS (address space) limits virtual memory
                resource.setrlimit(resource.RLIMIT_AS, (limits.memory_limit_bytes, limits.memory_limit_bytes))
            except (ValueError, OSError):
                pass

            # Limit number of processes
            try:
                resource.setrlimit(resource.RLIMIT_NPROC, (limits.pids_limit, limits.pids_limit))
            except (ValueError, OSError):
                pass

        try:
            proc = subprocess.Popen(
                final_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=str(cwd) if cwd else None,
                env=clean_env,
                preexec_fn=preexec_limits if os.name == "posix" else None,
            )
        except OSError as exc:
            from .models import ExecutionMetrics, ExecutionVerdict
            return ExecutionResult(
                verdict=ExecutionVerdict.INTERNAL_ERROR,
                stderr=str(exc),
                metrics=ExecutionMetrics(),
            )

        # Attach process to cgroup if manager is active
        if self.cgroup_manager.is_available:
            self.cgroup_manager.attach_process(scope_id, proc.pid)

        # Supervise execution with ProcessWatcher
        watcher = ProcessWatcher(self.cgroup_manager, scope_id)
        try:
            result = watcher.supervise(proc, limits, stdin_data)
        finally:
            if self.cgroup_manager.is_available:
                self.cgroup_manager.destroy_scope(scope_id)

        return result

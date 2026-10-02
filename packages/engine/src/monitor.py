import os
import resource
import signal
import subprocess
import time
from typing import Optional

from .cgroups import CgroupV2Manager
from .models import ExecutionMetrics, ExecutionResult, ExecutionVerdict, ResourceLimits


class ProcessWatcher:
    """Supervises a sandboxed process, enforcing CPU, time, and memory limits."""

    def __init__(
        self,
        cgroup_manager: Optional[CgroupV2Manager] = None,
        scope_id: Optional[str] = None,
    ):
        self.cgroup_manager = cgroup_manager
        self.scope_id = scope_id

    def supervise(
        self,
        proc: subprocess.Popen,
        limits: ResourceLimits,
        stdin_data: str = "",
    ) -> ExecutionResult:
        """Monitor process execution until termination or resource limit breach."""
        start_wall = time.monotonic()
        time_limit_sec = limits.time_limit_ms / 1000.0
        # Allow modest grace period for wall-clock vs CPU time
        wall_limit_sec = time_limit_sec * 2.0

        stdout_chunks = []
        stderr_chunks = []
        peak_memory_bytes = 0
        timed_out = False
        oom_killed = False

        # Feed stdin if provided
        if proc.stdin:
            try:
                if stdin_data:
                    proc.stdin.write(stdin_data)
                    proc.stdin.flush()
            except (BrokenPipeError, OSError):
                pass
            try:
                proc.stdin.close()
            except OSError:
                pass
            proc.stdin = None

        # Polling loop
        while proc.poll() is None:
            elapsed_wall = time.monotonic() - start_wall

            # Check peak memory from cgroups if available
            if self.cgroup_manager and self.scope_id:
                cgroup_mem = self.cgroup_manager.get_peak_memory(self.scope_id)
                if cgroup_mem > peak_memory_bytes:
                    peak_memory_bytes = cgroup_mem
                if cgroup_mem > limits.memory_limit_bytes or self.cgroup_manager.is_oom_killed(self.scope_id):
                    oom_killed = True
                    self._kill_process(proc)
                    break

            # Check timeout
            if elapsed_wall > wall_limit_sec:
                timed_out = True
                self._kill_process(proc)
                break

            time.sleep(0.005)

        # Process has ended, read remaining stdout/stderr
        out, err = proc.communicate()
        if out:
            stdout_chunks.append(out)
        if err:
            stderr_chunks.append(err)

        total_wall_ms = int((time.monotonic() - start_wall) * 1000)

        # Get final resource usage from rusage
        try:
            rusage = resource.getrusage(resource.RUSAGE_CHILDREN)
            # macOS ru_maxrss is in bytes, Linux ru_maxrss is in kilobytes
            # Normalize to bytes
            raw_rss = rusage.ru_maxrss
            if raw_rss > 0:
                # If value is less than 1GB represented in KB, convert KB -> bytes on Linux
                # On macOS raw_rss is already in bytes
                import platform
                if platform.system() != "Darwin":
                    rss_bytes = raw_rss * 1024
                else:
                    rss_bytes = raw_rss
                if rss_bytes > peak_memory_bytes:
                    peak_memory_bytes = rss_bytes

            cpu_time_ms = int((rusage.ru_utime + rusage.ru_stime) * 1000)
        except OSError:
            cpu_time_ms = total_wall_ms

        exit_code = proc.returncode if proc.returncode is not None else -1

        # Check cgroup oom flag post-mortem
        if self.cgroup_manager and self.scope_id:
            if self.cgroup_manager.is_oom_killed(self.scope_id):
                oom_killed = True

        # Determine verdict
        if timed_out or (cpu_time_ms > limits.time_limit_ms):
            verdict = ExecutionVerdict.TIME_LIMIT_EXCEEDED
        elif oom_killed or (exit_code in (137, -9) and peak_memory_bytes >= limits.memory_limit_bytes):
            verdict = ExecutionVerdict.MEMORY_LIMIT_EXCEEDED
        elif exit_code != 0:
            verdict = ExecutionVerdict.RUNTIME_ERROR
        else:
            verdict = ExecutionVerdict.ACCEPTED

        stdout_str = "".join(stdout_chunks)
        stderr_str = "".join(stderr_chunks)

        metrics = ExecutionMetrics(
            cpu_time_ms=cpu_time_ms,
            wall_time_ms=total_wall_ms,
            peak_memory_bytes=peak_memory_bytes,
            exit_code=exit_code,
        )

        return ExecutionResult(
            verdict=verdict,
            stdout=stdout_str,
            stderr=stderr_str,
            metrics=metrics,
        )

    def _kill_process(self, proc: subprocess.Popen) -> None:
        """Forcefully terminate the target process and its process tree."""
        try:
            proc.kill()
            proc.wait(timeout=0.5)
        except (OSError, subprocess.TimeoutExpired):
            pass

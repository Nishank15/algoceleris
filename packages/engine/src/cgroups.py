import os
import signal
import time
from pathlib import Path
from typing import Optional

from .models import ResourceLimits


class CgroupV2Manager:
    """Manages Linux cgroups v2 transient scopes for isolated code execution."""

    DEFAULT_BASE_PATH = Path("/sys/fs/cgroup/cloudjudge")

    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or self.DEFAULT_BASE_PATH
        self._cgroups_available = self._detect_cgroup_v2()

    def _detect_cgroup_v2(self) -> bool:
        """Check if Linux cgroups v2 unified hierarchy is available and writable."""
        root_cgroup = Path("/sys/fs/cgroup")
        if not root_cgroup.exists():
            return False
        # cgroup2 has cgroup.controllers in /sys/fs/cgroup
        controllers_file = root_cgroup / "cgroup.controllers"
        return controllers_file.exists() and os.access(str(root_cgroup), os.W_OK)

    @property
    def is_available(self) -> bool:
        return self._cgroups_available

    def create_scope(self, scope_id: str, limits: ResourceLimits) -> Optional[Path]:
        """Create a transient cgroup scope with configured resource limits."""
        if not self._cgroups_available:
            return None

        scope_dir = self.base_path / f"sub_{scope_id}"
        try:
            scope_dir.mkdir(parents=True, exist_ok=True)

            # Apply memory limit
            memory_max = scope_dir / "memory.max"
            if memory_max.exists():
                memory_max.write_text(str(limits.memory_limit_bytes))

            # Apply CPU quota: <quota_us> <period_us>
            # 1 CPU = 100000us per 100000us period
            cpu_max = scope_dir / "cpu.max"
            if cpu_max.exists():
                quota_us = int((limits.cpu_limit_pct / 100.0) * 100000)
                cpu_max.write_text(f"{quota_us} 100000")

            # Apply PID limit (prevent fork bombs)
            pids_max = scope_dir / "pids.max"
            if pids_max.exists():
                pids_max.write_text(str(limits.pids_limit))

            return scope_dir
        except OSError:
            return None

    def attach_process(self, scope_id: str, pid: int) -> bool:
        """Add a process ID to the transient cgroup scope."""
        if not self._cgroups_available:
            return False

        scope_dir = self.base_path / f"sub_{scope_id}"
        procs_file = scope_dir / "cgroup.procs"
        try:
            if procs_file.exists():
                procs_file.write_text(str(pid))
                return True
        except OSError:
            pass
        return False

    def get_peak_memory(self, scope_id: str) -> int:
        """Read peak memory usage in bytes from the cgroup scope."""
        if not self._cgroups_available:
            return 0

        scope_dir = self.base_path / f"sub_{scope_id}"
        peak_file = scope_dir / "memory.peak"
        try:
            if peak_file.exists():
                return int(peak_file.read_text().strip())
        except (OSError, ValueError):
            pass
        return 0

    def is_oom_killed(self, scope_id: str) -> bool:
        """Check memory.events for OOM kill occurrences."""
        if not self._cgroups_available:
            return False

        scope_dir = self.base_path / f"sub_{scope_id}"
        events_file = scope_dir / "memory.events"
        try:
            if events_file.exists():
                content = events_file.read_text()
                for line in content.splitlines():
                    parts = line.strip().split()
                    if len(parts) == 2 and parts[0] in ("oom_kill", "oom_group_kill"):
                        if int(parts[1]) > 0:
                            return True
        except (OSError, ValueError):
            pass
        return False

    def destroy_scope(self, scope_id: str) -> None:
        """Kill all processes in the scope and remove the cgroup directory."""
        if not self._cgroups_available:
            return

        scope_dir = self.base_path / f"sub_{scope_id}"
        if not scope_dir.exists():
            return

        # Kill any surviving processes inside cgroup
        procs_file = scope_dir / "cgroup.procs"
        try:
            if procs_file.exists():
                pids = [int(p) for p in procs_file.read_text().split() if p.isdigit()]
                for pid in pids:
                    try:
                        os.kill(pid, signal.SIGKILL)
                    except OSError:
                        pass
        except OSError:
            pass

        # Cleanup directory
        for _ in range(5):
            try:
                scope_dir.rmdir()
                break
            except OSError:
                time.sleep(0.01)

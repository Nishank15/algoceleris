import sys
import unittest
from pathlib import Path

# Add engine src to path for direct testing
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.cgroups import CgroupV2Manager
from src.models import ExecutionVerdict, ResourceLimits
from src.sandbox import IsolationSandbox


class TestSandbox(unittest.TestCase):
    def setUp(self):
        self.sandbox = IsolationSandbox()

    def test_models_default_values(self):
        limits = ResourceLimits()
        self.assertEqual(limits.memory_limit_bytes, 268435456)  # 256 MB
        self.assertEqual(limits.cpu_limit_pct, 100)
        self.assertEqual(limits.time_limit_ms, 2000)
        self.assertEqual(limits.pids_limit, 64)
        self.assertEqual(ExecutionVerdict.MEMORY_LIMIT_EXCEEDED.value, "MEMORY_LIMIT_EXCEEDED")

    def test_cgroups_manager_availability(self):
        manager = CgroupV2Manager()
        # On non-Linux or unprivileged environment it gracefully returns False
        self.assertIsInstance(manager.is_available, bool)

    def test_sandbox_tracer_execution(self):
        result = self.sandbox.run(
            [sys.executable, "-c", "print('tracer output')"],
            limits=ResourceLimits(time_limit_ms=2000),
        )
        self.assertEqual(result.verdict, ExecutionVerdict.ACCEPTED)
        self.assertIn("tracer output", result.stdout.strip())
        self.assertEqual(result.metrics.exit_code, 0)
        self.assertGreater(result.metrics.wall_time_ms, 0)

    def test_sandbox_stdin_piping(self):
        script = "import sys; line = sys.stdin.read(); print(f'ECHO: {line.strip()}')"
        result = self.sandbox.run(
            [sys.executable, "-c", script],
            stdin_data="Sample Test Data 123",
            limits=ResourceLimits(time_limit_ms=2000),
        )
        self.assertEqual(result.verdict, ExecutionVerdict.ACCEPTED)
        self.assertEqual(result.stdout.strip(), "ECHO: Sample Test Data 123")

    def test_sandbox_runtime_error_exit_code(self):
        result = self.sandbox.run(
            [sys.executable, "-c", "import sys; sys.exit(42)"],
            limits=ResourceLimits(time_limit_ms=2000),
        )
        self.assertEqual(result.verdict, ExecutionVerdict.RUNTIME_ERROR)
        self.assertEqual(result.metrics.exit_code, 42)

    def test_sandbox_timeout_enforcement(self):
        # Run a script that sleeps 1.0 second with a 150ms limit
        result = self.sandbox.run(
            [sys.executable, "-c", "import time; time.sleep(1.0)"],
            limits=ResourceLimits(time_limit_ms=150),
        )
        self.assertEqual(result.verdict, ExecutionVerdict.TIME_LIMIT_EXCEEDED)


if __name__ == "__main__":
    unittest.main()

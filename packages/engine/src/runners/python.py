import os
import shutil
import sys
from pathlib import Path
from typing import Optional

from ..models import ExecutionMetrics, ExecutionResult, ExecutionVerdict, ResourceLimits
from ..sandbox import IsolationSandbox
from .base import BaseRunner, CompilationResult


class PythonRunner(BaseRunner):
    """Python 3.12 runner executing unbuffered code inside an isolated sandbox."""

    def __init__(
        self,
        sandbox: Optional[IsolationSandbox] = None,
        python_bin: Optional[str] = None,
    ):
        super().__init__(sandbox=sandbox)
        self.python_bin = python_bin or sys.executable or shutil.which("python3") or "python3"

    def compile(self, source_code: str, work_dir: Path) -> Optional[CompilationResult]:
        solution_file = work_dir / "solution.py"
        solution_file.write_text(source_code, encoding="utf-8")
        try:
            compile(source_code, "solution.py", "exec")
            return CompilationResult(success=True, output_path=solution_file)
        except SyntaxError as exc:
            return CompilationResult(
                success=False,
                diagnostics=f"SyntaxError: {exc.msg} (line {exc.lineno})",
            )

    def execute(
        self,
        executable_target: Path,
        input_data: str = "",
        limits: Optional[ResourceLimits] = None,
        cwd: Optional[Path] = None,
    ) -> ExecutionResult:
        solution_file = (
            executable_target if executable_target.is_file() else executable_target / "solution.py"
        )
        if not solution_file.exists():
            return ExecutionResult(
                verdict=ExecutionVerdict.INTERNAL_ERROR,
                stderr=f"Solution file not found at {solution_file}",
                metrics=ExecutionMetrics(),
            )

        exec_cwd = cwd or solution_file.parent
        # Execute with -u (unbuffered) and -B (do not write bytecode .pyc)
        cmd = [self.python_bin, "-u", "-B", solution_file.name]

        raw_result = self.sandbox.run(
            cmd,
            limits=limits,
            stdin_data=input_data,
            cwd=exec_cwd,
        )

        return self._post_process(raw_result)

    def _post_process(self, result: ExecutionResult) -> ExecutionResult:
        """Classify Python runtime errors, memory exceptions, and clean tracebacks."""
        if result.verdict in (
            ExecutionVerdict.TIME_LIMIT_EXCEEDED,
            ExecutionVerdict.MEMORY_LIMIT_EXCEEDED,
        ):
            return result

        stderr = result.stderr or ""
        # Check for Python-level MemoryError
        if "MemoryError" in stderr:
            result.verdict = ExecutionVerdict.MEMORY_LIMIT_EXCEEDED
            result.error_message = "Memory limit exceeded: Python MemoryError"
            return result

        if result.metrics.exit_code != 0:
            result.verdict = ExecutionVerdict.RUNTIME_ERROR
            # Sanitize paths in traceback for clean client reporting
            lines = stderr.strip().splitlines()
            cleaned_lines = []
            for line in lines:
                if 'File "' in line and "solution.py" in line:
                    idx = line.find('File "')
                    cleaned_lines.append(line[:idx] + 'File "solution.py"' + line.split("solution.py")[-1])
                else:
                    cleaned_lines.append(line)
            result.error_message = "\n".join(cleaned_lines) if cleaned_lines else "Process exited with non-zero status"

        return result

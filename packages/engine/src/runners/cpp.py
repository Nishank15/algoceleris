import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import List, Optional

from ..models import ExecutionMetrics, ExecutionResult, ExecutionVerdict, ResourceLimits
from ..sandbox import IsolationSandbox
from .base import BaseRunner, CompilationResult


class CppRunner(BaseRunner):
    """C++ runner compiling with g++ (C++20) and executing inside an isolated sandbox."""

    def __init__(
        self,
        sandbox: Optional[IsolationSandbox] = None,
        compiler_path: Optional[str] = None,
        compiler_flags: Optional[List[str]] = None,
    ):
        super().__init__(sandbox=sandbox)
        self.compiler_path = compiler_path or shutil.which("g++") or "g++"
        self.compiler_flags = compiler_flags or [
            "-O3",
            "-std=c++20",
            "-Wall",
            "-Wextra",
        ]

    def compile(self, source_code: str, work_dir: Path) -> Optional[CompilationResult]:
        source_file = work_dir / "solution.cpp"
        binary_file = work_dir / "solution"
        source_file.write_text(source_code, encoding="utf-8")

        cmd = [self.compiler_path] + self.compiler_flags + [str(source_file), "-o", str(binary_file)]
        start_time = time.monotonic()
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(work_dir),
                capture_output=True,
                text=True,
                timeout=15.0,
            )
            elapsed_ms = int((time.monotonic() - start_time) * 1000)
            if proc.returncode != 0:
                return CompilationResult(
                    success=False,
                    diagnostics=proc.stderr or proc.stdout,
                    compilation_time_ms=elapsed_ms,
                )
            return CompilationResult(
                success=True,
                output_path=binary_file,
                compilation_time_ms=elapsed_ms,
            )
        except subprocess.TimeoutExpired:
            elapsed_ms = int((time.monotonic() - start_time) * 1000)
            return CompilationResult(
                success=False,
                diagnostics="Compilation timed out after 15 seconds.",
                compilation_time_ms=elapsed_ms,
            )
        except OSError as exc:
            return CompilationResult(
                success=False,
                diagnostics=f"Failed to invoke compiler '{self.compiler_path}': {exc}",
                compilation_time_ms=0,
            )

    def execute(
        self,
        executable_target: Path,
        input_data: str = "",
        limits: Optional[ResourceLimits] = None,
        cwd: Optional[Path] = None,
    ) -> ExecutionResult:
        binary_path = executable_target if executable_target.is_file() else executable_target / "solution"
        if not binary_path.exists():
            return ExecutionResult(
                verdict=ExecutionVerdict.INTERNAL_ERROR,
                stderr=f"Executable binary not found at {binary_path}",
                metrics=ExecutionMetrics(),
            )

        exec_cwd = cwd or binary_path.parent
        return self.sandbox.run(
            [str(binary_path)],
            limits=limits,
            stdin_data=input_data,
            cwd=exec_cwd,
        )

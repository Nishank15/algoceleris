import os
import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import List, Optional

from ..models import ExecutionMetrics, ExecutionResult, ExecutionVerdict, ResourceLimits
from ..sandbox import IsolationSandbox
from .base import BaseRunner, CompilationResult


class JavaRunner(BaseRunner):
    """Java 21 runner enforcing JVM heap bounds (-Xmx256m) and serial GC inside IsolationSandbox."""

    def __init__(
        self,
        sandbox: Optional[IsolationSandbox] = None,
        javac_path: Optional[str] = None,
        java_path: Optional[str] = None,
        jvm_flags: Optional[List[str]] = None,
    ):
        super().__init__(sandbox=sandbox)
        self.javac_path = javac_path or shutil.which("javac") or "javac"
        self.java_path = java_path or shutil.which("java") or "java"
        self.jvm_flags = jvm_flags or [
            "-Xmx256m",
            "-Xms64m",
            "-XX:+UseSerialGC",
            "-XX:ActiveProcessorCount=1",
            "-Dfile.encoding=UTF-8",
        ]
        self._detected_class_name: Optional[str] = None

    def detect_class_name(self, source_code: str) -> str:
        """Extract public class name or top-level class name, defaulting to 'Solution'."""
        pub_match = re.search(r"\bpublic\s+(?:final\s+)?class\s+([A-Za-z0-9_]+)", source_code)
        if pub_match:
            return pub_match.group(1)
        class_match = re.search(r"\bclass\s+([A-Za-z0-9_]+)", source_code)
        if class_match:
            return class_match.group(1)
        return "Solution"

    def compile(self, source_code: str, work_dir: Path) -> Optional[CompilationResult]:
        class_name = self.detect_class_name(source_code)
        self._detected_class_name = class_name
        java_file = work_dir / f"{class_name}.java"
        java_file.write_text(source_code, encoding="utf-8")

        cmd = [self.javac_path, "-encoding", "UTF-8", str(java_file.name)]
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
                output_path=work_dir / f"{class_name}.class",
                compilation_time_ms=elapsed_ms,
            )
        except subprocess.TimeoutExpired:
            elapsed_ms = int((time.monotonic() - start_time) * 1000)
            return CompilationResult(
                success=False,
                diagnostics="Java compilation timed out after 15 seconds.",
                compilation_time_ms=elapsed_ms,
            )
        except OSError as exc:
            return CompilationResult(
                success=False,
                diagnostics=f"Failed to invoke javac '{self.javac_path}': {exc}",
                compilation_time_ms=0,
            )

    def execute(
        self,
        executable_target: Path,
        input_data: str = "",
        limits: Optional[ResourceLimits] = None,
        cwd: Optional[Path] = None,
    ) -> ExecutionResult:
        if executable_target.is_file() and executable_target.suffix == ".class":
            class_name = executable_target.stem
            work_dir = executable_target.parent
        elif self._detected_class_name:
            class_name = self._detected_class_name
            work_dir = executable_target if executable_target.is_dir() else executable_target.parent
        else:
            work_dir = executable_target if executable_target.is_dir() else executable_target.parent
            # Find primary class file
            class_files = [f for f in work_dir.glob("*.class") if "$" not in f.stem]
            if "Solution.class" in [f.name for f in class_files]:
                class_name = "Solution"
            elif class_files:
                class_name = class_files[0].stem
            else:
                class_name = "Solution"

        exec_cwd = cwd or work_dir
        cmd = [self.java_path] + self.jvm_flags + ["-cp", str(exec_cwd), class_name]

        raw_result = self.sandbox.run(
            cmd,
            limits=limits,
            stdin_data=input_data,
            cwd=exec_cwd,
        )

        return self._post_process(raw_result)

    def _post_process(self, result: ExecutionResult) -> ExecutionResult:
        if result.verdict in (
            ExecutionVerdict.TIME_LIMIT_EXCEEDED,
            ExecutionVerdict.MEMORY_LIMIT_EXCEEDED,
        ):
            return result

        stderr = result.stderr or ""
        # Check for JVM OutOfMemoryError
        if "java.lang.OutOfMemoryError" in stderr or "OutOfMemory" in stderr:
            result.verdict = ExecutionVerdict.MEMORY_LIMIT_EXCEEDED
            result.error_message = "Memory limit exceeded (JVM OutOfMemoryError)"
            return result

        if result.metrics.exit_code != 0:
            result.verdict = ExecutionVerdict.RUNTIME_ERROR
            # Clean and sanitize JVM stack trace
            lines = stderr.strip().splitlines()
            cleaned_lines = []
            for line in lines:
                if line.strip().startswith("at "):
                    # Retain application frames, drop internal JVM reflection frames
                    if "java.base/" not in line:
                        cleaned_lines.append(line)
                else:
                    cleaned_lines.append(line)
            result.error_message = "\n".join(cleaned_lines) if cleaned_lines else "JVM process terminated with error"

        return result

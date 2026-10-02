import abc
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from ..models import ExecutionMetrics, ExecutionResult, ExecutionVerdict, ResourceLimits
from ..sandbox import IsolationSandbox


@dataclass
class CompilationResult:
    """Outcome of a language compilation step."""
    success: bool
    output_path: Optional[Path] = None
    diagnostics: str = ""
    compilation_time_ms: int = 0


class BaseRunner(abc.ABC):
    """Abstract base class for all language-specific execution runners."""

    def __init__(self, sandbox: Optional[IsolationSandbox] = None):
        self.sandbox = sandbox or IsolationSandbox()

    @abc.abstractmethod
    def compile(self, source_code: str, work_dir: Path) -> Optional[CompilationResult]:
        """Compile source code in work_dir.

        Returns CompilationResult, or None if the language does not require a compilation step.
        """
        pass

    @abc.abstractmethod
    def execute(
        self,
        executable_target: Path,
        input_data: str = "",
        limits: Optional[ResourceLimits] = None,
        cwd: Optional[Path] = None,
    ) -> ExecutionResult:
        """Execute compiled binary or script inside IsolationSandbox."""
        pass

    def run(
        self,
        source_code: str,
        input_data: str = "",
        limits: Optional[ResourceLimits] = None,
    ) -> ExecutionResult:
        """Run submission end-to-end: compile (if applicable) and execute inside sandbox."""
        limits = limits or ResourceLimits()
        with tempfile.TemporaryDirectory(prefix="judge_run_") as temp_dir:
            work_dir = Path(temp_dir)
            comp_res = self.compile(source_code, work_dir)
            if comp_res is not None and not comp_res.success:
                return ExecutionResult(
                    verdict=ExecutionVerdict.COMPILATION_ERROR,
                    stdout="",
                    stderr=comp_res.diagnostics,
                    metrics=ExecutionMetrics(
                        cpu_time_ms=comp_res.compilation_time_ms,
                        wall_time_ms=comp_res.compilation_time_ms,
                        exit_code=1,
                    ),
                    error_message=f"Compilation error:\n{comp_res.diagnostics}",
                )

            target = comp_res.output_path if (comp_res and comp_res.output_path) else work_dir
            return self.execute(target, input_data=input_data, limits=limits, cwd=work_dir)

import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .comparator import OutputComparator
from .models import ExecutionMetrics, ExecutionResult, ExecutionVerdict, ResourceLimits
from .runners.base import BaseRunner, CompilationResult
from .runners.cpp import CppRunner
from .runners.java import JavaRunner
from .runners.python import PythonRunner
from .sandbox import IsolationSandbox


@dataclass
class TestCase:
    """Individual test case specification."""
    id: int
    input_data: str
    expected_output: str
    is_sample: bool = False


@dataclass
class TestCaseResult:
    """Outcome and telemetry for a single test case execution."""
    test_case_id: int
    verdict: ExecutionVerdict
    execution_time_ms: int = 0
    memory_used_bytes: int = 0
    stdout: str = ""
    stderr: str = ""
    diff: Optional[str] = None


@dataclass
class SubmissionJob:
    """Submission job request payload for code evaluation."""
    submission_id: str
    language: str
    source_code: str
    time_limit_ms: int = 2000
    memory_limit_bytes: int = 268435456  # 256 MB
    test_cases: List[TestCase] = field(default_factory=list)


@dataclass
class SubmissionReport:
    """Aggregate evaluation verdict and per-testcase results."""
    submission_id: str
    verdict: ExecutionVerdict
    test_cases_passed: int
    total_test_cases: int
    max_time_ms: int
    max_memory_bytes: int
    test_case_results: List[TestCaseResult] = field(default_factory=list)
    compile_output: Optional[str] = None


class JudgeEvaluator:
    """Multi-testcase evaluation engine coordinating compilation, isolated execution, and diffing."""

    def __init__(
        self,
        sandbox: Optional[IsolationSandbox] = None,
        comparator: Optional[OutputComparator] = None,
    ):
        self.sandbox = sandbox or IsolationSandbox()
        self.comparator = comparator or OutputComparator()
        self.runners: Dict[str, BaseRunner] = {
            "cpp": CppRunner(sandbox=self.sandbox),
            "c++": CppRunner(sandbox=self.sandbox),
            "python": PythonRunner(sandbox=self.sandbox),
            "python3": PythonRunner(sandbox=self.sandbox),
            "py": PythonRunner(sandbox=self.sandbox),
            "java": JavaRunner(sandbox=self.sandbox),
        }

    def get_runner(self, language: str) -> BaseRunner:
        key = language.strip().lower()
        if key not in self.runners:
            raise ValueError(f"Unsupported language: '{language}'. Supported: cpp, python, java")
        return self.runners[key]

    def evaluate(
        self,
        job: SubmissionJob,
        stop_on_first_failure: bool = True,
        progress_callback: Optional[Any] = None,
    ) -> SubmissionReport:
        """Evaluate submission job across all provided test cases."""
        runner = self.get_runner(job.language)
        limits = ResourceLimits(
            memory_limit_bytes=job.memory_limit_bytes,
            time_limit_ms=job.time_limit_ms,
        )

        if progress_callback:
            progress_callback(
                "compiling",
                {"submission_id": job.submission_id, "language": job.language},
            )

        with tempfile.TemporaryDirectory(prefix=f"eval_{job.submission_id}_") as temp_dir:
            work_dir = Path(temp_dir)
            comp_res = runner.compile(job.source_code, work_dir)

            # Short-circuit on compilation failure
            if comp_res is not None and not comp_res.success:
                if progress_callback:
                    progress_callback(
                        "compilation_failed",
                        {
                            "submission_id": job.submission_id,
                            "diagnostics": comp_res.diagnostics,
                        },
                    )
                report = SubmissionReport(
                    submission_id=job.submission_id,
                    verdict=ExecutionVerdict.COMPILATION_ERROR,
                    test_cases_passed=0,
                    total_test_cases=len(job.test_cases),
                    max_time_ms=comp_res.compilation_time_ms,
                    max_memory_bytes=0,
                    test_case_results=[],
                    compile_output=comp_res.diagnostics,
                )
                if progress_callback:
                    progress_callback(
                        "completed",
                        {
                            "submission_id": job.submission_id,
                            "verdict": report.verdict.value,
                            "test_cases_passed": report.test_cases_passed,
                            "total_test_cases": report.total_test_cases,
                            "max_time_ms": report.max_time_ms,
                            "max_memory_bytes": report.max_memory_bytes,
                        },
                    )
                return report

            exec_target = comp_res.output_path if (comp_res and comp_res.output_path) else work_dir

            test_results: List[TestCaseResult] = []
            passed_count = 0
            max_time_ms = 0
            max_memory_bytes = 0
            overall_verdict = ExecutionVerdict.ACCEPTED

            for tc in job.test_cases:
                if progress_callback:
                    progress_callback(
                        "test_case_start",
                        {
                            "submission_id": job.submission_id,
                            "test_case_id": tc.id,
                            "total_test_cases": len(job.test_cases),
                        },
                    )

                run_res = runner.execute(
                    exec_target,
                    input_data=tc.input_data,
                    limits=limits,
                    cwd=work_dir,
                )

                time_used = run_res.metrics.cpu_time_ms or run_res.metrics.wall_time_ms
                mem_used = run_res.metrics.peak_memory_bytes
                max_time_ms = max(max_time_ms, time_used)
                max_memory_bytes = max(max_memory_bytes, mem_used)

                diff_str = None
                if run_res.verdict == ExecutionVerdict.ACCEPTED:
                    comp = self.comparator.compare(run_res.stdout, tc.expected_output)
                    if comp.is_match:
                        tc_verdict = ExecutionVerdict.ACCEPTED
                        passed_count += 1
                    else:
                        tc_verdict = ExecutionVerdict.WRONG_ANSWER
                        diff_str = comp.diff
                else:
                    tc_verdict = run_res.verdict

                tc_result = TestCaseResult(
                    test_case_id=tc.id,
                    verdict=tc_verdict,
                    execution_time_ms=time_used,
                    memory_used_bytes=mem_used,
                    stdout=run_res.stdout,
                    stderr=run_res.stderr or run_res.error_message or "",
                    diff=diff_str,
                )
                test_results.append(tc_result)

                if progress_callback:
                    progress_callback(
                        "test_case_result",
                        {
                            "submission_id": job.submission_id,
                            "test_case_id": tc.id,
                            "verdict": tc_verdict.value,
                            "execution_time_ms": time_used,
                            "memory_used_bytes": mem_used,
                            "diff": diff_str,
                        },
                    )

                if tc_verdict != ExecutionVerdict.ACCEPTED:
                    if overall_verdict == ExecutionVerdict.ACCEPTED:
                        overall_verdict = tc_verdict
                    if stop_on_first_failure:
                        break

            report = SubmissionReport(
                submission_id=job.submission_id,
                verdict=overall_verdict,
                test_cases_passed=passed_count,
                total_test_cases=len(job.test_cases),
                max_time_ms=max_time_ms,
                max_memory_bytes=max_memory_bytes,
                test_case_results=test_results,
                compile_output=comp_res.diagnostics if comp_res else None,
            )

            if progress_callback:
                progress_callback(
                    "completed",
                    {
                        "submission_id": job.submission_id,
                        "verdict": report.verdict.value,
                        "test_cases_passed": report.test_cases_passed,
                        "total_test_cases": report.total_test_cases,
                        "max_time_ms": report.max_time_ms,
                        "max_memory_bytes": report.max_memory_bytes,
                    },
                )

            return report

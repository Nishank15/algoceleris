import difflib
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ComparisonResult:
    """Detailed result of output evaluation."""
    is_match: bool
    diff: Optional[str] = None
    message: Optional[str] = None


class OutputComparator:
    """Comparator evaluating execution output against expected solution test cases."""

    def compare(
        self,
        actual: str,
        expected: str,
        trim_whitespace: bool = True,
        case_sensitive: bool = True,
    ) -> ComparisonResult:
        """Compare actual program output against expected output with token and whitespace normalization."""
        # Normalize newline characters
        norm_actual = actual.replace("\r\n", "\n").replace("\r", "\n")
        norm_expected = expected.replace("\r\n", "\n").replace("\r", "\n")

        if not case_sensitive:
            norm_actual = norm_actual.lower()
            norm_expected = norm_expected.lower()

        # Split into lines
        actual_lines = norm_actual.split("\n")
        expected_lines = norm_expected.split("\n")

        if trim_whitespace:
            # Strip trailing whitespace on each line
            actual_lines = [line.rstrip() for line in actual_lines]
            expected_lines = [line.rstrip() for line in expected_lines]

            # Drop trailing blank lines
            while actual_lines and actual_lines[-1] == "":
                actual_lines.pop()
            while expected_lines and expected_lines[-1] == "":
                expected_lines.pop()

        # Check line counts
        if len(actual_lines) != len(expected_lines):
            diff = self._build_diff(expected_lines, actual_lines)
            return ComparisonResult(
                is_match=False,
                diff=diff,
                message=f"Line count mismatch: expected {len(expected_lines)} lines, got {len(actual_lines)} lines",
            )

        # Line-by-line token comparison
        for idx, (act_line, exp_line) in enumerate(zip(actual_lines, expected_lines), start=1):
            if trim_whitespace:
                # Token-based comparison per line (collapses multiple whitespace spaces/tabs)
                act_tokens = act_line.split()
                exp_tokens = exp_line.split()
                if act_tokens != exp_tokens:
                    diff = self._build_diff(expected_lines, actual_lines)
                    return ComparisonResult(
                        is_match=False,
                        diff=diff,
                        message=f"Mismatch on line {idx}: expected '{exp_line}', got '{act_line}'",
                    )
            else:
                if act_line != exp_line:
                    diff = self._build_diff(expected_lines, actual_lines)
                    return ComparisonResult(
                        is_match=False,
                        diff=diff,
                        message=f"Mismatch on line {idx}: expected '{exp_line}', got '{act_line}'",
                    )

        return ComparisonResult(is_match=True)

    @staticmethod
    def _build_diff(expected_lines: List[str], actual_lines: List[str]) -> str:
        """Generate a unified diff between expected and actual output lines."""
        diff_iter = difflib.unified_diff(
            expected_lines,
            actual_lines,
            fromfile="expected",
            tofile="actual",
            lineterm="",
        )
        return "\n".join(diff_iter)

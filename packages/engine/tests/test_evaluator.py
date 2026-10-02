import shutil
import sys
import unittest
from pathlib import Path

# Add engine src to path for direct testing
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.evaluator import JudgeEvaluator, SubmissionJob, TestCase
from src.models import ExecutionVerdict


class TestJudgeEvaluator(unittest.TestCase):
    def setUp(self):
        self.evaluator = JudgeEvaluator()

    def test_cpp_multi_testcases_all_accepted(self):
        if not shutil.which("g++"):
            self.skipTest("g++ is not available")

        cpp_code = """
        #include <iostream>
        int main() {
            int n;
            if (std::cin >> n) {
                std::cout << (n * 2) << std::endl;
            }
            return 0;
        }
        """
        job = SubmissionJob(
            submission_id="sub-cpp-100",
            language="cpp",
            source_code=cpp_code,
            time_limit_ms=2000,
            test_cases=[
                TestCase(id=1, input_data="5\n", expected_output="10\n", is_sample=True),
                TestCase(id=2, input_data="12\n", expected_output="24\n"),
                TestCase(id=3, input_data="-3\n", expected_output="-6\n"),
            ],
        )

        report = self.evaluator.evaluate(job)
        self.assertEqual(report.verdict, ExecutionVerdict.ACCEPTED)
        self.assertEqual(report.test_cases_passed, 3)
        self.assertEqual(report.total_test_cases, 3)
        self.assertEqual(len(report.test_case_results), 3)
        for res in report.test_case_results:
            self.assertEqual(res.verdict, ExecutionVerdict.ACCEPTED)
            self.assertIsNone(res.diff)

    def test_python_wrong_answer_diff_and_short_circuit(self):
        # Program returns n + 1 instead of expected n * 2
        py_code = """
import sys
n = int(sys.stdin.read().strip())
print(n + 1)
"""
        job = SubmissionJob(
            submission_id="sub-py-200",
            language="python",
            source_code=py_code,
            test_cases=[
                TestCase(id=1, input_data="1\n", expected_output="2\n"),  # 1 + 1 = 2 (PASSES)
                TestCase(id=2, input_data="5\n", expected_output="10\n"), # 5 + 1 = 6 != 10 (FAILS WA)
                TestCase(id=3, input_data="9\n", expected_output="18\n"), # should be skipped if short-circuit
            ],
        )

        report = self.evaluator.evaluate(job, stop_on_first_failure=True)
        self.assertEqual(report.verdict, ExecutionVerdict.WRONG_ANSWER)
        self.assertEqual(report.test_cases_passed, 1)
        self.assertEqual(report.total_test_cases, 3)
        # 2 test cases evaluated (1 passed, 1 failed, 3rd skipped)
        self.assertEqual(len(report.test_case_results), 2)
        failing_tc = report.test_case_results[1]
        self.assertEqual(failing_tc.verdict, ExecutionVerdict.WRONG_ANSWER)
        self.assertIsNotNone(failing_tc.diff)
        self.assertIn("-10", failing_tc.diff)
        self.assertIn("+6", failing_tc.diff)

    def test_java_multi_testcases_accepted(self):
        if not shutil.which("javac") or not shutil.which("java"):
            self.skipTest("Java is not available")

        java_code = """
import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        while (sc.hasNextInt()) {
            int a = sc.nextInt();
            int b = sc.nextInt();
            System.out.println(a * b);
        }
    }
}
"""
        job = SubmissionJob(
            submission_id="sub-java-300",
            language="java",
            source_code=java_code,
            test_cases=[
                TestCase(id=1, input_data="3 4\n", expected_output="12\n"),
                TestCase(id=2, input_data="7 8\n", expected_output="56\n"),
                TestCase(id=3, input_data="10 0\n", expected_output="0\n"),
            ],
        )

        report = self.evaluator.evaluate(job)
        self.assertEqual(report.verdict, ExecutionVerdict.ACCEPTED)
        self.assertEqual(report.test_cases_passed, 3)
        self.assertEqual(report.total_test_cases, 3)

    def test_cpp_compilation_error_short_circuit(self):
        if not shutil.which("g++"):
            self.skipTest("g++ is not available")

        cpp_broken = "int main() { compile error! }"
        job = SubmissionJob(
            submission_id="sub-cpp-ce",
            language="cpp",
            source_code=cpp_broken,
            test_cases=[
                TestCase(id=1, input_data="1\n", expected_output="1\n"),
                TestCase(id=2, input_data="2\n", expected_output="2\n"),
            ],
        )

        report = self.evaluator.evaluate(job)
        self.assertEqual(report.verdict, ExecutionVerdict.COMPILATION_ERROR)
        self.assertEqual(report.test_cases_passed, 0)
        self.assertEqual(report.total_test_cases, 2)
        self.assertEqual(len(report.test_case_results), 0)
        self.assertIsNotNone(report.compile_output)
        self.assertTrue(len(report.compile_output) > 0)

    def test_python_time_limit_exceeded(self):
        py_infinite = """
import time
while True:
    time.sleep(0.01)
"""
        job = SubmissionJob(
            submission_id="sub-py-tle",
            language="python",
            source_code=py_infinite,
            time_limit_ms=200,
            test_cases=[
                TestCase(id=1, input_data="", expected_output=""),
            ],
        )

        report = self.evaluator.evaluate(job)
        self.assertEqual(report.verdict, ExecutionVerdict.TIME_LIMIT_EXCEEDED)
        self.assertEqual(report.test_cases_passed, 0)
        self.assertEqual(report.test_case_results[0].verdict, ExecutionVerdict.TIME_LIMIT_EXCEEDED)

    def test_unsupported_language_raises_error(self):
        job = SubmissionJob(
            submission_id="sub-unknown",
            language="brainfuck",
            source_code="",
            test_cases=[],
        )
        with self.assertRaises(ValueError):
            self.evaluator.evaluate(job)


if __name__ == "__main__":
    unittest.main()

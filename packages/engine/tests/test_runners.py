import shutil
import sys
import unittest
from pathlib import Path

# Add engine src to path for direct testing
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.comparator import OutputComparator
from src.models import ExecutionVerdict, ResourceLimits
from src.runners.cpp import CppRunner
from src.runners.python import PythonRunner


class TestOutputComparator(unittest.TestCase):
    def setUp(self):
        self.comparator = OutputComparator()

    def test_exact_match(self):
        result = self.comparator.compare("42\n", "42\n")
        self.assertTrue(result.is_match)
        self.assertIsNone(result.diff)

    def test_crlf_and_trailing_whitespace_normalization(self):
        actual = "42   \r\nHello World   \r\n\r\n"
        expected = "42\nHello World\n"
        result = self.comparator.compare(actual, expected)
        self.assertTrue(result.is_match)

    def test_token_spacing_within_line(self):
        actual = "1   2   3\n"
        expected = "1 2 3\n"
        result = self.comparator.compare(actual, expected)
        self.assertTrue(result.is_match)

    def test_mismatch_generates_diff(self):
        actual = "10\n20\n"
        expected = "10\n25\n"
        result = self.comparator.compare(actual, expected)
        self.assertFalse(result.is_match)
        self.assertIsNotNone(result.diff)
        self.assertIn("-25", result.diff)
        self.assertIn("+20", result.diff)

    def test_case_sensitivity(self):
        result_sensitive = self.comparator.compare("yes\n", "YES\n", case_sensitive=True)
        self.assertFalse(result_sensitive.is_match)

        result_insensitive = self.comparator.compare("yes\n", "YES\n", case_sensitive=False)
        self.assertTrue(result_insensitive.is_match)


class TestCppRunner(unittest.TestCase):
    def setUp(self):
        if not shutil.which("g++"):
            self.skipTest("g++ is not available on this system.")
        self.runner = CppRunner()

    def test_cpp_accepted_addition(self):
        cpp_code = """
        #include <iostream>
        int main() {
            long long a, b;
            if (std::cin >> a >> b) {
                std::cout << (a + b) << std::endl;
            }
            return 0;
        }
        """
        limits = ResourceLimits(time_limit_ms=2000, memory_limit_bytes=268435456)
        result = self.runner.run(cpp_code, input_data="123 456\n", limits=limits)
        self.assertEqual(result.verdict, ExecutionVerdict.ACCEPTED)
        self.assertEqual(result.stdout.strip(), "579")

    def test_cpp_compilation_error(self):
        cpp_code = """
        #include <iostream>
        int main() {
            this is not valid c++ code;
            return 0;
        }
        """
        result = self.runner.run(cpp_code)
        self.assertEqual(result.verdict, ExecutionVerdict.COMPILATION_ERROR)
        self.assertTrue(len(result.stderr) > 0)

    def test_cpp_time_limit_exceeded(self):
        cpp_code = """
        int main() {
            volatile int x = 0;
            while (true) {
                x++;
            }
            return 0;
        }
        """
        # Low time limit of 200ms
        limits = ResourceLimits(time_limit_ms=200)
        result = self.runner.run(cpp_code, limits=limits)
        self.assertEqual(result.verdict, ExecutionVerdict.TIME_LIMIT_EXCEEDED)

    def test_cpp_runtime_error(self):
        cpp_code = """
        #include <cstdlib>
        int main() {
            std::exit(42);
        }
        """
        result = self.runner.run(cpp_code)
        self.assertEqual(result.verdict, ExecutionVerdict.RUNTIME_ERROR)
        self.assertEqual(result.metrics.exit_code, 42)


class TestPythonRunner(unittest.TestCase):
    def setUp(self):
        self.runner = PythonRunner()

    def test_python_accepted(self):
        py_code = """
import sys
data = sys.stdin.read().split()
if data:
    print(int(data[0]) * int(data[1]))
"""
        result = self.runner.run(py_code, input_data="7 8\n")
        self.assertEqual(result.verdict, ExecutionVerdict.ACCEPTED)
        self.assertEqual(result.stdout.strip(), "56")

    def test_python_syntax_error(self):
        py_code = "def invalid syntax here :"
        result = self.runner.run(py_code)
        self.assertEqual(result.verdict, ExecutionVerdict.COMPILATION_ERROR)
        self.assertIn("SyntaxError", result.stderr)

    def test_python_runtime_error_division_by_zero(self):
        py_code = """
x = 1 / 0
"""
        result = self.runner.run(py_code)
        self.assertEqual(result.verdict, ExecutionVerdict.RUNTIME_ERROR)
        self.assertIn("ZeroDivisionError", result.stderr)

    def test_python_time_limit_exceeded(self):
        py_code = """
import time
while True:
    time.sleep(0.05)
"""
        # Low time limit of 200ms
        limits = ResourceLimits(time_limit_ms=200)
        result = self.runner.run(py_code, limits=limits)
        self.assertEqual(result.verdict, ExecutionVerdict.TIME_LIMIT_EXCEEDED)

    def test_python_memory_error(self):
        py_code = """
raise MemoryError("Artificial out of memory")
"""
        result = self.runner.run(py_code)
        self.assertEqual(result.verdict, ExecutionVerdict.MEMORY_LIMIT_EXCEEDED)


if __name__ == "__main__":
    unittest.main()

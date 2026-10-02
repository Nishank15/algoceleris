import shutil
import sys
import unittest
from pathlib import Path

# Add engine src to path for direct testing
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.models import ExecutionVerdict, ResourceLimits
from src.runners.java import JavaRunner


class TestJavaRunner(unittest.TestCase):
    def setUp(self):
        if not shutil.which("javac") or not shutil.which("java"):
            self.skipTest("Java (javac/java) is not installed on this system.")
        self.runner = JavaRunner()

    def test_java_accepted_solution(self):
        code = """
import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextLong()) {
            long a = scanner.nextLong();
            long b = scanner.nextLong();
            System.out.println(a + b);
        }
    }
}
"""
        result = self.runner.run(code, input_data="40 2\n")
        self.assertEqual(result.verdict, ExecutionVerdict.ACCEPTED)
        self.assertEqual(result.stdout.strip(), "42")

    def test_java_custom_class_name(self):
        code = """
import java.util.Scanner;

public class Calculator {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextInt()) {
            int n = scanner.nextInt();
            System.out.println(n * n);
        }
    }
}
"""
        result = self.runner.run(code, input_data="9\n")
        self.assertEqual(result.verdict, ExecutionVerdict.ACCEPTED)
        self.assertEqual(result.stdout.strip(), "81")

    def test_java_compilation_error(self):
        code = """
public class Solution {
    public static void main(String[] args) {
        int x = "incompatible types";
    }
}
"""
        result = self.runner.run(code)
        self.assertEqual(result.verdict, ExecutionVerdict.COMPILATION_ERROR)
        self.assertIn("incompatible types", result.stderr)

    def test_java_runtime_error(self):
        code = """
public class Solution {
    public static void main(String[] args) {
        int a = 1 / 0;
    }
}
"""
        result = self.runner.run(code)
        self.assertEqual(result.verdict, ExecutionVerdict.RUNTIME_ERROR)
        self.assertIn("ArithmeticException", result.stderr)

    def test_java_time_limit_exceeded(self):
        code = """
public class Solution {
    public static void main(String[] args) {
        while (true) {
            try {
                Thread.sleep(50);
            } catch (Exception e) {}
        }
    }
}
"""
        # Low time limit of 300ms
        limits = ResourceLimits(time_limit_ms=300)
        result = self.runner.run(code, limits=limits)
        self.assertEqual(result.verdict, ExecutionVerdict.TIME_LIMIT_EXCEEDED)

    def test_java_memory_limit_exceeded(self):
        code = """
import java.util.ArrayList;
import java.util.List;

public class Solution {
    public static void main(String[] args) {
        List<byte[]> memoryHog = new ArrayList<>();
        while (true) {
            memoryHog.add(new byte[10 * 1024 * 1024]); // 10MB chunks
        }
    }
}
"""
        # JVM configured with -Xmx256m will trigger java.lang.OutOfMemoryError quickly
        result = self.runner.run(code)
        self.assertEqual(result.verdict, ExecutionVerdict.MEMORY_LIMIT_EXCEEDED)


if __name__ == "__main__":
    unittest.main()

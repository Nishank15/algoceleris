import asyncio
import shutil
import sys
import time
import unittest
from pathlib import Path

# Add package paths for cross-package imports
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(ROOT_DIR / "packages" / "engine"))
sys.path.insert(0, str(ROOT_DIR / "packages" / "gateway"))
sys.path.insert(0, str(ROOT_DIR / "packages" / "worker"))

from packages.engine.src import ExecutionVerdict, JudgeEvaluator
from packages.gateway.src import InMemoryQueueBroker
from packages.worker.src import WorkerDaemon, WorkerPool


class TestWorkerDaemon(unittest.TestCase):
    def setUp(self):
        self.broker = InMemoryQueueBroker()
        self.evaluator = JudgeEvaluator()
        self.daemon = WorkerDaemon(broker=self.broker, evaluator=self.evaluator)

    def test_worker_processes_accepted_cpp_submission(self):
        if not shutil.which("g++"):
            self.skipTest("g++ is not installed")

        sub_id = "sub-test-cpp-1"
        job_data = {
            "submission_id": sub_id,
            "language": "cpp",
            "source_code": """
            #include <iostream>
            int main() {
                long long a, b;
                if (std::cin >> a >> b) std::cout << (a + b) << std::endl;
                return 0;
            }
            """,
            "time_limit_ms": 2000,
            "memory_limit_bytes": 268435456,
            "test_cases": [
                {"id": 1, "input_data": "10 20\n", "expected_output": "30\n"},
                {"id": 2, "input_data": "100 200\n", "expected_output": "300\n"},
            ],
        }

        # Track events published to channel
        events_received = []

        async def listen():
            async for ev in self.broker.listen_channel(f"judge:events:{sub_id}"):
                events_received.append(ev)
                if ev.get("event_type") == "completed":
                    break

        # Run listener in background task
        loop = asyncio.new_event_loop()

        def run_listener():
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(listen())
            finally:
                loop.run_until_complete(loop.shutdown_asyncgens())
                loop.close()

        import threading
        listener_thread = threading.Thread(target=run_listener, daemon=True)
        listener_thread.start()

        # Wait until subscriber queue is registered
        start_wait = time.monotonic()
        while time.monotonic() - start_wait < 2.0:
            if self.broker._subscribers.get(f"judge:events:{sub_id}"):
                break
            time.sleep(0.01)

        # Process job
        report = self.daemon.process_job(job_data)
        self.assertEqual(report.verdict, ExecutionVerdict.ACCEPTED)
        self.assertEqual(report.test_cases_passed, 2)

        listener_thread.join(timeout=2.0)

        # Check status in broker
        status_rec = self.broker.get_status(sub_id)
        self.assertIsNotNone(status_rec)
        self.assertEqual(status_rec.get("status"), "COMPLETED")
        self.assertEqual(status_rec.get("verdict"), "ACCEPTED")
        self.assertIn("report", status_rec)

        # Verify stream event sequence
        event_types = [ev["event_type"] for ev in events_received]
        self.assertIn("compiling", event_types)
        self.assertIn("test_case_start", event_types)
        self.assertIn("test_case_result", event_types)
        self.assertIn("completed", event_types)

    def test_worker_processes_python_tle_submission(self):
        sub_id = "sub-test-py-tle"
        job_data = {
            "submission_id": sub_id,
            "language": "python",
            "source_code": "import time\nwhile True:\n    time.sleep(0.01)",
            "time_limit_ms": 200,
            "test_cases": [{"id": 1, "input_data": "", "expected_output": ""}],
        }

        report = self.daemon.process_job(job_data)
        self.assertEqual(report.verdict, ExecutionVerdict.TIME_LIMIT_EXCEEDED)

        status_rec = self.broker.get_status(sub_id)
        self.assertEqual(status_rec.get("status"), "COMPLETED")
        self.assertEqual(status_rec.get("verdict"), "TIME_LIMIT_EXCEEDED")

    def test_worker_processes_compilation_error(self):
        if not shutil.which("g++"):
            self.skipTest("g++ is not installed")

        sub_id = "sub-test-cpp-ce"
        job_data = {
            "submission_id": sub_id,
            "language": "cpp",
            "source_code": "invalid c++ code syntax error",
            "test_cases": [{"id": 1, "input_data": "", "expected_output": ""}],
        }

        report = self.daemon.process_job(job_data)
        self.assertEqual(report.verdict, ExecutionVerdict.COMPILATION_ERROR)

        status_rec = self.broker.get_status(sub_id)
        self.assertEqual(status_rec.get("status"), "FAILED")
        self.assertEqual(status_rec.get("verdict"), "COMPILATION_ERROR")
        self.assertIsNotNone(status_rec.get("diagnostics"))

    def test_worker_pool_concurrent_execution(self):
        pool = WorkerPool(concurrency=2, broker=self.broker, evaluator=self.evaluator)

        # Enqueue 4 python jobs
        sub_ids = []
        for i in range(4):
            sub_id = f"sub-batch-{i}"
            sub_ids.append(sub_id)
            self.broker.enqueue(
                "judge:submissions",
                {
                    "submission_id": sub_id,
                    "language": "python",
                    "source_code": f"print({i} * 10)",
                    "test_cases": [{"id": 1, "input_data": "", "expected_output": f"{i * 10}\n"}],
                },
            )

        # Start pool
        pool.start()

        # Wait for all jobs to complete
        start = time.monotonic()
        while time.monotonic() - start < 10.0:
            completed_all = True
            for s_id in sub_ids:
                st = self.broker.get_status(s_id)
                if not st or st.get("status") != "COMPLETED":
                    completed_all = False
                    break
            if completed_all:
                break
            time.sleep(0.1)

        pool.stop(timeout=2.0)

        # Verify all jobs completed with ACCEPTED
        for s_id in sub_ids:
            st = self.broker.get_status(s_id)
            self.assertIsNotNone(st, f"Status missing for {s_id}")
            self.assertEqual(st.get("status"), "COMPLETED")
            self.assertEqual(st.get("verdict"), "ACCEPTED")


if __name__ == "__main__":
    unittest.main()

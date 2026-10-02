import shutil
import sys
import threading
import time
import unittest
from pathlib import Path

# Add package paths for cross-package imports
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(ROOT_DIR / "packages" / "engine"))
sys.path.insert(0, str(ROOT_DIR / "packages" / "gateway"))
sys.path.insert(0, str(ROOT_DIR / "packages" / "worker"))

from fastapi.testclient import TestClient

from packages.gateway.src.main import create_production_app
from packages.gateway.src.queue import InMemoryQueueBroker
from packages.worker.src import WorkerDaemon


class TestWebSocketStreaming(unittest.TestCase):
    def setUp(self):
        self.broker = InMemoryQueueBroker()
        self.app = create_production_app(broker=self.broker)
        self.client = TestClient(self.app)
        self.daemon = WorkerDaemon(broker=self.broker)

    def test_realtime_websocket_streaming_flow(self):
        # 1. Submit valid Python job with 2 test cases
        payload = {
            "language": "python",
            "source_code": """
import sys
data = sys.stdin.read().split()
if data:
    print(int(data[0]) * 2)
""",
            "time_limit_ms": 2000,
            "test_cases": [
                {"id": 1, "input_data": "5\n", "expected_output": "10\n"},
                {"id": 2, "input_data": "21\n", "expected_output": "42\n"},
            ],
        }
        submit_resp = self.client.post("/api/v1/submissions", json=payload)
        self.assertEqual(submit_resp.status_code, 202)
        sub_id = submit_resp.json()["submission_id"]

        # 2. Connect WebSocket before processing job
        received_events = []

        with self.client.websocket_connect(f"/ws/submissions/{sub_id}") as ws:
            # First message should be initial status
            first_msg = ws.receive_json()
            received_events.append(first_msg)
            self.assertEqual(first_msg["event_type"], "status")
            self.assertEqual(first_msg["data"]["status"], "QUEUED")

            # 3. Spawn thread to process job with WorkerDaemon
            worker_thread = threading.Thread(
                target=lambda: self.daemon.run_once("judge:submissions", timeout=1),
                daemon=True,
            )
            worker_thread.start()

            # 4. Read incoming WebSocket event frames until 'completed'
            while True:
                msg = ws.receive_json()
                received_events.append(msg)
                if msg.get("event_type") == "completed":
                    break

            worker_thread.join(timeout=3.0)

        # 5. Assert received events sequence
        event_types = [ev["event_type"] for ev in received_events]
        self.assertIn("status", event_types)
        self.assertIn("compiling", event_types)
        self.assertIn("test_case_start", event_types)
        self.assertIn("test_case_result", event_types)
        self.assertIn("completed", event_types)

        # Check final completed frame payload
        completed_frame = [ev for ev in received_events if ev["event_type"] == "completed"][0]
        self.assertEqual(completed_frame["data"]["verdict"], "ACCEPTED")
        self.assertEqual(completed_frame["data"]["test_cases_passed"], 2)

    def test_websocket_reconnect_to_completed_job(self):
        # 1. Submit and process job completely
        payload = {
            "language": "python",
            "source_code": "print(100)",
            "test_cases": [{"id": 1, "input_data": "", "expected_output": "100\n"}],
        }
        submit_resp = self.client.post("/api/v1/submissions", json=payload)
        sub_id = submit_resp.json()["submission_id"]

        # Process immediately
        self.daemon.run_once("judge:submissions", timeout=1)

        # 2. Connect WebSocket to finished job
        with self.client.websocket_connect(f"/ws/submissions/{sub_id}") as ws:
            frame = ws.receive_json()
            self.assertEqual(frame["event_type"], "completed")
            self.assertEqual(frame["submission_id"], sub_id)
            self.assertEqual(frame["data"]["status"], "COMPLETED")
            self.assertEqual(frame["data"]["verdict"], "ACCEPTED")

    def test_websocket_compilation_error_streaming(self):
        if not shutil.which("g++"):
            self.skipTest("g++ is not installed")

        payload = {
            "language": "cpp",
            "source_code": "invalid c++ syntax error here ;;;",
            "test_cases": [{"id": 1, "input_data": "", "expected_output": ""}],
        }
        submit_resp = self.client.post("/api/v1/submissions", json=payload)
        sub_id = submit_resp.json()["submission_id"]

        received_events = []
        with self.client.websocket_connect(f"/ws/submissions/{sub_id}") as ws:
            # Initial status
            first_msg = ws.receive_json()
            received_events.append(first_msg)

            # Process job
            worker_thread = threading.Thread(
                target=lambda: self.daemon.run_once("judge:submissions", timeout=1),
                daemon=True,
            )
            worker_thread.start()

            while True:
                msg = ws.receive_json()
                received_events.append(msg)
                if msg.get("event_type") in {"compilation_failed", "completed"}:
                    break

            worker_thread.join(timeout=3.0)

        ev_types = [ev["event_type"] for ev in received_events]
        self.assertTrue("compilation_failed" in ev_types or "completed" in ev_types)


if __name__ == "__main__":
    unittest.main()

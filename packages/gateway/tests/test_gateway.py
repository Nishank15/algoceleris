import sys
import unittest
from pathlib import Path

# Add gateway root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from src.api import create_app
from src.models import SubmissionStatus
from src.queue import InMemoryQueueBroker


class TestGatewayAPI(unittest.TestCase):
    def setUp(self):
        self.broker = InMemoryQueueBroker()
        self.app = create_app(broker=self.broker)
        self.client = TestClient(self.app)

    def test_submit_valid_cpp_job(self):
        payload = {
            "language": "cpp",
            "source_code": "#include <iostream>\nint main(){ return 0; }",
            "time_limit_ms": 1500,
            "memory_limit_bytes": 134217728,
            "test_cases": [
                {"id": 1, "input_data": "1 2\n", "expected_output": "3\n", "is_sample": True}
            ],
        }
        response = self.client.post("/api/v1/submissions", json=payload)
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertTrue(data["submission_id"].startswith("sub-"))
        self.assertEqual(data["status"], SubmissionStatus.QUEUED.value)

        # Verify job was placed in queue
        queued_job = self.broker.dequeue("judge:submissions", timeout=1)
        self.assertIsNotNone(queued_job)
        self.assertEqual(queued_job["submission_id"], data["submission_id"])
        self.assertEqual(queued_job["language"], "cpp")
        self.assertEqual(len(queued_job["test_cases"]), 1)

    def test_submit_valid_python_job(self):
        payload = {
            "language": "python3",
            "source_code": "print('hello')",
            "test_cases": [
                {"id": 1, "input_data": "", "expected_output": "hello\n"}
            ],
        }
        response = self.client.post("/api/v1/submissions", json=payload)
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertTrue(data["submission_id"].startswith("sub-"))

        # Verify language normalization to canonical 'python'
        queued_job = self.broker.dequeue("judge:submissions", timeout=1)
        self.assertEqual(queued_job["language"], "python")

    def test_submit_valid_java_job(self):
        payload = {
            "language": "java",
            "source_code": "public class Solution { public static void main(String[] args) {} }",
            "test_cases": [
                {"id": 1, "input_data": "", "expected_output": ""}
            ],
        }
        response = self.client.post("/api/v1/submissions", json=payload)
        self.assertEqual(response.status_code, 202)

    def test_submit_invalid_language_returns_422(self):
        payload = {
            "language": "rust",
            "source_code": "fn main() {}",
            "test_cases": [
                {"id": 1, "input_data": "", "expected_output": ""}
            ],
        }
        response = self.client.post("/api/v1/submissions", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_submit_empty_code_returns_422(self):
        payload = {
            "language": "python",
            "source_code": "",
            "test_cases": [
                {"id": 1, "input_data": "", "expected_output": ""}
            ],
        }
        response = self.client.post("/api/v1/submissions", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_submit_empty_test_cases_returns_422(self):
        payload = {
            "language": "python",
            "source_code": "print(1)",
            "test_cases": [],
        }
        response = self.client.post("/api/v1/submissions", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_get_submission_status(self):
        # Submit a job first
        payload = {
            "language": "cpp",
            "source_code": "int main(){}",
            "test_cases": [{"id": 1, "input_data": "", "expected_output": ""}],
        }
        post_resp = self.client.post("/api/v1/submissions", json=payload)
        sub_id = post_resp.json()["submission_id"]

        # Fetch status
        get_resp = self.client.get(f"/api/v1/submissions/{sub_id}")
        self.assertEqual(get_resp.status_code, 200)
        status_data = get_resp.json()
        self.assertEqual(status_data["submission_id"], sub_id)
        self.assertEqual(status_data["status"], SubmissionStatus.QUEUED.value)

        # Fetch non-existent ID
        missing_resp = self.client.get("/api/v1/submissions/sub-nonexistent")
        self.assertEqual(missing_resp.status_code, 404)

    def test_gateway_health(self):
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["broker"], "InMemoryQueueBroker")


if __name__ == "__main__":
    unittest.main()

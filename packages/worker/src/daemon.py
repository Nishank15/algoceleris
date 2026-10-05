import dataclasses
import time
from typing import Any, Dict, Optional

# Support importing when installed or via sys.path
try:
    from packages.engine.src import JudgeEvaluator, SubmissionJob, SubmissionReport, TestCase
    from packages.gateway.src.queue import QueueBroker, get_queue_broker
except ImportError:
    from src.evaluator import JudgeEvaluator, SubmissionJob, SubmissionReport, TestCase
    from src.queue import QueueBroker, get_queue_broker


class WorkerDaemon:
    """Worker daemon consuming submission jobs from queue and executing inside sandbox."""

    def __init__(
        self,
        broker: Optional[QueueBroker] = None,
        evaluator: Optional[JudgeEvaluator] = None,
    ):
        self.broker = broker or get_queue_broker()
        self.evaluator = evaluator or JudgeEvaluator()
        self._stop_requested = False

    def process_job(self, job_data: Dict[str, Any]) -> SubmissionReport:
        """Process a single submission job end-to-end, streaming intermediate events."""
        sub_id = job_data["submission_id"]
        language = job_data["language"]
        source_code = job_data["source_code"]
        time_limit = job_data.get("time_limit_ms", 2000)
        memory_limit = job_data.get("memory_limit_bytes", 268435456)

        test_cases = [
            TestCase(
                id=tc["id"],
                input_data=tc.get("input_data", ""),
                expected_output=tc["expected_output"],
                is_sample=tc.get("is_sample", False),
            )
            for tc in job_data.get("test_cases", [])
        ]

        job = SubmissionJob(
            submission_id=sub_id,
            language=language,
            source_code=source_code,
            time_limit_ms=time_limit,
            memory_limit_bytes=memory_limit,
            test_cases=test_cases,
        )

        channel = f"judge:events:{sub_id}"

        def on_progress(event_type: str, data: Dict[str, Any]):
            event_payload = {
                "event_type": event_type,
                "submission_id": sub_id,
                "data": data,
                "timestamp": time.time(),
            }
            # Publish to Pub/Sub channel
            self.broker.publish(channel, event_payload)

            # Update status store
            if event_type == "compiling":
                self.broker.set_status(sub_id, {"status": "COMPILING"})
            elif event_type == "test_case_start":
                self.broker.set_status(
                    sub_id,
                    {
                        "status": "RUNNING",
                        "current_test_case": data.get("test_case_id"),
                    },
                )
            elif event_type == "compilation_failed":
                self.broker.set_status(
                    sub_id,
                    {
                        "status": "FAILED",
                        "verdict": "COMPILATION_ERROR",
                        "diagnostics": data.get("diagnostics"),
                    },
                )
            elif event_type == "completed":
                current_st = self.broker.get_status(sub_id) or {}
                final_status = "FAILED" if (data.get("verdict") == "COMPILATION_ERROR" or current_st.get("status") == "FAILED") else "COMPLETED"
                self.broker.set_status(
                    sub_id,
                    {
                        "status": final_status,
                        "verdict": data.get("verdict"),
                        "test_cases_passed": data.get("test_cases_passed"),
                        "total_test_cases": data.get("total_test_cases"),
                    },
                )

        # Execute submission
        report = self.evaluator.evaluate(
            job,
            stop_on_first_failure=True,
            progress_callback=on_progress,
        )

        # Store full report in status store
        self.broker.set_status(sub_id, {"report": dataclasses.asdict(report)})

        return report

    def run_once(self, queue_name: str = "judge:submissions", timeout: int = 1) -> bool:
        """Dequeue and execute one job if available."""
        job_data = self.broker.dequeue(queue_name, timeout=timeout)
        if not job_data:
            return False
        self.process_job(job_data)
        return True

    def run_forever(self, queue_name: str = "judge:submissions"):
        """Continuously poll queue and process jobs until stopped."""
        while not self._stop_requested:
            try:
                self.run_once(queue_name, timeout=1)
            except Exception as exc:
                time.sleep(0.5)

    def stop(self):
        """Signal worker loop to terminate."""
        self._stop_requested = True

import threading
import time
from typing import List, Optional

try:
    from packages.engine.src import JudgeEvaluator
    from packages.gateway.src import QueueBroker, get_queue_broker
except ImportError:
    from src.evaluator import JudgeEvaluator
    from src.queue import QueueBroker, get_queue_broker

from .daemon import WorkerDaemon


class WorkerPool:
    """Supervises a pool of concurrent worker daemons processing submission queues."""

    def __init__(
        self,
        concurrency: int = 4,
        broker: Optional[QueueBroker] = None,
        evaluator: Optional[JudgeEvaluator] = None,
        queue_name: str = "judge:submissions",
    ):
        self.concurrency = concurrency
        self.broker = broker or get_queue_broker()
        self.evaluator = evaluator or JudgeEvaluator()
        self.queue_name = queue_name

        self._daemons: List[WorkerDaemon] = []
        self._threads: List[threading.Thread] = []
        self._is_running = False
        self._jobs_processed = 0
        self._lock = threading.Lock()

    def start(self):
        """Spawn and start worker daemon threads."""
        if self._is_running:
            return
        self._is_running = True
        self._daemons.clear()
        self._threads.clear()

        for idx in range(self.concurrency):
            daemon = WorkerDaemon(broker=self.broker, evaluator=self.evaluator)
            self._daemons.append(daemon)

            def worker_loop(d: WorkerDaemon):
                while self._is_running and not d._stop_requested:
                    processed = d.run_once(self.queue_name, timeout=1)
                    if processed:
                        with self._lock:
                            self._jobs_processed += 1

            th = threading.Thread(
                target=worker_loop,
                args=(daemon,),
                name=f"judge-worker-{idx}",
                daemon=True,
            )
            self._threads.append(th)
            th.start()

    def stop(self, timeout: float = 3.0):
        """Signal all workers to stop and wait for completion."""
        self._is_running = False
        for d in self._daemons:
            d.stop()
        for th in self._threads:
            th.join(timeout=timeout)

    @property
    def jobs_processed(self) -> int:
        with self._lock:
            return self._jobs_processed

    def process_all_jobs(self, timeout: float = 5.0) -> int:
        """Process all currently queued jobs until the queue is depleted."""
        daemon = WorkerDaemon(broker=self.broker, evaluator=self.evaluator)
        count = 0
        start = time.monotonic()
        while time.monotonic() - start < timeout:
            processed = daemon.run_once(self.queue_name, timeout=0.1)
            if processed:
                count += 1
            else:
                break
        return count

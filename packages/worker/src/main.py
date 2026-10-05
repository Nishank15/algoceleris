import logging
import os
import signal
import sys
import time

from packages.engine.src import JudgeEvaluator
from packages.gateway.src.queue import get_queue_broker
from packages.worker.src.pool import WorkerPool

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("worker")


def main():
    concurrency = int(os.environ.get("CONCURRENCY", "4"))
    redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
    queue_name = os.environ.get("QUEUE_NAME", "judge:submissions")

    logger.info(
        "Initializing worker pool (concurrency=%d, queue=%s, redis_url=%s)",
        concurrency,
        queue_name,
        redis_url,
    )
    broker = get_queue_broker(redis_url)
    evaluator = JudgeEvaluator()
    pool = WorkerPool(
        concurrency=concurrency,
        broker=broker,
        evaluator=evaluator,
        queue_name=queue_name,
    )

    def handle_shutdown(signum, frame):
        logger.info("Termination signal %s received. Stopping worker pool...", signum)
        pool.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    pool.start()
    logger.info("Worker pool running with %d daemons. Listening for jobs...", concurrency)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        handle_shutdown(signal.SIGINT, None)


if __name__ == "__main__":
    main()

import abc
import asyncio
import json
import os
import queue
import threading
from typing import Any, AsyncIterator, Dict, List, Optional


class QueueBroker(abc.ABC):
    """Abstract interface for task queuing, status tracking, and Pub/Sub event distribution."""

    @abc.abstractmethod
    def enqueue(self, queue_name: str, payload: Dict[str, Any]) -> None:
        """Push a JSON-serializable job onto the specified queue."""
        pass

    @abc.abstractmethod
    def dequeue(self, queue_name: str, timeout: int = 1) -> Optional[Dict[str, Any]]:
        """Pop a job from the queue, blocking up to timeout seconds."""
        pass

    @abc.abstractmethod
    def publish(self, channel: str, event: Dict[str, Any]) -> None:
        """Broadcast an event onto the specified pub/sub channel."""
        pass

    @abc.abstractmethod
    def set_status(self, submission_id: str, status_data: Dict[str, Any]) -> None:
        """Persist or update state for a submission."""
        pass

    @abc.abstractmethod
    def get_status(self, submission_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve current state for a submission."""
        pass

    @abc.abstractmethod
    async def listen_channel(self, channel: str) -> AsyncIterator[Dict[str, Any]]:
        """Asynchronously yield events published to a channel."""
        pass


class InMemoryQueueBroker(QueueBroker):
    """Thread-safe and asyncio-compatible in-memory queue broker for testing and offline execution."""

    def __init__(self):
        self._queues: Dict[str, queue.Queue] = {}
        self._status_store: Dict[str, Dict[str, Any]] = {}
        self._subscribers: Dict[str, List[asyncio.Queue]] = {}
        self._lock = threading.Lock()

    def _get_queue(self, queue_name: str) -> queue.Queue:
        with self._lock:
            if queue_name not in self._queues:
                self._queues[queue_name] = queue.Queue()
            return self._queues[queue_name]

    def enqueue(self, queue_name: str, payload: Dict[str, Any]) -> None:
        q = self._get_queue(queue_name)
        q.put(payload)

    def dequeue(self, queue_name: str, timeout: int = 1) -> Optional[Dict[str, Any]]:
        q = self._get_queue(queue_name)
        try:
            return q.get(block=True, timeout=timeout)
        except queue.Empty:
            return None

    def publish(self, channel: str, event: Dict[str, Any]) -> None:
        with self._lock:
            subs = list(self._subscribers.get(channel, []))
        for sub in subs:
            try:
                sub.put_nowait(event)
            except asyncio.QueueFull:
                pass

    def set_status(self, submission_id: str, status_data: Dict[str, Any]) -> None:
        with self._lock:
            if submission_id not in self._status_store:
                self._status_store[submission_id] = {}
            self._status_store[submission_id].update(status_data)

    def get_status(self, submission_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            data = self._status_store.get(submission_id)
            return dict(data) if data is not None else None

    async def listen_channel(self, channel: str) -> AsyncIterator[Dict[str, Any]]:
        sub_queue: asyncio.Queue = asyncio.Queue()
        with self._lock:
            if channel not in self._subscribers:
                self._subscribers[channel] = []
            self._subscribers[channel].append(sub_queue)
        try:
            while True:
                event = await sub_queue.get()
                yield event
                sub_queue.task_done()
        finally:
            with self._lock:
                if channel in self._subscribers and sub_queue in self._subscribers[channel]:
                    self._subscribers[channel].remove(sub_queue)


class RedisQueueBroker(QueueBroker):
    """Production Redis broker utilizing Redis lists for FIFO jobs and Pub/Sub for live telemetry."""

    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        import redis
        self.redis_url = redis_url
        self._client = redis.Redis.from_url(redis_url, decode_responses=True)
        # Test connection
        self._client.ping()

    def enqueue(self, queue_name: str, payload: Dict[str, Any]) -> None:
        serialized = json.dumps(payload)
        self._client.lpush(queue_name, serialized)

    def dequeue(self, queue_name: str, timeout: int = 1) -> Optional[Dict[str, Any]]:
        result = self._client.brpop(queue_name, timeout=timeout)
        if result:
            _, serialized = result
            return json.loads(serialized)
        return None

    def publish(self, channel: str, event: Dict[str, Any]) -> None:
        serialized = json.dumps(event)
        self._client.publish(channel, serialized)

    def set_status(self, submission_id: str, status_data: Dict[str, Any]) -> None:
        key = f"judge:status:{submission_id}"
        # Serialize nested dicts / lists
        mapping = {}
        for k, v in status_data.items():
            mapping[k] = json.dumps(v) if isinstance(v, (dict, list)) else str(v)
        self._client.hset(key, mapping=mapping)
        self._client.expire(key, 86400)  # 24h retention

    def get_status(self, submission_id: str) -> Optional[Dict[str, Any]]:
        key = f"judge:status:{submission_id}"
        raw = self._client.hgetall(key)
        if not raw:
            return None
        parsed = {}
        for k, v in raw.items():
            try:
                parsed[k] = json.loads(v)
            except (json.JSONDecodeError, TypeError):
                parsed[k] = v
        return parsed

    async def listen_channel(self, channel: str) -> AsyncIterator[Dict[str, Any]]:
        import redis.asyncio as aioredis
        async_client = aioredis.from_url(self.redis_url, decode_responses=True)
        pubsub = async_client.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message.get("type") == "message":
                    data = message.get("data")
                    try:
                        yield json.loads(data)
                    except (json.JSONDecodeError, TypeError):
                        yield {"raw": data}
        finally:
            await pubsub.unsubscribe(channel)
            await async_client.close()


def get_queue_broker(redis_url: Optional[str] = None) -> QueueBroker:
    """Factory creating RedisQueueBroker if reachable, else falling back to InMemoryQueueBroker."""
    url = redis_url or os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    try:
        broker = RedisQueueBroker(redis_url=url)
        return broker
    except Exception:
        # Graceful fallback to InMemoryQueueBroker for local dev & testing
        return InMemoryQueueBroker()

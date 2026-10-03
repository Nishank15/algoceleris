import json
import logging
import os
import threading
import time
import uuid
from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ProctoringEventType(str, Enum):
    FULLSCREEN_EXIT = "FULLSCREEN_EXIT"
    TAB_BLUR = "TAB_BLUR"
    CLIPBOARD_COPY = "CLIPBOARD_COPY"
    CLIPBOARD_PASTE = "CLIPBOARD_PASTE"
    CONTEXT_MENU = "CONTEXT_MENU"


class ProctoringEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: f"pevt-{uuid.uuid4().hex[:10]}")
    contest_id: str
    user_id: str
    event_type: ProctoringEventType
    timestamp: float = Field(default_factory=time.time)
    strike_count: int = 0
    details: Optional[str] = None


class ProctoringStore(ABC):
    """Abstract persistence store for contest proctoring violations and audit trails."""

    @abstractmethod
    def log_event(self, event: ProctoringEvent) -> int:
        """Records a violation event and returns the participant's cumulative strike count."""
        pass

    @abstractmethod
    def get_events(self, contest_id: str, user_id: str) -> List[ProctoringEvent]:
        """Returns ordered audit trail of proctoring events for a participant."""
        pass

    @abstractmethod
    def get_participant_strikes(self, contest_id: str, user_id: str) -> int:
        """Returns current cumulative strike count for a participant."""
        pass

    def is_flagged(self, contest_id: str, user_id: str, max_strikes: int = 3) -> bool:
        """Returns True if the participant has reached or exceeded max strikes threshold."""
        return self.get_participant_strikes(contest_id, user_id) >= max_strikes


class InMemoryProctoringStore(ProctoringStore):
    """Thread-safe in-memory proctoring audit store for unit tests and local execution."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # (contest_id, user_id) -> List[ProctoringEvent]
        self._events: Dict[tuple[str, str], List[ProctoringEvent]] = {}

    def log_event(self, event: ProctoringEvent) -> int:
        with self._lock:
            key = (event.contest_id, event.user_id)
            if key not in self._events:
                self._events[key] = []
            
            # Strike count is cumulative number of events
            current_strikes = len(self._events[key]) + 1
            event.strike_count = current_strikes
            self._events[key].append(event)
            return current_strikes

    def get_events(self, contest_id: str, user_id: str) -> List[ProctoringEvent]:
        with self._lock:
            return list(self._events.get((contest_id, user_id), []))

    def get_participant_strikes(self, contest_id: str, user_id: str) -> int:
        with self._lock:
            return len(self._events.get((contest_id, user_id), []))


class RedisProctoringStore(ProctoringStore):
    """Redis-backed persistent proctoring store using Redis Lists and Hashes."""

    def __init__(self, redis_client) -> None:
        self.redis = redis_client

    def _list_key(self, contest_id: str, user_id: str) -> str:
        return f"contest:{contest_id}:proctor:{user_id}:events"

    def _strikes_key(self, contest_id: str, user_id: str) -> str:
        return f"contest:{contest_id}:proctor:{user_id}:strikes"

    def log_event(self, event: ProctoringEvent) -> int:
        strikes_key = self._strikes_key(event.contest_id, event.user_id)
        current_strikes = self.redis.incr(strikes_key)
        event.strike_count = current_strikes

        list_key = self._list_key(event.contest_id, event.user_id)
        self.redis.rpush(list_key, event.model_dump_json())
        return current_strikes

    def get_events(self, contest_id: str, user_id: str) -> List[ProctoringEvent]:
        list_key = self._list_key(contest_id, user_id)
        raw_items = self.redis.lrange(list_key, 0, -1)
        events: List[ProctoringEvent] = []
        for item in raw_items:
            payload = item.decode() if isinstance(item, bytes) else str(item)
            events.append(ProctoringEvent.model_validate_json(payload))
        return events

    def get_participant_strikes(self, contest_id: str, user_id: str) -> int:
        strikes_key = self._strikes_key(contest_id, user_id)
        val = self.redis.get(strikes_key)
        if val is None:
            return 0
        return int(val)


_GLOBAL_PROCTORING_STORE: Optional[ProctoringStore] = None


def get_proctoring_store() -> ProctoringStore:
    global _GLOBAL_PROCTORING_STORE
    if _GLOBAL_PROCTORING_STORE is not None:
        return _GLOBAL_PROCTORING_STORE

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    use_in_memory = os.getenv("USE_IN_MEMORY_PROCTORING", "false").lower() == "true"

    if not use_in_memory:
        try:
            import redis

            client = redis.Redis.from_url(redis_url, decode_responses=True)
            client.ping()
            _GLOBAL_PROCTORING_STORE = RedisProctoringStore(client)
            return _GLOBAL_PROCTORING_STORE
        except Exception:
            pass

    _GLOBAL_PROCTORING_STORE = InMemoryProctoringStore()
    return _GLOBAL_PROCTORING_STORE

import json
import logging
import os
import threading
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from .models import ParticipantScore

logger = logging.getLogger(__name__)


class LeaderboardEntry(BaseModel):
    rank: int = Field(..., description="1-indexed standing on leaderboard")
    user_id: str
    solved_count: int
    total_penalty_minutes: int
    problem_scores: Dict[str, dict] = Field(default_factory=dict)
    score_composite: float


class LeaderboardBackend(ABC):
    """Abstract storage backend for Sorted Set leaderboard data."""

    @abstractmethod
    def set_score(self, contest_id: str, user_id: str, score: float) -> None:
        pass

    @abstractmethod
    def get_rank(self, contest_id: str, user_id: str) -> Optional[int]:
        """Return 1-indexed rank or None if user not on leaderboard."""
        pass

    @abstractmethod
    def get_top(self, contest_id: str, limit: int) -> List[Tuple[str, float]]:
        """Return list of (user_id, score) sorted descending."""
        pass


class InMemoryLeaderboardBackend(LeaderboardBackend):
    """Thread-safe in-memory sorted map for tests and standalone mode."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # contest_id -> {user_id: score}
        self._leaderboards: Dict[str, Dict[str, float]] = {}

    def set_score(self, contest_id: str, user_id: str, score: float) -> None:
        with self._lock:
            if contest_id not in self._leaderboards:
                self._leaderboards[contest_id] = {}
            self._leaderboards[contest_id][user_id] = score

    def get_rank(self, contest_id: str, user_id: str) -> Optional[int]:
        with self._lock:
            board = self._leaderboards.get(contest_id)
            if not board or user_id not in board:
                return None
            sorted_items = sorted(board.items(), key=lambda x: x[1], reverse=True)
            for idx, (uid, _) in enumerate(sorted_items):
                if uid == user_id:
                    return idx + 1
            return None

    def get_top(self, contest_id: str, limit: int) -> List[Tuple[str, float]]:
        with self._lock:
            board = self._leaderboards.get(contest_id, {})
            sorted_items = sorted(board.items(), key=lambda x: x[1], reverse=True)
            return sorted_items[:limit]


class RedisLeaderboardBackend(LeaderboardBackend):
    """Redis Sorted Set backend using ZADD, ZREVRANGE, and ZREVRANK."""

    def __init__(self, redis_client) -> None:
        self.redis = redis_client

    def _key(self, contest_id: str) -> str:
        return f"contest:{contest_id}:leaderboard"

    def set_score(self, contest_id: str, user_id: str, score: float) -> None:
        self.redis.zadd(self._key(contest_id), {user_id: score})

    def get_rank(self, contest_id: str, user_id: str) -> Optional[int]:
        rank = self.redis.zrevrank(self._key(contest_id), user_id)
        if rank is None:
            return None
        return int(rank) + 1

    def get_top(self, contest_id: str, limit: int) -> List[Tuple[str, float]]:
        items = self.redis.zrevrange(self._key(contest_id), 0, limit - 1, withscores=True)
        results = []
        for item in items:
            uid = item[0].decode() if isinstance(item[0], bytes) else str(item[0])
            score = float(item[1])
            results.append((uid, score))
        return results


class LeaderboardEngine:
    """Manages contest rankings using Redis Sorted Set composite scores."""

    SOLVE_PRIORITY_MULTIPLIER = 1_000_000_000.0

    def __init__(
        self,
        backend: Optional[LeaderboardBackend] = None,
        contest_store=None,
    ) -> None:
        self.backend = backend or InMemoryLeaderboardBackend()
        self.contest_store = contest_store

    @classmethod
    def calculate_composite_score(cls, solved_count: int, total_penalty_minutes: int) -> float:
        """
        Calculates composite score for Redis Sorted Set.
        Solved problems have 10^9 weight, penalty minutes subtract linearly.
        Higher composite score strictly guarantees higher standing.
        """
        return (solved_count * cls.SOLVE_PRIORITY_MULTIPLIER) - (total_penalty_minutes * 60.0)

    def record_score(self, contest_id: str, participant: ParticipantScore) -> int:
        """Record participant score in Sorted Set and return updated 1-indexed rank."""
        score = self.calculate_composite_score(
            solved_count=participant.solved_count,
            total_penalty_minutes=participant.total_penalty_minutes,
        )
        self.backend.set_score(contest_id, participant.user_id, score)
        return self.backend.get_rank(contest_id, participant.user_id) or 1

    def get_user_rank(self, contest_id: str, user_id: str) -> Optional[int]:
        return self.backend.get_rank(contest_id, user_id)

    def get_leaderboard(self, contest_id: str, limit: int = 100) -> List[LeaderboardEntry]:
        top_entries = self.backend.get_top(contest_id, limit)
        results: List[LeaderboardEntry] = []

        for rank, (user_id, score) in enumerate(top_entries, start=1):
            prob_scores = {}
            solved = 0
            penalty = 0

            if self.contest_store:
                part = self.contest_store.get_participant_score(contest_id, user_id)
                if part:
                    solved = part.solved_count
                    penalty = part.total_penalty_minutes
                    prob_scores = {
                        k: v.model_dump() if hasattr(v, "model_dump") else v
                        for k, v in part.problem_scores.items()
                    }
            else:
                # Approximate from composite score if store not injected
                solved = int(score // self.SOLVE_PRIORITY_MULTIPLIER)
                penalty = int(abs(score % self.SOLVE_PRIORITY_MULTIPLIER) // 60.0)

            results.append(
                LeaderboardEntry(
                    rank=rank,
                    user_id=user_id,
                    solved_count=solved,
                    total_penalty_minutes=penalty,
                    problem_scores=prob_scores,
                    score_composite=score,
                )
            )

        return results


_GLOBAL_LEADERBOARD_ENGINE: Optional[LeaderboardEngine] = None


def get_leaderboard_engine(contest_store=None) -> LeaderboardEngine:
    global _GLOBAL_LEADERBOARD_ENGINE
    if _GLOBAL_LEADERBOARD_ENGINE is not None:
        if contest_store and not _GLOBAL_LEADERBOARD_ENGINE.contest_store:
            _GLOBAL_LEADERBOARD_ENGINE.contest_store = contest_store
        return _GLOBAL_LEADERBOARD_ENGINE

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    use_in_memory = os.getenv("USE_IN_MEMORY_LEADERBOARD", "false").lower() == "true"

    if not use_in_memory:
        try:
            import redis

            client = redis.Redis.from_url(redis_url, decode_responses=True)
            client.ping()
            backend = RedisLeaderboardBackend(client)
            _GLOBAL_LEADERBOARD_ENGINE = LeaderboardEngine(backend, contest_store)
            return _GLOBAL_LEADERBOARD_ENGINE
        except Exception:
            pass

    backend = InMemoryLeaderboardBackend()
    _GLOBAL_LEADERBOARD_ENGINE = LeaderboardEngine(backend, contest_store)
    return _GLOBAL_LEADERBOARD_ENGINE

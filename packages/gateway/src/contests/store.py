from __future__ import annotations

import json
import logging
import os
import threading
import time
from abc import ABC, abstractmethod
from typing import Dict, List, Optional

from .models import Contest, ContestProblem, ContestStatus, ParticipantScore, ProblemScore

logger = logging.getLogger(__name__)


class ContestStore(ABC):
    """Abstract interface for persisting contests and participant score states."""

    @abstractmethod
    def get_contest(self, contest_id: str) -> Optional[Contest]:
        pass

    @abstractmethod
    def list_contests(self) -> List[Contest]:
        pass

    @abstractmethod
    def create_contest(self, contest: Contest) -> Contest:
        pass

    @abstractmethod
    def register_participant(self, contest_id: str, user_id: str) -> ParticipantScore:
        pass

    @abstractmethod
    def get_participant_score(self, contest_id: str, user_id: str) -> Optional[ParticipantScore]:
        pass

    @abstractmethod
    def update_participant_score(self, score: ParticipantScore) -> None:
        pass


class InMemoryContestStore(ContestStore):
    """Thread-safe in-memory contest store pre-seeded with sample contest."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._contests: Dict[str, Contest] = {}
        # (contest_id, user_id) -> ParticipantScore
        self._participants: Dict[tuple[str, str], ParticipantScore] = {}
        self._seed_default_contest()

    def _seed_default_contest(self) -> None:
        now = time.time()
        sample_contest = Contest(
            id="weekly-contest-1",
            title="Weekly Contest 1: Core Algorithms",
            description="Algorithmic challenges in arrays, string balancing, and cache eviction architectures.",
            start_time=now - 300,
            end_time=now + 6900,
            duration_minutes=120,
            status=ContestStatus.ACTIVE,
            problems=[
                ContestProblem(
                    id="two-sum",
                    letter_code="A",
                    title="Two Sum",
                    difficulty="Easy",
                    points=100,
                ),
                ContestProblem(
                    id="valid-parentheses",
                    letter_code="B",
                    title="Valid Parentheses",
                    difficulty="Easy",
                    points=100,
                ),
                ContestProblem(
                    id="lru-cache",
                    letter_code="C",
                    title="LRU Cache",
                    difficulty="Medium",
                    points=200,
                ),
            ],
        )
        self._contests[sample_contest.id] = sample_contest

    def get_contest(self, contest_id: str) -> Optional[Contest]:
        with self._lock:
            return self._contests.get(contest_id)

    def list_contests(self) -> List[Contest]:
        with self._lock:
            return list(self._contests.values())

    def create_contest(self, contest: Contest) -> Contest:
        with self._lock:
            self._contests[contest.id] = contest
            return contest

    def register_participant(self, contest_id: str, user_id: str) -> ParticipantScore:
        with self._lock:
            key = (contest_id, user_id)
            if key in self._participants:
                return self._participants[key]

            contest = self._contests.get(contest_id)
            prob_scores = {}
            if contest:
                for prob in contest.problems:
                    prob_scores[prob.id] = ProblemScore(problem_id=prob.id)

            score = ParticipantScore(
                user_id=user_id,
                contest_id=contest_id,
                solved_count=0,
                total_penalty_minutes=0,
                problem_scores=prob_scores,
                registered_at=time.time(),
            )
            self._participants[key] = score
            return score

    def get_participant_score(self, contest_id: str, user_id: str) -> Optional[ParticipantScore]:
        with self._lock:
            return self._participants.get((contest_id, user_id))

    def update_participant_score(self, score: ParticipantScore) -> None:
        with self._lock:
            self._participants[(score.contest_id, score.user_id)] = score


class RedisContestStore(ContestStore):
    """Redis-backed contest store using hashes and JSON serialization."""

    def __init__(self, redis_client) -> None:
        self.redis = redis_client
        self._fallback = InMemoryContestStore()

    def get_contest(self, contest_id: str) -> Optional[Contest]:
        raw = self.redis.get(f"contest:{contest_id}:meta")
        if not raw:
            return self._fallback.get_contest(contest_id)
        data = json.loads(raw)
        return Contest(**data)

    def list_contests(self) -> List[Contest]:
        keys = self.redis.keys("contest:*:meta")
        if not keys:
            return self._fallback.list_contests()
        contests = []
        for key in keys:
            raw = self.redis.get(key)
            if raw:
                contests.append(Contest(**json.loads(raw)))
        return contests

    def create_contest(self, contest: Contest) -> Contest:
        self.redis.set(f"contest:{contest.id}:meta", contest.model_dump_json())
        return contest

    def register_participant(self, contest_id: str, user_id: str) -> ParticipantScore:
        key = f"contest:{contest_id}:participant:{user_id}"
        raw = self.redis.get(key)
        if raw:
            return ParticipantScore(**json.loads(raw))

        contest = self.get_contest(contest_id)
        prob_scores = {}
        if contest:
            for p in contest.problems:
                prob_scores[p.id] = ProblemScore(problem_id=p.id).model_dump()

        score = ParticipantScore(
            user_id=user_id,
            contest_id=contest_id,
            solved_count=0,
            total_penalty_minutes=0,
            problem_scores=prob_scores,
            registered_at=time.time(),
        )
        self.redis.set(key, score.model_dump_json())
        return score

    def get_participant_score(self, contest_id: str, user_id: str) -> Optional[ParticipantScore]:
        key = f"contest:{contest_id}:participant:{user_id}"
        raw = self.redis.get(key)
        if not raw:
            return self._fallback.get_participant_score(contest_id, user_id)
        return ParticipantScore(**json.loads(raw))

    def update_participant_score(self, score: ParticipantScore) -> None:
        key = f"contest:{score.contest_id}:participant:{score.user_id}"
        self.redis.set(key, score.model_dump_json())


_GLOBAL_CONTEST_STORE: Optional[ContestStore] = None


def get_contest_store() -> ContestStore:
    """Return ContestStore (Redis if available, else fresh/cached InMemoryContestStore)."""
    global _GLOBAL_CONTEST_STORE
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    use_in_memory = os.getenv("USE_IN_MEMORY_CONTEST", "false").lower() == "true"

    if not use_in_memory:
        try:
            import redis

            client = redis.Redis.from_url(redis_url, decode_responses=True)
            client.ping()
            return RedisContestStore(client)
        except Exception:
            pass

    if _GLOBAL_CONTEST_STORE is None:
        _GLOBAL_CONTEST_STORE = InMemoryContestStore()
    return _GLOBAL_CONTEST_STORE

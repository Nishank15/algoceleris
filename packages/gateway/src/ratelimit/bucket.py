from __future__ import annotations

import math
import os
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    reset_after_seconds: float
    retry_after_seconds: int


class TokenBucketStorage(ABC):
    """Abstract storage backend for token bucket data."""

    @abstractmethod
    def get_bucket(self, key: str) -> Optional[Tuple[float, float]]:
        """Return (tokens, last_updated_epoch_seconds) or None if absent/expired."""
        pass

    @abstractmethod
    def set_bucket(self, key: str, tokens: float, last_updated: float, ttl_seconds: int) -> None:
        """Store (tokens, last_updated) with TTL."""
        pass


class InMemoryTokenBucketStorage(TokenBucketStorage):
    """Thread-safe in-memory token bucket storage for tests and standalone mode."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # key -> (tokens, last_updated, expires_at)
        self._store: dict[str, Tuple[float, float, float]] = {}

    def get_bucket(self, key: str) -> Optional[Tuple[float, float]]:
        now = time.time()
        with self._lock:
            if key not in self._store:
                return None
            tokens, last_updated, expires_at = self._store[key]
            if now > expires_at:
                del self._store[key]
                return None
            return tokens, last_updated

    def set_bucket(self, key: str, tokens: float, last_updated: float, ttl_seconds: int) -> None:
        now = time.time()
        with self._lock:
            self._store[key] = (tokens, last_updated, now + ttl_seconds)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


class RedisTokenBucketStorage(TokenBucketStorage):
    """Redis-backed token bucket storage using atomic Lua script for concurrency safety."""

    LUA_SCRIPT = """
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local requested = tonumber(ARGV[3])
    local now = tonumber(ARGV[4])
    local ttl = tonumber(ARGV[5])

    local bucket = redis.call('HMGET', key, 'tokens', 'last_updated')
    local tokens = tonumber(bucket[1])
    local last_updated = tonumber(bucket[2])

    if not tokens then
        tokens = capacity
        last_updated = now
    else
        local delta = math.max(0, now - last_updated)
        tokens = math.min(capacity, tokens + delta * refill_rate)
        last_updated = now
    end

    local allowed = 0
    local retry_after = 0
    if tokens >= requested then
        tokens = tokens - requested
        allowed = 1
    else
        local needed = requested - tokens
        if refill_rate > 0 then
            retry_after = math.ceil(needed / refill_rate)
        else
            retry_after = 60
        end
    end

    redis.call('HMSET', key, 'tokens', tokens, 'last_updated', last_updated)
    redis.call('EXPIRE', key, ttl)

    local reset_after = 0
    if refill_rate > 0 then
        reset_after = math.ceil((capacity - tokens) / refill_rate)
    end

    return {allowed, math.floor(tokens), retry_after, reset_after}
    """

    def __init__(self, redis_client) -> None:
        self.redis = redis_client
        self._script = self.redis.register_script(self.LUA_SCRIPT)

    def consume_atomic(
        self,
        key: str,
        capacity: int,
        refill_rate_per_sec: float,
        tokens_to_consume: int,
        now: float,
        ttl_seconds: int,
    ) -> RateLimitResult:
        result = self._script(
            keys=[key],
            args=[
                capacity,
                refill_rate_per_sec,
                tokens_to_consume,
                now,
                ttl_seconds,
            ],
        )
        allowed_int, tokens_left, retry_after, reset_after = result
        return RateLimitResult(
            allowed=bool(allowed_int),
            limit=capacity,
            remaining=int(tokens_left),
            reset_after_seconds=float(reset_after),
            retry_after_seconds=int(retry_after),
        )

    def get_bucket(self, key: str) -> Optional[Tuple[float, float]]:
        bucket = self.redis.hmget(key, ["tokens", "last_updated"])
        if not bucket or bucket[0] is None or bucket[1] is None:
            return None
        return float(bucket[0]), float(bucket[1])

    def set_bucket(self, key: str, tokens: float, last_updated: float, ttl_seconds: int) -> None:
        pipe = self.redis.pipeline()
        pipe.hset(key, mapping={"tokens": tokens, "last_updated": last_updated})
        pipe.expire(key, ttl_seconds)
        pipe.execute()


class TokenBucketLimiter:
    """Core Token-Bucket rate limiter enforcing refill rates and maximum token capacities."""

    def __init__(self, storage: Optional[TokenBucketStorage] = None) -> None:
        self.storage = storage or InMemoryTokenBucketStorage()

    def consume(
        self,
        key: str,
        capacity: int,
        refill_rate_per_sec: float,
        tokens_to_consume: int = 1,
        ttl_seconds: int = 3600,
    ) -> RateLimitResult:
        """Attempt to consume tokens_to_consume from the bucket associated with key."""
        now = time.time()

        # If using Redis with registered Lua script, use atomic evaluation
        if isinstance(self.storage, RedisTokenBucketStorage):
            return self.storage.consume_atomic(
                key=key,
                capacity=capacity,
                refill_rate_per_sec=refill_rate_per_sec,
                tokens_to_consume=tokens_to_consume,
                now=now,
                ttl_seconds=ttl_seconds,
            )

        # In-memory execution
        data = self.storage.get_bucket(key)
        if data is None:
            tokens = float(capacity)
            last_updated = now
        else:
            tokens, last_updated = data
            delta = max(0.0, now - last_updated)
            tokens = min(float(capacity), tokens + delta * refill_rate_per_sec)
            last_updated = now

        allowed = tokens >= tokens_to_consume
        if allowed:
            tokens -= tokens_to_consume
            retry_after = 0
        else:
            needed = tokens_to_consume - tokens
            retry_after = (
                math.ceil(needed / refill_rate_per_sec) if refill_rate_per_sec > 0 else 60
            )

        self.storage.set_bucket(key, tokens, last_updated, ttl_seconds)

        reset_after = (
            math.ceil((capacity - tokens) / refill_rate_per_sec)
            if refill_rate_per_sec > 0
            else 0.0
        )

        return RateLimitResult(
            allowed=allowed,
            limit=capacity,
            remaining=max(0, int(math.floor(tokens))),
            reset_after_seconds=float(reset_after),
            retry_after_seconds=int(retry_after),
        )


def get_limiter() -> TokenBucketLimiter:
    """Return configured TokenBucketLimiter (Redis connection if available, else fresh InMemory storage)."""
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    use_in_memory = os.getenv("USE_IN_MEMORY_RATE_LIMIT", "false").lower() == "true"

    if not use_in_memory:
        try:
            import redis

            client = redis.Redis.from_url(redis_url, decode_responses=True)
            client.ping()
            return TokenBucketLimiter(RedisTokenBucketStorage(client))
        except Exception:
            pass

    return TokenBucketLimiter(InMemoryTokenBucketStorage())


import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Dict, Optional

from .models import (
    EntitlementResponse,
    PaymentProvider,
    SubscriptionRecord,
    SubscriptionTier,
)

logger = logging.getLogger(__name__)


class SubscriptionStore(ABC):
    """Abstract interface for managing user subscriptions and entitlements."""

    @abstractmethod
    def get_subscription(self, user_id: str) -> SubscriptionRecord:
        """Retrieve user's current subscription record."""
        pass

    @abstractmethod
    def set_subscription(self, user_id: str, record: SubscriptionRecord) -> None:
        """Update or persist user subscription record."""
        pass

    def get_entitlements(self, user_id: str) -> EntitlementResponse:
        """Compute access feature flags and rate limits based on active subscription tier."""
        sub = self.get_subscription(user_id)
        is_pro = sub.tier == SubscriptionTier.PRO and sub.status == "active"

        return EntitlementResponse(
            user_id=user_id,
            tier=SubscriptionTier.PRO if is_pro else SubscriptionTier.FREE,
            can_use_ai_assistant=is_pro,
            has_priority_queue=is_pro,
            can_view_plagiarism_audit=is_pro,
            rate_limit_per_minute=100 if is_pro else 5,
        )


class InMemorySubscriptionStore(SubscriptionStore):
    """In-memory store for unit tests and local execution without Redis."""

    def __init__(self):
        self._store: Dict[str, SubscriptionRecord] = {}

    def get_subscription(self, user_id: str) -> SubscriptionRecord:
        if user_id not in self._store:
            return SubscriptionRecord(
                user_id=user_id,
                tier=SubscriptionTier.FREE,
                provider=PaymentProvider.NONE,
            )
        return self._store[user_id]

    def set_subscription(self, user_id: str, record: SubscriptionRecord) -> None:
        self._store[user_id] = record


class RedisSubscriptionStore(SubscriptionStore):
    """Redis-backed store for production persistence."""

    def __init__(self, redis_client=None, redis_url: str = "redis://localhost:6379/0"):
        if redis_client is not None:
            self.redis = redis_client
        else:
            import redis
            self.redis = redis.Redis.from_url(redis_url, decode_responses=True)

    def _key(self, user_id: str) -> str:
        return f"user:subscription:{user_id}"

    def get_subscription(self, user_id: str) -> SubscriptionRecord:
        try:
            raw = self.redis.get(self._key(user_id))
            if raw:
                data = json.loads(raw)
                return SubscriptionRecord(**data)
        except Exception as e:
            logger.warning(f"Failed to read subscription from Redis for {user_id}: {e}")

        return SubscriptionRecord(
            user_id=user_id,
            tier=SubscriptionTier.FREE,
            provider=PaymentProvider.NONE,
        )

    def set_subscription(self, user_id: str, record: SubscriptionRecord) -> None:
        try:
            key = self._key(user_id)
            self.redis.set(key, record.model_dump_json())
        except Exception as e:
            logger.error(f"Failed to write subscription to Redis for {user_id}: {e}")
            raise


_global_sub_store: Optional[SubscriptionStore] = None


def get_subscription_store(redis_url: Optional[str] = None) -> SubscriptionStore:
    """Factory creating or returning the configured subscription store."""
    global _global_sub_store
    if _global_sub_store is not None:
        return _global_sub_store

    url = redis_url or os.getenv("REDIS_URL")
    if url:
        try:
            store = RedisSubscriptionStore(redis_url=url)
            store.redis.ping()
            _global_sub_store = store
            return _global_sub_store
        except Exception as e:
            logger.warning(f"Could not connect to Redis for subscriptions ({e}), using in-memory store")

    _global_sub_store = InMemorySubscriptionStore()
    return _global_sub_store

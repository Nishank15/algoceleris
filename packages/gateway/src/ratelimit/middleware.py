from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, Request, Response, status

from ..subscriptions.store import SubscriptionStore, get_subscription_store
from .bucket import RateLimitResult, TokenBucketLimiter, get_limiter


@dataclass
class RateLimitConfig:
    capacity: int
    refill_rate_per_sec: float


def get_tier_rate_limit_config(action: str, tier: str) -> RateLimitConfig:
    """Return rate limit quota configuration based on action and user tier."""
    normalized_tier = tier.lower()

    if action == "submissions":
        if normalized_tier == "pro":
            # 100 requests per minute
            return RateLimitConfig(capacity=100, refill_rate_per_sec=100.0 / 60.0)
        # Free tier: 5 requests per minute
        return RateLimitConfig(capacity=5, refill_rate_per_sec=5.0 / 60.0)

    if action == "ai_debug":
        if normalized_tier == "pro":
            # 10 debug requests per minute
            return RateLimitConfig(capacity=10, refill_rate_per_sec=10.0 / 60.0)
        # Free tier: 0 requests (entitlement check also blocks free tier)
        return RateLimitConfig(capacity=0, refill_rate_per_sec=0.0)

    # Default fallback
    return RateLimitConfig(capacity=30, refill_rate_per_sec=30.0 / 60.0)


class RateLimiter:
    """FastAPI dependency enforcing Token-Bucket rate limits per action and subscription tier."""

    def __init__(
        self,
        action: str,
        tokens_to_consume: int = 1,
        limiter: Optional[TokenBucketLimiter] = None,
        subscription_store: Optional[SubscriptionStore] = None,
    ) -> None:
        self.action = action
        self.tokens_to_consume = tokens_to_consume
        self._limiter = limiter
        self._subscription_store = subscription_store

    def _get_limiter(self, request: Request) -> TokenBucketLimiter:
        if self._limiter is not None:
            return self._limiter
        if hasattr(request.app.state, "rate_limiter"):
            return request.app.state.rate_limiter
        return get_limiter()

    def _get_subscription_store(self, request: Request) -> SubscriptionStore:
        if self._subscription_store is not None:
            return self._subscription_store
        if hasattr(request.app.state, "subscription_store"):
            return request.app.state.subscription_store
        return get_subscription_store()

    def _resolve_user_id(self, request: Request) -> str:
        # Check header
        user_id = request.headers.get("X-User-ID")
        if user_id:
            return user_id

        # Check query parameters
        user_id = request.query_params.get("user_id")
        if user_id:
            return user_id

        # Fallback to client host/IP
        if request.client and request.client.host:
            return f"ip:{request.client.host}"

        return "anonymous"

    async def __call__(self, request: Request, response: Response) -> RateLimitResult:
        limiter = self._get_limiter(request)
        sub_store = self._get_subscription_store(request)
        user_id = self._resolve_user_id(request)

        # Check user tier
        sub = sub_store.get_subscription(user_id)
        if sub and sub.status == "active":
            tier = sub.tier.value if hasattr(sub.tier, "value") else str(sub.tier)
        else:
            tier = "free"

        config = get_tier_rate_limit_config(self.action, tier)
        bucket_key = f"ratelimit:{self.action}:{user_id}"

        result = limiter.consume(
            key=bucket_key,
            capacity=config.capacity,
            refill_rate_per_sec=config.refill_rate_per_sec,
            tokens_to_consume=self.tokens_to_consume,
        )

        # Attach standard rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(result.limit)
        response.headers["X-RateLimit-Remaining"] = str(result.remaining)
        response.headers["X-RateLimit-Reset"] = str(int(result.reset_after_seconds))

        if not result.allowed:
            headers = {
                "Retry-After": str(result.retry_after_seconds),
                "X-RateLimit-Limit": str(result.limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(result.reset_after_seconds)),
            }
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "rate_limit_exceeded",
                    "message": f"Rate limit exceeded for action '{self.action}'. Please retry after {result.retry_after_seconds}s.",
                    "action": self.action,
                    "tier": tier,
                    "retry_after": result.retry_after_seconds,
                },
                headers=headers,
            )

        return result

---
phase: 05-ai-code-assistant-token-bucket-rate-limiter
plan: "01"
subsystem: gateway/ratelimit
tags: [ratelimit, token-bucket, redis, fastapi, quotas, http-429]
key_files:
  - packages/gateway/src/ratelimit/__init__.py
  - packages/gateway/src/ratelimit/bucket.py
  - packages/gateway/src/ratelimit/middleware.py
  - packages/gateway/src/api.py
  - packages/gateway/tests/test_rate_limiter.py
verification:
  - python3 -m unittest packages/gateway/tests/test_rate_limiter.py
  - python3 -m unittest discover -s packages/gateway/tests
  - python3 -m unittest discover -s packages/engine/tests && python3 -m unittest discover -s packages/worker/tests
---

# Plan 05-01 Summary: Redis Token-Bucket Rate Limiter & Tier Quotas

## Objective
Implemented the Redis Token-Bucket rate limiting algorithm and FastAPI rate limiting dependency (`RateLimiter`) with tier-differentiated quotas (Free: 5/min, Pro: 100/min) and standard RFC HTTP 429 response handling (`AI-02`).

## Key Implementations

### 1. Token-Bucket Algorithm & Storage (`packages/gateway/src/ratelimit/bucket.py`)
- **`TokenBucketLimiter`**:
  - Implements the token bucket replenishment formula: `tokens = min(capacity, tokens + (now - last_updated) * refill_rate_per_sec)`.
  - Calculates `reset_after_seconds` and `retry_after_seconds`.
- **Backends**:
  - `RedisTokenBucketStorage`: Atomic Lua script executing HMGET, token replenishment calculation, HMSET, and key TTL expiry in a single Redis transaction.
  - `InMemoryTokenBucketStorage`: Thread-safe in-memory dictionary storage for local testing and standalone execution without Redis.

### 2. FastAPI Rate Limiter Dependency (`packages/gateway/src/ratelimit/middleware.py`)
- **`RateLimiter`**:
  - Resolves `user_id` from `X-User-ID` header, query parameter, or client IP address.
  - Queries `SubscriptionStore` to check active subscription tier (`free` vs `pro`).
  - Sets standard rate limit response headers on all requests:
    - `X-RateLimit-Limit`
    - `X-RateLimit-Remaining`
    - `X-RateLimit-Reset`
  - Rejects excess requests with HTTP 429 Too Many Requests containing `Retry-After` header and structured JSON error detail.
- **Tier Quota Mapping**:
  - Submissions: Free = 5/min, Pro = 100/min.
  - AI Debugging: Free = 0/min (gated), Pro = 10/min.

### 3. API Integration & Test Suite
- Integrated `submission_limiter = RateLimiter("submissions")` onto `POST /api/v1/submissions` in `packages/gateway/src/api.py`.
- Developed `packages/gateway/tests/test_rate_limiter.py` covering token exhaustion, refill timing, Free tier throttling at limit, Pro tier high quota, and isolated per-user buckets.

## Verification
- `test_rate_limiter.py`: 7/7 tests passed.
- Gateway test suite: 32/32 tests passed.
- Full repository regression suite (gateway, engine, worker): 68/68 tests passed with 0 failures.

## Self-Check: PASSED
All artifacts exist on disk, unit and regression tests pass cleanly.

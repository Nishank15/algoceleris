import time
import unittest
from fastapi.testclient import TestClient

from packages.gateway.src.api import create_app
from packages.gateway.src.queue import InMemoryQueueBroker
from packages.gateway.src.ratelimit.bucket import (
    InMemoryTokenBucketStorage,
    RateLimitResult,
    TokenBucketLimiter,
)
from packages.gateway.src.subscriptions.store import InMemorySubscriptionStore, SubscriptionRecord


class TestTokenBucketLimiter(unittest.TestCase):
    def setUp(self):
        self.storage = InMemoryTokenBucketStorage()
        self.limiter = TokenBucketLimiter(self.storage)

    def test_initial_consumption(self):
        result = self.limiter.consume(
            key="test_bucket",
            capacity=5,
            refill_rate_per_sec=1.0,
            tokens_to_consume=1,
        )
        self.assertTrue(result.allowed)
        self.assertEqual(result.limit, 5)
        self.assertEqual(result.remaining, 4)
        self.assertEqual(result.retry_after_seconds, 0)

    def test_exhaustion_returns_429_values(self):
        for _ in range(5):
            res = self.limiter.consume(
                key="exhaust_bucket",
                capacity=5,
                refill_rate_per_sec=0.1,
                tokens_to_consume=1,
            )
            self.assertTrue(res.allowed)

        # 6th attempt should be rejected
        res = self.limiter.consume(
            key="exhaust_bucket",
            capacity=5,
            refill_rate_per_sec=0.1,
            tokens_to_consume=1,
        )
        self.assertFalse(res.allowed)
        self.assertEqual(res.remaining, 0)
        self.assertGreater(res.retry_after_seconds, 0)

    def test_bucket_refills_over_time(self):
        # Consume all tokens
        for _ in range(3):
            self.limiter.consume("refill_bucket", capacity=3, refill_rate_per_sec=10.0)

        # Immediate next fails
        fail_res = self.limiter.consume("refill_bucket", capacity=3, refill_rate_per_sec=10.0)
        self.assertFalse(fail_res.allowed)

        # Wait 0.25s (at 10 tokens/sec, adds ~2.5 tokens)
        time.sleep(0.25)
        retry_res = self.limiter.consume("refill_bucket", capacity=3, refill_rate_per_sec=10.0)
        self.assertTrue(retry_res.allowed)


class TestRateLimiterFastAPIIntegration(unittest.TestCase):
    def setUp(self):
        self.broker = InMemoryQueueBroker()
        self.sub_store = InMemorySubscriptionStore()
        self.limiter = TokenBucketLimiter(InMemoryTokenBucketStorage())
        self.app = create_app(
            broker=self.broker,
            subscription_store=self.sub_store,
            rate_limiter=self.limiter,
        )
        self.client = TestClient(self.app)

    def _submit(self, user_id: str = "user-free"):
        return self.client.post(
            "/api/v1/submissions",
            headers={"X-User-ID": user_id},
            json={
                "language": "python",
                "source_code": "print(42)",
                "test_cases": [{"id": 1, "input_data": "", "expected_output": "42"}],
            },
        )

    def test_free_tier_throttling_at_limit(self):
        user = "free-student-1"
        # First 5 submissions for Free user should succeed (202 Accepted)
        for i in range(5):
            resp = self._submit(user)
            self.assertEqual(resp.status_code, 202, f"Attempt {i+1} failed")
            self.assertEqual(resp.headers.get("X-RateLimit-Limit"), "5")
            self.assertIn("X-RateLimit-Remaining", resp.headers)

        # 6th submission should return 429 Too Many Requests
        throttled = self._submit(user)
        self.assertEqual(throttled.status_code, 429)
        self.assertIn("Retry-After", throttled.headers)
        self.assertEqual(throttled.headers.get("X-RateLimit-Remaining"), "0")
        data = throttled.json()
        self.assertIn("detail", data)
        self.assertEqual(data["detail"]["error"], "rate_limit_exceeded")

    def test_pro_tier_receives_higher_quota(self):
        pro_user = "usr-pro-coder"
        from packages.gateway.src.subscriptions.models import PaymentProvider, SubscriptionRecord, SubscriptionTier

        self.sub_store.set_subscription(
            pro_user,
            SubscriptionRecord(
                user_id=pro_user,
                tier=SubscriptionTier.PRO,
                provider=PaymentProvider.STRIPE,
                subscription_id="sub_pro_test",
                status="active",
            ),
        )

        # Pro user has limit 100/min, submit 10 times with no 429
        for i in range(10):
            resp = self._submit(pro_user)
            self.assertEqual(resp.status_code, 202)
            self.assertEqual(resp.headers.get("X-RateLimit-Limit"), "100")

    def test_isolated_buckets_per_user(self):
        # Exhaust user-a
        for _ in range(5):
            self._submit("user-a")
        self.assertEqual(self._submit("user-a").status_code, 429)

        # user-b is unaffected
        fresh_resp = self._submit("user-b")
        self.assertEqual(fresh_resp.status_code, 202)

    def test_health_reports_rate_limiter(self):
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["rate_limiter"], "InMemoryTokenBucketStorage")


if __name__ == "__main__":
    unittest.main()

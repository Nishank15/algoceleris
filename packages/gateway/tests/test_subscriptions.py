import unittest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from packages.gateway.src.api import create_app
from packages.gateway.src.queue import InMemoryQueueBroker
from packages.gateway.src.subscriptions import (
    InMemorySubscriptionStore,
    PaymentProvider,
    RedisSubscriptionStore,
    SubscriptionRecord,
    SubscriptionTier,
)


class TestSubscriptionStoreAndAPI(unittest.TestCase):
    def setUp(self):
        self.store = InMemorySubscriptionStore()
        self.broker = InMemoryQueueBroker()
        self.app = create_app(broker=self.broker, subscription_store=self.store)
        self.client = TestClient(self.app)

    def test_default_free_entitlements(self):
        ent = self.store.get_entitlements("user_free_1")
        self.assertEqual(ent.user_id, "user_free_1")
        self.assertEqual(ent.tier, SubscriptionTier.FREE)
        self.assertFalse(ent.can_use_ai_assistant)
        self.assertFalse(ent.has_priority_queue)
        self.assertFalse(ent.can_view_plagiarism_audit)
        self.assertEqual(ent.rate_limit_per_minute, 5)

    def test_pro_tier_entitlements(self):
        self.store.set_subscription(
            "user_pro_1",
            SubscriptionRecord(
                user_id="user_pro_1",
                tier=SubscriptionTier.PRO,
                provider=PaymentProvider.STRIPE,
                subscription_id="sub_test_123",
            ),
        )

        ent = self.store.get_entitlements("user_pro_1")
        self.assertEqual(ent.user_id, "user_pro_1")
        self.assertEqual(ent.tier, SubscriptionTier.PRO)
        self.assertTrue(ent.can_use_ai_assistant)
        self.assertTrue(ent.has_priority_queue)
        self.assertTrue(ent.can_view_plagiarism_audit)
        self.assertEqual(ent.rate_limit_per_minute, 100)

    def test_api_get_entitlements(self):
        # 1. Query for free user
        resp = self.client.get("/api/v1/subscriptions/entitlements/user_alex")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["user_id"], "user_alex")
        self.assertEqual(data["tier"], "free")
        self.assertFalse(data["can_use_ai_assistant"])
        self.assertFalse(data["has_priority_queue"])
        self.assertEqual(data["rate_limit_per_minute"], 5)

        # 2. Upgrade user in store
        self.store.set_subscription(
            "user_alex",
            SubscriptionRecord(
                user_id="user_alex",
                tier=SubscriptionTier.PRO,
                provider=PaymentProvider.RAZORPAY,
                subscription_id="pay_test_456",
            ),
        )

        # 3. Query again
        resp2 = self.client.get("/api/v1/subscriptions/entitlements/user_alex")
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        self.assertEqual(data2["tier"], "pro")
        self.assertTrue(data2["can_use_ai_assistant"])
        self.assertTrue(data2["has_priority_queue"])
        self.assertEqual(data2["rate_limit_per_minute"], 100)

    def test_redis_subscription_store_serialization(self):
        mock_redis = MagicMock()
        mock_redis.get.return_value = None

        redis_store = RedisSubscriptionStore(redis_client=mock_redis)
        default_sub = redis_store.get_subscription("user_test")
        self.assertEqual(default_sub.tier, SubscriptionTier.FREE)

        # Test set
        rec = SubscriptionRecord(
            user_id="user_test",
            tier=SubscriptionTier.PRO,
            provider=PaymentProvider.STRIPE,
        )
        redis_store.set_subscription("user_test", rec)
        mock_redis.set.assert_called_once()


if __name__ == "__main__":
    unittest.main()

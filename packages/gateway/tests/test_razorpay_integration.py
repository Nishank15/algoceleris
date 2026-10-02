import hashlib
import hmac
import json
import unittest

from packages.gateway.src.subscriptions import (
    InMemorySubscriptionStore,
    PaymentProvider,
    SubscriptionTier,
)
from packages.gateway.src.subscriptions.razorpay_service import RazorpayService


class TestRazorpayIntegration(unittest.TestCase):
    def setUp(self):
        self.key_secret = "rzp_secret_mock_test_key"
        self.webhook_secret = "whsec_mock_razorpay_test"
        self.service = RazorpayService(
            key_id="rzp_test_123",
            key_secret=self.key_secret,
            webhook_secret=self.webhook_secret,
        )
        self.store = InMemorySubscriptionStore()

    def test_create_order(self):
        order = self.service.create_order(
            user_id="user_rahul",
            email="rahul@developer.in",
        )
        self.assertTrue(order["order_id"].startswith("order_"))
        self.assertEqual(order["amount"], 149900)
        self.assertEqual(order["currency"], "INR")
        self.assertEqual(order["key_id"], "rzp_test_123")
        self.assertIn("user_rah", order["receipt"])

    def test_verify_payment_signature(self):
        order_id = "order_abc123xyz"
        payment_id = "pay_987654321"

        msg = f"{order_id}|{payment_id}".encode("utf-8")
        valid_sig = hmac.new(
            self.key_secret.encode("utf-8"),
            msg,
            hashlib.sha256,
        ).hexdigest()

        # 1. Valid signature
        self.assertTrue(
            self.service.verify_payment_signature(
                order_id, payment_id, valid_sig, key_secret=self.key_secret
            )
        )

        # 2. Corrupted signature
        self.assertFalse(
            self.service.verify_payment_signature(
                order_id, payment_id, "corrupted_sig", key_secret=self.key_secret
            )
        )

        # 3. Mismatched payment_id
        self.assertFalse(
            self.service.verify_payment_signature(
                order_id, "pay_different", valid_sig, key_secret=self.key_secret
            )
        )

    def test_verify_webhook_signature(self):
        payload = json.dumps({"event": "payment.captured"}).encode("utf-8")
        valid_sig = hmac.new(
            self.webhook_secret.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()

        self.assertTrue(
            self.service.verify_webhook_signature(
                payload, valid_sig, webhook_secret=self.webhook_secret
            )
        )
        self.assertFalse(
            self.service.verify_webhook_signature(
                payload, "bad_webhook_sig", webhook_secret=self.webhook_secret
            )
        )

    def test_fulfill_payment(self):
        res = self.service.fulfill_payment(
            user_id="user_priya",
            order_id="order_112233",
            payment_id="pay_445566",
            store=self.store,
        )
        self.assertEqual(res["status"], "provisioned")
        self.assertEqual(res["user_id"], "user_priya")
        self.assertEqual(res["provider"], "razorpay")

        # Verify entitlement in store
        sub = self.store.get_subscription("user_priya")
        self.assertEqual(sub.tier, SubscriptionTier.PRO)
        self.assertEqual(sub.provider, PaymentProvider.RAZORPAY)

        ent = self.store.get_entitlements("user_priya")
        self.assertEqual(ent.tier, SubscriptionTier.PRO)
        self.assertTrue(ent.can_use_ai_assistant)
        self.assertTrue(ent.has_priority_queue)
        self.assertEqual(ent.rate_limit_per_minute, 100)

    def test_api_razorpay_endpoints(self):
        from fastapi.testclient import TestClient
        from packages.gateway.src.api import create_app
        from packages.gateway.src.queue import InMemoryQueueBroker

        app = create_app(broker=InMemoryQueueBroker(), subscription_store=self.store)
        client = TestClient(app)

        # 1. Create order
        resp = client.post(
            "/api/v1/subscriptions/razorpay/create-order",
            json={"user_id": "user_api_razor", "amount": 149900, "currency": "INR"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["order_id"].startswith("order_"))
        self.assertEqual(data["amount"], 149900)
        self.assertEqual(data["currency"], "INR")

        order_id = data["order_id"]
        payment_id = "pay_test_succ_123"

        # 2. Verify payment with invalid signature -> 400
        resp_bad = client.post(
            "/api/v1/subscriptions/razorpay/verify-payment",
            json={
                "user_id": "user_api_razor",
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": "invalid_sig",
            },
        )
        self.assertEqual(resp_bad.status_code, 400)

        # 3. Verify payment with valid signature -> 200
        msg = f"{order_id}|{payment_id}".encode("utf-8")
        valid_sig = hmac.new(
            "mock_rzp_secret_key_v2".encode("utf-8"),
            msg,
            hashlib.sha256,
        ).hexdigest()

        resp_ok = client.post(
            "/api/v1/subscriptions/razorpay/verify-payment",
            json={
                "user_id": "user_api_razor",
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": valid_sig,
            },
        )
        self.assertEqual(resp_ok.status_code, 200)
        verify_data = resp_ok.json()
        self.assertEqual(verify_data["status"], "verified")
        self.assertEqual(verify_data["tier"], "pro")

        # 4. Check entitlement
        ent = self.store.get_entitlements("user_api_razor")
        self.assertEqual(ent.tier, SubscriptionTier.PRO)
        self.assertTrue(ent.can_use_ai_assistant)


if __name__ == "__main__":
    unittest.main()


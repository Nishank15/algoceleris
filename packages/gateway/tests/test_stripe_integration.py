import hashlib
import hmac
import json
import time
import unittest
from fastapi.testclient import TestClient

from packages.gateway.src.api import create_app
from packages.gateway.src.queue import InMemoryQueueBroker
from packages.gateway.src.subscriptions import (
    InMemorySubscriptionStore,
    SubscriptionTier,
)
from packages.gateway.src.subscriptions.stripe_service import StripeService


class TestStripeIntegration(unittest.TestCase):
    def setUp(self):
        self.secret = "whsec_test_secret_123456"
        self.stripe_service = StripeService(webhook_secret=self.secret)
        self.store = InMemorySubscriptionStore()
        self.broker = InMemoryQueueBroker()
        self.app = create_app(broker=self.broker, subscription_store=self.store)
        self.client = TestClient(self.app)

    def test_create_checkout_session(self):
        session = self.stripe_service.create_checkout_session(
            user_id="user_dev_42",
            email="dev@cloudjudge.io",
        )
        self.assertTrue(session["session_id"].startswith("cs_test_"))
        self.assertEqual(session["client_reference_id"], "user_dev_42")
        self.assertEqual(session["amount_total"], 1900)
        self.assertEqual(session["currency"], "usd")
        self.assertIn("https://checkout.stripe.com/c/pay/", session["checkout_url"])

    def test_webhook_signature_verification(self):
        payload = json.dumps({"test": "data"}).encode("utf-8")
        timestamp = str(int(time.time()))

        signed_payload = f"{timestamp}.".encode("utf-8") + payload
        signature = hmac.new(
            self.secret.encode("utf-8"),
            signed_payload,
            hashlib.sha256,
        ).hexdigest()

        header = f"t={timestamp},v1={signature}"
        is_valid = self.stripe_service.verify_webhook_signature(
            payload, header, webhook_secret=self.secret
        )
        self.assertTrue(is_valid)

        # Invalid signature
        bad_header = f"t={timestamp},v1=bad_signature"
        self.assertFalse(
            self.stripe_service.verify_webhook_signature(
                payload, bad_header, webhook_secret=self.secret
            )
        )

    def test_handle_checkout_session_completed(self):
        event = {
            "id": "evt_test_1",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_abc",
                    "client_reference_id": "user_pro_subscriber",
                    "subscription": "sub_stripe_real_999",
                }
            },
        }

        result = self.stripe_service.handle_webhook_event(event, self.store)
        self.assertEqual(result["status"], "provisioned")
        self.assertEqual(result["user_id"], "user_pro_subscriber")

        # Verify entitlement upgraded in store
        ent = self.store.get_entitlements("user_pro_subscriber")
        self.assertEqual(ent.tier, SubscriptionTier.PRO)
        self.assertTrue(ent.can_use_ai_assistant)
        self.assertTrue(ent.has_priority_queue)

    def test_handle_subscription_deleted(self):
        # Pre-seed user as pro
        self.test_handle_checkout_session_completed()

        event = {
            "id": "evt_test_2",
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": "sub_stripe_real_999",
                    "metadata": {"user_id": "user_pro_subscriber"},
                }
            },
        }

        result = self.stripe_service.handle_webhook_event(event, self.store)
        self.assertEqual(result["status"], "downgraded")

        # Verify user reverted to free
        ent = self.store.get_entitlements("user_pro_subscriber")
        self.assertEqual(ent.tier, SubscriptionTier.FREE)
        self.assertFalse(ent.can_use_ai_assistant)

    def test_api_stripe_endpoints(self):
        # 1. Test create checkout session endpoint
        resp = self.client.post(
            "/api/v1/subscriptions/stripe/create-checkout-session",
            json={"user_id": "user_api_1", "email": "api@judge.com"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["session_id"].startswith("cs_test_"))
        self.assertIn("https://checkout.stripe.com/c/pay/", data["checkout_url"])
        self.assertEqual(data["amount_total"], 1900)

        # 2. Test webhook endpoint with missing signature -> 400
        resp_bad = self.client.post(
            "/api/v1/subscriptions/stripe/webhook",
            json={"type": "checkout.session.completed"},
        )
        self.assertEqual(resp_bad.status_code, 400)

        # 3. Test webhook endpoint with valid signature
        webhook_body = json.dumps(
            {
                "id": "evt_api_test",
                "type": "checkout.session.completed",
                "data": {
                    "object": {
                        "id": "cs_test_live",
                        "client_reference_id": "user_api_1",
                        "subscription": "sub_live_123",
                    }
                },
            }
        ).encode("utf-8")

        ts = str(int(time.time()))
        signed = f"{ts}.".encode("utf-8") + webhook_body
        sig = hmac.new(
            "whsec_mock_stripe_cloudjudge_v2".encode("utf-8"),
            signed,
            hashlib.sha256,
        ).hexdigest()

        resp_ok = self.client.post(
            "/api/v1/subscriptions/stripe/webhook",
            content=webhook_body,
            headers={"Stripe-Signature": f"t={ts},v1={sig}"},
        )
        self.assertEqual(resp_ok.status_code, 200)

        # Verify entitlement updated
        ent = self.store.get_entitlements("user_api_1")
        self.assertEqual(ent.tier, SubscriptionTier.PRO)


if __name__ == "__main__":
    unittest.main()


import asyncio
import hashlib
import hmac
import json
import os
import sys
import time
import unittest
import uuid
from pathlib import Path

# Add gateway root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import close_all_sessions

from src.ai import create_ai_router
from src.ai.assistant import GeminiDebugAssistant
from src.auth.security import create_access_token, hash_password
from src.database import (
    Base,
    close_db_engine,
    get_async_engine,
    get_db,
    get_session_factory,
)
from src.models.entities import Subscription, User
from src.ratelimit.bucket import InMemoryTokenBucketStorage, TokenBucketLimiter
from src.subscriptions.db_sync import (
    resolve_user,
    sync_razorpay_payment_to_db,
    sync_stripe_event_to_db,
)
from src.subscriptions.models import SubscriptionTier
from src.subscriptions.razorpay_service import RazorpayService
from src.subscriptions.router import create_subscriptions_router
from src.subscriptions.store import InMemorySubscriptionStore
from src.subscriptions.stripe_service import StripeService


class TestSubscriptionDBSync(unittest.TestCase):
    """Comprehensive test suite for Phase 15 Plan 15-02: Relational Subscription DB Sync & Admin Immunity."""

    def setUp(self):
        self.test_db_url = f"sqlite+aiosqlite:///:memory:?cache=shared_{os.urandom(4).hex()}"
        self.engine = get_async_engine(self.test_db_url)

        async def _init_tables():
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

        asyncio.run(_init_tables())

        self.session_factory = get_session_factory(engine=self.engine)

        async def override_get_db():
            async with self.session_factory() as session:
                try:
                    yield session
                except Exception:
                    await session.rollback()
                    raise

        # Seed test users
        self.free_id = uuid.uuid4()
        self.pro_id = uuid.uuid4()
        self.admin_id = uuid.uuid4()

        async def _seed_users():
            async with self.session_factory() as session:
                u_free = User(
                    id=self.free_id,
                    username="alice_free",
                    email="alice@example.com",
                    password_hash=hash_password("Password123!"),
                    account_type="free",
                )
                u_pro = User(
                    id=self.pro_id,
                    username="bob_pro",
                    email="bob@example.com",
                    password_hash=hash_password("Password123!"),
                    account_type="pro",
                )
                u_admin = User(
                    id=self.admin_id,
                    username="carol_admin",
                    email="carol@example.com",
                    password_hash=hash_password("Password123!"),
                    account_type="admin",
                )
                session.add_all([u_free, u_pro, u_admin])
                await session.commit()

        asyncio.run(_seed_users())

        # JWT tokens
        self.free_token = create_access_token(str(self.free_id), "alice_free", "free")
        self.admin_token = create_access_token(str(self.admin_id), "carol_admin", "admin")

        # Secrets for webhooks
        self.stripe_secret = "whsec_test_stripe_secret_123"
        self.razorpay_secret = "whsec_test_razorpay_secret_123"

        self.stripe_service = StripeService(webhook_secret=self.stripe_secret)
        self.razorpay_service = RazorpayService(
            key_id="rzp_test_key",
            key_secret="rzp_test_secret",
            webhook_secret=self.razorpay_secret,
        )

        self.store = InMemorySubscriptionStore()
        self.app = FastAPI(title="Subscription DB Sync Test App")
        self.app.dependency_overrides[get_db] = override_get_db

        sub_router = create_subscriptions_router(
            store=self.store,
            stripe_service=self.stripe_service,
            razorpay_service=self.razorpay_service,
        )
        self.app.include_router(sub_router, prefix="/api/v1")

        self.limiter = TokenBucketLimiter(storage=InMemoryTokenBucketStorage())
        self.assistant = GeminiDebugAssistant()
        ai_router = create_ai_router(
            store=self.store,
            assistant=self.assistant,
            limiter=self.limiter,
        )
        self.app.include_router(ai_router, prefix="/api/v1")

        self.client = TestClient(self.app)

    def tearDown(self):
        self.app.dependency_overrides.clear()
        close_all_sessions()
        asyncio.run(close_db_engine(self.test_db_url))

    def _sign_stripe_payload(self, payload: bytes) -> str:
        ts = str(int(time.time()))
        signed = f"{ts}.".encode("utf-8") + payload
        sig = hmac.new(
            self.stripe_secret.encode("utf-8"),
            signed,
            hashlib.sha256,
        ).hexdigest()
        return f"t={ts},v1={sig}"

    def _sign_razorpay_payload(self, payload: bytes) -> str:
        return hmac.new(
            self.razorpay_secret.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()

    def test_resolve_user(self):
        """Verify user resolution by UUID, case-insensitive email, and username."""
        async def _test():
            async with self.session_factory() as session:
                # 1. By UUID
                u1 = await resolve_user(session, str(self.free_id))
                self.assertIsNotNone(u1)
                self.assertEqual(u1.username, "alice_free")

                # 2. By Email (case-insensitive)
                u2 = await resolve_user(session, "ALICE@EXAMPLE.COM")
                self.assertIsNotNone(u2)
                self.assertEqual(u2.id, self.free_id)

                # 3. By Username
                u3 = await resolve_user(session, "carol_admin")
                self.assertIsNotNone(u3)
                self.assertEqual(u3.id, self.admin_id)

                # 4. Unknown
                u4 = await resolve_user(session, "nonexistent@example.com")
                self.assertIsNone(u4)

        asyncio.run(_test())

    def test_sync_stripe_checkout_completed(self):
        """Verify Stripe checkout.session.completed upgrades user to Pro and records subscription."""
        event = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "client_reference_id": str(self.free_id),
                    "customer": "cus_stripe_111",
                    "subscription": "sub_stripe_222",
                    "current_period_end": int(time.time()) + 2592000,
                }
            },
        }

        async def _test():
            async with self.session_factory() as session:
                res = await sync_stripe_event_to_db(session, event, store=self.store)
                self.assertEqual(res["status"], "provisioned")
                self.assertEqual(res["tier"], "pro")

                # Verify user account_type
                user = await session.get(User, self.free_id)
                self.assertEqual(user.account_type, "pro")

                # Verify subscriptions table
                stmt = select(Subscription).where(Subscription.user_id == self.free_id)
                sub_res = await session.execute(stmt)
                sub = sub_res.scalars().first()
                self.assertIsNotNone(sub)
                self.assertEqual(sub.provider, "stripe")
                self.assertEqual(sub.customer_id, "cus_stripe_111")
                self.assertEqual(sub.subscription_id, "sub_stripe_222")
                self.assertEqual(sub.status, "active")

        asyncio.run(_test())

        # Verify in-memory store
        ent = self.store.get_subscription(str(self.free_id))
        self.assertEqual(ent.tier, SubscriptionTier.PRO)

    def test_sync_stripe_cancellation_and_downgrade(self):
        """Verify customer.subscription.deleted downgrades normal Pro user to Free."""
        # 1. Setup active subscription for bob_pro
        async def _setup_sub():
            async with self.session_factory() as session:
                sub = Subscription(
                    user_id=self.pro_id,
                    provider="stripe",
                    customer_id="cus_bob",
                    subscription_id="sub_bob_123",
                    status="active",
                )
                session.add(sub)
                await session.commit()

        asyncio.run(_setup_sub())

        event = {
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": "sub_bob_123",
                    "customer": "cus_bob",
                    "metadata": {"user_id": str(self.pro_id)},
                }
            },
        }

        async def _test():
            async with self.session_factory() as session:
                res = await sync_stripe_event_to_db(session, event, store=self.store)
                self.assertEqual(res["status"], "downgraded")
                self.assertEqual(res["tier"], "free")

                # Verify user is now free
                user = await session.get(User, self.pro_id)
                self.assertEqual(user.account_type, "free")

                # Verify subscription is canceled
                stmt = select(Subscription).where(Subscription.user_id == self.pro_id)
                sub_res = await session.execute(stmt)
                sub = sub_res.scalars().first()
                self.assertEqual(sub.status, "canceled")

        asyncio.run(_test())

        # Verify in-memory store is free
        ent = self.store.get_subscription(str(self.pro_id))
        self.assertEqual(ent.tier, SubscriptionTier.FREE)

    def test_admin_immunity_on_stripe_cancellation(self):
        """RBAC-03: Admin accounts MUST NEVER be downgraded to free upon Stripe cancellation."""
        async def _setup_admin_sub():
            async with self.session_factory() as session:
                sub = Subscription(
                    user_id=self.admin_id,
                    provider="stripe",
                    customer_id="cus_carol_admin",
                    subscription_id="sub_carol_456",
                    status="active",
                )
                session.add(sub)
                await session.commit()

        asyncio.run(_setup_admin_sub())

        event = {
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": "sub_carol_456",
                    "customer": "cus_carol_admin",
                    "metadata": {"user_id": str(self.admin_id)},
                }
            },
        }

        async def _test():
            async with self.session_factory() as session:
                res = await sync_stripe_event_to_db(session, event, store=self.store)
                self.assertEqual(res["status"], "preserved_admin")
                self.assertEqual(res["tier"], "admin")

                # Check PostgreSQL: Admin status MUST BE UNCHANGED
                user = await session.get(User, self.admin_id)
                self.assertEqual(user.account_type, "admin")

                # Subscription status updated to canceled
                stmt = select(Subscription).where(Subscription.user_id == self.admin_id)
                sub_res = await session.execute(stmt)
                sub = sub_res.scalars().first()
                self.assertEqual(sub.status, "canceled")

        asyncio.run(_test())

        # Check SubscriptionStore: Admin preserves Pro entitlement privileges
        ent = self.store.get_subscription(str(self.admin_id))
        self.assertEqual(ent.tier, SubscriptionTier.PRO)

    def test_admin_immunity_on_payment_failed(self):
        """RBAC-03: Admin accounts MUST NEVER be downgraded on invoice.payment_failed."""
        event = {
            "type": "invoice.payment_failed",
            "data": {
                "object": {
                    "metadata": {"user_id": str(self.admin_id)},
                }
            },
        }

        async def _test():
            async with self.session_factory() as session:
                res = await sync_stripe_event_to_db(session, event, store=self.store)
                self.assertEqual(res["status"], "preserved_admin")

                user = await session.get(User, self.admin_id)
                self.assertEqual(user.account_type, "admin")

        asyncio.run(_test())

    def test_sync_razorpay_payment_to_db(self):
        """Verify Razorpay payment sync elevates free user to Pro and records subscription."""
        async def _test():
            async with self.session_factory() as session:
                res = await sync_razorpay_payment_to_db(
                    db=session,
                    user_id=str(self.free_id),
                    order_id="order_rzp_999",
                    payment_id="pay_rzp_888",
                    store=self.store,
                )
                self.assertEqual(res["status"], "provisioned")
                self.assertEqual(res["tier"], "pro")

                user = await session.get(User, self.free_id)
                self.assertEqual(user.account_type, "pro")

                stmt = select(Subscription).where(Subscription.user_id == self.free_id)
                sub_res = await session.execute(stmt)
                sub = sub_res.scalars().first()
                self.assertIsNotNone(sub)
                self.assertEqual(sub.provider, "razorpay")
                self.assertEqual(sub.subscription_id, "pay_rzp_888")
                self.assertEqual(sub.status, "active")

        asyncio.run(_test())

        ent = self.store.get_subscription(str(self.free_id))
        self.assertEqual(ent.tier, SubscriptionTier.PRO)

    def test_stripe_webhook_api_e2e(self):
        """End-to-end API test: POST /api/v1/subscriptions/stripe/webhook elevates user in DB."""
        payload = json.dumps({
            "id": "evt_test_checkout",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "client_reference_id": str(self.free_id),
                    "customer": "cus_e2e_1",
                    "subscription": "sub_e2e_1",
                }
            },
        }).encode("utf-8")

        sig = self._sign_stripe_payload(payload)

        resp = self.client.post(
            "/api/v1/subscriptions/stripe/webhook",
            content=payload,
            headers={"Stripe-Signature": sig},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["received"])
        self.assertEqual(data["db_sync"]["status"], "provisioned")

        # Verify DB persisted
        async def _check():
            async with self.session_factory() as session:
                user = await session.get(User, self.free_id)
                self.assertEqual(user.account_type, "pro")

        asyncio.run(_check())

    def test_razorpay_verify_payment_api_e2e(self):
        """End-to-end API test: POST /api/v1/subscriptions/razorpay/verify-payment elevates user in DB."""
        order_id = "order_e2e_rzp_123"
        payment_id = "pay_e2e_rzp_456"

        body = f"{order_id}|{payment_id}".encode("utf-8")
        valid_sig = hmac.new(
            "rzp_test_secret".encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()

        req_data = {
            "user_id": str(self.free_id),
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": valid_sig,
        }

        resp = self.client.post(
            "/api/v1/subscriptions/razorpay/verify-payment",
            json=req_data,
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "verified")
        self.assertEqual(data["tier"], "pro")

        # Verify DB persisted
        async def _check():
            async with self.session_factory() as session:
                user = await session.get(User, self.free_id)
                self.assertEqual(user.account_type, "pro")

        asyncio.run(_check())

    def test_razorpay_webhook_api_e2e(self):
        """End-to-end API test: POST /api/v1/subscriptions/razorpay/webhook provisions user in DB."""
        payload = json.dumps({
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_webhook_rzp_777",
                        "order_id": "order_webhook_rzp_888",
                        "notes": {"user_id": str(self.free_id)},
                    }
                }
            },
        }).encode("utf-8")

        sig = self._sign_razorpay_payload(payload)

        resp = self.client.post(
            "/api/v1/subscriptions/razorpay/webhook",
            content=payload,
            headers={"X-Razorpay-Signature": sig},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["received"])
        self.assertEqual(data["db_sync"]["status"], "provisioned")

        # Verify DB persisted
        async def _check():
            async with self.session_factory() as session:
                user = await session.get(User, self.free_id)
                self.assertEqual(user.account_type, "pro")

        asyncio.run(_check())

    def test_full_pro_access_lifecycle_with_ai_debug(self):
        """Test full transition lifecycle: free user 403 Forbidden -> Stripe webhook upgrade -> 200 OK."""
        debug_payload = {
            "user_id": str(self.free_id),
            "language": "python",
            "source_code": "def solve():\n    return 42",
            "problem_title": "Two Sum",
            "problem_description": "Find two indices that sum to target.",
            "failing_test_cases": [{"input": "[2, 7, 11, 15], 9", "expected": "[0, 1]", "actual": "[1, 2]"}],
        }

        # 1. Free user attempts to call AI debug endpoint -> 403 Forbidden
        headers = {"Authorization": f"Bearer {self.free_token}"}
        resp1 = self.client.post(
            "/api/v1/ai/debug",
            json=debug_payload,
            headers=headers,
        )
        self.assertEqual(resp1.status_code, 403)
        self.assertEqual(resp1.json()["detail"]["error"], "pro_tier_required")

        # 2. Simulate Stripe checkout webhook provisioning
        event = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "client_reference_id": str(self.free_id),
                    "customer": "cus_full_lifecycle",
                    "subscription": "sub_full_lifecycle",
                }
            },
        }
        payload = json.dumps(event).encode("utf-8")
        sig = self._sign_stripe_payload(payload)

        resp_hook = self.client.post(
            "/api/v1/subscriptions/stripe/webhook",
            content=payload,
            headers={"Stripe-Signature": sig},
        )
        self.assertEqual(resp_hook.status_code, 200)

        # 3. User calls AI debug endpoint again -> 200 OK!
        resp2 = self.client.post(
            "/api/v1/ai/debug",
            json=debug_payload,
            headers=headers,
        )
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        self.assertIn("root_cause", data2)
        self.assertIn("complexity_analysis", data2)


if __name__ == "__main__":
    unittest.main()

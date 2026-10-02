import hashlib
import hmac
import logging
import os
import time
import uuid
from typing import Any, Dict, Optional

from .models import PaymentProvider, SubscriptionRecord, SubscriptionTier
from .store import SubscriptionStore

logger = logging.getLogger(__name__)


class StripeService:
    """Handles Stripe checkout session generation and cryptographically verified webhook processing."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        webhook_secret: Optional[str] = None,
    ):
        self.api_key = api_key or os.getenv("STRIPE_API_KEY", "sk_test_mock_cloudjudge_v2")
        self.webhook_secret = webhook_secret or os.getenv(
            "STRIPE_WEBHOOK_SECRET", "whsec_mock_stripe_cloudjudge_v2"
        )

    def create_checkout_session(
        self,
        user_id: str,
        email: Optional[str] = None,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates a Stripe Checkout Session for upgrading to Pro tier."""
        session_id = f"cs_test_{uuid.uuid4().hex}"
        success = success_url or "http://localhost:3000?session_id={CHECKOUT_SESSION_ID}&status=success"
        cancel = cancel_url or "http://localhost:3000?status=cancelled"

        checkout_url = (
            f"https://checkout.stripe.com/c/pay/{session_id}"
            f"?client_reference_id={user_id}&customer_email={email or 'user@example.com'}"
        )

        return {
            "session_id": session_id,
            "checkout_url": checkout_url,
            "customer_email": email or "",
            "client_reference_id": user_id,
            "amount_total": 1900,  # $19.00 USD in cents
            "currency": "usd",
            "success_url": success,
            "cancel_url": cancel,
            "created_at": time.time(),
        }

    def verify_webhook_signature(
        self,
        payload: bytes,
        signature_header: str,
        webhook_secret: Optional[str] = None,
        tolerance_seconds: int = 300,
    ) -> bool:
        """Cryptographically verifies Stripe timestamped HMAC-SHA256 webhook signature.

        Stripe-Signature header format: 't=1492774577,v1=5257a869e7ece...,v0=...'
        """
        secret = webhook_secret or self.webhook_secret
        if not signature_header or not secret:
            return False

        try:
            elements = dict(item.split("=", 1) for item in signature_header.split(","))
            timestamp = elements.get("t")
            v1_signature = elements.get("v1")

            if not timestamp or not v1_signature:
                return False

            # Check timestamp freshness if tolerance > 0
            if tolerance_seconds > 0:
                current_time = time.time()
                if abs(current_time - float(timestamp)) > tolerance_seconds:
                    logger.warning("Stripe webhook timestamp outside tolerance window")
                    return False

            # Compute HMAC-SHA256(secret, timestamp + "." + payload)
            signed_payload = f"{timestamp}.".encode("utf-8") + payload
            computed_sig = hmac.new(
                secret.encode("utf-8"),
                signed_payload,
                hashlib.sha256,
            ).hexdigest()

            return hmac.compare_digest(computed_sig, v1_signature)

        except Exception as e:
            logger.error(f"Failed to verify Stripe webhook signature: {e}")
            return False

    def handle_webhook_event(
        self,
        event: Dict[str, Any],
        store: SubscriptionStore,
    ) -> Dict[str, Any]:
        """Processes verified Stripe webhook event and updates user subscription entitlement."""
        event_type = event.get("type", "")
        data_obj = event.get("data", {}).get("object", {})

        if event_type == "checkout.session.completed":
            user_id = data_obj.get("client_reference_id") or data_obj.get("metadata", {}).get("user_id")
            if not user_id:
                raise ValueError("Missing client_reference_id or metadata.user_id in Stripe checkout session")

            subscription_id = data_obj.get("subscription") or data_obj.get("id")

            record = SubscriptionRecord(
                user_id=user_id,
                tier=SubscriptionTier.PRO,
                provider=PaymentProvider.STRIPE,
                subscription_id=subscription_id,
                status="active",
                created_at=time.time(),
            )
            store.set_subscription(user_id, record)
            return {"status": "provisioned", "user_id": user_id, "tier": "pro"}

        elif event_type in {"customer.subscription.deleted", "customer.subscription.cancelled"}:
            user_id = data_obj.get("metadata", {}).get("user_id")
            # If user_id is in metadata or client reference
            if user_id:
                record = SubscriptionRecord(
                    user_id=user_id,
                    tier=SubscriptionTier.FREE,
                    provider=PaymentProvider.NONE,
                    status="cancelled",
                    created_at=time.time(),
                )
                store.set_subscription(user_id, record)
                return {"status": "downgraded", "user_id": user_id, "tier": "free"}

        return {"status": "ignored", "event_type": event_type}


_global_stripe_service: Optional[StripeService] = None


def get_stripe_service() -> StripeService:
    global _global_stripe_service
    if _global_stripe_service is None:
        _global_stripe_service = StripeService()
    return _global_stripe_service

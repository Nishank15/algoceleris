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


class RazorpayService:
    """Handles Razorpay order creation, HMAC-SHA256 signature verification, and webhook fulfillment."""

    def __init__(
        self,
        key_id: Optional[str] = None,
        key_secret: Optional[str] = None,
        webhook_secret: Optional[str] = None,
    ):
        self.key_id = key_id or os.getenv("RAZORPAY_KEY_ID", "rzp_test_mock_cloudjudge_v2")
        self.key_secret = key_secret or os.getenv("RAZORPAY_KEY_SECRET", "mock_rzp_secret_key_v2")
        self.webhook_secret = webhook_secret or os.getenv(
            "RAZORPAY_WEBHOOK_SECRET", "whsec_mock_razorpay_v2"
        )

    def create_order(
        self,
        user_id: str,
        email: Optional[str] = None,
        amount_paise: int = 149900,  # ₹1,499.00 INR
        currency: str = "INR",
    ) -> Dict[str, Any]:
        """Creates a Razorpay order payload for domestic UPI/NetBanking/Card transactions."""
        order_id = f"order_{uuid.uuid4().hex[:14]}"
        receipt = f"rcpt_{user_id[:8]}_{int(time.time())}"

        return {
            "order_id": order_id,
            "amount": amount_paise,
            "currency": currency.upper(),
            "receipt": receipt,
            "key_id": self.key_id,
            "status": "created",
            "created_at": time.time(),
        }

    def verify_payment_signature(
        self,
        order_id: str,
        payment_id: str,
        signature: str,
        key_secret: Optional[str] = None,
    ) -> bool:
        """Cryptographically verifies Razorpay payment signature using HMAC-SHA256(secret, order_id + '|' + payment_id)."""
        secret = key_secret or self.key_secret
        if not order_id or not payment_id or not signature or not secret:
            return False

        try:
            msg = f"{order_id}|{payment_id}".encode("utf-8")
            computed = hmac.new(
                secret.encode("utf-8"),
                msg,
                hashlib.sha256,
            ).hexdigest()
            return hmac.compare_digest(computed, signature)
        except Exception as e:
            logger.error(f"Failed to verify Razorpay payment signature: {e}")
            return False

    def verify_webhook_signature(
        self,
        payload: bytes,
        signature_header: str,
        webhook_secret: Optional[str] = None,
    ) -> bool:
        """Verifies Razorpay X-Razorpay-Signature header against the raw webhook body."""
        secret = webhook_secret or self.webhook_secret
        if not signature_header or not secret:
            return False

        try:
            computed = hmac.new(
                secret.encode("utf-8"),
                payload,
                hashlib.sha256,
            ).hexdigest()
            return hmac.compare_digest(computed, signature_header)
        except Exception as e:
            logger.error(f"Failed to verify Razorpay webhook signature: {e}")
            return False

    def fulfill_payment(
        self,
        user_id: str,
        order_id: str,
        payment_id: str,
        store: SubscriptionStore,
    ) -> Dict[str, Any]:
        """Provisions Pro tier entitlement in the subscription store following verified payment."""
        record = SubscriptionRecord(
            user_id=user_id,
            tier=SubscriptionTier.PRO,
            provider=PaymentProvider.RAZORPAY,
            subscription_id=payment_id,
            status="active",
            created_at=time.time(),
        )
        store.set_subscription(user_id, record)
        return {
            "status": "provisioned",
            "user_id": user_id,
            "tier": "pro",
            "provider": "razorpay",
            "order_id": order_id,
            "payment_id": payment_id,
        }


_global_razorpay_service: Optional[RazorpayService] = None


def get_razorpay_service() -> RazorpayService:
    global _global_razorpay_service
    if _global_razorpay_service is None:
        _global_razorpay_service = RazorpayService()
    return _global_razorpay_service

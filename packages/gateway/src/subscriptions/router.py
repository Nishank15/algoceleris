import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from .db_sync import sync_razorpay_payment_to_db, sync_stripe_event_to_db

logger = logging.getLogger("cloudjudge.subscriptions.router")
from .models import (
    EntitlementResponse,
    RazorpayOrderRequest,
    RazorpayOrderResponse,
    RazorpayVerifyRequest,
    RazorpayVerifyResponse,
    StripeCheckoutRequest,
    StripeCheckoutResponse,
)
from .razorpay_service import RazorpayService, get_razorpay_service
from .store import SubscriptionStore
from .stripe_service import StripeService, get_stripe_service


def create_subscriptions_router(
    store: SubscriptionStore,
    stripe_service: Optional[StripeService] = None,
    razorpay_service: Optional[RazorpayService] = None,
) -> APIRouter:
    router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])
    service_stripe = stripe_service or get_stripe_service()
    service_razorpay = razorpay_service or get_razorpay_service()

    # --- Common Entitlements ---
    @router.get(
        "/entitlements/{user_id}",
        response_model=EntitlementResponse,
        summary="Retrieve user subscription tier and feature entitlement flags",
    )
    def get_user_entitlements(user_id: str) -> EntitlementResponse:
        """Fetch tier and gating flags (AI assistant, priority queue, rate limits)."""
        return store.get_entitlements(user_id)

    # --- Stripe Endpoints ---
    @router.post(
        "/stripe/create-checkout-session",
        response_model=StripeCheckoutResponse,
        summary="Create a Stripe Checkout Session for Pro tier upgrade",
    )
    def create_stripe_checkout_session(
        req: StripeCheckoutRequest,
    ) -> StripeCheckoutResponse:
        """Generates Stripe Checkout Session ID and redirection URL."""
        res = service_stripe.create_checkout_session(
            user_id=req.user_id,
            email=req.email,
            success_url=req.success_url,
            cancel_url=req.cancel_url,
        )
        return StripeCheckoutResponse(
            session_id=res["session_id"],
            checkout_url=res["checkout_url"],
            amount_total=res["amount_total"],
            currency=res["currency"],
        )

    @router.post(
        "/stripe/webhook",
        summary="Receive and verify Stripe webhook events",
    )
    async def stripe_webhook(
        request: Request,
        stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature"),
        db: AsyncSession = Depends(get_db),
    ):
        """Processes cryptographic webhook from Stripe to provision/cancel Pro subscriptions."""
        body = await request.body()
        if not stripe_signature:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing Stripe-Signature header",
            )

        is_valid = service_stripe.verify_webhook_signature(body, stripe_signature)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Stripe webhook signature",
            )

        try:
            event = json.loads(body.decode("utf-8"))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload",
            )

        result = service_stripe.handle_webhook_event(event, store)
        db_sync = None
        try:
            db_sync = await sync_stripe_event_to_db(db, event, store=store)
        except Exception as e:
            logger.warning(f"Failed to sync Stripe webhook event to DB: {e}")
        return {"received": True, "result": result, "db_sync": db_sync}

    # --- Razorpay Endpoints ---
    @router.post(
        "/razorpay/create-order",
        response_model=RazorpayOrderResponse,
        summary="Create Razorpay order for domestic UPI/NetBanking payment",
    )
    def create_razorpay_order(req: RazorpayOrderRequest) -> RazorpayOrderResponse:
        """Generates unique Razorpay order ID for client-side checkout modal."""
        res = service_razorpay.create_order(
            user_id=req.user_id,
            email=req.email,
            amount_paise=req.amount or 149900,
            currency=req.currency or "INR",
        )
        return RazorpayOrderResponse(
            order_id=res["order_id"],
            amount=res["amount"],
            currency=res["currency"],
            key_id=res["key_id"],
        )

    @router.post(
        "/razorpay/verify-payment",
        response_model=RazorpayVerifyResponse,
        summary="Verify cryptographic HMAC signature and provision Pro entitlement",
    )
    async def verify_razorpay_payment(
        req: RazorpayVerifyRequest,
        db: AsyncSession = Depends(get_db),
    ) -> RazorpayVerifyResponse:
        """Verifies HMAC-SHA256 signature of razorpay_order_id | razorpay_payment_id."""
        is_valid = service_razorpay.verify_payment_signature(
            order_id=req.razorpay_order_id,
            payment_id=req.razorpay_payment_id,
            signature=req.razorpay_signature,
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Razorpay payment signature",
            )

        service_razorpay.fulfill_payment(
            user_id=req.user_id,
            order_id=req.razorpay_order_id,
            payment_id=req.razorpay_payment_id,
            store=store,
        )
        try:
            await sync_razorpay_payment_to_db(
                db=db,
                user_id=req.user_id,
                order_id=req.razorpay_order_id,
                payment_id=req.razorpay_payment_id,
                store=store,
            )
        except Exception as e:
            logger.warning(f"Failed to sync Razorpay payment to DB: {e}")

        return RazorpayVerifyResponse(
            status="verified",
            user_id=req.user_id,
            tier="pro",
            message="Payment verified successfully. Pro entitlement provisioned.",
        )

    @router.post(
        "/razorpay/webhook",
        summary="Receive and verify Razorpay webhook events",
    )
    async def razorpay_webhook(
        request: Request,
        x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
        db: AsyncSession = Depends(get_db),
    ):
        """Processes cryptographic webhook from Razorpay."""
        body = await request.body()
        if not x_razorpay_signature:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing X-Razorpay-Signature header",
            )

        is_valid = service_razorpay.verify_webhook_signature(body, x_razorpay_signature)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Razorpay webhook signature",
            )

        try:
            event = json.loads(body.decode("utf-8"))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload",
            )

        # Fulfill payment if payment.captured event
        db_sync = None
        if event.get("event") == "payment.captured":
            payment_entity = event.get("payload", {}).get("payment", {}).get("entity", {})
            user_id = payment_entity.get("notes", {}).get("user_id")
            order_id = payment_entity.get("order_id", "")
            payment_id = payment_entity.get("id", "")
            if user_id:
                service_razorpay.fulfill_payment(user_id, order_id, payment_id, store)
                try:
                    db_sync = await sync_razorpay_payment_to_db(
                        db=db,
                        user_id=user_id,
                        order_id=order_id,
                        payment_id=payment_id,
                        store=store,
                    )
                except Exception as e:
                    logger.warning(f"Failed to sync Razorpay webhook to DB: {e}")

        return {"received": True, "event": event.get("event"), "db_sync": db_sync}

    return router

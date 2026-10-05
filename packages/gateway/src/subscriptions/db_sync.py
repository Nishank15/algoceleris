from datetime import datetime, timedelta, timezone
import logging
import time
from typing import Any, Dict, Optional
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.entities import Subscription, User
from .models import PaymentProvider, SubscriptionRecord, SubscriptionTier
from .store import SubscriptionStore

logger = logging.getLogger("cloudjudge.subscriptions.db_sync")


async def resolve_user(db: AsyncSession, identifier: str) -> Optional[User]:
    """Resolve a User entity by UUID, email, or username."""
    if not identifier:
        return None

    clean_id = str(identifier).strip()

    # Try UUID lookup
    try:
        user_uuid = uuid.UUID(clean_id)
        stmt = select(User).where(User.id == user_uuid).limit(1)
        res = await db.execute(stmt)
        user = res.scalars().first()
        if user:
            return user
    except (ValueError, TypeError):
        pass

    # Try email or username lookup
    stmt = select(User).where(
        (func.lower(User.email) == clean_id.lower())
        | (func.lower(User.username) == clean_id.lower())
    ).limit(1)
    res = await db.execute(stmt)
    return res.scalars().first()


async def sync_stripe_event_to_db(
    db: AsyncSession,
    event: Dict[str, Any],
    store: Optional[SubscriptionStore] = None,
) -> Dict[str, Any]:
    """Synchronize verified Stripe webhook event with PostgreSQL users & subscriptions."""
    event_type = event.get("type", "")
    data_obj = event.get("data", {}).get("object", {})

    # Provisioning / Activation Events
    if event_type in {
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "invoice.payment_succeeded",
    }:
        user_ident = (
            data_obj.get("client_reference_id")
            or data_obj.get("metadata", {}).get("user_id")
            or data_obj.get("customer_email")
        )

        user = None
        if user_ident:
            user = await resolve_user(db, user_ident)

        # Fallback to customer ID lookup in subscriptions table
        customer_id = data_obj.get("customer") or data_obj.get("id")
        if not user and customer_id:
            sub_stmt = select(Subscription).where(
                Subscription.customer_id == str(customer_id)
            ).limit(1)
            sub_res = await db.execute(sub_stmt)
            existing_sub = sub_res.scalars().first()
            if existing_sub:
                user = await db.get(User, existing_sub.user_id)

        if not user:
            logger.warning(
                f"Could not resolve user for Stripe activation event '{event_type}' "
                f"(ident={user_ident}, customer={customer_id})"
            )
            return {"status": "ignored", "reason": "user_not_found", "event_type": event_type}

        # Elevate user to Pro unless already Admin
        if user.account_type.lower() != "admin":
            user.account_type = "pro"
            user.updated_at = datetime.now(timezone.utc)

        # Compute period end
        subscription_id = data_obj.get("subscription") or data_obj.get("id")
        period_end_ts = (
            data_obj.get("current_period_end")
            or data_obj.get("lines", {}).get("data", [{}])[0].get("period", {}).get("end")
        )

        if period_end_ts:
            try:
                period_end = datetime.fromtimestamp(int(period_end_ts), tz=timezone.utc)
            except Exception:
                period_end = datetime.now(timezone.utc) + timedelta(days=30)
        else:
            period_end = datetime.now(timezone.utc) + timedelta(days=30)

        # Upsert Subscription record
        sub_query = select(Subscription).where(
            (Subscription.user_id == user.id) & (Subscription.provider == "stripe")
        ).limit(1)
        sub_res = await db.execute(sub_query)
        db_sub = sub_res.scalars().first()

        if db_sub:
            db_sub.subscription_id = str(subscription_id) if subscription_id else db_sub.subscription_id
            db_sub.customer_id = str(customer_id) if customer_id else db_sub.customer_id
            db_sub.status = "active"
            db_sub.current_period_end = period_end
        else:
            db_sub = Subscription(
                user_id=user.id,
                provider="stripe",
                customer_id=str(customer_id) if customer_id else None,
                subscription_id=str(subscription_id) if subscription_id else None,
                status="active",
                current_period_end=period_end,
            )
            db.add(db_sub)

        await db.commit()

        # Update cache store
        if store is not None:
            rec = SubscriptionRecord(
                user_id=str(user.id),
                tier=SubscriptionTier.PRO,
                provider=PaymentProvider.STRIPE,
                subscription_id=str(subscription_id) if subscription_id else None,
                status="active",
                created_at=time.time(),
            )
            store.set_subscription(str(user.id), rec)
            if user.username:
                store.set_subscription(user.username, rec)
            if user_ident and user_ident not in (str(user.id), user.username):
                store.set_subscription(user_ident, rec)

        logger.info(f"Successfully provisioned Pro subscription for user {user.username} via Stripe.")
        return {"status": "provisioned", "user_id": str(user.id), "tier": "pro"}

    # Cancellation / Downgrade Events
    elif event_type in {
        "customer.subscription.deleted",
        "customer.subscription.cancelled",
        "invoice.payment_failed",
    }:
        user_ident = (
            data_obj.get("metadata", {}).get("user_id")
            or data_obj.get("client_reference_id")
        )

        user = None
        if user_ident:
            user = await resolve_user(db, user_ident)

        # Lookup by subscription_id or customer_id
        subscription_id = data_obj.get("id") or data_obj.get("subscription")
        customer_id = data_obj.get("customer")

        if not user and (subscription_id or customer_id):
            clauses = []
            if subscription_id:
                clauses.append(Subscription.subscription_id == str(subscription_id))
            if customer_id:
                clauses.append(Subscription.customer_id == str(customer_id))

            sub_stmt = select(Subscription).where(
                (Subscription.provider == "stripe") & (clauses[0] if len(clauses) == 1 else (clauses[0] | clauses[1]))
            ).limit(1)
            sub_res = await db.execute(sub_stmt)
            existing_sub = sub_res.scalars().first()
            if existing_sub:
                user = await db.get(User, existing_sub.user_id)

        if not user:
            logger.warning(f"Could not resolve user for Stripe downgrade event '{event_type}'.")
            return {"status": "ignored", "reason": "user_not_found", "event_type": event_type}

        # Admin immunity check
        is_admin = user.account_type.lower() == "admin"
        if not is_admin:
            user.account_type = "free"
            user.updated_at = datetime.now(timezone.utc)

        target_status = "past_due" if event_type == "invoice.payment_failed" else "canceled"

        # Update subscription status
        sub_query = select(Subscription).where(
            (Subscription.user_id == user.id) & (Subscription.provider == "stripe")
        ).limit(1)
        sub_res = await db.execute(sub_query)
        db_sub = sub_res.scalars().first()
        if db_sub:
            db_sub.status = target_status

        await db.commit()

        if store is not None:
            target_tier = SubscriptionTier.PRO if is_admin else SubscriptionTier.FREE
            rec = SubscriptionRecord(
                user_id=str(user.id),
                tier=target_tier,
                provider=PaymentProvider.NONE,
                status=target_status,
                created_at=time.time(),
            )
            store.set_subscription(str(user.id), rec)
            if user.username:
                store.set_subscription(user.username, rec)
            if user_ident and user_ident not in (str(user.id), user.username):
                store.set_subscription(user_ident, rec)

        logger.info(
            f"Stripe event '{event_type}' processed for user {user.username}: "
            f"account_type is '{user.account_type}' (admin_immunity={is_admin})."
        )
        return {
            "status": "preserved_admin" if is_admin else "downgraded",
            "user_id": str(user.id),
            "tier": user.account_type,
        }

    return {"status": "ignored", "event_type": event_type}


async def sync_razorpay_payment_to_db(
    db: AsyncSession,
    user_id: str,
    order_id: str,
    payment_id: str,
    store: Optional[SubscriptionStore] = None,
) -> Dict[str, Any]:
    """Synchronize verified Razorpay payment with PostgreSQL users & subscriptions."""
    user = await resolve_user(db, user_id)
    if not user:
        logger.warning(f"Could not resolve user '{user_id}' for Razorpay payment {payment_id}.")
        return {"status": "ignored", "reason": "user_not_found"}

    # Elevate to Pro unless Admin
    if user.account_type.lower() != "admin":
        user.account_type = "pro"
        user.updated_at = datetime.now(timezone.utc)

    period_end = datetime.now(timezone.utc) + timedelta(days=30)

    # Upsert Subscription record
    sub_query = select(Subscription).where(
        (Subscription.user_id == user.id) & (Subscription.provider == "razorpay")
    ).limit(1)
    sub_res = await db.execute(sub_query)
    db_sub = sub_res.scalars().first()

    if db_sub:
        db_sub.subscription_id = str(payment_id)
        db_sub.status = "active"
        db_sub.current_period_end = period_end
    else:
        db_sub = Subscription(
            user_id=user.id,
            provider="razorpay",
            customer_id=None,
            subscription_id=str(payment_id),
            status="active",
            current_period_end=period_end,
        )
        db.add(db_sub)

    await db.commit()

    if store is not None:
        rec = SubscriptionRecord(
            user_id=str(user.id),
            tier=SubscriptionTier.PRO,
            provider=PaymentProvider.RAZORPAY,
            subscription_id=str(payment_id),
            status="active",
            created_at=time.time(),
        )
        store.set_subscription(str(user.id), rec)
        if user.username:
            store.set_subscription(user.username, rec)
        if user_id and user_id not in (str(user.id), user.username):
            store.set_subscription(user_id, rec)

    logger.info(f"Successfully provisioned Pro subscription for user {user.username} via Razorpay.")
    return {
        "status": "provisioned",
        "user_id": str(user.id),
        "tier": "pro",
        "provider": "razorpay",
        "order_id": order_id,
        "payment_id": payment_id,
    }

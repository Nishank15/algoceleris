import time
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class SubscriptionTier(str, Enum):
    FREE = "free"
    PRO = "pro"


class PaymentProvider(str, Enum):
    STRIPE = "stripe"
    RAZORPAY = "razorpay"
    NONE = "none"


class SubscriptionRecord(BaseModel):
    user_id: str
    tier: SubscriptionTier = SubscriptionTier.FREE
    provider: PaymentProvider = PaymentProvider.NONE
    subscription_id: Optional[str] = None
    status: str = "active"
    valid_until: Optional[float] = None
    created_at: float = Field(default_factory=time.time)


class EntitlementResponse(BaseModel):
    user_id: str
    tier: SubscriptionTier
    can_use_ai_assistant: bool
    has_priority_queue: bool
    can_view_plagiarism_audit: bool
    rate_limit_per_minute: int


class StripeCheckoutRequest(BaseModel):
    user_id: str
    email: Optional[str] = None
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class StripeCheckoutResponse(BaseModel):
    session_id: str
    checkout_url: str
    amount_total: int
    currency: str


class RazorpayOrderRequest(BaseModel):
    user_id: str
    email: Optional[str] = None
    amount: Optional[int] = 149900
    currency: Optional[str] = "INR"


class RazorpayOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str


class RazorpayVerifyRequest(BaseModel):
    user_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class RazorpayVerifyResponse(BaseModel):
    status: str
    user_id: str
    tier: str
    message: str



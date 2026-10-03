from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from ..ratelimit.bucket import TokenBucketLimiter, get_limiter
from ..ratelimit.middleware import RateLimiter
from ..subscriptions.models import SubscriptionTier
from ..subscriptions.store import SubscriptionStore, get_subscription_store
from .assistant import GeminiDebugAssistant, get_ai_assistant
from .models import AIDebugRequest, AIDebugResponse


def create_ai_router(
    store: Optional[SubscriptionStore] = None,
    assistant: Optional[GeminiDebugAssistant] = None,
    limiter: Optional[TokenBucketLimiter] = None,
) -> APIRouter:
    router = APIRouter(prefix="/ai", tags=["AI Code Assistant"])

    active_store = store or get_subscription_store()
    active_assistant = assistant or get_ai_assistant()
    active_limiter = limiter or get_limiter()

    ai_rate_limiter = RateLimiter(
        action="ai_debug",
        limiter=active_limiter,
        subscription_store=active_store,
    )

    @router.post(
        "/debug",
        response_model=AIDebugResponse,
        summary="Automated root-cause analysis and single-click diff fix using Gemini 2.5 Flash",
    )
    async def debug_code(
        request: AIDebugRequest,
        http_req: Request,
        http_res: Response,
    ) -> AIDebugResponse:
        # 1. Entitlement check: Pro tier required for AI debugging
        entitlements = active_store.get_entitlements(request.user_id)
        if not entitlements.can_use_ai_assistant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "pro_tier_required",
                    "message": "Pro subscription required for AI Code Assistant",
                    "upgrade_url": "/pricing",
                    "current_tier": (
                        entitlements.tier.value
                        if hasattr(entitlements.tier, "value")
                        else str(entitlements.tier)
                    ),
                },
            )

        # 2. Rate limit consumption check (10/min for Pro tier)
        await ai_rate_limiter(http_req, http_res, user_id=request.user_id)

        # 3. Invoke Gemini debug assistant
        return active_assistant.debug_code(request)

    return router

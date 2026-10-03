import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException, status

from .ai import GeminiDebugAssistant, create_ai_router, get_ai_assistant
from .contests import ContestStore, create_contests_router, get_contest_store
from .models import SubmissionRequest, SubmissionResponse, SubmissionStatus
from .queue import QueueBroker, get_queue_broker
from .ratelimit import RateLimiter, TokenBucketLimiter, get_limiter
from .subscriptions import SubscriptionStore, get_subscription_store
from .subscriptions.router import create_subscriptions_router


def create_router(
    broker: QueueBroker,
    rate_limiter: Optional[TokenBucketLimiter] = None,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1")
    submission_limiter = RateLimiter("submissions", limiter=rate_limiter)

    @router.post(
        "/submissions",
        response_model=SubmissionResponse,
        status_code=status.HTTP_202_ACCEPTED,
        summary="Submit code for sandboxed asynchronous evaluation",
        dependencies=[Depends(submission_limiter)],
    )
    def submit_code(request: SubmissionRequest) -> SubmissionResponse:
        submission_id = f"sub-{uuid.uuid4().hex[:12]}"
        now = time.time()

        job_payload = {
            "submission_id": submission_id,
            "language": request.language,
            "source_code": request.source_code,
            "time_limit_ms": request.time_limit_ms,
            "memory_limit_bytes": request.memory_limit_bytes,
            "test_cases": [tc.model_dump() for tc in request.test_cases],
            "submitted_at": now,
        }

        # Initialize status record in broker
        broker.set_status(
            submission_id,
            {
                "submission_id": submission_id,
                "status": SubmissionStatus.QUEUED.value,
                "language": request.language,
                "submitted_at": now,
                "test_cases_count": len(request.test_cases),
            },
        )

        # Enqueue job to submission queue
        broker.enqueue("judge:submissions", job_payload)

        return SubmissionResponse(
            submission_id=submission_id,
            status=SubmissionStatus.QUEUED,
            message="Submission enqueued successfully",
        )

    @router.get(
        "/submissions/{submission_id}",
        summary="Retrieve submission execution status and evaluation results",
    )
    def get_submission_status(submission_id: str):
        record = broker.get_status(submission_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Submission '{submission_id}' not found",
            )
        return record

    return router


def create_app(
    broker: Optional[QueueBroker] = None,
    subscription_store: Optional[SubscriptionStore] = None,
    rate_limiter: Optional[TokenBucketLimiter] = None,
    ai_assistant: Optional[GeminiDebugAssistant] = None,
    contest_store: Optional[ContestStore] = None,
) -> FastAPI:
    """FastAPI application factory for the Cloud-Judge V2 Gateway."""
    app = FastAPI(
        title="Cloud-Judge V2 Gateway",
        description="High-throughput submission gateway and real-time execution streaming API",
        version="0.1.0",
    )
    active_broker = broker or get_queue_broker()
    active_sub_store = subscription_store or get_subscription_store()
    active_limiter = rate_limiter or get_limiter()
    active_assistant = ai_assistant or get_ai_assistant()
    active_contest_store = contest_store or get_contest_store()

    app.state.broker = active_broker
    app.state.subscription_store = active_sub_store
    app.state.rate_limiter = active_limiter
    app.state.ai_assistant = active_assistant
    app.state.contest_store = active_contest_store

    api_router = create_router(active_broker, rate_limiter=active_limiter)
    sub_router = create_subscriptions_router(active_sub_store)
    ai_router = create_ai_router(
        store=active_sub_store,
        assistant=active_assistant,
        limiter=active_limiter,
    )
    contests_router = create_contests_router(
        store=active_contest_store,
        broker=active_broker,
    )
    api_router.include_router(sub_router)
    api_router.include_router(ai_router)
    api_router.include_router(contests_router)

    app.include_router(api_router)

    @app.get("/health", summary="Service health check")
    def health_check():
        return {
            "status": "healthy",
            "broker": active_broker.__class__.__name__,
            "subscription_store": active_sub_store.__class__.__name__,
            "rate_limiter": active_limiter.storage.__class__.__name__,
            "ai_assistant": active_assistant.__class__.__name__,
            "contest_store": active_contest_store.__class__.__name__,
        }

    return app



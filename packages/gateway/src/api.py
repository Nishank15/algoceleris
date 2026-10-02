import time
import uuid
from typing import Optional

from fastapi import APIRouter, FastAPI, HTTPException, status

from .models import SubmissionRequest, SubmissionResponse, SubmissionStatus
from .queue import QueueBroker, get_queue_broker


def create_router(broker: QueueBroker) -> APIRouter:
    router = APIRouter(prefix="/api/v1")

    @router.post(
        "/submissions",
        response_model=SubmissionResponse,
        status_code=status.HTTP_202_ACCEPTED,
        summary="Submit code for sandboxed asynchronous evaluation",
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


def create_app(broker: Optional[QueueBroker] = None) -> FastAPI:
    """FastAPI application factory for the Cloud-Judge V2 Gateway."""
    app = FastAPI(
        title="Cloud-Judge V2 Gateway",
        description="High-throughput submission gateway and real-time execution streaming API",
        version="0.1.0",
    )
    active_broker = broker or get_queue_broker()
    app.state.broker = active_broker

    api_router = create_router(active_broker)
    app.include_router(api_router)

    @app.get("/health", summary="Service health check")
    def health_check():
        return {
            "status": "healthy",
            "broker": active_broker.__class__.__name__,
        }

    return app

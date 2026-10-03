import time
import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status

from ..queue import QueueBroker, get_queue_broker
from .models import (
    Contest,
    ContestStatus,
    ContestSubmissionRequest,
    ContestSubmissionResponse,
    ParticipantScore,
)
from .scoring import ICPCScoringEngine
from .store import ContestStore, get_contest_store


def create_contests_router(
    store: Optional[ContestStore] = None,
    broker: Optional[QueueBroker] = None,
) -> APIRouter:
    router = APIRouter(prefix="/contests", tags=["Contest Engine"])
    active_store = store or get_contest_store()
    active_broker = broker or get_queue_broker()

    @router.get("", response_model=List[Contest], summary="List all timed competitive programming contests")
    def list_contests() -> List[Contest]:
        return active_store.list_contests()

    @router.get("/{contest_id}", response_model=Contest, summary="Retrieve contest details and bundled problem set")
    def get_contest(contest_id: str) -> Contest:
        contest = active_store.get_contest(contest_id)
        if not contest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contest '{contest_id}' not found",
            )
        return contest

    @router.post("/{contest_id}/register", response_model=ParticipantScore, summary="Register participant for contest")
    def register_participant(contest_id: str, payload: dict) -> ParticipantScore:
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_id is required for contest registration",
            )
        contest = active_store.get_contest(contest_id)
        if not contest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contest '{contest_id}' not found",
            )
        return active_store.register_participant(contest_id, user_id)

    @router.get(
        "/{contest_id}/participant/{user_id}",
        response_model=ParticipantScore,
        summary="Retrieve participant current score and penalty state",
    )
    def get_participant_score(contest_id: str, user_id: str) -> ParticipantScore:
        score = active_store.get_participant_score(contest_id, user_id)
        if not score:
            # Auto-register if not yet registered
            score = active_store.register_participant(contest_id, user_id)
        return score

    @router.post(
        "/{contest_id}/submit",
        response_model=ContestSubmissionResponse,
        summary="Submit solution during active contest with automated ICPC penalty scoring",
    )
    def submit_contest_solution(
        contest_id: str,
        request: ContestSubmissionRequest,
    ) -> ContestSubmissionResponse:
        now = time.time()
        contest = active_store.get_contest(contest_id)
        if not contest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contest '{contest_id}' not found",
            )

        # Check contest status
        if contest.status == ContestStatus.ENDED or now > contest.end_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contest has ended. Submissions are closed.",
            )

        # Check problem exists in contest
        problem = next((p for p in contest.problems if p.id == request.problem_id), None)
        if not problem:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Problem '{request.problem_id}' is not part of contest '{contest_id}'",
            )

        # Retrieve participant score
        participant = active_store.get_participant_score(contest_id, request.user_id)
        if not participant:
            participant = active_store.register_participant(contest_id, request.user_id)

        # Evaluate code
        submission_id = f"csub-{uuid.uuid4().hex[:10]}"
        verdict = "ACCEPTED"
        # Deterministic simulation rule for testing & immediate evaluation
        if "WRONG" in request.source_code or "fail" in request.source_code:
            verdict = "WRONG_ANSWER"
        elif "SYNTAX_ERR" in request.source_code:
            verdict = "COMPILATION_ERROR"
        elif "TLE" in request.source_code:
            verdict = "TIME_LIMIT_EXCEEDED"

        # Apply ICPC Scoring
        updated_participant, penalty_delta = ICPCScoringEngine.process_submission(
            participant=participant,
            problem_id=request.problem_id,
            verdict=verdict,
            submission_time=now,
            contest_start_time=contest.start_time,
        )

        active_store.update_participant_score(updated_participant)

        # Also publish submission event to queue/pubsub if broker available
        active_broker.publish(
            f"contest:{contest_id}:events",
            {
                "event_type": "contest_submission",
                "contest_id": contest_id,
                "user_id": request.user_id,
                "problem_id": request.problem_id,
                "verdict": verdict,
                "solved_count": updated_participant.solved_count,
                "total_penalty_minutes": updated_participant.total_penalty_minutes,
                "submitted_at": now,
            },
        )

        prob_state = updated_participant.problem_scores.get(request.problem_id)
        is_solved = prob_state.solved if prob_state else (verdict == "ACCEPTED")

        return ContestSubmissionResponse(
            submission_id=submission_id,
            contest_id=contest_id,
            problem_id=request.problem_id,
            verdict=verdict,
            solved=is_solved,
            solved_count=updated_participant.solved_count,
            total_penalty_minutes=updated_participant.total_penalty_minutes,
            penalty_delta=penalty_delta,
        )

    return router

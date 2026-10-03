from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from ..contests.store import ContestStore, get_contest_store
from .detector import CompareResult, PlagiarismDetector, SimilarityMatrix


class CompareRequest(BaseModel):
    code_a: str = Field(..., min_length=1, description="First source code snippet")
    code_b: str = Field(..., min_length=1, description="Second source code snippet")
    lang_a: str = Field(default="python", description="Language of snippet A")
    lang_b: str = Field(default="python", description="Language of snippet B")
    threshold: Optional[float] = Field(default=0.75, ge=0.0, le=1.0)


class RunPlagiarismRequest(BaseModel):
    problem_id: Optional[str] = Field(default=None, description="Problem ID to filter analysis")
    threshold: Optional[float] = Field(default=0.75, ge=0.0, le=1.0)
    submissions: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional list of submission payloads [{'user_id', 'source_code', 'language'}]",
    )


def create_plagiarism_router(
    store: Optional[ContestStore] = None,
    detector: Optional[PlagiarismDetector] = None,
) -> APIRouter:
    router = APIRouter(tags=["Plagiarism Detection Engine"])
    active_store = store or get_contest_store()
    active_detector = detector or PlagiarismDetector()

    @router.post(
        "/plagiarism/compare",
        response_model=CompareResult,
        summary="Compare two source code submissions for similarity using AST normalization & Winnowing",
    )
    def compare_snippets(request: CompareRequest) -> CompareResult:
        return active_detector.compare_two(
            code_a=request.code_a,
            code_b=request.code_b,
            lang_a=request.lang_a,
            lang_b=request.lang_b,
            threshold=request.threshold,
        )

    @router.post(
        "/contests/{contest_id}/plagiarism/run",
        response_model=SimilarityMatrix,
        summary="Execute post-contest AST Winnowing plagiarism detection and produce similarity matrix",
    )
    def run_contest_plagiarism(
        contest_id: str,
        request: Optional[RunPlagiarismRequest] = None,
    ) -> SimilarityMatrix:
        contest = active_store.get_contest(contest_id)
        if not contest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contest '{contest_id}' not found",
            )

        problem_id = request.problem_id if request else None
        threshold = request.threshold if request and request.threshold is not None else 0.75
        subs = request.submissions if request and request.submissions is not None else None

        if subs is None:
            subs = active_store.get_submissions(contest_id, problem_id)

        matrix = active_detector.analyze_submissions(
            submissions=subs,
            contest_id=contest_id,
            problem_id=problem_id or "",
            threshold=threshold,
        )

        active_store.save_similarity_matrix(
            contest_id=contest_id,
            matrix_data=matrix.model_dump(),
            problem_id=problem_id,
        )

        return matrix

    @router.get(
        "/contests/{contest_id}/plagiarism/matrix",
        response_model=SimilarityMatrix,
        summary="Retrieve previously computed pairwise plagiarism similarity matrix for contest",
    )
    def get_contest_plagiarism_matrix(
        contest_id: str,
        problem_id: Optional[str] = Query(default=None, description="Optional problem ID filter"),
    ) -> SimilarityMatrix:
        contest = active_store.get_contest(contest_id)
        if not contest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contest '{contest_id}' not found",
            )

        cached = active_store.get_similarity_matrix(contest_id, problem_id)
        if cached:
            return SimilarityMatrix(**cached)

        # On-demand compute if submissions exist
        subs = active_store.get_submissions(contest_id, problem_id)
        matrix = active_detector.analyze_submissions(
            submissions=subs,
            contest_id=contest_id,
            problem_id=problem_id or "",
        )
        active_store.save_similarity_matrix(
            contest_id=contest_id,
            matrix_data=matrix.model_dump(),
            problem_id=problem_id,
        )
        return matrix

    return router

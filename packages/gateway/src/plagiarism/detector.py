from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .ast_parser import ASTNormalizer
from .winnowing import WinnowingEngine


class PlagiarismMatch(BaseModel):
    user_a: str
    user_b: str
    similarity: float = Field(..., ge=0.0, le=1.0)
    matched_fingerprints: int = 0
    total_fingerprints_a: int = 0
    total_fingerprints_b: int = 0
    is_flagged: bool = False


class SimilarityMatrix(BaseModel):
    contest_id: str = ""
    problem_id: str = ""
    participants: List[str] = Field(default_factory=list)
    matrix: List[List[float]] = Field(default_factory=list)
    flagged_pairs: List[PlagiarismMatch] = Field(default_factory=list)
    threshold: float = 0.75
    total_analyzed: int = 0
    analyzed_at: float = Field(default_factory=time.time)


class CompareResult(BaseModel):
    similarity: float
    containment: float
    is_flagged: bool
    matched_fingerprints: int
    fingerprints_a_count: int
    fingerprints_b_count: int
    normalized_tokens_a_count: int
    normalized_tokens_b_count: int


class PlagiarismDetector:
    """
    Coordinates AST normalization, Winnowing fingerprinting,
    and pairwise collusion matrix generation.
    """

    def __init__(self, k: int = 5, w: int = 4, default_threshold: float = 0.75) -> None:
        self.engine = WinnowingEngine(k=k, w=w)
        self.default_threshold = default_threshold

    def compare_two(
        self,
        code_a: str,
        code_b: str,
        lang_a: str = "python",
        lang_b: str = "python",
        threshold: Optional[float] = None,
    ) -> CompareResult:
        thresh = threshold if threshold is not None else self.default_threshold
        tokens_a = ASTNormalizer.normalize(code_a, lang_a)
        tokens_b = ASTNormalizer.normalize(code_b, lang_b)

        fps_a = self.engine.get_hash_set(tokens_a)
        fps_b = self.engine.get_hash_set(tokens_b)

        sim = self.engine.calculate_similarity(fps_a, fps_b)
        containment = self.engine.calculate_containment(fps_a, fps_b)
        overlap = len(fps_a.intersection(fps_b))

        return CompareResult(
            similarity=sim,
            containment=containment,
            is_flagged=sim >= thresh,
            matched_fingerprints=overlap,
            fingerprints_a_count=len(fps_a),
            fingerprints_b_count=len(fps_b),
            normalized_tokens_a_count=len(tokens_a),
            normalized_tokens_b_count=len(tokens_b),
        )

    def analyze_submissions(
        self,
        submissions: List[Dict[str, Any]],
        contest_id: str = "",
        problem_id: str = "",
        threshold: Optional[float] = None,
    ) -> SimilarityMatrix:
        """
        Analyzes a list of submissions and outputs a full pairwise NxN similarity matrix
        with flagged participant pairs exceeding threshold.
        """
        thresh = threshold if threshold is not None else self.default_threshold
        participants: List[str] = []
        user_fingerprints: Dict[str, Set[int]] = {}

        # De-duplicate: take latest submission per user
        for sub in submissions:
            user_id = sub.get("user_id") or sub.get("participant_id") or "anonymous"
            code = sub.get("source_code", "")
            lang = sub.get("language", "python")

            if user_id not in user_fingerprints:
                participants.append(user_id)

            tokens = ASTNormalizer.normalize(code, lang)
            fps = self.engine.get_hash_set(tokens)
            user_fingerprints[user_id] = fps

        n = len(participants)
        matrix: List[List[float]] = [[0.0 for _ in range(n)] for _ in range(n)]
        flagged_pairs: List[PlagiarismMatch] = []

        for i in range(n):
            matrix[i][i] = 1.0
            u_a = participants[i]
            fps_a = user_fingerprints[u_a]

            for j in range(i + 1, n):
                u_b = participants[j]
                fps_b = user_fingerprints[u_b]

                sim = self.engine.calculate_similarity(fps_a, fps_b)
                matrix[i][j] = sim
                matrix[j][i] = sim

                overlap = len(fps_a.intersection(fps_b))
                is_flagged = sim >= thresh

                if is_flagged:
                    flagged_pairs.append(
                        PlagiarismMatch(
                            user_a=u_a,
                            user_b=u_b,
                            similarity=sim,
                            matched_fingerprints=overlap,
                            total_fingerprints_a=len(fps_a),
                            total_fingerprints_b=len(fps_b),
                            is_flagged=True,
                        )
                    )

        # Sort flagged pairs by similarity descending
        flagged_pairs.sort(key=lambda m: m.similarity, reverse=True)

        return SimilarityMatrix(
            contest_id=contest_id,
            problem_id=problem_id,
            participants=participants,
            matrix=matrix,
            flagged_pairs=flagged_pairs,
            threshold=thresh,
            total_analyzed=n,
            analyzed_at=time.time(),
        )

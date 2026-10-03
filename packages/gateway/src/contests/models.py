import time
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class ContestStatus(str, Enum):
    UPCOMING = "UPCOMING"
    ACTIVE = "ACTIVE"
    ENDED = "ENDED"


class ContestProblem(BaseModel):
    id: str = Field(..., description="Problem unique identifier, e.g. two-sum")
    letter_code: str = Field(..., description="Problem letter code, e.g. A, B, C")
    title: str = Field(..., description="Problem display title")
    difficulty: str = Field(default="Medium", description="Problem difficulty")
    points: int = Field(default=100, description="Max points assigned to problem")


class Contest(BaseModel):
    id: str = Field(..., description="Contest unique slug identifier")
    title: str = Field(..., description="Contest title")
    description: str = Field(default="", description="Contest description and rules")
    start_time: float = Field(..., description="Epoch start timestamp in seconds")
    end_time: float = Field(..., description="Epoch end timestamp in seconds")
    duration_minutes: int = Field(..., description="Total duration in minutes")
    status: ContestStatus = Field(default=ContestStatus.UPCOMING)
    problems: List[ContestProblem] = Field(default_factory=list)


class ProblemScore(BaseModel):
    problem_id: str
    solved: bool = False
    rejected_attempts: int = 0
    solved_at_minute: Optional[int] = None
    penalty_minutes: int = 0


class ParticipantScore(BaseModel):
    user_id: str
    contest_id: str
    solved_count: int = 0
    total_penalty_minutes: int = 0
    problem_scores: Dict[str, ProblemScore] = Field(default_factory=dict)
    registered_at: float = Field(default_factory=time.time)


class ContestSubmissionRequest(BaseModel):
    user_id: str = Field(..., description="Participant user ID")
    problem_id: str = Field(..., description="Target problem ID")
    language: str = Field(..., description="Programming language: cpp, python, java")
    source_code: str = Field(..., min_length=1, description="Source code")


class ContestSubmissionResponse(BaseModel):
    submission_id: str
    contest_id: str
    problem_id: str
    verdict: str
    solved: bool
    solved_count: int
    total_penalty_minutes: int
    penalty_delta: int

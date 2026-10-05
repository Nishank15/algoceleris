from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class DifficultyStats(BaseModel):
    """Aggregate total problems available vs solved per difficulty tier."""
    total: int = Field(default=0, ge=0, description="Total problems in difficulty tier")
    solved: int = Field(default=0, ge=0, description="Problems solved with ACCEPTED verdict")


class ContestRatingPoint(BaseModel):
    """Individual contest rating progression point for time-series sparklines."""
    contest_id: str = Field(..., description="Unique contest identifier")
    contest_name: str = Field(..., description="Display title of the contest")
    rating: int = Field(..., description="Calculated rating after this contest")
    rank: Optional[int] = Field(default=None, description="Final rank in contest")
    date: str = Field(..., description="ISO 8601 timestamp of contest completion")


class DailyContributionPoint(BaseModel):
    """Calendar day submission volume for 3D Isometric Skyline and heatmaps."""
    date: str = Field(..., description="Date formatted as YYYY-MM-DD")
    count: int = Field(default=0, ge=0, description="Number of submissions evaluated on this date")


class ProfileStats(BaseModel):
    """Aggregated user metrics across problem solving, contests, and activity."""
    difficulty_breakdown: Dict[str, DifficultyStats] = Field(
        default_factory=lambda: {
            "Easy": DifficultyStats(total=0, solved=0),
            "Medium": DifficultyStats(total=0, solved=0),
            "Hard": DifficultyStats(total=0, solved=0),
        },
        description="Solve metrics categorized by problem difficulty tier",
    )
    total_solved: int = Field(default=0, ge=0, description="Distinct problems solved")
    total_problems: int = Field(default=0, ge=0, description="Total platform problems")
    rating_history: List[ContestRatingPoint] = Field(
        default_factory=list,
        description="Chronological contest performance history",
    )
    current_rating: int = Field(default=1500, description="Current competitive rating")
    percentile: float = Field(default=50.0, ge=0.0, le=100.0, description="Estimated platform percentile")
    daily_contributions: List[DailyContributionPoint] = Field(
        default_factory=list,
        description="Daily submission activity over the trailing 365 days",
    )


class UserProfileResponse(BaseModel):
    """Public developer profile response model."""
    username: str = Field(..., description="Unique developer username")
    account_type: str = Field(default="free", description="Subscription tier ('free', 'pro', 'admin')")
    created_at: str = Field(..., description="Account creation timestamp (ISO 8601)")
    avatar_url: Optional[str] = Field(default=None, description="Custom avatar image URL")
    college_name: Optional[str] = Field(default=None, description="Affiliated academic institution or organization")
    stats: ProfileStats = Field(..., description="Aggregated developer statistics")


class GuestSubmissionItem(BaseModel):
    """Individual client-side anonymous submission item to be migrated."""
    problem_slug: str = Field(..., description="Problem unique slug")
    language: str = Field(..., description="Programming language (e.g. python, cpp, java)")
    code: str = Field(..., max_length=65536, description="Evaluated solution source code")
    verdict: str = Field(..., description="Evaluation verdict (e.g. ACCEPTED, WRONG_ANSWER)")
    runtime_ms: int = Field(default=0, ge=0, description="Total runtime in milliseconds")
    memory_kb: int = Field(default=0, ge=0, description="Peak memory consumption in kilobytes")
    testcases_passed: int = Field(default=0, ge=0, description="Number of passing test cases")
    total_testcases: int = Field(default=0, ge=0, description="Total test cases executed")
    created_at: Optional[str] = Field(default=None, description="Original local evaluation timestamp")


class MigrateGuestRequest(BaseModel):
    """Batch migration payload for anonymous localStorage submissions."""
    submissions: List[GuestSubmissionItem] = Field(
        ...,
        max_length=100,
        description="List of guest submissions to attach to authenticated account (max 100)",
    )


class MigrateGuestResponse(BaseModel):
    """Summary of completed guest submission migration."""
    migrated_count: int = Field(..., ge=0, description="Number of submissions successfully recorded")
    message: str = Field(..., description="Status summary message")

from datetime import datetime, timedelta, timezone
import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.rbac import get_current_user
from ..database import get_db
from ..models.entities import ContestParticipation, Submission, User
from .models import (
    ContestRatingPoint,
    DailyContributionPoint,
    DifficultyStats,
    MigrateGuestRequest,
    MigrateGuestResponse,
    ProfileStats,
    UserProfileResponse,
)

logger = logging.getLogger("cloudjudge.users.router")

# Problem difficulty registry matching platform problem catalog
DEFAULT_PROBLEM_DIFFICULTY: Dict[str, str] = {
    "two-sum": "Easy",
    "valid-palindrome": "Easy",
    "fizz-buzz": "Easy",
    "valid-parentheses": "Easy",
    "reverse-string": "Easy",
    "palindrome-number": "Easy",
    "valid-anagram": "Easy",
    "longest-substring": "Medium",
    "3sum": "Medium",
    "coin-change": "Medium",
    "group-anagrams": "Medium",
    "lru-cache": "Medium",
    "max-subarray": "Medium",
    "merge-intervals": "Medium",
    "trapping-rain-water": "Hard",
    "median-two-sorted-arrays": "Hard",
    "merge-k-sorted-lists": "Hard",
    "word-ladder": "Hard",
    "n-queens": "Hard",
    "edit-distance": "Hard",
}

DEFAULT_EASY_TOTAL = 4
DEFAULT_MEDIUM_TOTAL = 5
DEFAULT_HARD_TOTAL = 3


def create_users_router() -> APIRouter:
    router = APIRouter(prefix="/users", tags=["Users & Analytics"])

    @router.get(
        "/{username}/profile",
        response_model=UserProfileResponse,
        summary="Retrieve authentic database-backed developer analytics",
    )
    async def get_user_profile(
        username: str,
        db: AsyncSession = Depends(get_db),
    ) -> UserProfileResponse:
        """Fetch developer stats: difficulty solve breakdown, contest progression, and 365d activity skyline."""
        clean_u = username.strip()

        # 1. Resolve User
        user_stmt = select(User).where(func.lower(User.username) == clean_u.lower()).limit(1)
        user_res = await db.execute(user_stmt)
        user = user_res.scalars().first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User '{clean_u}' not found",
            )

        # 2. Difficulty Solve Breakdown (UX-03)
        sub_stmt = (
            select(Submission.problem_slug)
            .where(
                (Submission.user_id == user.id)
                & (func.upper(Submission.verdict) == "ACCEPTED")
            )
            .distinct()
        )
        sub_res = await db.execute(sub_stmt)
        solved_slugs = set(sub_res.scalars().all())

        easy_solved = 0
        med_solved = 0
        hard_solved = 0

        for slug in solved_slugs:
            diff = DEFAULT_PROBLEM_DIFFICULTY.get(slug.strip().lower(), "Medium")
            if diff == "Easy":
                easy_solved += 1
            elif diff == "Hard":
                hard_solved += 1
            else:
                med_solved += 1

        easy_total = max(DEFAULT_EASY_TOTAL, easy_solved)
        med_total = max(DEFAULT_MEDIUM_TOTAL, med_solved)
        hard_total = max(DEFAULT_HARD_TOTAL, hard_solved)

        difficulty_breakdown = {
            "Easy": DifficultyStats(total=easy_total, solved=easy_solved),
            "Medium": DifficultyStats(total=med_total, solved=med_solved),
            "Hard": DifficultyStats(total=hard_total, solved=hard_solved),
        }
        total_solved = len(solved_slugs)
        total_problems = easy_total + med_total + hard_total

        # 3. Contest Rating Progression (UX-04)
        cp_stmt = (
            select(ContestParticipation)
            .where(ContestParticipation.user_id == user.id)
            .order_by(ContestParticipation.created_at.asc())
        )
        cp_res = await db.execute(cp_stmt)
        participations = cp_res.scalars().all()

        current_rating = 1500
        rating_history: List[ContestRatingPoint] = []
        for cp in participations:
            current_rating += cp.rating_delta
            rating_history.append(
                ContestRatingPoint(
                    contest_id=cp.contest_id,
                    contest_name=cp.contest_id.replace("-", " ").title(),
                    rating=current_rating,
                    rank=cp.rank,
                    date=cp.created_at.isoformat() if cp.created_at else datetime.now(timezone.utc).isoformat(),
                )
            )

        # Percentile calculation
        percentile = round(max(0.4, min(99.0, 50.0 - (current_rating - 1500) * 0.05)), 1)

        # 4. Daily Skyline Submissions (UX-05)
        cutoff = datetime.now(timezone.utc) - timedelta(days=365)
        sub_date_col = func.date(Submission.created_at)

        skyline_stmt = (
            select(sub_date_col.label("sub_date"), func.count(Submission.id).label("sub_count"))
            .where(
                (Submission.user_id == user.id)
                & (Submission.created_at >= cutoff)
            )
            .group_by(sub_date_col)
            .order_by(sub_date_col.asc())
        )
        skyline_res = await db.execute(skyline_stmt)
        daily_contributions = [
            DailyContributionPoint(date=str(row.sub_date), count=int(row.sub_count))
            for row in skyline_res
        ]

        created_at_str = (
            user.created_at.isoformat()
            if user.created_at
            else datetime.now(timezone.utc).isoformat()
        )

        return UserProfileResponse(
            username=user.username,
            account_type=user.account_type,
            created_at=created_at_str,
            avatar_url=user.avatar_url,
            college_name=user.college_name,
            stats=ProfileStats(
                difficulty_breakdown=difficulty_breakdown,
                total_solved=total_solved,
                total_problems=total_problems,
                rating_history=rating_history,
                current_rating=current_rating,
                percentile=percentile,
                daily_contributions=daily_contributions,
            ),
        )

    @router.post(
        "/submissions/migrate-guest",
        response_model=MigrateGuestResponse,
        summary="Migrate anonymous guest submissions to authenticated user account",
    )
    @router.post(
        "/migrate-guest",
        response_model=MigrateGuestResponse,
        include_in_schema=False,
    )
    async def migrate_guest_submissions(
        req: MigrateGuestRequest,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> MigrateGuestResponse:
        """Assign anonymous localStorage submissions to the newly authenticated user in PostgreSQL."""
        if not req.submissions:
            return MigrateGuestResponse(
                migrated_count=0,
                message="No submissions provided to migrate",
            )

        migrated_records: List[Submission] = []
        for item in req.submissions:
            # Parse created_at if provided
            sub_dt = None
            if item.created_at:
                try:
                    sub_dt = datetime.fromisoformat(item.created_at.replace("Z", "+00:00"))
                except Exception:
                    sub_dt = datetime.now(timezone.utc)
            else:
                sub_dt = datetime.now(timezone.utc)

            sub = Submission(
                user_id=current_user.id,
                problem_slug=item.problem_slug.strip().lower(),
                language=item.language.strip().lower(),
                code=item.code,
                verdict=item.verdict.strip().upper(),
                runtime_ms=item.runtime_ms,
                memory_kb=item.memory_kb,
                testcases_passed=item.testcases_passed,
                total_testcases=item.total_testcases,
                created_at=sub_dt,
            )
            db.add(sub)
            migrated_records.append(sub)

        await db.commit()
        logger.info(
            f"Successfully migrated {len(migrated_records)} guest submissions "
            f"for user {current_user.username} ({current_user.id})."
        )
        return MigrateGuestResponse(
            migrated_count=len(migrated_records),
            message=f"Successfully migrated {len(migrated_records)} submissions",
        )

    return router

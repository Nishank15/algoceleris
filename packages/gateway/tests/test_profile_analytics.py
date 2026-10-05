import asyncio
from datetime import datetime, timedelta, timezone
import os
import sys
import unittest
import uuid
from pathlib import Path

# Add gateway root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import close_all_sessions

from src.auth.security import hash_password
from src.database import (
    Base,
    close_db_engine,
    get_async_engine,
    get_db,
    get_session_factory,
)
from src.models.entities import ContestParticipation, Submission, User
from src.users.router import create_users_router


class TestProfileAnalytics(unittest.TestCase):
    """Test suite for Phase 16 Plan 16-01: DB-Backed Profile Analytics (UX-03, UX-04, UX-05)."""

    def setUp(self):
        self.test_db_url = f"sqlite+aiosqlite:///:memory:?cache=shared_{os.urandom(4).hex()}"
        self.engine = get_async_engine(self.test_db_url)

        async def _init_tables():
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

        asyncio.run(_init_tables())

        self.session_factory = get_session_factory(engine=self.engine)

        async def override_get_db():
            async with self.session_factory() as session:
                try:
                    yield session
                except Exception:
                    await session.rollback()
                    raise

        # Seed test users
        self.user_active_id = uuid.uuid4()
        self.user_cold_id = uuid.uuid4()

        async def _seed_data():
            async with self.session_factory() as session:
                u_active = User(
                    id=self.user_active_id,
                    username="super_coder",
                    email="super@example.com",
                    password_hash=hash_password("Password123!"),
                    account_type="pro",
                    college_name="Stanford University",
                )
                u_cold = User(
                    id=self.user_cold_id,
                    username="brand_new_dev",
                    email="newbie@example.com",
                    password_hash=hash_password("Password123!"),
                    account_type="free",
                )
                session.add_all([u_active, u_cold])

                # Submissions for super_coder
                now = datetime.now(timezone.utc)
                # 2 Easy solved: two-sum, valid-palindrome
                # 1 Medium solved: longest-substring
                # 1 Hard solved: trapping-rain-water
                # 1 Medium failed: 3sum
                subs = [
                    Submission(
                        user_id=self.user_active_id,
                        problem_slug="two-sum",
                        language="python",
                        code="def solve(): pass",
                        verdict="ACCEPTED",
                        created_at=now - timedelta(days=2),
                    ),
                    Submission(
                        user_id=self.user_active_id,
                        problem_slug="valid-palindrome",
                        language="python",
                        code="def solve(): pass",
                        verdict="ACCEPTED",
                        created_at=now - timedelta(days=2),
                    ),
                    Submission(
                        user_id=self.user_active_id,
                        problem_slug="longest-substring",
                        language="cpp",
                        code="int main() {}",
                        verdict="ACCEPTED",
                        created_at=now - timedelta(days=1),
                    ),
                    Submission(
                        user_id=self.user_active_id,
                        problem_slug="trapping-rain-water",
                        language="java",
                        code="class Solution {}",
                        verdict="ACCEPTED",
                        created_at=now,
                    ),
                    Submission(
                        user_id=self.user_active_id,
                        problem_slug="3sum",
                        language="python",
                        code="def solve(): pass",
                        verdict="WRONG_ANSWER",
                        created_at=now,
                    ),
                ]
                session.add_all(subs)

                # Contest Participations for super_coder
                cps = [
                    ContestParticipation(
                        user_id=self.user_active_id,
                        contest_id="weekly-contest-408",
                        rank=14,
                        score=18,
                        penalty_minutes=45,
                        rating_delta=65,
                        created_at=now - timedelta(days=14),
                    ),
                    ContestParticipation(
                        user_id=self.user_active_id,
                        contest_id="biweekly-contest-134",
                        rank=5,
                        score=20,
                        penalty_minutes=32,
                        rating_delta=40,
                        created_at=now - timedelta(days=7),
                    ),
                ]
                session.add_all(cps)
                await session.commit()

        asyncio.run(_seed_data())

        self.app = FastAPI(title="Profile Analytics Test App")
        self.app.dependency_overrides[get_db] = override_get_db
        users_router = create_users_router()
        self.app.include_router(users_router, prefix="/api/v1")
        self.client = TestClient(self.app)

    def tearDown(self):
        self.app.dependency_overrides.clear()
        close_all_sessions()
        asyncio.run(close_db_engine(self.test_db_url))

    def test_profile_not_found(self):
        """Querying a non-existent username returns HTTP 404."""
        resp = self.client.get("/api/v1/users/nonexistent_ghost/profile")
        self.assertEqual(resp.status_code, 404)
        self.assertIn("not found", resp.json()["detail"].lower())

    def test_profile_active_user_difficulty_breakdown(self):
        """Verify distinct ACCEPTED problems solve breakdown (UX-03)."""
        resp = self.client.get("/api/v1/users/super_coder/profile")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertEqual(data["username"], "super_coder")
        self.assertEqual(data["account_type"], "pro")
        self.assertEqual(data["college_name"], "Stanford University")

        stats = data["stats"]
        # Solved: 2 Easy, 1 Medium, 1 Hard = 4 total solved
        self.assertEqual(stats["total_solved"], 4)
        breakdown = stats["difficulty_breakdown"]
        self.assertEqual(breakdown["Easy"]["solved"], 2)
        self.assertEqual(breakdown["Medium"]["solved"], 1)
        self.assertEqual(breakdown["Hard"]["solved"], 1)

        # Totals
        self.assertGreaterEqual(breakdown["Easy"]["total"], 2)
        self.assertGreaterEqual(breakdown["Medium"]["total"], 1)
        self.assertGreaterEqual(breakdown["Hard"]["total"], 1)

    def test_profile_contest_rating_progression(self):
        """Verify contest rating progression history calculation (UX-04)."""
        resp = self.client.get("/api/v1/users/super_coder/profile")
        self.assertEqual(resp.status_code, 200)
        stats = resp.json()["stats"]

        # Base 1500 + 65 (contest 1) + 40 (contest 2) = 1605
        self.assertEqual(stats["current_rating"], 1605)
        history = stats["rating_history"]
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["contest_id"], "weekly-contest-408")
        self.assertEqual(history[0]["rating"], 1565)
        self.assertEqual(history[1]["contest_id"], "biweekly-contest-134")
        self.assertEqual(history[1]["rating"], 1605)

    def test_profile_skyline_activity(self):
        """Verify 365-day daily submission counts formatted for 3D Isometric Skyline (UX-05)."""
        resp = self.client.get("/api/v1/users/super_coder/profile")
        self.assertEqual(resp.status_code, 200)
        stats = resp.json()["stats"]

        daily = stats["daily_contributions"]
        # Seeded across 3 days: now-2d (2 subs), now-1d (1 sub), now (2 subs) = 3 distinct dates
        self.assertEqual(len(daily), 3)
        for item in daily:
            self.assertIn("date", item)
            self.assertIn("count", item)
            self.assertGreater(item["count"], 0)

    def test_cold_start_profile(self):
        """A fresh user with zero submissions and zero contests returns clean defaults without crashing."""
        resp = self.client.get("/api/v1/users/brand_new_dev/profile")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertEqual(data["username"], "brand_new_dev")
        self.assertEqual(data["account_type"], "free")
        stats = data["stats"]
        self.assertEqual(stats["total_solved"], 0)
        self.assertEqual(stats["current_rating"], 1500)
        self.assertEqual(len(stats["rating_history"]), 0)
        self.assertEqual(len(stats["daily_contributions"]), 0)
        self.assertEqual(stats["difficulty_breakdown"]["Easy"]["solved"], 0)
        self.assertEqual(stats["difficulty_breakdown"]["Medium"]["solved"], 0)
        self.assertEqual(stats["difficulty_breakdown"]["Hard"]["solved"], 0)


if __name__ == "__main__":
    unittest.main()

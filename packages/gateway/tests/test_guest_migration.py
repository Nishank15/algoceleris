import asyncio
import os
import sys
import unittest
import uuid
from pathlib import Path

# Add gateway root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import close_all_sessions

from src.auth.security import create_access_token, hash_password
from src.database import (
    Base,
    close_db_engine,
    get_async_engine,
    get_db,
    get_session_factory,
)
from src.models.entities import Submission, User
from src.users.router import create_users_router


class TestGuestMigration(unittest.TestCase):
    """Test suite for Phase 16 Plan 16-01: Guest Submission History Migration."""

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

        # Seed test user
        self.user_id = uuid.uuid4()
        async def _seed_user():
            async with self.session_factory() as session:
                user = User(
                    id=self.user_id,
                    username="new_coder",
                    email="coder@example.com",
                    password_hash=hash_password("Password123!"),
                    account_type="free",
                )
                session.add(user)
                await session.commit()

        asyncio.run(_seed_user())

        self.token = create_access_token(str(self.user_id), "new_coder", "free")

        self.app = FastAPI(title="Guest Migration Test App")
        self.app.dependency_overrides[get_db] = override_get_db
        users_router = create_users_router()
        self.app.include_router(users_router, prefix="/api/v1")
        self.client = TestClient(self.app)

    def tearDown(self):
        self.app.dependency_overrides.clear()
        close_all_sessions()
        asyncio.run(close_db_engine(self.test_db_url))

    def test_migrate_guest_unauthorized(self):
        """Calling migration endpoint without Bearer token must return 401 Unauthorized."""
        payload = {
            "submissions": [
                {
                    "problem_slug": "two-sum",
                    "language": "python",
                    "code": "print('hello')",
                    "verdict": "ACCEPTED",
                }
            ]
        }
        resp = self.client.post("/api/v1/users/submissions/migrate-guest", json=payload)
        self.assertEqual(resp.status_code, 401)

    def test_migrate_guest_success(self):
        """Valid migration payload transfers submissions to authenticated account in PostgreSQL."""
        payload = {
            "submissions": [
                {
                    "problem_slug": "two-sum",
                    "language": "python",
                    "code": "def two_sum(): pass",
                    "verdict": "ACCEPTED",
                    "runtime_ms": 45,
                    "memory_kb": 14200,
                    "testcases_passed": 5,
                    "total_testcases": 5,
                    "created_at": "2026-03-01T10:00:00Z",
                },
                {
                    "problem_slug": "longest-substring",
                    "language": "cpp",
                    "code": "int main() {}",
                    "verdict": "WRONG_ANSWER",
                    "runtime_ms": 12,
                    "memory_kb": 2400,
                    "testcases_passed": 2,
                    "total_testcases": 10,
                },
            ]
        }

        resp = self.client.post(
            "/api/v1/users/submissions/migrate-guest",
            json=payload,
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["migrated_count"], 2)

        # Verify records exist in PostgreSQL submissions table
        async def _check_db():
            async with self.session_factory() as session:
                stmt = select(Submission).where(Submission.user_id == self.user_id)
                res = await session.execute(stmt)
                subs = res.scalars().all()
                self.assertEqual(len(subs), 2)
                slugs = {s.problem_slug for s in subs}
                self.assertIn("two-sum", slugs)
                self.assertIn("longest-substring", slugs)

        asyncio.run(_check_db())

    def test_migrate_guest_empty_list(self):
        """Submitting empty submissions list returns migrated_count: 0."""
        resp = self.client.post(
            "/api/v1/users/submissions/migrate-guest",
            json={"submissions": []},
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["migrated_count"], 0)

    def test_migrate_guest_payload_limit(self):
        """Submitting more than 100 submissions returns 422 Unprocessable Entity."""
        excessive = [
            {
                "problem_slug": f"problem-{i}",
                "language": "python",
                "code": "pass",
                "verdict": "ACCEPTED",
            }
            for i in range(105)
        ]

        resp = self.client.post(
            "/api/v1/users/submissions/migrate-guest",
            json={"submissions": excessive},
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.assertEqual(resp.status_code, 422)


if __name__ == "__main__":
    unittest.main()

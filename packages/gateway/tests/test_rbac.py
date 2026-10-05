import asyncio
import os
import sys
import unittest
import uuid
from pathlib import Path
from typing import Optional

# Add gateway root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import close_all_sessions

from src.ai import create_ai_router
from src.ai.assistant import GeminiDebugAssistant
from src.auth.rbac import (
    get_current_user,
    get_optional_current_user,
    require_admin,
    require_pro,
)
from src.auth.security import create_access_token, hash_password
from src.cli import run_set_role
from src.database import (
    Base,
    close_db_engine,
    get_async_engine,
    get_db,
    get_session_factory,
)
from src.models.entities import User
from src.ratelimit.bucket import InMemoryTokenBucketStorage, TokenBucketLimiter
from src.subscriptions.store import InMemorySubscriptionStore


class TestRBAC(unittest.TestCase):
    """Test suite for Role-Based Access Control guards, AI router integration, and CLI set-role."""

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
        self.free_id = uuid.uuid4()
        self.pro_id = uuid.uuid4()
        self.admin_id = uuid.uuid4()

        async def _seed_users():
            async with self.session_factory() as session:
                u_free = User(
                    id=self.free_id,
                    username="free_user",
                    email="free@test.com",
                    password_hash=hash_password("Pass123!"),
                    account_type="free",
                )
                u_pro = User(
                    id=self.pro_id,
                    username="pro_user",
                    email="pro@test.com",
                    password_hash=hash_password("Pass123!"),
                    account_type="pro",
                )
                u_admin = User(
                    id=self.admin_id,
                    username="admin_user",
                    email="admin@test.com",
                    password_hash=hash_password("Pass123!"),
                    account_type="admin",
                )
                session.add_all([u_free, u_pro, u_admin])
                await session.commit()

        asyncio.run(_seed_users())

        # Tokens
        self.free_token = create_access_token(
            str(self.free_id), "free_user", "free"
        )
        self.pro_token = create_access_token(
            str(self.pro_id), "pro_user", "pro"
        )
        self.admin_token = create_access_token(
            str(self.admin_id), "admin_user", "admin"
        )

        # Build test app
        self.app = FastAPI()
        self.app.dependency_overrides[get_db] = override_get_db

        @self.app.get("/api/test/whoami")
        async def whoami(current_user: User = Depends(get_current_user)):
            return {
                "id": str(current_user.id),
                "username": current_user.username,
                "account_type": current_user.account_type,
            }

        @self.app.get("/api/test/optional")
        async def optional_user(
            current_user: Optional[User] = Depends(get_optional_current_user),
        ):
            return {"authenticated": current_user is not None}

        @self.app.get("/api/test/pro-endpoint")
        async def pro_endpoint(user: User = Depends(require_pro)):
            return {"status": "ok", "user": user.username}

        @self.app.get("/api/test/admin-endpoint")
        async def admin_endpoint(user: User = Depends(require_admin)):
            return {"status": "ok", "user": user.username}

        # Mount AI router
        self.sub_store = InMemorySubscriptionStore()
        self.limiter = TokenBucketLimiter(storage=InMemoryTokenBucketStorage())
        self.assistant = GeminiDebugAssistant()
        ai_router = create_ai_router(
            store=self.sub_store,
            assistant=self.assistant,
            limiter=self.limiter,
        )
        self.app.include_router(ai_router, prefix="/api/v1")

        self.client = TestClient(self.app)

    def tearDown(self):
        self.app.dependency_overrides.clear()
        close_all_sessions()
        asyncio.run(close_db_engine(self.test_db_url))

    def test_get_current_user_unauthorized(self):
        # Missing header
        res = self.client.get("/api/test/whoami")
        self.assertEqual(res.status_code, 401)

        # Invalid format
        res = self.client.get(
            "/api/test/whoami",
            headers={"Authorization": "Basic 12345"},
        )
        self.assertEqual(res.status_code, 401)

        # Invalid token
        res = self.client.get(
            "/api/test/whoami",
            headers={"Authorization": "Bearer bad.token.here"},
        )
        self.assertEqual(res.status_code, 401)

    def test_get_current_user_success(self):
        res = self.client.get(
            "/api/test/whoami",
            headers={"Authorization": f"Bearer {self.free_token}"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["username"], "free_user")
        self.assertEqual(data["account_type"], "free")

    def test_optional_current_user(self):
        # Without header
        res1 = self.client.get("/api/test/optional")
        self.assertEqual(res1.status_code, 200)
        self.assertFalse(res1.json()["authenticated"])

        # With valid header
        res2 = self.client.get(
            "/api/test/optional",
            headers={"Authorization": f"Bearer {self.pro_token}"},
        )
        self.assertEqual(res2.status_code, 200)
        self.assertTrue(res2.json()["authenticated"])

    def test_require_pro_guard(self):
        # Free account rejected with 403
        res_free = self.client.get(
            "/api/test/pro-endpoint",
            headers={"Authorization": f"Bearer {self.free_token}"},
        )
        self.assertEqual(res_free.status_code, 403)
        self.assertEqual(res_free.json()["detail"]["error"], "pro_tier_required")

        # Pro account allowed with 200
        res_pro = self.client.get(
            "/api/test/pro-endpoint",
            headers={"Authorization": f"Bearer {self.pro_token}"},
        )
        self.assertEqual(res_pro.status_code, 200)
        self.assertEqual(res_pro.json()["status"], "ok")

        # Admin account allowed with 200 (admin inherits pro permissions)
        res_admin = self.client.get(
            "/api/test/pro-endpoint",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(res_admin.status_code, 200)
        self.assertEqual(res_admin.json()["status"], "ok")

    def test_require_admin_guard(self):
        # Free account rejected with 403
        res_free = self.client.get(
            "/api/test/admin-endpoint",
            headers={"Authorization": f"Bearer {self.free_token}"},
        )
        self.assertEqual(res_free.status_code, 403)
        self.assertEqual(res_free.json()["detail"]["error"], "admin_privileges_required")

        # Pro account rejected with 403
        res_pro = self.client.get(
            "/api/test/admin-endpoint",
            headers={"Authorization": f"Bearer {self.pro_token}"},
        )
        self.assertEqual(res_pro.status_code, 403)
        self.assertEqual(res_pro.json()["detail"]["error"], "admin_privileges_required")

        # Admin account allowed with 200
        res_admin = self.client.get(
            "/api/test/admin-endpoint",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(res_admin.status_code, 200)
        self.assertEqual(res_admin.json()["status"], "ok")

    def test_set_role_cli(self):
        # Invalid role raises ValueError
        with self.assertRaises(ValueError):
            asyncio.run(
                run_set_role(
                    email="free@test.com",
                    role="super_god_mode",
                    db_url=self.test_db_url,
                )
            )

        # Missing email and username returns False
        success_none = asyncio.run(
            run_set_role(
                role="pro",
                db_url=self.test_db_url,
            )
        )
        self.assertFalse(success_none)

        # Nonexistent user returns False
        success_nonexistent = asyncio.run(
            run_set_role(
                email="nobody@test.com",
                role="pro",
                db_url=self.test_db_url,
            )
        )
        self.assertFalse(success_nonexistent)

        # Elevate free to pro
        success_elevate = asyncio.run(
            run_set_role(
                email="free@test.com",
                role="pro",
                db_url=self.test_db_url,
            )
        )
        self.assertTrue(success_elevate)

        # Verify in DB
        async def _check_role():
            async with self.session_factory() as session:
                res = await session.execute(
                    select(User.account_type).where(User.id == self.free_id)
                )
                return res.scalar()

        role = asyncio.run(_check_role())
        self.assertEqual(role, "pro")

        # Elevate to admin
        success_admin = asyncio.run(
            run_set_role(
                username="free_user",
                role="admin",
                db_url=self.test_db_url,
            )
        )
        self.assertTrue(success_admin)
        self.assertEqual(asyncio.run(_check_role()), "admin")

        # Demote back to free
        success_demote = asyncio.run(
            run_set_role(
                username="free_user",
                role="free",
                db_url=self.test_db_url,
            )
        )
        self.assertTrue(success_demote)
        self.assertEqual(asyncio.run(_check_role()), "free")

    def test_ai_router_with_rbac(self):
        payload = {
            "user_id": str(self.free_id),
            "language": "python",
            "source_code": "def solve(): pass",
            "problem_title": "Two Sum",
            "problem_description": "Sample problem",
            "error_diagnostics": "SyntaxError",
            "failing_test_cases": [{"input": "1", "expected": "1", "actual": "None"}],
        }

        # 1. Calling with free user token -> 403 Forbidden
        res_free = self.client.post(
            "/api/v1/ai/debug",
            json=payload,
            headers={"Authorization": f"Bearer {self.free_token}"},
        )
        self.assertEqual(res_free.status_code, 403)
        self.assertEqual(res_free.json()["detail"]["error"], "pro_tier_required")

        # 2. Calling with pro user token -> 200 OK
        res_pro = self.client.post(
            "/api/v1/ai/debug",
            json=payload,
            headers={"Authorization": f"Bearer {self.pro_token}"},
        )
        self.assertEqual(res_pro.status_code, 200)
        self.assertIn("root_cause", res_pro.json())

        # 3. Calling with admin user token -> 200 OK
        res_admin = self.client.post(
            "/api/v1/ai/debug",
            json=payload,
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(res_admin.status_code, 200)
        self.assertIn("root_cause", res_admin.json())


if __name__ == "__main__":
    unittest.main()

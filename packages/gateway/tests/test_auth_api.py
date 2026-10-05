import asyncio
import os
import sys
import unittest
from pathlib import Path

# Add gateway root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from sqlalchemy.orm import close_all_sessions

from src.api import create_app
from src.auth.bloom import BloomUniquenessChecker
from src.auth.security import (
    _mem_refresh_tokens,
    _mem_token_families,
    decode_token,
)
from src.database import (
    Base,
    close_db_engine,
    get_async_engine,
    get_db,
    get_session_factory,
)
from src.models.entities import User
from src.queue import InMemoryQueueBroker


class TestAuthAPI(unittest.TestCase):
    """Comprehensive test suite for Phase 14 Authentication API endpoints."""

    def setUp(self):
        # Clear in-memory token stores
        _mem_refresh_tokens.clear()
        _mem_token_families.clear()

        self.test_db_url = f"sqlite+aiosqlite:///:memory:?cache=shared_{os.urandom(4).hex()}"
        self.engine = get_async_engine(self.test_db_url)

        # Create tables
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

        self.broker = InMemoryQueueBroker()
        self.bloom_checker = BloomUniquenessChecker(
            force_in_memory=True,
            session_factory=self.session_factory,
        )

        self.app = create_app(
            broker=self.broker,
            bloom_checker=self.bloom_checker,
        )
        self.app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(self.app)

    def tearDown(self):
        self.app.dependency_overrides.clear()
        close_all_sessions()
        asyncio.run(close_db_engine(self.test_db_url))

    def test_signup_success(self):
        payload = {
            "username": "coder_bob",
            "email": "bob@example.com",
            "password": "StrongPassword123!",
            "college_name": "MIT",
        }
        res = self.client.post("/api/v1/auth/signup", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()

        self.assertIn("access_token", data)
        self.assertEqual(data["token_type"], "bearer")
        self.assertEqual(data["expires_in"], 900)
        self.assertEqual(data["user"]["username"], "coder_bob")
        self.assertEqual(data["user"]["email"], "bob@example.com")
        self.assertEqual(data["user"]["account_type"], "free")
        self.assertEqual(data["user"]["college_name"], "MIT")

        # Verify HttpOnly refresh_token cookie
        self.assertIn("refresh_token", res.cookies)
        cookie_header = res.headers.get("set-cookie", "")
        self.assertIn("HttpOnly", cookie_header)
        self.assertIn("Path=/api/v1/auth", cookie_header)

        # Verify Bloom filter was updated
        async def _check_bloom():
            u_avail = await self.bloom_checker.is_username_available("coder_bob")
            e_avail = await self.bloom_checker.is_email_available("bob@example.com")
            return u_avail, e_avail

        u_avail, e_avail = asyncio.run(_check_bloom())
        self.assertFalse(u_avail)
        self.assertFalse(e_avail)

    def test_signup_duplicate_username_rejected(self):
        payload1 = {
            "username": "alice",
            "email": "alice1@example.com",
            "password": "Password123!",
        }
        res1 = self.client.post("/api/v1/auth/signup", json=payload1)
        self.assertEqual(res1.status_code, 201)

        payload2 = {
            "username": "alice",
            "email": "alice2@example.com",
            "password": "Password456!",
        }
        res2 = self.client.post("/api/v1/auth/signup", json=payload2)
        self.assertEqual(res2.status_code, 409)
        self.assertIn("already taken", res2.json()["detail"])

    def test_signup_duplicate_email_rejected(self):
        payload1 = {
            "username": "user1",
            "email": "same@example.com",
            "password": "Password123!",
        }
        res1 = self.client.post("/api/v1/auth/signup", json=payload1)
        self.assertEqual(res1.status_code, 201)

        payload2 = {
            "username": "user2",
            "email": "same@example.com",
            "password": "Password456!",
        }
        res2 = self.client.post("/api/v1/auth/signup", json=payload2)
        self.assertEqual(res2.status_code, 409)
        self.assertIn("already registered", res2.json()["detail"])

    def test_login_success_with_username_and_email(self):
        # Sign up user first
        signup_payload = {
            "username": "dev_alex",
            "email": "alex@dev.com",
            "password": "AlexSecretPassword99!",
        }
        self.client.post("/api/v1/auth/signup", json=signup_payload)

        # Login with username
        res_user = self.client.post(
            "/api/v1/auth/login",
            json={"identifier": "dev_alex", "password": "AlexSecretPassword99!"},
        )
        self.assertEqual(res_user.status_code, 200)
        data_user = res_user.json()
        self.assertIn("access_token", data_user)
        self.assertEqual(data_user["user"]["username"], "dev_alex")
        self.assertIn("refresh_token", res_user.cookies)

        # Login with email
        res_email = self.client.post(
            "/api/v1/auth/login",
            json={"identifier": "alex@dev.com", "password": "AlexSecretPassword99!"},
        )
        self.assertEqual(res_email.status_code, 200)
        data_email = res_email.json()
        self.assertIn("access_token", data_email)
        self.assertEqual(data_email["user"]["email"], "alex@dev.com")

    def test_login_invalid_credentials(self):
        signup_payload = {
            "username": "charlie",
            "email": "charlie@example.com",
            "password": "CorrectPassword123!",
        }
        self.client.post("/api/v1/auth/signup", json=signup_payload)

        # Wrong password
        res_wrong = self.client.post(
            "/api/v1/auth/login",
            json={"identifier": "charlie", "password": "WrongPassword!"},
        )
        self.assertEqual(res_wrong.status_code, 401)
        self.assertIn("Invalid username/email or password", res_wrong.json()["detail"])

        # Non-existent user
        res_none = self.client.post(
            "/api/v1/auth/login",
            json={"identifier": "ghost_user", "password": "AnyPassword!"},
        )
        self.assertEqual(res_none.status_code, 401)
        self.assertIn("Invalid username/email or password", res_none.json()["detail"])

    def test_check_availability(self):
        # Initially available
        res1 = self.client.get("/api/v1/auth/check-availability?username=unique_dan")
        self.assertEqual(res1.status_code, 200)
        self.assertTrue(res1.json()["available"])

        res_email = self.client.get("/api/v1/auth/check-availability?email=dan@domain.com")
        self.assertEqual(res_email.status_code, 200)
        self.assertTrue(res_email.json()["available"])

        # Sign up
        self.client.post(
            "/api/v1/auth/signup",
            json={
                "username": "unique_dan",
                "email": "dan@domain.com",
                "password": "PasswordDan123!",
            },
        )

        # Now taken
        res2 = self.client.get("/api/v1/auth/check-availability?username=unique_dan")
        self.assertEqual(res2.status_code, 200)
        self.assertFalse(res2.json()["available"])

        res_email2 = self.client.get("/api/v1/auth/check-availability?email=dan@domain.com")
        self.assertEqual(res_email2.status_code, 200)
        self.assertFalse(res_email2.json()["available"])

    def test_refresh_token_rotation(self):
        signup_res = self.client.post(
            "/api/v1/auth/signup",
            json={
                "username": "rotator",
                "email": "rotator@test.com",
                "password": "RotateSecret123!",
            },
        )
        r1_cookie = signup_res.cookies.get("refresh_token")
        self.assertIsNotNone(r1_cookie)

        # Perform silent refresh with R1 via Cookie header
        refresh_res = self.client.post(
            "/api/v1/auth/refresh",
            headers={"Cookie": f"refresh_token={r1_cookie}"},
        )
        self.assertEqual(refresh_res.status_code, 200)
        refresh_data = refresh_res.json()
        self.assertIn("access_token", refresh_data)

        # Verify newly rotated cookie R2 was issued
        r2_cookie = refresh_res.cookies.get("refresh_token")
        self.assertIsNotNone(r2_cookie)
        self.assertNotEqual(r1_cookie, r2_cookie)

        # Decode tokens to verify family ID stayed constant but token ID rotated
        p1 = decode_token(r1_cookie)
        p2 = decode_token(r2_cookie)
        self.assertEqual(p1["family"], p2["family"])
        self.assertNotEqual(p1["jti"], p2["jti"])

    def test_replay_attack_revocation(self):
        signup_res = self.client.post(
            "/api/v1/auth/signup",
            json={
                "username": "victim",
                "email": "victim@test.com",
                "password": "VictimSecret123!",
            },
        )
        r1_cookie = signup_res.cookies.get("refresh_token")

        # Legitimate rotation from R1 to R2
        legit_res = self.client.post(
            "/api/v1/auth/refresh",
            headers={"Cookie": f"refresh_token={r1_cookie}"},
        )
        self.assertEqual(legit_res.status_code, 200)
        r2_cookie = legit_res.cookies.get("refresh_token")

        # Attacker replays consumed token R1
        attacker_res = self.client.post(
            "/api/v1/auth/refresh",
            headers={"Cookie": f"refresh_token={r1_cookie}"},
        )
        self.assertEqual(attacker_res.status_code, 401)
        self.assertIn("reuse detected", attacker_res.json()["detail"])

        # Legitimate user now tries to use R2; family was revoked so R2 must fail as well!
        aftermath_res = self.client.post(
            "/api/v1/auth/refresh",
            headers={"Cookie": f"refresh_token={r2_cookie}"},
        )
        self.assertEqual(aftermath_res.status_code, 401)

    def test_get_current_user_me(self):
        # Unauthenticated request
        unauth_res = self.client.get("/api/v1/auth/me")
        self.assertEqual(unauth_res.status_code, 401)

        # Invalid token
        invalid_res = self.client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.token.payload"},
        )
        self.assertEqual(invalid_res.status_code, 401)

        # Sign up and fetch profile with valid access token
        signup_res = self.client.post(
            "/api/v1/auth/signup",
            json={
                "username": "emma",
                "email": "emma@test.com",
                "password": "EmmaPassword123!",
                "college_name": "Stanford",
            },
        )
        access_token = signup_res.json()["access_token"]

        me_res = self.client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.json()
        self.assertEqual(me_data["username"], "emma")
        self.assertEqual(me_data["email"], "emma@test.com")
        self.assertEqual(me_data["college_name"], "Stanford")
        self.assertEqual(me_data["account_type"], "free")

    def test_logout(self):
        signup_res = self.client.post(
            "/api/v1/auth/signup",
            json={
                "username": "logout_user",
                "email": "logout@test.com",
                "password": "LogoutPassword123!",
            },
        )
        r_cookie = signup_res.cookies.get("refresh_token")

        logout_res = self.client.post(
            "/api/v1/auth/logout",
            headers={"Cookie": f"refresh_token={r_cookie}"},
        )
        self.assertEqual(logout_res.status_code, 200)

        # Verify refresh attempt fails after logout
        refresh_res = self.client.post(
            "/api/v1/auth/refresh",
            headers={"Cookie": f"refresh_token={r_cookie}"},
        )
        self.assertEqual(refresh_res.status_code, 401)


if __name__ == "__main__":
    unittest.main()

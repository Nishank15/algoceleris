import asyncio
import csv
import io
import os
import tempfile
import unittest
import uuid
from typing import Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.gateway.src.auth.security import create_access_token, hash_password
from packages.gateway.src.database import (
    Base,
    close_db_engine,
    get_async_engine,
    get_db,
    get_session_factory,
)
from packages.gateway.src.models import (
    CampusRole,
    Cohort,
    MembershipStatus,
    OrgMembership,
    Organization,
    User,
)
from packages.gateway.src.core.campus_rbac import (
    require_instructor,
    require_org_admin,
    require_student,
)
from packages.gateway.src.api import create_app
from packages.gateway.src.queue import InMemoryQueueBroker


class TestCampusRBAC(unittest.TestCase):
    """Test suite validating Multi-Tenant Campus RBAC and Organization/Cohort REST APIs."""

    def setUp(self):
        try:
            self.loop = asyncio.get_event_loop()
            if self.loop.is_closed():
                self.loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self.loop)
        except RuntimeError:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix=".db")
        self.sqlite_url = f"sqlite+aiosqlite:///{self.temp_db_path}"
        self.engine = get_async_engine(self.sqlite_url)

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
        self.app = create_app(broker=self.broker)
        self.app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(self.app)

        # Seed initial organizations and users
        self.org1_id = uuid.uuid4()
        self.org2_id = uuid.uuid4()

        self.org_admin_id = uuid.uuid4()
        self.instructor_id = uuid.uuid4()
        self.student_id = uuid.uuid4()
        self.cross_tenant_user_id = uuid.uuid4()
        self.unaffiliated_user_id = uuid.uuid4()

        async def _seed_data():
            async with self.session_factory() as session:
                # Organizations
                org1 = Organization(
                    id=self.org1_id,
                    name="MIT EECS",
                    slug="mit-eecs",
                    domain_whitelist=["mit.edu"],
                    branding_config={"max_seats": 5},
                )
                org2 = Organization(
                    id=self.org2_id,
                    name="Stanford CS",
                    slug="stanford-cs",
                    domain_whitelist=["stanford.edu"],
                    branding_config={"max_seats": 10},
                )
                session.add_all([org1, org2])

                # Users
                u_admin = User(
                    id=self.org_admin_id,
                    username="org_admin_user",
                    email="admin@mit.edu",
                    password_hash=hash_password("Pass123!"),
                    account_type="pro",
                )
                u_instr = User(
                    id=self.instructor_id,
                    username="instructor_user",
                    email="prof@mit.edu",
                    password_hash=hash_password("Pass123!"),
                    account_type="pro",
                )
                u_stud = User(
                    id=self.student_id,
                    username="student_user",
                    email="alice@mit.edu",
                    password_hash=hash_password("Pass123!"),
                    account_type="free",
                )
                u_cross = User(
                    id=self.cross_tenant_user_id,
                    username="stanford_user",
                    email="bob@stanford.edu",
                    password_hash=hash_password("Pass123!"),
                    account_type="pro",
                )
                u_unaffil = User(
                    id=self.unaffiliated_user_id,
                    username="external_user",
                    email="stranger@gmail.com",
                    password_hash=hash_password("Pass123!"),
                    account_type="free",
                )
                session.add_all([u_admin, u_instr, u_stud, u_cross, u_unaffil])

                # Org 1 Memberships
                m_admin = OrgMembership(
                    org_id=self.org1_id,
                    user_id=self.org_admin_id,
                    role=CampusRole.ORG_ADMIN.value,
                    status=MembershipStatus.ACTIVE.value,
                )
                m_instr = OrgMembership(
                    org_id=self.org1_id,
                    user_id=self.instructor_id,
                    role=CampusRole.INSTRUCTOR.value,
                    status=MembershipStatus.ACTIVE.value,
                )
                m_stud = OrgMembership(
                    org_id=self.org1_id,
                    user_id=self.student_id,
                    role=CampusRole.STUDENT.value,
                    status=MembershipStatus.ACTIVE.value,
                )
                # Org 2 Membership
                m_cross = OrgMembership(
                    org_id=self.org2_id,
                    user_id=self.cross_tenant_user_id,
                    role=CampusRole.ORG_ADMIN.value,
                    status=MembershipStatus.ACTIVE.value,
                )
                session.add_all([m_admin, m_instr, m_stud, m_cross])
                await session.commit()

        asyncio.run(_seed_data())

        # Tokens
        self.token_admin = create_access_token(
            user_id=str(self.org_admin_id),
            username="org_admin_user",
            email="admin@mit.edu",
            account_type="pro",
        )
        self.token_instructor = create_access_token(
            user_id=str(self.instructor_id),
            username="instructor_user",
            email="prof@mit.edu",
            account_type="pro",
        )
        self.token_student = create_access_token(
            user_id=str(self.student_id),
            username="student_user",
            email="alice@mit.edu",
            account_type="free",
        )
        self.token_cross = create_access_token(
            user_id=str(self.cross_tenant_user_id),
            username="stanford_user",
            email="bob@stanford.edu",
            account_type="pro",
        )
        self.token_unaffil = create_access_token(
            user_id=str(self.unaffiliated_user_id),
            username="external_user",
            email="stranger@gmail.com",
            account_type="free",
        )

    def tearDown(self):
        asyncio.run(close_db_engine(self.sqlite_url))
        try:
            os.close(self.temp_db_fd)
        except OSError:
            pass
        if os.path.exists(self.temp_db_path):
            try:
                os.remove(self.temp_db_path)
            except OSError:
                pass

    def test_require_campus_roles_hierarchy_and_permissions(self):
        """Test require_org_admin, require_instructor, and require_student dependency hierarchy."""
        test_router_app = FastAPI()

        @test_router_app.get("/test/{org_id}/admin-only", dependencies=[Depends(require_org_admin)])
        def admin_endpoint(org_id: uuid.UUID):
            return {"status": "ok", "scope": "admin"}

        @test_router_app.get("/test/{org_id}/instructor-only", dependencies=[Depends(require_instructor)])
        def instructor_endpoint(org_id: uuid.UUID):
            return {"status": "ok", "scope": "instructor"}

        @test_router_app.get("/test/{org_id}/student-allowed", dependencies=[Depends(require_student)])
        def student_endpoint(org_id: uuid.UUID):
            return {"status": "ok", "scope": "student"}

        test_router_app.dependency_overrides = self.app.dependency_overrides
        client = TestClient(test_router_app)

        # 1. Admin accessing require_org_admin -> 200
        res = client.get(
            f"/test/{self.org1_id}/admin-only",
            headers={"Authorization": f"Bearer {self.token_admin}"},
        )
        self.assertEqual(res.status_code, 200)

        # 2. Instructor accessing require_org_admin -> 403 structured
        res = client.get(
            f"/test/{self.org1_id}/admin-only",
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 403)
        detail = res.json()["detail"]
        self.assertEqual(detail["error"], "insufficient_campus_permissions")
        self.assertEqual(detail["required_role"], "org_admin")
        self.assertEqual(detail["user_role"], "instructor")

        # 3. Student accessing require_org_admin -> 403 structured
        res = client.get(
            f"/test/{self.org1_id}/admin-only",
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 403)
        detail = res.json()["detail"]
        self.assertEqual(detail["error"], "insufficient_campus_permissions")
        self.assertEqual(detail["required_role"], "org_admin")
        self.assertEqual(detail["user_role"], "student")

        # 4. Instructor accessing require_instructor -> 200
        res = client.get(
            f"/test/{self.org1_id}/instructor-only",
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 200)

        # 5. Org Admin accessing require_instructor -> 200 (hierarchy allows admin)
        res = client.get(
            f"/test/{self.org1_id}/instructor-only",
            headers={"Authorization": f"Bearer {self.token_admin}"},
        )
        self.assertEqual(res.status_code, 200)

        # 6. Student accessing require_instructor -> 403
        res = client.get(
            f"/test/{self.org1_id}/instructor-only",
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 403)
        detail = res.json()["detail"]
        self.assertEqual(detail["error"], "insufficient_campus_permissions")
        self.assertEqual(detail["required_role"], "instructor")
        self.assertEqual(detail["user_role"], "student")

        # 7. Student accessing require_student -> 200
        res = client.get(
            f"/test/{self.org1_id}/student-allowed",
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 200)

        # 8. Instructor & Admin accessing require_student -> 200
        res = client.get(
            f"/test/{self.org1_id}/student-allowed",
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 200)
        res = client.get(
            f"/test/{self.org1_id}/student-allowed",
            headers={"Authorization": f"Bearer {self.token_admin}"},
        )
        self.assertEqual(res.status_code, 200)

    def test_cross_tenant_isolation_rejection(self):
        """Assert cross-tenant and unaffiliated user access rejection with user_role=None."""
        test_router_app = FastAPI()

        @test_router_app.get("/test/{org_id}/resource", dependencies=[Depends(require_student)])
        def resource_endpoint(org_id: uuid.UUID):
            return {"status": "ok"}

        test_router_app.dependency_overrides = self.app.dependency_overrides
        client = TestClient(test_router_app)

        # User belonging to Org 2 accessing Org 1 resource -> 403 Forbidden
        res = client.get(
            f"/test/{self.org1_id}/resource",
            headers={"Authorization": f"Bearer {self.token_cross}"},
        )
        self.assertEqual(res.status_code, 403)
        detail = res.json()["detail"]
        self.assertEqual(detail["error"], "insufficient_campus_permissions")
        self.assertIsNone(detail["user_role"])

        # Unaffiliated user accessing Org 1 resource -> 403 Forbidden
        res = client.get(
            f"/test/{self.org1_id}/resource",
            headers={"Authorization": f"Bearer {self.token_unaffil}"},
        )
        self.assertEqual(res.status_code, 403)
        detail = res.json()["detail"]
        self.assertEqual(detail["error"], "insufficient_campus_permissions")
        self.assertIsNone(detail["user_role"])

    def test_organization_creation_and_retrieval_api(self):
        """Test POST /api/v1/campus/orgs and GET /api/v1/campus/orgs/{org_id}."""
        # 1. Create organization
        payload = {
            "name": "UC Berkeley EECS",
            "slug": "berkeley-eecs",
            "domain_whitelist": ["berkeley.edu"],
            "branding_config": {"accent_color": "#003262", "max_seats": 200},
        }
        res = self.client.post(
            "/api/v1/campus/orgs",
            json=payload,
            headers={"Authorization": f"Bearer {self.token_admin}"},
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["name"], "UC Berkeley EECS")
        self.assertEqual(data["slug"], "berkeley-eecs")
        self.assertEqual(data["domain_whitelist"], ["berkeley.edu"])
        new_org_id = uuid.UUID(data["id"])

        # Creator should automatically be enrolled as org_admin
        async def _check_admin_membership():
            async with self.session_factory() as session:
                stmt = select(OrgMembership).where(
                    OrgMembership.org_id == new_org_id,
                    OrgMembership.user_id == self.org_admin_id,
                )
                result = await session.execute(stmt)
                m = result.scalars().first()
                self.assertIsNotNone(m)
                self.assertEqual(m.role, CampusRole.ORG_ADMIN.value)

        asyncio.run(_check_admin_membership())

        # 2. Retrieve org details as admin of that org -> 200 OK
        res = self.client.get(
            f"/api/v1/campus/orgs/{new_org_id}",
            headers={"Authorization": f"Bearer {self.token_admin}"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["slug"], "berkeley-eecs")

        # 3. Retrieve org details as unauthorized cross-tenant user -> 403 Forbidden
        res = self.client.get(
            f"/api/v1/campus/orgs/{new_org_id}",
            headers={"Authorization": f"Bearer {self.token_cross}"},
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["detail"]["error"], "insufficient_campus_permissions")

        # 4. Duplicate slug should be rejected -> 409 Conflict
        res = self.client.post(
            "/api/v1/campus/orgs",
            json=payload,
            headers={"Authorization": f"Bearer {self.token_admin}"},
        )
        self.assertEqual(res.status_code, 409)

    def test_cohort_creation_and_roster_api(self):
        """Test POST /api/v1/campus/cohorts and GET /api/v1/campus/cohorts/{cohort_id}/roster."""
        # 1. Student attempting to create cohort -> 403 Forbidden
        cohort_payload = {
            "org_id": str(self.org1_id),
            "name": "Spring 2026 CS 101",
            "code": "CS-101-S26",
            "term": "Spring 2026",
        }
        res = self.client.post(
            "/api/v1/campus/cohorts",
            json=cohort_payload,
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 403)

        # 2. Instructor creating cohort in Org 1 -> 201 Created
        res = self.client.post(
            "/api/v1/campus/cohorts",
            json=cohort_payload,
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 201)
        cohort_data = res.json()
        self.assertEqual(cohort_data["code"], "CS-101-S26")
        cohort_id = cohort_data["id"]

        # 3. Duplicate [org_id, code] in same org -> 409 Conflict
        res = self.client.post(
            "/api/v1/campus/cohorts",
            json=cohort_payload,
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 409)

        # 4. Get cohort roster (initially empty)
        res = self.client.get(
            f"/api/v1/campus/cohorts/{cohort_id}/roster",
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), [])

        # 5. Cross-tenant user accessing roster -> 403 Forbidden
        res = self.client.get(
            f"/api/v1/campus/cohorts/{cohort_id}/roster",
            headers={"Authorization": f"Bearer {self.token_cross}"},
        )
        self.assertEqual(res.status_code, 403)

    def test_batch_member_ingestion_whitelist_and_quota_rollback(self):
        """Test POST /api/v1/campus/orgs/{org_id}/members/batch with domain validation and quota rollback."""
        # Setup: Create a cohort in Org 1
        cohort_res = self.client.post(
            "/api/v1/campus/cohorts",
            json={
                "org_id": str(self.org1_id),
                "name": "Algorithms Batch",
                "code": "ALGO-2026",
                "term": "Fall 2026",
            },
            headers={"Authorization": f"Bearer {self.token_admin}"},
        )
        self.assertEqual(cohort_res.status_code, 201)
        cohort_id = cohort_res.json()["id"]

        # Org1 currently has 3 members (admin, prof, student). max_seats in Org 1 is 5.
        # 1. Ingest batch with disallowed domain -> 400 Bad Request (Domain whitelist violation)
        invalid_batch = {
            "members": [
                {"email": "valid1@mit.edu", "role": "student", "cohort_id": cohort_id},
                {"email": "attacker@evil.com", "role": "student", "cohort_id": cohort_id},
            ]
        }
        res = self.client.post(
            f"/api/v1/campus/orgs/{self.org1_id}/members/batch",
            json=invalid_batch,
            headers={"Authorization": f"Bearer {self.token_admin}"},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("domain", res.json()["detail"]["error"].lower())

        # Verify that atomic rollback prevented valid1@mit.edu from being partially created
        async def _check_valid1_not_present():
            async with self.session_factory() as session:
                stmt = select(User).where(User.email == "valid1@mit.edu")
                result = await session.execute(stmt)
                u = result.scalars().first()
                self.assertIsNone(u)

        asyncio.run(_check_valid1_not_present())

        # 2. Valid batch ingestion under seat quota (2 students -> total 5, within max_seats=5)
        valid_batch = {
            "members": [
                {"email": "valid1@mit.edu", "role": "student", "cohort_id": cohort_id},
                {"email": "valid2@mit.edu", "role": "student", "cohort_id": cohort_id},
            ]
        }
        res = self.client.post(
            f"/api/v1/campus/orgs/{self.org1_id}/members/batch",
            json=valid_batch,
            headers={"Authorization": f"Bearer {self.token_admin}"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["imported_count"], 2)

        # Verify roster now returns the newly ingested students
        res = self.client.get(
            f"/api/v1/campus/cohorts/{cohort_id}/roster",
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 200)
        roster = res.json()
        emails = [r["email"] for r in roster]
        self.assertIn("valid1@mit.edu", emails)
        self.assertIn("valid2@mit.edu", emails)

        # 3. Quota overflow: Org 1 now has 5 members (max_seats is 5).
        # Attempting to add 1 more member must trigger quota overflow and rollback.
        overflow_batch = {
            "members": [
                {"email": "overflow@mit.edu", "role": "student", "cohort_id": cohort_id}
            ]
        }
        res = self.client.post(
            f"/api/v1/campus/orgs/{self.org1_id}/members/batch",
            json=overflow_batch,
            headers={"Authorization": f"Bearer {self.token_admin}"},
        )
        self.assertIn(res.status_code, [400, 409])
        self.assertIn("quota", res.json()["detail"]["error"].lower())

        # Verify rollback: overflow@mit.edu is NOT added to org_memberships
        async def _check_overflow_not_present():
            async with self.session_factory() as session:
                stmt = select(User).where(User.email == "overflow@mit.edu")
                result = await session.execute(stmt)
                u = result.scalars().first()
                self.assertIsNone(u)

        asyncio.run(_check_overflow_not_present())

        # 4. CSV roster batch ingestion
        # Temporarily increase max_seats in branding_config for CSV test
        async def _increase_max_seats():
            async with self.session_factory() as session:
                org = await session.get(Organization, self.org1_id)
                org.branding_config = {"max_seats": 20}
                await session.commit()

        asyncio.run(_increase_max_seats())

        csv_content = f"email,role,cohort_id\ncsv_user1@mit.edu,student,{cohort_id}\ncsv_user2@mit.edu,teaching_assistant,{cohort_id}\n"
        res = self.client.post(
            f"/api/v1/campus/orgs/{self.org1_id}/members/batch",
            json={"csv_content": csv_content},
            headers={"Authorization": f"Bearer {self.token_admin}"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["imported_count"], 2)


if __name__ == "__main__":
    unittest.main()

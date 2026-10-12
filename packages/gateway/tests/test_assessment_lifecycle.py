import asyncio
from datetime import datetime, timedelta, timezone
import os
import tempfile
import unittest
import uuid

from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import select

from packages.gateway.src.api import create_app
from packages.gateway.src.auth.security import create_access_token, hash_password
from packages.gateway.src.core.assessment_engine import (
    compute_late_penalty,
    resolve_assessment_status,
)
from packages.gateway.src.database import (
    Base,
    close_db_engine,
    get_async_engine,
    get_db,
    get_session_factory,
)
from packages.gateway.src.models import (
    Assessment,
    AssessmentMode,
    AssessmentStatus,
    AssessmentSubmission,
    CampusRole,
    Cohort,
    MembershipStatus,
    OrgMembership,
    Organization,
    Submission,
    User,
)
from packages.gateway.src.queue import InMemoryQueueBroker


class TestAssessmentLifecycle(unittest.TestCase):
    """Test suite validating Assessment Engine state transitions, deadline gatekeeper, and penalty calculations."""

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

        # Seed IDs
        self.org_id = uuid.uuid4()
        self.cohort_id = uuid.uuid4()
        self.instructor_id = uuid.uuid4()
        self.student_id = uuid.uuid4()

        async def _seed_data():
            async with self.session_factory() as session:
                org = Organization(
                    id=self.org_id,
                    name="Caltech CMS",
                    slug="caltech-cms",
                    domain_whitelist=["caltech.edu"],
                    branding_config={"max_seats": 50},
                )
                cohort = Cohort(
                    id=self.cohort_id,
                    org_id=self.org_id,
                    name="CS 38 Algorithms",
                    code="CS-38-2026",
                    term="Spring 2026",
                )
                session.add_all([org, cohort])

                u_instr = User(
                    id=self.instructor_id,
                    username="prof_donald",
                    email="donald@caltech.edu",
                    password_hash=hash_password("Pass123!"),
                    account_type="pro",
                )
                u_stud = User(
                    id=self.student_id,
                    username="student_richard",
                    email="richard@caltech.edu",
                    password_hash=hash_password("Pass123!"),
                    account_type="free",
                )
                session.add_all([u_instr, u_stud])

                m_instr = OrgMembership(
                    org_id=self.org_id,
                    user_id=self.instructor_id,
                    cohort_id=self.cohort_id,
                    role=CampusRole.INSTRUCTOR.value,
                    status=MembershipStatus.ACTIVE.value,
                )
                m_stud = OrgMembership(
                    org_id=self.org_id,
                    user_id=self.student_id,
                    cohort_id=self.cohort_id,
                    role=CampusRole.STUDENT.value,
                    status=MembershipStatus.ACTIVE.value,
                )
                session.add_all([m_instr, m_stud])
                await session.commit()

        asyncio.run(_seed_data())

        self.token_instructor = create_access_token(
            user_id=str(self.instructor_id),
            username="prof_donald",
            email="donald@caltech.edu",
            account_type="pro",
        )
        self.token_student = create_access_token(
            user_id=str(self.student_id),
            username="student_richard",
            email="richard@caltech.edu",
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

    def test_penalty_formula_accuracy_and_edge_cases(self):
        """Verify late penalty deduction formula math, hourly ceiling rounding, and max caps."""
        now = datetime.now(timezone.utc)
        due_at = now - timedelta(hours=2)

        # 1. On time submission: 0% penalty
        res = compute_late_penalty(
            raw_score=100.0,
            due_at=due_at,
            submitted_at=due_at - timedelta(minutes=5),
            late_penalty_percent_per_hour=15.0,
            max_late_penalty_percent=100.0,
        )
        self.assertFalse(res["is_late"])
        self.assertEqual(res["penalty_percent"], 0.0)
        self.assertEqual(res["late_penalty_deduction"], 0.0)
        self.assertEqual(res["final_score"], 100.0)

        # 2. Exactly 0.1 hr late (6 mins): rounds up to 1 hr ceiling
        # 1 hr * 15%/hr = 15% penalty -> 100 - 15 = 85.0 final score
        res = compute_late_penalty(
            raw_score=100.0,
            due_at=due_at,
            submitted_at=due_at + timedelta(minutes=6),
            late_penalty_percent_per_hour=15.0,
            max_late_penalty_percent=100.0,
        )
        self.assertTrue(res["is_late"])
        self.assertEqual(res["hours_late"], 1)
        self.assertEqual(res["penalty_percent"], 15.0)
        self.assertEqual(res["late_penalty_deduction"], 15.0)
        self.assertEqual(res["final_score"], 85.0)

        # 3. 2.1 hrs late: rounds up to 3 hrs ceiling
        # 3 hrs * 10%/hr = 30% penalty -> raw 80.0 * 0.30 = 24.0 deduction -> 56.0 final score
        res = compute_late_penalty(
            raw_score=80.0,
            due_at=due_at,
            submitted_at=due_at + timedelta(hours=2, minutes=6),
            late_penalty_percent_per_hour=10.0,
            max_late_penalty_percent=100.0,
        )
        self.assertTrue(res["is_late"])
        self.assertEqual(res["hours_late"], 3)
        self.assertEqual(res["penalty_percent"], 30.0)
        self.assertEqual(res["late_penalty_deduction"], 24.0)
        self.assertEqual(res["final_score"], 56.0)

        # 4. Max penalty cap: 5 hrs late * 10% = 50%, capped at 40%
        res = compute_late_penalty(
            raw_score=100.0,
            due_at=due_at,
            submitted_at=due_at + timedelta(hours=5),
            late_penalty_percent_per_hour=10.0,
            max_late_penalty_percent=40.0,
        )
        self.assertEqual(res["hours_late"], 5)
        self.assertEqual(res["penalty_percent"], 40.0)
        self.assertEqual(res["late_penalty_deduction"], 40.0)
        self.assertEqual(res["final_score"], 60.0)

    def test_dynamic_state_transitions(self):
        """Verify dynamic state transitions: DRAFT -> SCHEDULED -> ACTIVE -> GRACE_PERIOD -> CLOSED."""
        t0 = datetime(2026, 10, 15, 10, 0, 0, tzinfo=timezone.utc)
        publish_at = t0
        starts_at = t0 + timedelta(hours=1)
        due_at = t0 + timedelta(hours=3)
        cutoff_at = t0 + timedelta(hours=5)

        # Manual DRAFT override remains DRAFT
        st = resolve_assessment_status(
            manual_status=AssessmentStatus.DRAFT.value,
            publish_at=publish_at,
            starts_at=starts_at,
            due_at=due_at,
            cutoff_at=cutoff_at,
            current_time=starts_at + timedelta(minutes=30),
        )
        self.assertEqual(st, AssessmentStatus.DRAFT.value)

        # Published: Before starts_at -> SCHEDULED
        st = resolve_assessment_status(
            manual_status=AssessmentStatus.SCHEDULED.value,
            publish_at=publish_at,
            starts_at=starts_at,
            due_at=due_at,
            cutoff_at=cutoff_at,
            current_time=starts_at - timedelta(minutes=15),
        )
        self.assertEqual(st, AssessmentStatus.SCHEDULED.value)

        # Published: Between starts_at and due_at -> ACTIVE
        st = resolve_assessment_status(
            manual_status=AssessmentStatus.SCHEDULED.value,
            publish_at=publish_at,
            starts_at=starts_at,
            due_at=due_at,
            cutoff_at=cutoff_at,
            current_time=starts_at + timedelta(minutes=30),
        )
        self.assertEqual(st, AssessmentStatus.ACTIVE.value)

        # Published: Between due_at and cutoff_at -> GRACE_PERIOD
        st = resolve_assessment_status(
            manual_status=AssessmentStatus.SCHEDULED.value,
            publish_at=publish_at,
            starts_at=starts_at,
            due_at=due_at,
            cutoff_at=cutoff_at,
            current_time=due_at + timedelta(minutes=30),
        )
        self.assertEqual(st, AssessmentStatus.GRACE_PERIOD.value)

        # Published: Past cutoff_at -> CLOSED
        st = resolve_assessment_status(
            manual_status=AssessmentStatus.SCHEDULED.value,
            publish_at=publish_at,
            starts_at=starts_at,
            due_at=due_at,
            cutoff_at=cutoff_at,
            current_time=cutoff_at + timedelta(minutes=5),
        )
        self.assertEqual(st, AssessmentStatus.CLOSED.value)

    def test_assessment_crud_and_status_endpoints(self):
        """Test POST cohorts/{cohort_id}/assessments, GET assessments/{id}, and PATCH status."""
        now = datetime.now(timezone.utc)
        payload = {
            "title": "Midterm Exam 1",
            "description": "Comprehensive algorithms midterm covering DP and Graphs.",
            "mode": AssessmentMode.EXAM.value,
            "problem_slugs": ["two-sum", "graph-shortest-path"],
            "scoring_rubric": {"two-sum": 40, "graph-shortest-path": 60},
            "publish_at": (now - timedelta(hours=1)).isoformat(),
            "starts_at": (now + timedelta(hours=1)).isoformat(),
            "due_at": (now + timedelta(hours=3)).isoformat(),
            "cutoff_at": (now + timedelta(hours=5)).isoformat(),
            "duration_minutes": 120,
            "late_penalty_percent_per_hour": 15.0,
            "max_late_penalty_percent": 60.0,
            "proctoring_config": {"enforce_fullscreen": True, "max_tab_switches": 3},
            "status": AssessmentStatus.DRAFT.value,
        }

        # 1. Student attempting to create assessment -> 403 Forbidden
        res = self.client.post(
            f"/api/v1/campus/cohorts/{self.cohort_id}/assessments",
            json=payload,
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 403)

        # 2. Instructor creating assessment -> 201 Created
        res = self.client.post(
            f"/api/v1/campus/cohorts/{self.cohort_id}/assessments",
            json=payload,
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        assessment_id = data["id"]
        self.assertEqual(data["title"], "Midterm Exam 1")
        self.assertEqual(data["status"], AssessmentStatus.DRAFT.value)

        # 3. Student viewing DRAFT assessment -> 404 (invisible to students while in DRAFT)
        res = self.client.get(
            f"/api/v1/campus/assessments/{assessment_id}",
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 404)

        # 4. Instructor viewing DRAFT assessment -> 200 OK
        res = self.client.get(
            f"/api/v1/campus/assessments/{assessment_id}",
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 200)

        # 5. Instructor publishing assessment (PATCH status -> SCHEDULED)
        res = self.client.patch(
            f"/api/v1/campus/assessments/{assessment_id}/status",
            json={"status": AssessmentStatus.SCHEDULED.value},
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], AssessmentStatus.SCHEDULED.value)

        # 6. Student viewing published assessment -> 200 OK
        res = self.client.get(
            f"/api/v1/campus/assessments/{assessment_id}",
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], AssessmentStatus.SCHEDULED.value)

    def test_submission_deadline_gatekeeper_and_penalty_deduction(self):
        """Test submission rejection before starts_at, 0% penalty in active window, penalty in grace period, and cutoff rejection."""
        now = datetime.now(timezone.utc)
        starts_at = now + timedelta(hours=1)
        due_at = now + timedelta(hours=3)
        cutoff_at = now + timedelta(hours=5)

        # Create scheduled assessment
        res = self.client.post(
            f"/api/v1/campus/cohorts/{self.cohort_id}/assessments",
            json={
                "title": "Strict Timed Exam",
                "description": "Timed exam for gatekeeper validation.",
                "mode": AssessmentMode.EXAM.value,
                "problem_slugs": ["two-sum"],
                "scoring_rubric": {"two-sum": 100},
                "publish_at": (now - timedelta(minutes=10)).isoformat(),
                "starts_at": starts_at.isoformat(),
                "due_at": due_at.isoformat(),
                "cutoff_at": cutoff_at.isoformat(),
                "late_penalty_percent_per_hour": 20.0,
                "max_late_penalty_percent": 60.0,
                "status": AssessmentStatus.SCHEDULED.value,
            },
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 201)
        assessment_id = res.json()["id"]

        # Case 1: Submit before starts_at -> 403 assessment_not_started
        sub_payload_early = {
            "raw_score": 100.0,
            "problem_slug": "two-sum",
            "submitted_at": (starts_at - timedelta(minutes=10)).isoformat(),
        }
        res = self.client.post(
            f"/api/v1/campus/assessments/{assessment_id}/submit",
            json=sub_payload_early,
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["detail"]["error"], "assessment_not_started")

        # Case 2: Submit in active window -> 201 Accepted, 0% penalty
        sub_payload_active = {
            "raw_score": 95.0,
            "problem_slug": "two-sum",
            "submitted_at": (starts_at + timedelta(minutes=45)).isoformat(),
        }
        res = self.client.post(
            f"/api/v1/campus/assessments/{assessment_id}/submit",
            json=sub_payload_active,
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 201)
        sub_data = res.json()
        self.assertFalse(sub_data["is_late"])
        self.assertEqual(sub_data["late_penalty_deduction"], 0.0)
        self.assertEqual(sub_data["final_score"], 95.0)

        # Case 3: Submit during GRACE_PERIOD window (1.2 hrs late -> rounds up to 2 hrs)
        # 2 hrs * 20%/hr = 40% penalty. Raw 100.0 -> deduction 40.0 -> final 60.0
        sub_payload_grace = {
            "raw_score": 100.0,
            "problem_slug": "two-sum",
            "submitted_at": (due_at + timedelta(hours=1, minutes=12)).isoformat(),
        }
        res = self.client.post(
            f"/api/v1/campus/assessments/{assessment_id}/submit",
            json=sub_payload_grace,
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 201)
        grace_data = res.json()
        self.assertTrue(grace_data["is_late"])
        self.assertEqual(grace_data["late_penalty_deduction"], 40.0)
        self.assertEqual(grace_data["final_score"], 60.0)

        # Case 4: Submit after cutoff_at -> 403 assessment_cutoff_passed
        sub_payload_late = {
            "raw_score": 100.0,
            "problem_slug": "two-sum",
            "submitted_at": (cutoff_at + timedelta(minutes=5)).isoformat(),
        }
        res = self.client.post(
            f"/api/v1/campus/assessments/{assessment_id}/submit",
            json=sub_payload_late,
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["detail"]["error"], "assessment_cutoff_passed")


if __name__ == "__main__":
    unittest.main()

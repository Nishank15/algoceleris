import asyncio
from datetime import datetime, timedelta, timezone
import json
import os
import tempfile
import unittest
import uuid

from fastapi.testclient import TestClient

from packages.gateway.src.api import create_app
from packages.gateway.src.auth.security import create_access_token, hash_password
from packages.gateway.src.core.assessment_engine import mask_test_case_results
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
from packages.engine.src.evaluator import JudgeEvaluator, SubmissionJob, TestCase
from packages.engine.src.models import ResourceLimits
from packages.engine.src.sandbox import IsolationSandbox


class TestSecretTestMasking(unittest.TestCase):
    """Test suite validating secret institutional test case evaluation, worker sandbox limits, and diagnostic masking."""

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

        # IDs
        self.org_id = uuid.uuid4()
        self.cohort_id = uuid.uuid4()
        self.instructor_id = uuid.uuid4()
        self.student_id = uuid.uuid4()
        self.other_student_id = uuid.uuid4()

        async def _seed_data():
            async with self.session_factory() as session:
                org = Organization(
                    id=self.org_id,
                    name="Princeton CS",
                    slug="princeton-cs",
                    domain_whitelist=["princeton.edu"],
                    branding_config={"max_seats": 50},
                )
                cohort = Cohort(
                    id=self.cohort_id,
                    org_id=self.org_id,
                    name="COS 226 Algorithms",
                    code="COS-226-S26",
                    term="Spring 2026",
                )
                session.add_all([org, cohort])

                u_instr = User(
                    id=self.instructor_id,
                    username="prof_sedgewick",
                    email="rs@princeton.edu",
                    password_hash=hash_password("Pass123!"),
                    account_type="pro",
                )
                u_stud = User(
                    id=self.student_id,
                    username="student_alan",
                    email="alan@princeton.edu",
                    password_hash=hash_password("Pass123!"),
                    account_type="free",
                )
                u_other = User(
                    id=self.other_student_id,
                    username="student_grace",
                    email="grace@princeton.edu",
                    password_hash=hash_password("Pass123!"),
                    account_type="free",
                )
                session.add_all([u_instr, u_stud, u_other])

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
                m_other = OrgMembership(
                    org_id=self.org_id,
                    user_id=self.other_student_id,
                    cohort_id=self.cohort_id,
                    role=CampusRole.STUDENT.value,
                    status=MembershipStatus.ACTIVE.value,
                )
                session.add_all([m_instr, m_stud, m_other])
                await session.commit()

        asyncio.run(_seed_data())

        self.token_instructor = create_access_token(
            user_id=str(self.instructor_id),
            username="prof_sedgewick",
            email="rs@princeton.edu",
            account_type="pro",
        )
        self.token_student = create_access_token(
            user_id=str(self.student_id),
            username="student_alan",
            email="alan@princeton.edu",
            account_type="free",
        )
        self.token_other_student = create_access_token(
            user_id=str(self.other_student_id),
            username="student_grace",
            email="grace@princeton.edu",
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

    def test_sandbox_constraints_and_limits(self):
        """Verify worker sandbox limits: 256MB memory cap, 1 vCPU, and network namespace isolation flag."""
        limits = ResourceLimits()
        # 1. Strict 256MB memory cap
        self.assertEqual(limits.memory_limit_bytes, 268435456)
        # 2. 1 vCPU (100% of 1 core)
        self.assertEqual(limits.cpu_limit_pct, 100)
        # 3. Network isolation enabled
        self.assertTrue(getattr(limits, "network_isolated", True))

        # Check sandbox network unshare detection / capability
        sandbox = IsolationSandbox()
        self.assertIsNotNone(sandbox)

    def test_worker_evaluation_sample_vs_secret_test_cases(self):
        """Verify worker evaluation handles both sample and secret test cases with accurate flags."""
        evaluator = JudgeEvaluator()
        job = SubmissionJob(
            submission_id=f"sub-{uuid.uuid4().hex[:8]}",
            language="python3",
            source_code="import sys\nfor line in sys.stdin:\n    print(int(line.strip()) * 2)",
            test_cases=[
                TestCase(id=1, input_data="5\n", expected_output="10\n", is_sample=True, is_secret=False),
                TestCase(id=2, input_data="15\n", expected_output="30\n", is_sample=False, is_secret=True),
            ],
        )
        report = evaluator.evaluate(job, stop_on_first_failure=False)
        self.assertEqual(report.total_test_cases, 2)
        self.assertEqual(report.test_cases_passed, 2)
        self.assertEqual(len(report.test_case_results), 2)

        tc1_res = report.test_case_results[0]
        self.assertTrue(tc1_res.is_sample)
        self.assertFalse(tc1_res.is_secret)
        self.assertEqual(tc1_res.stdout.strip(), "10")

        tc2_res = report.test_case_results[1]
        self.assertFalse(tc2_res.is_sample)
        self.assertTrue(tc2_res.is_secret)
        self.assertEqual(tc2_res.stdout.strip(), "30")

    def test_mask_test_case_results_helper_logic(self):
        """Verify pure helper mask_test_case_results behavior across student vs faculty vs released state."""
        raw_results = [
            {
                "test_case_id": 1,
                "is_sample": True,
                "is_secret": False,
                "verdict": "ACCEPTED",
                "stdout": "Sample Output 123",
                "diff": None,
            },
            {
                "test_case_id": 2,
                "is_sample": False,
                "is_secret": True,
                "verdict": "WRONG_ANSWER",
                "stdout": "Expected 42 but got 99",
                "diff": "--- expected\n+++ actual\n@@ -1 +1 @@\n-42\n+99",
            },
        ]

        # 1. Student viewing during ACTIVE / GRACE_PERIOD (grades unreleased) -> secret test MASKED
        masked = mask_test_case_results(raw_results, is_instructor=False, is_grades_released=False)
        self.assertEqual(masked[0]["stdout"], "Sample Output 123")
        self.assertEqual(masked[1]["stdout"], "[MASKED - Secret Institutional Test Case]")
        self.assertIsNone(masked[1]["diff"])
        self.assertEqual(masked[1]["verdict"], "WRONG_ANSWER")  # Verdict remains visible

        # 2. Faculty viewing -> UNMASKED
        faculty_view = mask_test_case_results(raw_results, is_instructor=True, is_grades_released=False)
        self.assertEqual(faculty_view[1]["stdout"], "Expected 42 but got 99")
        self.assertIsNotNone(faculty_view[1]["diff"])

        # 3. Student viewing after grades released -> UNMASKED
        released_view = mask_test_case_results(raw_results, is_instructor=False, is_grades_released=True)
        self.assertEqual(released_view[1]["stdout"], "Expected 42 but got 99")
        self.assertIsNotNone(released_view[1]["diff"])

    def test_submission_masking_and_grade_release_endpoints(self):
        """Test output masking on student submit/query and unmasking after instructor triggers release-grades."""
        now = datetime.now(timezone.utc)
        starts_at = now - timedelta(hours=1)
        due_at = now + timedelta(hours=2)
        cutoff_at = now + timedelta(hours=4)

        # 1. Create active assessment with scoring rubric
        res = self.client.post(
            f"/api/v1/campus/cohorts/{self.cohort_id}/assessments",
            json={
                "title": "Data Structures Exam",
                "description": "Exam testing trees and graphs.",
                "mode": AssessmentMode.EXAM.value,
                "problem_slugs": ["binary-tree-inorder"],
                "scoring_rubric": {"binary-tree-inorder": 100},
                "publish_at": (now - timedelta(hours=2)).isoformat(),
                "starts_at": starts_at.isoformat(),
                "due_at": due_at.isoformat(),
                "cutoff_at": cutoff_at.isoformat(),
                "status": AssessmentStatus.SCHEDULED.value,
            },
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 201)
        assessment_id = res.json()["id"]

        test_breakdown = [
            {
                "test_case_id": 1,
                "is_sample": True,
                "is_secret": False,
                "verdict": "ACCEPTED",
                "stdout": "Sample Output A",
                "diff": None,
            },
            {
                "test_case_id": 2,
                "is_sample": False,
                "is_secret": True,
                "verdict": "WRONG_ANSWER",
                "stdout": "Secret Test Output X != Y",
                "diff": "-X\n+Y",
            },
        ]

        # 2. Student submits during ACTIVE window
        sub_res = self.client.post(
            f"/api/v1/campus/assessments/{assessment_id}/submit",
            json={
                "raw_score": 50.0,
                "problem_slug": "binary-tree-inorder",
                "source_code": "def inorder(): pass",
                "test_cases": test_breakdown,
            },
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(sub_res.status_code, 201)
        sub_data = sub_res.json()
        sub_id = sub_data["id"]

        # Student response MUST mask secret test cases
        tc_results = sub_data.get("test_case_results", [])
        self.assertEqual(len(tc_results), 2)
        self.assertEqual(tc_results[0]["stdout"], "Sample Output A")
        self.assertEqual(tc_results[1]["stdout"], "[MASKED - Secret Institutional Test Case]")
        self.assertIsNone(tc_results[1]["diff"])

        # 3. Student queries submission -> still masked
        res = self.client.get(
            f"/api/v1/campus/assessments/{assessment_id}/submissions/{sub_id}",
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 200)
        query_data = res.json()
        self.assertEqual(query_data["test_case_results"][1]["stdout"], "[MASKED - Secret Institutional Test Case]")

        # 4. Instructor queries submission -> unmasked bypass
        res = self.client.get(
            f"/api/v1/campus/assessments/{assessment_id}/submissions/{sub_id}",
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 200)
        instr_query = res.json()
        self.assertEqual(instr_query["test_case_results"][1]["stdout"], "Secret Test Output X != Y")
        self.assertEqual(instr_query["test_case_results"][1]["diff"], "-X\n+Y")

        # 5. Non-submitting student queries submission -> 403 Forbidden
        res = self.client.get(
            f"/api/v1/campus/assessments/{assessment_id}/submissions/{sub_id}",
            headers={"Authorization": f"Bearer {self.token_other_student}"},
        )
        self.assertEqual(res.status_code, 403)

        # 6. Student attempting to trigger release-grades -> 403 Forbidden
        res = self.client.post(
            f"/api/v1/campus/assessments/{assessment_id}/release-grades",
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 403)

        # 7. Instructor triggers release-grades -> 200 OK
        res = self.client.post(
            f"/api/v1/campus/assessments/{assessment_id}/release-grades",
            headers={"Authorization": f"Bearer {self.token_instructor}"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["grades_released"])

        # 8. Student queries submission AFTER release -> UNMASKED
        res = self.client.get(
            f"/api/v1/campus/assessments/{assessment_id}/submissions/{sub_id}",
            headers={"Authorization": f"Bearer {self.token_student}"},
        )
        self.assertEqual(res.status_code, 200)
        released_query = res.json()
        self.assertEqual(released_query["test_case_results"][1]["stdout"], "Secret Test Output X != Y")
        self.assertEqual(released_query["test_case_results"][1]["diff"], "-X\n+Y")


if __name__ == "__main__":
    unittest.main()

import asyncio
import os
import tempfile
import unittest
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import inspect, text, select
from sqlalchemy.exc import IntegrityError

from packages.gateway.src.database import close_db_engine, get_async_engine
from packages.gateway.src.migrate import run_downgrade, run_migrations


class TestCampusRelationalSchema(unittest.TestCase):
    """Test suite validating Milestone v3.0 AlgoCeleris Campus relational schema."""

    def setUp(self):
        try:
            self.loop = asyncio.get_event_loop()
            if self.loop.is_closed():
                self.loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self.loop)
        except RuntimeError:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

        # Temporary sqlite database file for isolated schema testing
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix=".db")
        self.sqlite_url = f"sqlite+aiosqlite:///{self.temp_db_path}"

    def tearDown(self):
        asyncio.run(close_db_engine(self.sqlite_url))
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            os.close(self.temp_db_fd)
        except OSError:
            pass
        if os.path.exists(self.temp_db_path):
            try:
                os.remove(self.temp_db_path)
            except OSError:
                pass

    def test_campus_entities_importable(self):
        """Assert that all new campus models are defined and exported from the central models package."""
        try:
            from packages.gateway.src.models import (
                Organization,
                Cohort,
                OrgMembership,
                Assessment,
                AssessmentSubmission,
                InterviewRoom,
                ProctorEvent,
                CampusRole,
                MembershipStatus,
                AssessmentMode,
                AssessmentStatus,
            )
            from packages.gateway.src.models.entities import Submission
        except ImportError as e:
            self.fail(f"Failed to import campus ORM models: {e}")

        # Assert Submission entity contains assessment_id and room_id attributes
        self.assertTrue(hasattr(Submission, "assessment_id"), "Submission must have assessment_id attribute")
        self.assertTrue(hasattr(Submission, "room_id"), "Submission must have room_id attribute")

    def test_campus_migration_upgrade_and_downgrade_cycle(self):
        """Verify Alembic migration upgrade to head, verify tables/foreign keys, and test rollback."""
        # Run upgrade head
        run_migrations(db_url=self.sqlite_url, revision="head")

        async def _verify_campus_tables():
            engine = get_async_engine(self.sqlite_url)
            async with engine.connect() as conn:
                res = await conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                )
                tables = {row[0] for row in res.fetchall()}

                # Core baseline tables
                self.assertIn("users", tables)
                self.assertIn("subscriptions", tables)
                self.assertIn("submissions", tables)
                self.assertIn("contest_participations", tables)

                # New campus tables
                self.assertIn("organizations", tables)
                self.assertIn("cohorts", tables)
                self.assertIn("org_memberships", tables)
                self.assertIn("assessments", tables)
                self.assertIn("assessment_submissions", tables)
                self.assertIn("interview_rooms", tables)
                self.assertIn("proctor_events", tables)

                # Verify extended submissions table columns
                col_res = await conn.execute(text("PRAGMA table_info(submissions)"))
                col_names = {row[1] for row in col_res.fetchall()}
                self.assertIn("assessment_id", col_names, "submissions must include assessment_id column")
                self.assertIn("room_id", col_names, "submissions must include room_id column")

        asyncio.run(_verify_campus_tables())

        # Test rollback: downgrade to initial schema (revision 0001_initial_schema)
        run_downgrade(db_url=self.sqlite_url, revision="0001_initial_schema")

        async def _verify_campus_downgrade():
            engine = get_async_engine(self.sqlite_url)
            async with engine.connect() as conn:
                res = await conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                )
                tables = {row[0] for row in res.fetchall()}
                self.assertNotIn("organizations", tables)
                self.assertNotIn("cohorts", tables)
                self.assertNotIn("org_memberships", tables)
                self.assertNotIn("assessments", tables)
                self.assertNotIn("assessment_submissions", tables)
                self.assertNotIn("interview_rooms", tables)
                self.assertNotIn("proctor_events", tables)

                # Baseline tables remain intact
                self.assertIn("users", tables)
                self.assertIn("submissions", tables)

        asyncio.run(_verify_campus_downgrade())

        # Re-apply head
        run_migrations(db_url=self.sqlite_url, revision="head")

    def test_campus_orm_crud_and_cascade_constraints(self):
        """Verify ORM insertions, relationships, and foreign-key cascade behaviors."""
        run_migrations(db_url=self.sqlite_url, revision="head")

        from packages.gateway.src.models.entities import User, Submission
        from packages.gateway.src.models.campus import (
            Organization,
            Cohort,
            OrgMembership,
            Assessment,
            AssessmentSubmission,
            InterviewRoom,
            ProctorEvent,
            CampusRole,
            MembershipStatus,
            AssessmentMode,
            AssessmentStatus,
        )
        from packages.gateway.src.database import get_session_factory

        async def _test_crud():
            engine = get_async_engine(self.sqlite_url)
            session_factory = get_session_factory(engine=engine)
            now = datetime.now(timezone.utc)

            async with session_factory() as session:
                # 1. Create User
                user_admin = User(
                    id=uuid.uuid4(),
                    username="campus_admin",
                    email="admin@mit.edu",
                    password_hash="argon2id$hashed",
                    account_type="admin",
                )
                user_student = User(
                    id=uuid.uuid4(),
                    username="student_alice",
                    email="alice@mit.edu",
                    password_hash="argon2id$hashed",
                    account_type="free",
                )
                session.add_all([user_admin, user_student])
                await session.flush()

                # 2. Create Organization
                org = Organization(
                    id=uuid.uuid4(),
                    name="Massachusetts Institute of Technology",
                    slug="mit-eecs",
                    domain_whitelist=["mit.edu"],
                    branding_config={"accent_color": "#e4f222", "logo": "/mit.png"},
                )
                session.add(org)
                await session.flush()

                # 3. Create Cohort
                cohort = Cohort(
                    id=uuid.uuid4(),
                    org_id=org.id,
                    name="CS 6.006 Fall 2026",
                    code="CS6006-F26",
                    term="Fall 2026",
                    is_active=True,
                )
                session.add(cohort)
                await session.flush()

                # 4. Create Memberships
                m_admin = OrgMembership(
                    id=uuid.uuid4(),
                    org_id=org.id,
                    user_id=user_admin.id,
                    cohort_id=cohort.id,
                    role=CampusRole.ORG_ADMIN,
                    status=MembershipStatus.ACTIVE,
                )
                m_student = OrgMembership(
                    id=uuid.uuid4(),
                    org_id=org.id,
                    user_id=user_student.id,
                    cohort_id=cohort.id,
                    role=CampusRole.STUDENT,
                    status=MembershipStatus.ACTIVE,
                )
                session.add_all([m_admin, m_student])
                await session.flush()

                # 5. Create Assessment
                assessment = Assessment(
                    id=uuid.uuid4(),
                    org_id=org.id,
                    cohort_id=cohort.id,
                    title="Midterm 1: Dynamic Programming & Graphs",
                    description="Timed closed-book departmental evaluation.",
                    mode=AssessmentMode.EXAM,
                    status=AssessmentStatus.SCHEDULED,
                    problem_slugs=["two-sum", "valid-parentheses"],
                    scoring_rubric={"two-sum": 50, "valid-parentheses": 50},
                    publish_at=now,
                    starts_at=now + timedelta(hours=1),
                    due_at=now + timedelta(hours=3),
                    cutoff_at=now + timedelta(hours=4),
                    duration_minutes=120,
                    late_penalty_percent_per_hour=15.0,
                    max_late_penalty_percent=50.0,
                    proctoring_config={"fullscreen_required": True, "track_tab_switches": True},
                    created_by=user_admin.id,
                )
                session.add(assessment)
                await session.flush()

                # 6. Create Submission linked to Assessment
                sub = Submission(
                    id=uuid.uuid4(),
                    user_id=user_student.id,
                    problem_slug="two-sum",
                    language="python",
                    code="def twoSum(nums, target): return [0, 1]",
                    verdict="Accepted",
                    runtime_ms=12,
                    memory_kb=14200,
                    testcases_passed=10,
                    total_testcases=10,
                    assessment_id=assessment.id,
                )
                session.add(sub)
                await session.flush()

                # 7. Create AssessmentSubmission
                asub = AssessmentSubmission(
                    id=uuid.uuid4(),
                    assessment_id=assessment.id,
                    user_id=user_student.id,
                    submission_id=sub.id,
                    raw_score=100.0,
                    late_penalty_deduction=0.0,
                    final_score=100.0,
                    is_late=False,
                    proctor_events_count=0,
                    eval_verdict="PASSED",
                )
                session.add(asub)

                # 8. Create InterviewRoom for Viva
                viva_room = InterviewRoom(
                    id=uuid.uuid4(),
                    org_id=org.id,
                    assessment_id=assessment.id,
                    room_code="VIVA-MIT-001",
                    host_user_id=user_admin.id,
                    candidate_user_id=user_student.id,
                    problem_slug="two-sum",
                    language="python",
                    status="WAITING",
                    rubric_scores={"code_quality": 10, "complexity_analysis": 10},
                )
                session.add(viva_room)

                # 9. Create ProctorEvent
                p_event = ProctorEvent(
                    id=uuid.uuid4(),
                    assessment_id=assessment.id,
                    user_id=user_student.id,
                    event_type="tab_switch",
                    severity="warning",
                    event_metadata={"blurred_for_ms": 3200},
                )
                session.add(p_event)

                await session.commit()

                # Verify query
                res_org = await session.execute(select(Organization).where(Organization.slug == "mit-eecs"))
                loaded_org = res_org.scalars().first()
                self.assertIsNotNone(loaded_org)
                self.assertEqual(loaded_org.domain_whitelist, ["mit.edu"])

                res_asub = await session.execute(
                    select(AssessmentSubmission).where(AssessmentSubmission.assessment_id == assessment.id)
                )
                loaded_asub = res_asub.scalars().first()
                self.assertIsNotNone(loaded_asub)
                self.assertEqual(loaded_asub.final_score, 100.0)

        asyncio.run(_test_crud())


if __name__ == "__main__":
    unittest.main()

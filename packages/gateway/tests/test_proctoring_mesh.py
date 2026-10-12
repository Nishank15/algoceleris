import asyncio
from datetime import datetime, timedelta, timezone
import json
import os
import tempfile
import threading
import unittest
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from packages.gateway.src.api import create_app
from packages.gateway.src.auth.security import create_access_token, hash_password
from packages.gateway.src.core.proctoring_mesh import (
    calculate_proctor_risk_score,
    get_proctoring_mesh_store,
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
    CampusRole,
    Cohort,
    MembershipStatus,
    OrgMembership,
    Organization,
    ProctorEvent,
    User,
)
from packages.gateway.src.queue import InMemoryQueueBroker


class TestCampusProctoringMesh(unittest.TestCase):
    """Test suite validating real-time proctoring telemetry WebSocket mesh, risk score aggregation, and Redis Pub/Sub relay."""

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
        self.other_user_id = uuid.uuid4()
        self.assessment_id = uuid.uuid4()

        now = datetime.now(timezone.utc)
        self.now = now

        async def _seed_data():
            async with self.session_factory() as session:
                org = Organization(
                    id=self.org_id,
                    name="Stanford CS",
                    slug="stanford-cs",
                    domain_whitelist=["stanford.edu"],
                    branding_config={"max_seats": 100},
                )
                cohort = Cohort(
                    id=self.cohort_id,
                    org_id=self.org_id,
                    name="CS 106B Programming Abstractions",
                    code="CS-106B-S26",
                    term="Spring 2026",
                )
                session.add_all([org, cohort])

                u_instr = User(
                    id=self.instructor_id,
                    username="prof_zelenski",
                    email="zelenski@stanford.edu",
                    password_hash=hash_password("Pass123!"),
                    account_type="pro",
                )
                u_stud = User(
                    id=self.student_id,
                    username="student_maya",
                    email="maya@stanford.edu",
                    password_hash=hash_password("Pass123!"),
                    account_type="free",
                )
                u_other = User(
                    id=self.other_user_id,
                    username="outsider_bob",
                    email="bob@outsider.org",
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
                session.add_all([m_instr, m_stud])

                assessment = Assessment(
                    id=self.assessment_id,
                    org_id=self.org_id,
                    cohort_id=self.cohort_id,
                    title="Midterm Examination",
                    description="Recursive backtracking and pointer manipulation.",
                    mode=AssessmentMode.EXAM.value,
                    problem_slugs=["boggle-solver"],
                    scoring_rubric={"boggle-solver": 100},
                    publish_at=now - timedelta(hours=2),
                    starts_at=now - timedelta(hours=1),
                    due_at=now + timedelta(hours=2),
                    cutoff_at=now + timedelta(hours=3),
                    status=AssessmentStatus.ACTIVE.value,
                    created_by=self.instructor_id,
                )
                session.add(assessment)
                await session.commit()

        asyncio.run(_seed_data())

        self.token_instructor = create_access_token(
            user_id=str(self.instructor_id),
            username="prof_zelenski",
            email="zelenski@stanford.edu",
            account_type="pro",
        )
        self.token_student = create_access_token(
            user_id=str(self.student_id),
            username="student_maya",
            email="maya@stanford.edu",
            account_type="free",
        )
        self.token_other = create_access_token(
            user_id=str(self.other_user_id),
            username="outsider_bob",
            email="bob@outsider.org",
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

    def test_risk_score_calculation_invariant(self):
        """Assert anomaly risk score invariant: RiskScore = (TabSwitches * 5) + (FullscreenExits * 10) + (PasteBursts * 15)."""
        self.assertEqual(calculate_proctor_risk_score(0, 0, 0), 0)
        self.assertEqual(calculate_proctor_risk_score(tab_switches=3, fullscreen_exits=0, paste_bursts=0), 15)
        self.assertEqual(calculate_proctor_risk_score(tab_switches=0, fullscreen_exits=2, paste_bursts=0), 20)
        self.assertEqual(calculate_proctor_risk_score(tab_switches=0, fullscreen_exits=0, paste_bursts=2), 30)

        # Composite verification
        # 4 tab switches (20) + 2 fullscreen exits (20) + 1 paste burst (15) = 55
        score = calculate_proctor_risk_score(tab_switches=4, fullscreen_exits=2, paste_bursts=1)
        self.assertEqual(score, 55)

    def test_unauthorized_websocket_connection_rejected(self):
        """Verify unauthenticated or unauthorized users are rejected on proctoring WebSocket."""
        # 1. No token provided
        with self.assertRaises(Exception):
            with self.client.websocket_connect(f"/ws/campus/assessments/{self.assessment_id}/proctor") as ws:
                ws.receive_json()

        # 2. Invalid token
        with self.assertRaises(Exception):
            with self.client.websocket_connect(f"/ws/campus/assessments/{self.assessment_id}/proctor?token=invalid_jwt") as ws:
                ws.receive_json()

        # 3. User with no membership in the assessment's organization
        with self.assertRaises(Exception):
            with self.client.websocket_connect(f"/ws/campus/assessments/{self.assessment_id}/proctor?token={self.token_other}") as ws:
                ws.receive_json()

    def test_student_telemetry_ingestion_and_risk_score_update(self):
        """Verify student telemetry ingestion, risk score calculation, and DB anomaly persistence."""
        with self.client.websocket_connect(f"/ws/campus/assessments/{self.assessment_id}/proctor?token={self.token_student}") as ws:
            # Welcome handshake frame
            welcome = ws.receive_json()
            self.assertEqual(welcome["event_type"], "connected")
            self.assertEqual(welcome["role"], "student")
            self.assertEqual(welcome["risk_score"], 0)

            # 1. Send heartbeat -> risk score unchanged (0), no anomaly in DB
            ws.send_json({
                "event_type": "heartbeat",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": {"in_focus": True},
            })
            ack1 = ws.receive_json()
            self.assertEqual(ack1["event_type"], "ack")
            self.assertEqual(ack1["risk_score"], 0)

            # 2. Send tab_switch -> risk score = 5
            ws.send_json({
                "event_type": "tab_switch",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": {"visibility": "hidden"},
            })
            ack2 = ws.receive_json()
            self.assertEqual(ack2["event_type"], "ack")
            self.assertEqual(ack2["risk_score"], 5)

            # 3. Send fullscreen_exit -> risk score = 5 + 10 = 15
            ws.send_json({
                "event_type": "fullscreen_exit",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": {"fullscreen": False},
            })
            ack3 = ws.receive_json()
            self.assertEqual(ack3["event_type"], "ack")
            self.assertEqual(ack3["risk_score"], 15)

            # 4. Send paste_burst -> risk score = 15 + 15 = 30
            ws.send_json({
                "event_type": "paste_burst",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": {"char_count": 140, "duration_ms": 50},
            })
            ack4 = ws.receive_json()
            self.assertEqual(ack4["event_type"], "ack")
            self.assertEqual(ack4["risk_score"], 30)

        # 5. Verify Redis hash tracking for active students
        mesh_store = get_proctoring_mesh_store()
        student_state = mesh_store.get_student_state(self.assessment_id, self.student_id)
        self.assertIsNotNone(student_state)
        self.assertEqual(student_state["risk_score"], 30)
        self.assertEqual(student_state["tab_switches"], 1)
        self.assertEqual(student_state["fullscreen_exits"], 1)
        self.assertEqual(student_state["paste_bursts"], 1)

        # 6. Verify persistence of warning and critical anomalies in proctor_events table
        async def _check_db_events():
            async with self.session_factory() as session:
                stmt = select(ProctorEvent).where(
                    ProctorEvent.assessment_id == self.assessment_id,
                    ProctorEvent.user_id == self.student_id,
                ).order_by(ProctorEvent.created_at)
                events = (await session.execute(stmt)).scalars().all()
                return events

        events = asyncio.run(_check_db_events())
        # Heartbeat is not an anomaly; 3 anomalies must be recorded
        self.assertEqual(len(events), 3)
        ev_types = [e.event_type for e in events]
        self.assertIn("tab_switch", ev_types)
        self.assertIn("fullscreen_exit", ev_types)
        self.assertIn("paste_burst", ev_types)

        severities = {e.event_type: e.severity for e in events}
        self.assertEqual(severities["tab_switch"], "warning")
        self.assertEqual(severities["fullscreen_exit"], "warning")
        self.assertEqual(severities["paste_burst"], "critical")

    def test_dual_gateway_redis_pubsub_relay(self):
        """Assert events published on Gateway 1 are relayed to instructor subscribers on Gateway 2 across Redis channel."""
        # Setup dual gateways sharing the broker
        app1 = self.app  # Gateway 1
        app2 = create_app(broker=self.broker)  # Gateway 2
        app2.dependency_overrides[get_db] = self.app.dependency_overrides[get_db]

        client1 = TestClient(app1)
        client2 = TestClient(app2)

        instructor_received_events = []
        instructor_ready = threading.Event()
        done_listening = threading.Event()

        def _instructor_worker():
            try:
                with client2.websocket_connect(f"/ws/campus/assessments/{self.assessment_id}/proctor?token={self.token_instructor}") as ws_instr:
                    # Initial snapshot
                    snapshot = ws_instr.receive_json()
                    self.assertEqual(snapshot["event_type"], "active_students_snapshot")
                    instructor_ready.set()

                    # Wait for relayed events from Gateway 1
                    while True:
                        msg = ws_instr.receive_json()
                        instructor_received_events.append(msg)
                        if msg.get("event_type") == "tab_switch":
                            done_listening.set()
                            break
            except Exception as e:
                instructor_ready.set()
                done_listening.set()

        t_instr = threading.Thread(target=_instructor_worker, daemon=True)
        t_instr.start()

        # Wait for instructor to subscribe
        self.assertTrue(instructor_ready.wait(timeout=2.0))

        # Student connects to Gateway 1 and emits an anomaly event
        with client1.websocket_connect(f"/ws/campus/assessments/{self.assessment_id}/proctor?token={self.token_student}") as ws_stud:
            _ = ws_stud.receive_json()  # welcome
            ws_stud.send_json({
                "event_type": "tab_switch",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": {"reason": "switched_to_browser"},
            })
            ack = ws_stud.receive_json()
            self.assertEqual(ack["risk_score"], 5)

        self.assertTrue(done_listening.wait(timeout=3.0))
        t_instr.join(timeout=2.0)

        # Assert instructor on Gateway 2 received the relayed events
        event_types = [ev["event_type"] for ev in instructor_received_events]
        self.assertIn("student_connected", event_types)
        self.assertIn("tab_switch", event_types)

        relayed = next(ev for ev in instructor_received_events if ev["event_type"] == "tab_switch")
        self.assertEqual(relayed["event_type"], "tab_switch")
        self.assertEqual(relayed["user_id"], str(self.student_id))
        self.assertEqual(relayed["risk_score"], 5)
        self.assertEqual(relayed["severity"], "warning")
        self.assertEqual(relayed["assessment_id"], str(self.assessment_id))


if __name__ == "__main__":
    unittest.main()

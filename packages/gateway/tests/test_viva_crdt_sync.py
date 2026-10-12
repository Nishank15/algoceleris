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
    InterviewRoom,
    MembershipStatus,
    OrgMembership,
    Organization,
    User,
)
from packages.gateway.src.queue import InMemoryQueueBroker


class TestVivaCRDTSync(unittest.TestCase):
    """Test suite validating multiplayer Viva CRDT synchronization, live cursor awareness, and private rubric masking."""

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
        self.host_id = uuid.uuid4()
        self.candidate_id = uuid.uuid4()
        self.outsider_id = uuid.uuid4()
        self.assessment_id = uuid.uuid4()
        self.room_code = f"viva-{uuid.uuid4().hex[:8]}"

        now = datetime.now(timezone.utc)
        self.now = now

        async def _seed_data():
            async with self.session_factory() as session:
                org = Organization(
                    id=self.org_id,
                    name="MIT EECS",
                    slug="mit-eecs",
                    domain_whitelist=["mit.edu"],
                    branding_config={"max_seats": 200},
                )
                cohort = Cohort(
                    id=self.cohort_id,
                    org_id=self.org_id,
                    name="6.006 Introduction to Algorithms",
                    code="6-006-S26",
                    term="Spring 2026",
                )
                session.add_all([org, cohort])

                u_host = User(
                    id=self.host_id,
                    username="prof_demaine",
                    email="edemaine@mit.edu",
                    password_hash=hash_password("Pass123!"),
                    account_type="pro",
                )
                u_cand = User(
                    id=self.candidate_id,
                    username="student_turing",
                    email="aturing@mit.edu",
                    password_hash=hash_password("Pass123!"),
                    account_type="free",
                )
                u_out = User(
                    id=self.outsider_id,
                    username="outsider_eve",
                    email="eve@outsider.org",
                    password_hash=hash_password("Pass123!"),
                    account_type="free",
                )
                session.add_all([u_host, u_cand, u_out])

                m_host = OrgMembership(
                    org_id=self.org_id,
                    user_id=self.host_id,
                    cohort_id=self.cohort_id,
                    role=CampusRole.INSTRUCTOR.value,
                    status=MembershipStatus.ACTIVE.value,
                )
                m_cand = OrgMembership(
                    org_id=self.org_id,
                    user_id=self.candidate_id,
                    cohort_id=self.cohort_id,
                    role=CampusRole.STUDENT.value,
                    status=MembershipStatus.ACTIVE.value,
                )
                session.add_all([m_host, m_cand])

                assessment = Assessment(
                    id=self.assessment_id,
                    org_id=self.org_id,
                    cohort_id=self.cohort_id,
                    title="Live Viva Examination",
                    description="Oral and coding viva on dynamic programming and graph algorithms.",
                    mode=AssessmentMode.VIVA.value,
                    problem_slugs=["bellman-ford-shortest-path"],
                    scoring_rubric={"correctness": 50, "complexity_analysis": 30, "clarity": 20},
                    publish_at=now - timedelta(hours=2),
                    starts_at=now - timedelta(hours=1),
                    due_at=now + timedelta(hours=3),
                    cutoff_at=now + timedelta(hours=4),
                    status=AssessmentStatus.ACTIVE.value,
                    created_by=self.host_id,
                )
                session.add(assessment)

                room = InterviewRoom(
                    id=uuid.uuid4(),
                    org_id=self.org_id,
                    assessment_id=self.assessment_id,
                    room_code=self.room_code,
                    host_user_id=self.host_id,
                    candidate_user_id=self.candidate_id,
                    problem_slug="bellman-ford-shortest-path",
                    language="python",
                    status="WAITING",
                    editor_code="# Write your solution here\n",
                    interviewer_notes="Initial baseline notes",
                    rubric_scores={"clarity": 15},
                )
                session.add(room)
                await session.commit()

        asyncio.run(_seed_data())

        self.token_host = create_access_token(
            user_id=str(self.host_id),
            username="prof_demaine",
            email="edemaine@mit.edu",
            account_type="pro",
        )
        self.token_candidate = create_access_token(
            user_id=str(self.candidate_id),
            username="student_turing",
            email="aturing@mit.edu",
            account_type="free",
        )
        self.token_outsider = create_access_token(
            user_id=str(self.outsider_id),
            username="outsider_eve",
            email="eve@outsider.org",
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

    def test_unauthorized_viva_websocket_access(self):
        """Verify unauthenticated users or users unaffiliated with the viva room are rejected."""
        # 1. Missing token
        with self.assertRaises(Exception):
            with self.client.websocket_connect(f"/ws/campus/viva/{self.room_code}") as ws:
                ws.receive_json()

        # 2. Invalid token
        with self.assertRaises(Exception):
            with self.client.websocket_connect(f"/ws/campus/viva/{self.room_code}?token=bad_token") as ws:
                ws.receive_json()

        # 3. Outsider token (neither host nor candidate)
        with self.assertRaises(Exception):
            with self.client.websocket_connect(f"/ws/campus/viva/{self.room_code}?token={self.token_outsider}") as ws:
                ws.receive_json()

    def test_viva_websocket_handshake_and_awareness_exchange(self):
        """Verify host and candidate WebSocket connection handshake and cursor awareness exchange."""
        host_received = []
        host_ready = threading.Event()
        done = threading.Event()

        def _host_worker():
            try:
                with self.client.websocket_connect(f"/ws/campus/viva/{self.room_code}?token={self.token_host}") as ws_h:
                    welcome = ws_h.receive_json()
                    self.assertEqual(welcome["event_type"], "connected")
                    self.assertEqual(welcome["role"], "host")
                    self.assertEqual(welcome["room_code"], self.room_code)
                    host_ready.set()

                    while True:
                        msg = ws_h.receive_json()
                        host_received.append(msg)
                        if msg.get("event_type") == "awareness":
                            done.set()
                            break
            except Exception:
                host_ready.set()
                done.set()

        t_host = threading.Thread(target=_host_worker, daemon=True)
        t_host.start()

        self.assertTrue(host_ready.wait(timeout=2.0))

        # Candidate connects and sends cursor awareness update
        with self.client.websocket_connect(f"/ws/campus/viva/{self.room_code}?token={self.token_candidate}") as ws_c:
            welcome_c = ws_c.receive_json()
            self.assertEqual(welcome_c["event_type"], "connected")
            self.assertEqual(welcome_c["role"], "candidate")

            # Candidate broadcasts awareness cursor position
            ws_c.send_json({
                "type": "awareness",
                "cursor": {"line": 15, "column": 8},
                "selection": {"start": 12, "end": 20},
                "color": "#00ffcc",
            })

        self.assertTrue(done.wait(timeout=3.0))
        t_host.join(timeout=2.0)

        # Host received candidate awareness envelope
        awareness_events = [ev for ev in host_received if ev.get("event_type") == "awareness"]
        self.assertGreaterEqual(len(awareness_events), 1)
        aw = awareness_events[0]
        self.assertEqual(aw["user_id"], str(self.candidate_id))
        self.assertEqual(aw["cursor"]["line"], 15)
        self.assertEqual(aw["cursor"]["column"], 8)
        self.assertEqual(aw["color"], "#00ffcc")

    def test_dual_gateway_crdt_sync_and_editor_persistence(self):
        """Verify cross-gateway Pub/Sub relay of CRDT updates and editor code persistence in database."""
        app1 = self.app
        app2 = create_app(broker=self.broker)
        app2.dependency_overrides[get_db] = self.app.dependency_overrides[get_db]

        client1 = TestClient(app1)
        client2 = TestClient(app2)

        host_received_events = []
        host_ready = threading.Event()
        done = threading.Event()

        def _host_worker():
            try:
                with client1.websocket_connect(f"/ws/campus/viva/{self.room_code}?token={self.token_host}") as ws_h:
                    _ = ws_h.receive_json()  # welcome
                    host_ready.set()

                    while True:
                        msg = ws_h.receive_json()
                        host_received_events.append(msg)
                        if msg.get("event_type") == "code_snapshot":
                            done.set()
                            break
            except Exception:
                host_ready.set()
                done.set()

        t_host = threading.Thread(target=_host_worker, daemon=True)
        t_host.start()

        self.assertTrue(host_ready.wait(timeout=2.0))

        # Candidate connects on Gateway 2 and sends editor snapshot update
        updated_code = "def bellman_ford(graph, src):\n    dist = {v: float('inf') for v in graph}\n    dist[src] = 0\n    return dist\n"
        with client2.websocket_connect(f"/ws/campus/viva/{self.room_code}?token={self.token_candidate}") as ws_c:
            _ = ws_c.receive_json()  # welcome

            ws_c.send_json({
                "type": "code_snapshot",
                "code": updated_code,
                "status": "IN_PROGRESS",
            })
            ack = ws_c.receive_json()
            self.assertEqual(ack["event_type"], "ack")

        self.assertTrue(done.wait(timeout=3.0))
        t_host.join(timeout=2.0)

        # Host on Gateway 1 received the snapshot relayed over campus:viva:{room_code}:events
        snapshots = [ev for ev in host_received_events if ev.get("event_type") == "code_snapshot"]
        self.assertGreaterEqual(len(snapshots), 1)
        snap = snapshots[0]
        self.assertEqual(snap["code"], updated_code)
        self.assertEqual(snap["status"], "IN_PROGRESS")

        # Database record must be persisted
        async def _check_db():
            async with self.session_factory() as session:
                stmt = select(InterviewRoom).where(InterviewRoom.room_code == self.room_code)
                res = await session.execute(stmt)
                return res.scalars().first()

        room_in_db = asyncio.run(_check_db())
        self.assertIsNotNone(room_in_db)
        self.assertEqual(room_in_db.editor_code, updated_code)
        self.assertEqual(room_in_db.status, "IN_PROGRESS")

    def test_viva_room_provisioning_and_private_rubric_masking(self):
        """Verify provisioning REST endpoint, instructor rubric updates, and candidate diagnostic masking."""
        # 1. Provision a new viva room via instructor endpoint
        res = self.client.post(
            f"/api/v1/campus/assessments/{self.assessment_id}/viva/provision",
            json={
                "candidate_user_id": str(self.candidate_id),
                "problem_slug": "bellman-ford-shortest-path",
                "language": "python",
                "initial_code": "def solve(): pass\n",
            },
            headers={"Authorization": f"Bearer {self.token_host}"},
        )
        self.assertEqual(res.status_code, 201)
        provisioned = res.json()
        new_room_code = provisioned["room_code"]
        self.assertTrue(new_room_code.startswith("viva-"))
        self.assertEqual(provisioned["candidate_user_id"], str(self.candidate_id))

        # 2. Instructor updates private rubric scores and notes
        patch_res = self.client.patch(
            f"/api/v1/campus/viva/{new_room_code}/rubric",
            json={
                "rubric_scores": {"correctness": 48, "complexity_analysis": 28, "clarity": 18},
                "interviewer_notes": "Candidate had excellent depth of intuition on negative cycles.",
                "status": "COMPLETED",
            },
            headers={"Authorization": f"Bearer {self.token_host}"},
        )
        self.assertEqual(patch_res.status_code, 200)
        updated_room = patch_res.json()
        self.assertEqual(updated_room["status"], "COMPLETED")
        self.assertEqual(updated_room["rubric_scores"]["correctness"], 48)
        self.assertEqual(updated_room["interviewer_notes"], "Candidate had excellent depth of intuition on negative cycles.")

        # 3. Candidate queries the room details -> rubric scores and interviewer notes MUST be masked!
        cand_get = self.client.get(
            f"/api/v1/campus/viva/{new_room_code}",
            headers={"Authorization": f"Bearer {self.token_candidate}"},
        )
        self.assertEqual(cand_get.status_code, 200)
        cand_room_view = cand_get.json()
        self.assertEqual(cand_room_view["room_code"], new_room_code)
        self.assertEqual(cand_room_view["status"], "COMPLETED")
        # Masked fields
        self.assertEqual(cand_room_view["rubric_scores"], {})
        self.assertIsNone(cand_room_view["interviewer_notes"])

        # 4. Instructor queries the room details -> unmasked
        host_get = self.client.get(
            f"/api/v1/campus/viva/{new_room_code}",
            headers={"Authorization": f"Bearer {self.token_host}"},
        )
        self.assertEqual(host_get.status_code, 200)
        host_room_view = host_get.json()
        self.assertEqual(host_room_view["rubric_scores"]["correctness"], 48)
        self.assertIsNotNone(host_room_view["interviewer_notes"])

        # 5. Candidate attempting to patch rubric -> 403 Forbidden
        cand_patch = self.client.patch(
            f"/api/v1/campus/viva/{new_room_code}/rubric",
            json={"rubric_scores": {"correctness": 50}},
            headers={"Authorization": f"Bearer {self.token_candidate}"},
        )
        self.assertEqual(cand_patch.status_code, 403)


if __name__ == "__main__":
    unittest.main()

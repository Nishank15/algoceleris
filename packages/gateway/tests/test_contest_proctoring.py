import time
import unittest
from fastapi.testclient import TestClient

from packages.gateway.src.api import create_app
from packages.gateway.src.contests.models import (
    Contest,
    ContestProblem,
    ContestStatus,
)
from packages.gateway.src.contests.proctoring import (
    InMemoryProctoringStore,
    ProctoringEvent,
    ProctoringEventType,
)
from packages.gateway.src.contests.store import InMemoryContestStore
from packages.gateway.src.queue import InMemoryQueueBroker


class TestContestProctoringStore(unittest.TestCase):
    def setUp(self):
        self.store = InMemoryProctoringStore()
        self.contest_id = "contest-proc-1"
        self.user_id = "test-cheater-007"

    def test_log_event_increments_strikes(self):
        # 1st strike: Fullscreen Exit
        ev1 = ProctoringEvent(
            contest_id=self.contest_id,
            user_id=self.user_id,
            event_type=ProctoringEventType.FULLSCREEN_EXIT,
            details="User minimized window",
        )
        s1 = self.store.log_event(ev1)
        self.assertEqual(s1, 1)
        self.assertEqual(self.store.get_participant_strikes(self.contest_id, self.user_id), 1)
        self.assertFalse(self.store.is_flagged(self.contest_id, self.user_id))

        # 2nd strike: Tab Blur
        ev2 = ProctoringEvent(
            contest_id=self.contest_id,
            user_id=self.user_id,
            event_type=ProctoringEventType.TAB_BLUR,
            details="Window switched to external IDE",
        )
        s2 = self.store.log_event(ev2)
        self.assertEqual(s2, 2)
        self.assertEqual(self.store.get_participant_strikes(self.contest_id, self.user_id), 2)
        self.assertFalse(self.store.is_flagged(self.contest_id, self.user_id))

        # 3rd strike: Clipboard Paste
        ev3 = ProctoringEvent(
            contest_id=self.contest_id,
            user_id=self.user_id,
            event_type=ProctoringEventType.CLIPBOARD_PASTE,
            details="Blocked attempt to paste 50 lines",
        )
        s3 = self.store.log_event(ev3)
        self.assertEqual(s3, 3)
        self.assertEqual(self.store.get_participant_strikes(self.contest_id, self.user_id), 3)
        self.assertTrue(self.store.is_flagged(self.contest_id, self.user_id))

        # Retrieve audit history
        events = self.store.get_events(self.contest_id, self.user_id)
        self.assertEqual(len(events), 3)
        self.assertEqual(events[0].event_type, ProctoringEventType.FULLSCREEN_EXIT)
        self.assertEqual(events[1].event_type, ProctoringEventType.TAB_BLUR)
        self.assertEqual(events[2].event_type, ProctoringEventType.CLIPBOARD_PASTE)


class TestContestProctoringAPI(unittest.TestCase):
    def setUp(self):
        self.broker = InMemoryQueueBroker()
        self.contest_store = InMemoryContestStore()
        self.proctoring_store = InMemoryProctoringStore()

        self.app = create_app(
            broker=self.broker,
            contest_store=self.contest_store,
            proctoring_store=self.proctoring_store,
        )
        self.client = TestClient(self.app)

        self.contest_id = "test-proctored-contest"
        now = time.time()
        self.test_contest = Contest(
            id=self.contest_id,
            title="Proctored Championship Cup",
            description="Strict proctoring enforced",
            start_time=now - 50,
            end_time=now + 5000,
            duration_minutes=90,
            status=ContestStatus.ACTIVE,
            problems=[
                ContestProblem(
                    id="p-1",
                    letter_code="A",
                    title="Problem A",
                    points=100,
                )
            ],
        )
        self.contest_store.create_contest(self.test_contest)

    def test_log_proctor_event_endpoint(self):
        # 404 for unknown contest
        resp = self.client.post(
            "/api/v1/contests/unknown-contest/proctor/event",
            json={
                "contest_id": "unknown-contest",
                "user_id": "user-1",
                "event_type": "FULLSCREEN_EXIT",
            },
        )
        self.assertEqual(resp.status_code, 404)

        # Log strike 1
        resp1 = self.client.post(
            f"/api/v1/contests/{self.contest_id}/proctor/event",
            json={
                "contest_id": self.contest_id,
                "user_id": "student_alpha",
                "event_type": "FULLSCREEN_EXIT",
                "details": "Exited full screen mode",
            },
        )
        self.assertEqual(resp1.status_code, 200)
        data1 = resp1.json()
        self.assertEqual(data1["strike_count"], 1)
        self.assertFalse(data1["is_flagged"])

        # Log strike 2
        resp2 = self.client.post(
            f"/api/v1/contests/{self.contest_id}/proctor/event",
            json={
                "contest_id": self.contest_id,
                "user_id": "student_alpha",
                "event_type": "TAB_BLUR",
                "details": "Switched browser tab",
            },
        )
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.json()["strike_count"], 2)

        # Log strike 3 -> Flagged!
        resp3 = self.client.post(
            f"/api/v1/contests/{self.contest_id}/proctor/event",
            json={
                "contest_id": self.contest_id,
                "user_id": "student_alpha",
                "event_type": "CLIPBOARD_COPY",
                "details": "Attempted to copy problem statement",
            },
        )
        self.assertEqual(resp3.status_code, 200)
        data3 = resp3.json()
        self.assertEqual(data3["strike_count"], 3)
        self.assertTrue(data3["is_flagged"])

        # Query audit history
        audit_resp = self.client.get(
            f"/api/v1/contests/{self.contest_id}/proctor/audit/student_alpha"
        )
        self.assertEqual(audit_resp.status_code, 200)
        audit_data = audit_resp.json()
        self.assertEqual(audit_data["user_id"], "student_alpha")
        self.assertEqual(audit_data["strike_count"], 3)
        self.assertTrue(audit_data["is_flagged"])
        self.assertEqual(len(audit_data["events"]), 3)


if __name__ == "__main__":
    unittest.main()

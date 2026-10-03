import time
import unittest
from fastapi.testclient import TestClient

from packages.gateway.src.api import create_app
from packages.gateway.src.contests.leaderboard import (
    InMemoryLeaderboardBackend,
    LeaderboardEngine,
    LeaderboardEntry,
)
from packages.gateway.src.contests.models import (
    Contest,
    ContestProblem,
    ContestStatus,
    ParticipantScore,
    ProblemScore,
)
from packages.gateway.src.contests.store import InMemoryContestStore
from packages.gateway.src.queue import InMemoryQueueBroker


class TestContestLeaderboardEngine(unittest.TestCase):
    def setUp(self):
        self.store = InMemoryContestStore()
        self.backend = InMemoryLeaderboardBackend()
        self.engine = LeaderboardEngine(backend=self.backend, contest_store=self.store)

    def test_composite_score_priority(self):
        # 2 solves with 500 penalty minutes must rank higher than 1 solve with 0 penalty minutes
        score_2_solves = LeaderboardEngine.calculate_composite_score(
            solved_count=2, total_penalty_minutes=500
        )
        score_1_solve = LeaderboardEngine.calculate_composite_score(
            solved_count=1, total_penalty_minutes=0
        )
        self.assertGreater(score_2_solves, score_1_solve)

        # Equal solves: lower penalty minutes must have higher composite score
        score_low_penalty = LeaderboardEngine.calculate_composite_score(
            solved_count=3, total_penalty_minutes=45
        )
        score_high_penalty = LeaderboardEngine.calculate_composite_score(
            solved_count=3, total_penalty_minutes=90
        )
        self.assertGreater(score_low_penalty, score_high_penalty)

    def test_record_and_rank_recalculation(self):
        contest_id = "test-c1"

        # Alice: 1 solve, 20 min penalty
        alice = ParticipantScore(
            user_id="alice",
            contest_id=contest_id,
            solved_count=1,
            total_penalty_minutes=20,
        )
        self.store.update_participant_score(alice)
        alice_rank = self.engine.record_score(contest_id, alice)
        self.assertEqual(alice_rank, 1)

        # Bob: 2 solves, 60 min penalty -> should take rank 1, Alice becomes rank 2
        bob = ParticipantScore(
            user_id="bob",
            contest_id=contest_id,
            solved_count=2,
            total_penalty_minutes=60,
        )
        self.store.update_participant_score(bob)
        bob_rank = self.engine.record_score(contest_id, bob)
        self.assertEqual(bob_rank, 1)
        self.assertEqual(self.engine.get_user_rank(contest_id, "alice"), 2)

        # Charlie: 1 solve, 10 min penalty -> ranks between Bob and Alice (Bob #1, Charlie #2, Alice #3)
        charlie = ParticipantScore(
            user_id="charlie",
            contest_id=contest_id,
            solved_count=1,
            total_penalty_minutes=10,
        )
        self.store.update_participant_score(charlie)
        charlie_rank = self.engine.record_score(contest_id, charlie)
        self.assertEqual(charlie_rank, 2)
        self.assertEqual(self.engine.get_user_rank(contest_id, "bob"), 1)
        self.assertEqual(self.engine.get_user_rank(contest_id, "alice"), 3)

        # Verify leaderboard list
        board = self.engine.get_leaderboard(contest_id)
        self.assertEqual(len(board), 3)
        self.assertEqual(board[0].user_id, "bob")
        self.assertEqual(board[0].rank, 1)
        self.assertEqual(board[1].user_id, "charlie")
        self.assertEqual(board[1].rank, 2)
        self.assertEqual(board[2].user_id, "alice")
        self.assertEqual(board[2].rank, 3)


class TestContestLeaderboardAPIAndWebSocket(unittest.TestCase):
    def setUp(self):
        self.broker = InMemoryQueueBroker()
        self.store = InMemoryContestStore()
        self.backend = InMemoryLeaderboardBackend()
        self.engine = LeaderboardEngine(backend=self.backend, contest_store=self.store)

        self.app = create_app(
            broker=self.broker,
            contest_store=self.store,
            leaderboard_engine=self.engine,
        )
        self.client = TestClient(self.app)

        # Create a test active contest
        self.contest_id = "test-live-contest"
        self.now = time.time()
        self.test_contest = Contest(
            id=self.contest_id,
            title="Live Test Cup",
            description="Testing live leaderboard streaming",
            start_time=self.now - 100,
            end_time=self.now + 7200,
            duration_minutes=120,
            status=ContestStatus.ACTIVE,
            problems=[
                ContestProblem(
                    id="prob-1",
                    letter_code="A",
                    title="Problem 1",
                    difficulty="Easy",
                    points=100,
                ),
                ContestProblem(
                    id="prob-2",
                    letter_code="B",
                    title="Problem 2",
                    difficulty="Medium",
                    points=200,
                ),
            ],
        )
        self.store.create_contest(self.test_contest)

    def test_get_leaderboard_endpoint(self):
        # 404 for nonexistent contest
        resp = self.client.get("/api/v1/contests/non-existent/leaderboard")
        self.assertEqual(resp.status_code, 404)

        # Empty leaderboard initially
        resp = self.client.get(f"/api/v1/contests/{self.contest_id}/leaderboard")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), [])

        # Register participant
        reg_resp = self.client.post(
            f"/api/v1/contests/{self.contest_id}/register",
            json={"user_id": "coder_42"},
        )
        self.assertEqual(reg_resp.status_code, 200)

        # Check leaderboard shows participant
        resp2 = self.client.get(f"/api/v1/contests/{self.contest_id}/leaderboard")
        self.assertEqual(resp2.status_code, 200)
        data = resp2.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["user_id"], "coder_42")
        self.assertEqual(data[0]["rank"], 1)
        self.assertEqual(data[0]["solved_count"], 0)

    def test_submission_updates_leaderboard_and_streams_websocket(self):
        # 1. Connect WebSocket to live contest leaderboard
        with self.client.websocket_connect(f"/ws/contests/{self.contest_id}/leaderboard") as ws:
            # First message must be snapshot
            snapshot = ws.receive_json()
            self.assertEqual(snapshot["event_type"], "leaderboard_snapshot")
            self.assertEqual(snapshot["contest_id"], self.contest_id)
            self.assertIsInstance(snapshot["data"], list)

            # 2. Submit solution
            sub_resp = self.client.post(
                f"/api/v1/contests/{self.contest_id}/submit",
                json={
                    "user_id": "legendary_coder",
                    "problem_id": "prob-1",
                    "language": "python",
                    "source_code": "def solve(): return 42",
                },
            )
            self.assertEqual(sub_resp.status_code, 200)
            self.assertTrue(sub_resp.json()["solved"])

            # 3. WebSocket should receive leaderboard_update
            update_event = ws.receive_json()
            self.assertEqual(update_event["event_type"], "leaderboard_update")
            self.assertEqual(update_event["contest_id"], self.contest_id)
            self.assertEqual(update_event["user_id"], "legendary_coder")
            self.assertEqual(update_event["rank"], 1)
            self.assertEqual(update_event["solved_count"], 1)

        # 4. REST endpoint confirms updated standing
        board_resp = self.client.get(f"/api/v1/contests/{self.contest_id}/leaderboard")
        self.assertEqual(board_resp.status_code, 200)
        board_data = board_resp.json()
        self.assertEqual(board_data[0]["user_id"], "legendary_coder")
        self.assertEqual(board_data[0]["solved_count"], 1)
        self.assertEqual(board_data[0]["rank"], 1)


if __name__ == "__main__":
    unittest.main()

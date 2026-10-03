import time
import unittest
from fastapi.testclient import TestClient

from packages.gateway.src.api import create_app
from packages.gateway.src.contests.models import (
    Contest,
    ContestProblem,
    ContestStatus,
    ParticipantScore,
)
from packages.gateway.src.contests.scoring import ICPCScoringEngine
from packages.gateway.src.contests.store import InMemoryContestStore
from packages.gateway.src.queue import InMemoryQueueBroker


class TestICPCScoringEngine(unittest.TestCase):
    def setUp(self):
        self.contest_start = 1000.0
        self.participant = ParticipantScore(
            user_id="user-1",
            contest_id="c1",
            solved_count=0,
            total_penalty_minutes=0,
        )

    def test_single_accepted_submission(self):
        # Solved at minute 15 with 0 prior rejections
        sub_time = self.contest_start + 15 * 60
        res, delta = ICPCScoringEngine.process_submission(
            participant=self.participant,
            problem_id="prob-A",
            verdict="ACCEPTED",
            submission_time=sub_time,
            contest_start_time=self.contest_start,
        )
        self.assertEqual(res.solved_count, 1)
        self.assertEqual(res.total_penalty_minutes, 15)
        self.assertEqual(delta, 15)
        self.assertTrue(res.problem_scores["prob-A"].solved)
        self.assertEqual(res.problem_scores["prob-A"].rejected_attempts, 0)

    def test_rejected_attempts_prior_to_accepted(self):
        # 2 wrong answers at minute 5 and 10
        ICPCScoringEngine.process_submission(
            participant=self.participant,
            problem_id="prob-B",
            verdict="WRONG_ANSWER",
            submission_time=self.contest_start + 5 * 60,
            contest_start_time=self.contest_start,
        )
        ICPCScoringEngine.process_submission(
            participant=self.participant,
            problem_id="prob-B",
            verdict="TIME_LIMIT_EXCEEDED",
            submission_time=self.contest_start + 10 * 60,
            contest_start_time=self.contest_start,
        )

        # Before AC, penalty is 0 and solved_count is 0
        self.assertEqual(self.participant.solved_count, 0)
        self.assertEqual(self.participant.total_penalty_minutes, 0)
        self.assertEqual(self.participant.problem_scores["prob-B"].rejected_attempts, 2)

        # AC at minute 25: penalty = 25 + (2 * 20) = 65
        res, delta = ICPCScoringEngine.process_submission(
            participant=self.participant,
            problem_id="prob-B",
            verdict="ACCEPTED",
            submission_time=self.contest_start + 25 * 60,
            contest_start_time=self.contest_start,
        )
        self.assertEqual(res.solved_count, 1)
        self.assertEqual(res.total_penalty_minutes, 65)
        self.assertEqual(delta, 65)

    def test_submissions_after_accepted_are_ignored(self):
        sub_time = self.contest_start + 10 * 60
        ICPCScoringEngine.process_submission(
            self.participant, "prob-C", "ACCEPTED", sub_time, self.contest_start
        )
        initial_penalty = self.participant.total_penalty_minutes

        # Subsequent submission
        res, delta = ICPCScoringEngine.process_submission(
            self.participant, "prob-C", "WRONG_ANSWER", sub_time + 100, self.contest_start
        )
        self.assertEqual(res.total_penalty_minutes, initial_penalty)
        self.assertEqual(delta, 0)


class TestContestAPI(unittest.TestCase):
    def setUp(self):
        self.broker = InMemoryQueueBroker()
        self.store = InMemoryContestStore()
        self.app = create_app(broker=self.broker, contest_store=self.store)
        self.client = TestClient(self.app)

    def test_list_and_get_contest(self):
        res = self.client.get("/api/v1/contests")
        self.assertEqual(res.status_code, 200)
        contests = res.json()
        self.assertTrue(len(contests) >= 1)
        self.assertEqual(contests[0]["id"], "weekly-contest-1")

        detail = self.client.get("/api/v1/contests/weekly-contest-1")
        self.assertEqual(detail.status_code, 200)
        data = detail.json()
        self.assertEqual(len(data["problems"]), 3)
        self.assertEqual(data["problems"][0]["letter_code"], "A")

    def test_register_and_submit_solution(self):
        user = "contestant-42"
        reg = self.client.post("/api/v1/contests/weekly-contest-1/register", json={"user_id": user})
        self.assertEqual(reg.status_code, 200)
        reg_data = reg.json()
        self.assertEqual(reg_data["solved_count"], 0)
        self.assertEqual(reg_data["total_penalty_minutes"], 0)

        # Submit wrong answer first
        sub_wa = self.client.post(
            "/api/v1/contests/weekly-contest-1/submit",
            json={
                "user_id": user,
                "problem_id": "two-sum",
                "language": "python",
                "source_code": "def solve(): return 'WRONG'",
            },
        )
        self.assertEqual(sub_wa.status_code, 200)
        wa_data = sub_wa.json()
        self.assertEqual(wa_data["verdict"], "WRONG_ANSWER")
        self.assertFalse(wa_data["solved"])
        self.assertEqual(wa_data["solved_count"], 0)

        # Submit accepted answer
        sub_ac = self.client.post(
            "/api/v1/contests/weekly-contest-1/submit",
            json={
                "user_id": user,
                "problem_id": "two-sum",
                "language": "python",
                "source_code": "def two_sum(): return [0, 1]",
            },
        )
        self.assertEqual(sub_ac.status_code, 200)
        ac_data = sub_ac.json()
        self.assertEqual(ac_data["verdict"], "ACCEPTED")
        self.assertTrue(ac_data["solved"])
        self.assertEqual(ac_data["solved_count"], 1)
        # 1 rejection (20 min) + elapsed minutes >= 21
        self.assertGreaterEqual(ac_data["total_penalty_minutes"], 21)

    def test_submit_invalid_problem(self):
        res = self.client.post(
            "/api/v1/contests/weekly-contest-1/submit",
            json={
                "user_id": "user-x",
                "problem_id": "unknown-problem-xyz",
                "language": "python",
                "source_code": "pass",
            },
        )
        self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()

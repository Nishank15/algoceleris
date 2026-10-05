import unittest
import uuid
from datetime import datetime

from sqlalchemy import UniqueConstraint, inspect

from packages.gateway.src.models.entities import (
    ContestParticipation,
    Submission,
    Subscription,
    User,
)


class TestEntityModels(unittest.TestCase):
    def test_user_table_definition(self):
        self.assertEqual(User.__tablename__, "users")
        columns = {c.name: c for c in User.__table__.columns}

        self.assertIn("id", columns)
        self.assertTrue(columns["id"].primary_key)

        self.assertIn("username", columns)
        self.assertFalse(columns["username"].nullable)
        self.assertTrue(columns["username"].unique)

        self.assertIn("email", columns)
        self.assertFalse(columns["email"].nullable)
        self.assertTrue(columns["email"].unique)

        self.assertIn("password_hash", columns)
        self.assertFalse(columns["password_hash"].nullable)

        self.assertIn("account_type", columns)
        self.assertIn("college_name", columns)
        self.assertTrue(columns["college_name"].nullable)

        self.assertIn("avatar_url", columns)
        self.assertTrue(columns["avatar_url"].nullable)

        self.assertIn("created_at", columns)
        self.assertIn("updated_at", columns)

    def test_subscription_table_definition(self):
        self.assertEqual(Subscription.__tablename__, "subscriptions")
        columns = {c.name: c for c in Subscription.__table__.columns}

        self.assertIn("id", columns)
        self.assertTrue(columns["id"].primary_key)

        self.assertIn("user_id", columns)
        fk = list(columns["user_id"].foreign_keys)[0]
        self.assertEqual(fk.target_fullname, "users.id")
        self.assertEqual(fk.ondelete, "CASCADE")

        self.assertIn("provider", columns)
        self.assertIn("customer_id", columns)
        self.assertIn("subscription_id", columns)
        self.assertIn("status", columns)
        self.assertIn("current_period_end", columns)
        self.assertIn("created_at", columns)

    def test_submission_table_definition(self):
        self.assertEqual(Submission.__tablename__, "submissions")
        columns = {c.name: c for c in Submission.__table__.columns}

        self.assertIn("id", columns)
        self.assertTrue(columns["id"].primary_key)

        self.assertIn("user_id", columns)
        self.assertTrue(columns["user_id"].nullable)
        fk = list(columns["user_id"].foreign_keys)[0]
        self.assertEqual(fk.target_fullname, "users.id")
        self.assertEqual(fk.ondelete, "SET NULL")

        self.assertIn("problem_slug", columns)
        self.assertIn("language", columns)
        self.assertIn("code", columns)
        self.assertIn("verdict", columns)
        self.assertIn("runtime_ms", columns)
        self.assertIn("memory_kb", columns)
        self.assertIn("testcases_passed", columns)
        self.assertIn("total_testcases", columns)
        self.assertIn("created_at", columns)

    def test_contest_participation_table_definition(self):
        self.assertEqual(
            ContestParticipation.__tablename__, "contest_participations"
        )
        columns = {c.name: c for c in ContestParticipation.__table__.columns}

        self.assertIn("id", columns)
        self.assertTrue(columns["id"].primary_key)

        self.assertIn("user_id", columns)
        fk = list(columns["user_id"].foreign_keys)[0]
        self.assertEqual(fk.target_fullname, "users.id")
        self.assertEqual(fk.ondelete, "CASCADE")

        self.assertIn("contest_id", columns)
        self.assertIn("rank", columns)
        self.assertTrue(columns["rank"].nullable)
        self.assertIn("score", columns)
        self.assertIn("penalty_minutes", columns)
        self.assertIn("rating_delta", columns)
        self.assertIn("created_at", columns)

        # Check unique constraint on (user_id, contest_id)
        unique_constraints = [
            c
            for c in ContestParticipation.__table__.constraints
            if isinstance(c, UniqueConstraint)
        ]
        self.assertTrue(
            any(
                set(col.name for col in c.columns) == {"user_id", "contest_id"}
                for c in unique_constraints
            )
        )

    def test_entity_instantiation_and_repr(self):
        u_id = uuid.uuid4()
        user = User(
            id=u_id,
            username="coder_42",
            email="coder@example.com",
            password_hash="argon2_hash",
            account_type="pro",
            college_name="IIT Bombay",
        )
        self.assertEqual(user.username, "coder_42")
        self.assertIn("coder_42", repr(user))

        sub = Subscription(
            user_id=u_id,
            provider="stripe",
            status="active",
        )
        self.assertEqual(sub.provider, "stripe")
        self.assertIn("stripe", repr(sub))

        submission = Submission(
            problem_slug="two-sum",
            language="cpp",
            code="int main(){}",
            verdict="Accepted",
        )
        self.assertEqual(submission.problem_slug, "two-sum")
        self.assertIn("two-sum", repr(submission))

        part = ContestParticipation(
            user_id=u_id,
            contest_id="weekly-contest-1",
            rank=1,
            score=300,
        )
        self.assertEqual(part.contest_id, "weekly-contest-1")
        self.assertIn("weekly-contest-1", repr(part))


if __name__ == "__main__":
    unittest.main()

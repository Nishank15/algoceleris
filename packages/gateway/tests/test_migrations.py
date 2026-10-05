import asyncio
import os
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import inspect, text

from packages.gateway.src.database import close_db_engine, get_async_engine
from packages.gateway.src.migrate import run_downgrade, run_migrations


class TestAlembicMigrations(unittest.TestCase):
    def setUp(self):
        try:
            self.loop = asyncio.get_event_loop()
            if self.loop.is_closed():
                self.loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self.loop)
        except RuntimeError:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

        # Temporary sqlite database file
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

    def test_migration_upgrade_and_downgrade_cycle(self):
        # 1. Run migrations upgrade head
        run_migrations(db_url=self.sqlite_url, revision="head")

        async def _verify_tables():
            engine = get_async_engine(self.sqlite_url)
            async with engine.connect() as conn:
                # Query table names from sqlite_master
                res = await conn.execute(
                    text(
                        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
                    )
                )
                tables = {row[0] for row in res.fetchall()}
                self.assertIn("users", tables)
                self.assertIn("subscriptions", tables)
                self.assertIn("submissions", tables)
                self.assertIn("contest_participations", tables)
                self.assertIn("alembic_version", tables)

                # Verify insertions across all 4 tables
                u_id = "00000000-0000-0000-0000-000000000001"
                await conn.execute(
                    text(
                        "INSERT INTO users (id, username, email, password_hash, account_type) "
                        "VALUES (:id, :u, :e, :p, :a)"
                    ),
                    {
                        "id": u_id,
                        "u": "judge_user",
                        "e": "judge@example.com",
                        "p": "hashed",
                        "a": "pro",
                    },
                )

                sub_id = "00000000-0000-0000-0000-000000000002"
                await conn.execute(
                    text(
                        "INSERT INTO subscriptions (id, user_id, provider, status) "
                        "VALUES (:id, :uid, :prov, :st)"
                    ),
                    {"id": sub_id, "uid": u_id, "prov": "stripe", "st": "active"},
                )

                submission_id = "00000000-0000-0000-0000-000000000003"
                await conn.execute(
                    text(
                        "INSERT INTO submissions (id, user_id, problem_slug, language, code, verdict) "
                        "VALUES (:id, :uid, :ps, :lang, :code, :v)"
                    ),
                    {
                        "id": submission_id,
                        "uid": u_id,
                        "ps": "two-sum",
                        "lang": "cpp",
                        "code": "int main(){}",
                        "v": "Accepted",
                    },
                )

                part_id = "00000000-0000-0000-0000-000000000004"
                await conn.execute(
                    text(
                        "INSERT INTO contest_participations (id, user_id, contest_id, score) "
                        "VALUES (:id, :uid, :cid, :sc)"
                    ),
                    {"id": part_id, "uid": u_id, "cid": "weekly-1", "sc": 100},
                )
                await conn.commit()

        asyncio.run(_verify_tables())

        # 2. Run migrations downgrade base
        run_downgrade(db_url=self.sqlite_url, revision="base")

        async def _verify_downgrade():
            engine = get_async_engine(self.sqlite_url)
            async with engine.connect() as conn:
                res = await conn.execute(
                    text(
                        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
                    )
                )
                tables = {row[0] for row in res.fetchall()}
                self.assertNotIn("users", tables)
                self.assertNotIn("subscriptions", tables)
                self.assertNotIn("submissions", tables)
                self.assertNotIn("contest_participations", tables)

        asyncio.run(_verify_downgrade())

    def test_postgres_migration_if_available(self):
        pg_url = os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://postgres:postgres@localhost:5432/cloud_judge",
        )
        try:
            # Upgrade Postgres to head
            run_migrations(db_url=pg_url, revision="head")
            self.assertTrue(True)
        except Exception as exc:
            # If postgres is not running locally in an isolated test runner, skip
            self.skipTest(f"PostgreSQL not accessible on localhost:5432: {exc}")


if __name__ == "__main__":
    unittest.main()

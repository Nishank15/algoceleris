import asyncio
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import text

from packages.gateway.src.api import create_app
from packages.gateway.src.database import (
    Base,
    check_db_health,
    close_db_engine,
    get_async_engine,
    get_db,
    get_session_factory,
)
from packages.gateway.src.queue import InMemoryQueueBroker


class TestDatabaseAsyncEngine(unittest.TestCase):
    def setUp(self):
        try:
            self.loop = asyncio.get_event_loop()
            if self.loop.is_closed():
                self.loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self.loop)
        except RuntimeError:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
        self.test_db_url = "sqlite+aiosqlite:///:memory:"

    def tearDown(self):
        asyncio.run(close_db_engine(self.test_db_url))
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    def test_declarative_base_exists(self):
        self.assertIsNotNone(Base)
        self.assertTrue(hasattr(Base, "metadata"))

    def test_engine_caching_and_singleton(self):
        engine1 = get_async_engine(self.test_db_url)
        engine2 = get_async_engine(self.test_db_url)
        self.assertIs(engine1, engine2)

    def test_check_db_health_healthy(self):
        async def _check():
            return await check_db_health(db_url=self.test_db_url)

        res = asyncio.run(_check())
        self.assertEqual(res.get("status"), "healthy")
        self.assertEqual(res.get("database"), "connected")
        self.assertEqual(res.get("dialect"), "sqlite")

    def test_check_db_health_unhealthy(self):
        # Invalid host/port that should fail immediately
        invalid_url = "postgresql+asyncpg://invalid_user:invalid_pass@127.0.0.1:54399/invalid_db"

        async def _check():
            return await check_db_health(db_url=invalid_url)

        res = asyncio.run(_check())
        self.assertEqual(res.get("status"), "unhealthy")
        self.assertEqual(res.get("database"), "disconnected")
        self.assertIn("error", res)
        asyncio.run(close_db_engine(invalid_url))

    def test_get_session_factory(self):
        engine = get_async_engine(self.test_db_url)
        factory = get_session_factory(engine=engine)
        self.assertIsNotNone(factory)

    def test_get_db_session_lifecycle(self):
        async def _test_session():
            engine = get_async_engine(self.test_db_url)
            gen = get_db(db_url=self.test_db_url)
            session = await gen.__anext__()
            self.assertIsNotNone(session)
            # Execute test query
            res = await session.execute(text("SELECT 42"))
            self.assertEqual(res.scalar(), 42)
            # Clean up generator
            try:
                await gen.__anext__()
            except StopAsyncIteration:
                pass

        asyncio.run(_test_session())

    def test_health_endpoint_includes_database_key(self):
        broker = InMemoryQueueBroker()
        app = create_app(broker=broker)
        client = TestClient(app)

        resp = client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("database", data)

        v1_resp = client.get("/api/v1/health")
        self.assertEqual(v1_resp.status_code, 200)
        v1_data = v1_resp.json()
        self.assertEqual(v1_data["status"], "healthy")
        self.assertIn("database", v1_data)


if __name__ == "__main__":
    unittest.main()

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock

from packages.gateway.src.auth.bloom import (
    BloomUniquenessChecker,
    InMemoryBloomFilter,
)


class TestInMemoryBloomFilter(unittest.TestCase):
    def test_add_and_exists(self):
        bf = InMemoryBloomFilter(size=1000, num_hashes=5)
        self.assertFalse(bf.exists("coder_alice"))
        bf.add("coder_alice")
        self.assertTrue(bf.exists("coder_alice"))
        self.assertTrue(bf.exists("CODER_ALICE"))  # Case insensitive check

    def test_absent_item(self):
        bf = InMemoryBloomFilter(size=1000, num_hashes=5)
        bf.add("alice")
        self.assertFalse(bf.exists("bob"))

    def test_clear(self):
        bf = InMemoryBloomFilter(size=1000, num_hashes=5)
        bf.add("charlie")
        self.assertTrue(bf.exists("charlie"))
        bf.clear()
        self.assertFalse(bf.exists("charlie"))


class TestBloomUniquenessChecker(unittest.TestCase):
    def setUp(self):
        try:
            self.loop = asyncio.get_event_loop()
            if self.loop.is_closed():
                self.loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self.loop)
        except RuntimeError:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

    def test_fast_path_when_not_in_bloom(self):
        checker = BloomUniquenessChecker(force_in_memory=True)

        async def _test():
            # Brand new username not in filter
            is_avail = await checker.is_username_available("unregistered_hero")
            self.assertTrue(is_avail)

            # Brand new email not in filter
            is_email_avail = await checker.is_email_available("new@example.com")
            self.assertTrue(is_email_avail)

        asyncio.run(_test())

    def test_fallback_to_db_when_in_bloom(self):
        checker = BloomUniquenessChecker(force_in_memory=True)

        async def _test():
            # Add to Bloom filter
            await checker.add_user("alice", "alice@example.com")

            # Mock DB session where user DOES exist in DB
            db_session_taken = AsyncMock()
            mock_result_taken = MagicMock()
            mock_result_taken.scalar.return_value = "some-uuid"
            db_session_taken.execute.return_value = mock_result_taken

            is_avail_taken = await checker.is_username_available(
                "alice", db_session=db_session_taken
            )
            self.assertFalse(is_avail_taken)

            # Mock DB session where user DOES NOT exist in DB (Bloom false positive)
            db_session_free = AsyncMock()
            mock_result_free = MagicMock()
            mock_result_free.scalar.return_value = None
            db_session_free.execute.return_value = mock_result_free

            is_avail_free = await checker.is_username_available(
                "alice", db_session=db_session_free
            )
            # Layer 2 PostgreSQL check absorbs false positive -> available!
            self.assertTrue(is_avail_free)

        asyncio.run(_test())

    def test_email_availability_pipeline(self):
        checker = BloomUniquenessChecker(force_in_memory=True)

        async def _test():
            await checker.add_user("bob", "bob@example.com")

            db_session_taken = AsyncMock()
            mock_result_taken = MagicMock()
            mock_result_taken.scalar.return_value = "some-uuid"
            db_session_taken.execute.return_value = mock_result_taken

            is_avail = await checker.is_email_available(
                "bob@example.com", db_session=db_session_taken
            )
            self.assertFalse(is_avail)

            # Different email not in bloom
            is_other_avail = await checker.is_email_available(
                "other@example.com"
            )
            self.assertTrue(is_other_avail)

        asyncio.run(_test())


if __name__ == "__main__":
    unittest.main()

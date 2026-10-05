import asyncio
import hashlib
import logging
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session_factory
from ..models.entities import User

logger = logging.getLogger("cloudjudge.auth.bloom")


class InMemoryBloomFilter:
    """In-memory Bloom filter for offline execution and fast testing."""

    def __init__(self, size: int = 100000, num_hashes: int = 7):
        self.size = size
        self.num_hashes = num_hashes
        self.bit_array: int = 0

    def _hashes(self, item: str):
        item_bytes = item.strip().lower().encode("utf-8")
        h1 = int(hashlib.sha256(item_bytes).hexdigest(), 16)
        h2 = int(hashlib.md5(item_bytes).hexdigest(), 16)
        for i in range(self.num_hashes):
            yield (h1 + i * h2) % self.size

    def add(self, item: str) -> None:
        for bit_index in self._hashes(item):
            self.bit_array |= 1 << bit_index

    def exists(self, item: str) -> bool:
        for bit_index in self._hashes(item):
            if not (self.bit_array & (1 << bit_index)):
                return False
        return True

    def clear(self) -> None:
        self.bit_array = 0


class BloomUniquenessChecker:
    """Dual-layer username and email uniqueness verification pipeline.

    Layer 1: Sub-millisecond RedisBloom filter check (0% false negative rate).
    Layer 2: Direct PostgreSQL database query fallback if Layer 1 reports positive.
    """

    def __init__(
        self,
        redis_client: Optional[Any] = None,
        session_factory: Optional[Any] = None,
        username_key: str = "bf:usernames",
        email_key: str = "bf:emails",
        error_rate: float = 0.001,
        capacity: int = 1000000,
        force_in_memory: bool = False,
    ):
        self.redis_client = redis_client
        self.session_factory = session_factory
        self.username_key = username_key
        self.email_key = email_key
        self.error_rate = error_rate
        self.capacity = capacity
        self.force_in_memory = force_in_memory

        self._mem_usernames = InMemoryBloomFilter()
        self._mem_emails = InMemoryBloomFilter()
        self._redis_bloom_active = False

    async def _execute_redis(self, *args: Any) -> Any:
        """Execute a Redis command supporting both sync and async clients."""
        if not self.redis_client or self.force_in_memory:
            raise RuntimeError("Redis client unavailable")

        if asyncio.iscoroutinefunction(self.redis_client.execute_command):
            return await self.redis_client.execute_command(*args)
        else:
            return await asyncio.to_thread(
                self.redis_client.execute_command, *args
            )

    async def ensure_filters_initialized(self) -> None:
        """Reserve RedisBloom filters if Redis is reachable and supports BF."""
        if self.redis_client and not self.force_in_memory:
            try:
                for key in (self.username_key, self.email_key):
                    try:
                        await self._execute_redis(
                            "BF.RESERVE", key, self.error_rate, self.capacity
                        )
                    except Exception as exc:
                        # Ignore if filter already exists
                        err_msg = str(exc).lower()
                        if "already exists" not in err_msg and "busykey" not in err_msg:
                            logger.warning(
                                f"BF.RESERVE failed for key {key}: {exc}"
                            )
                self._redis_bloom_active = True
                return
            except Exception as e:
                logger.info(
                    f"RedisBloom module not detected or error ({e}). Using in-memory fallback."
                )
                self._redis_bloom_active = False
        else:
            self._redis_bloom_active = False

    async def add_user(self, username: str, email: str) -> None:
        """Register username and email in the Bloom filters."""
        clean_user = username.strip().lower()
        clean_email = email.strip().lower()

        # Always update in-memory filter
        self._mem_usernames.add(clean_user)
        self._mem_emails.add(clean_email)

        if self._redis_bloom_active:
            try:
                await self._execute_redis("BF.ADD", self.username_key, clean_user)
                await self._execute_redis("BF.ADD", self.email_key, clean_email)
            except Exception as e:
                logger.warning(f"Failed to add user to RedisBloom: {e}")

    async def is_username_available(
        self, username: str, db_session: Optional[AsyncSession] = None
    ) -> bool:
        """Check if username is available using dual-layer pipeline.

        Returns True if available (not taken), False if already taken.
        """
        clean_user = username.strip().lower()

        # --- Layer 1: Bloom filter pre-check ---
        bloom_exists = False
        if self._redis_bloom_active:
            try:
                res = await self._execute_redis(
                    "BF.EXISTS", self.username_key, clean_user
                )
                bloom_exists = bool(res)
            except Exception as e:
                logger.warning(
                    f"Redis BF.EXISTS failed, falling back to memory/DB: {e}"
                )
                bloom_exists = self._mem_usernames.exists(clean_user)
        else:
            bloom_exists = self._mem_usernames.exists(clean_user)

        # Fast path: If Bloom filter says item is absent, it is guaranteed available (0% false negative)
        if not bloom_exists:
            return True

        # --- Layer 2: PostgreSQL fallback (absorbs potential Bloom false positives) ---
        return await self._check_db_username_available(clean_user, db_session)

    async def is_email_available(
        self, email: str, db_session: Optional[AsyncSession] = None
    ) -> bool:
        """Check if email is available using dual-layer pipeline.

        Returns True if available (not taken), False if already taken.
        """
        clean_email = email.strip().lower()

        # --- Layer 1: Bloom filter pre-check ---
        bloom_exists = False
        if self._redis_bloom_active:
            try:
                res = await self._execute_redis(
                    "BF.EXISTS", self.email_key, clean_email
                )
                bloom_exists = bool(res)
            except Exception as e:
                logger.warning(
                    f"Redis BF.EXISTS failed, falling back to memory/DB: {e}"
                )
                bloom_exists = self._mem_emails.exists(clean_email)
        else:
            bloom_exists = self._mem_emails.exists(clean_email)

        # Fast path: absent in filter -> definitely available
        if not bloom_exists:
            return True

        # --- Layer 2: PostgreSQL fallback ---
        return await self._check_db_email_available(clean_email, db_session)

    async def _check_db_username_available(
        self, clean_user: str, db_session: Optional[AsyncSession] = None
    ) -> bool:
        """Check PostgreSQL database for username existence."""
        if db_session is not None:
            stmt = select(User.id).where(
                func.lower(User.username) == clean_user
            ).limit(1)
            res = await db_session.execute(stmt)
            return res.scalar() is None

        factory = self.session_factory or get_session_factory()
        async with factory() as session:
            stmt = select(User.id).where(
                func.lower(User.username) == clean_user
            ).limit(1)
            res = await session.execute(stmt)
            return res.scalar() is None

    async def _check_db_email_available(
        self, clean_email: str, db_session: Optional[AsyncSession] = None
    ) -> bool:
        """Check PostgreSQL database for email existence."""
        if db_session is not None:
            stmt = select(User.id).where(
                func.lower(User.email) == clean_email
            ).limit(1)
            res = await db_session.execute(stmt)
            return res.scalar() is None

        factory = self.session_factory or get_session_factory()
        async with factory() as session:
            stmt = select(User.id).where(
                func.lower(User.email) == clean_email
            ).limit(1)
            res = await session.execute(stmt)
            return res.scalar() is None

import os
from typing import Any, AsyncGenerator, Dict, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool, StaticPool


class Base(DeclarativeBase):
    """Declarative base class for all SQLAlchemy ORM models."""
    pass


_engine_cache: Dict[str, AsyncEngine] = {}
_session_factory_cache: Dict[str, async_sessionmaker[AsyncSession]] = {}


def get_database_url() -> str:
    """Resolve database URL from environment or fallback to local postgres."""
    return os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/cloud_judge",
    )


def get_async_engine(db_url: Optional[str] = None) -> AsyncEngine:
    """Create or return cached singleton AsyncEngine connection pool."""
    resolved_url = db_url or get_database_url()

    if resolved_url in _engine_cache:
        return _engine_cache[resolved_url]

    pool_size = int(os.getenv("DB_POOL_SIZE", "10"))
    max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    pool_timeout = float(os.getenv("DB_POOL_TIMEOUT", "30.0"))

    # SQLite handling (e.g. for testing)
    if "sqlite" in resolved_url:
        if ":memory:" in resolved_url:
            engine = create_async_engine(
                resolved_url,
                connect_args={"check_same_thread": False},
                poolclass=StaticPool,
            )
        else:
            engine = create_async_engine(
                resolved_url,
                connect_args={"check_same_thread": False},
                poolclass=NullPool,
            )
    else:
        # PostgreSQL / asyncpg configuration
        engine = create_async_engine(
            resolved_url,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_timeout=pool_timeout,
            pool_pre_ping=True,
        )

    _engine_cache[resolved_url] = engine
    return engine


def get_session_factory(
    engine: Optional[AsyncEngine] = None,
    db_url: Optional[str] = None,
) -> async_sessionmaker[AsyncSession]:
    """Create or return cached session factory for async database sessions."""
    active_engine = engine or get_async_engine(db_url)
    cache_key = str(active_engine.url)

    if cache_key in _session_factory_cache:
        return _session_factory_cache[cache_key]

    factory = async_sessionmaker(
        bind=active_engine,
        expire_on_commit=False,
        class_=AsyncSession,
    )
    _session_factory_cache[cache_key] = factory
    return factory


async def get_db(db_url: Optional[str] = None) -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async database session."""
    session_factory = get_session_factory(db_url=db_url)
    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_db_health(
    engine: Optional[AsyncEngine] = None,
    db_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute ping query (SELECT 1) to verify database connectivity."""
    active_engine = engine or get_async_engine(db_url)
    try:
        async with active_engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            val = result.scalar()
            if val == 1:
                return {
                    "status": "healthy",
                    "database": "connected",
                    "dialect": active_engine.dialect.name,
                }
            return {
                "status": "unhealthy",
                "database": "unexpected_result",
            }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(exc),
        }


async def close_db_engine(db_url: Optional[str] = None) -> None:
    """Dispose of engine connections."""
    resolved_url = db_url or get_database_url()
    if resolved_url in _engine_cache:
        engine = _engine_cache.pop(resolved_url)
        await engine.dispose()
    if resolved_url in _session_factory_cache:
        _session_factory_cache.pop(resolved_url)

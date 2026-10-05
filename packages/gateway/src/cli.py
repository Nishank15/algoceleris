import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Optional

# Ensure package roots are in sys.path
GATEWAY_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = GATEWAY_ROOT.parent.parent

for p in [str(PROJECT_ROOT), str(GATEWAY_ROOT)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import redis
from sqlalchemy import select

from .auth.bloom import BloomUniquenessChecker
from .database import close_db_engine, get_async_engine, get_session_factory
from .models.entities import User

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("cloudjudge.cli")


async def run_seed_bloom(
    redis_url: Optional[str] = None,
    db_url: Optional[str] = None,
) -> int:
    """Populate RedisBloom username and email filters from PostgreSQL."""
    resolved_redis_url = redis_url or os.getenv(
        "REDIS_URL", "redis://localhost:6379/0"
    )

    logger.info(f"Connecting to Redis at {resolved_redis_url}...")
    try:
        redis_client = redis.Redis.from_url(
            resolved_redis_url, decode_responses=True
        )
        redis_client.ping()
    except Exception as e:
        logger.warning(
            f"Could not connect to Redis at {resolved_redis_url}: {e}."
        )
        redis_client = None

    checker = BloomUniquenessChecker(redis_client=redis_client)
    await checker.ensure_filters_initialized()

    logger.info("Connecting to database...")
    engine = get_async_engine(db_url)
    session_factory = get_session_factory(engine=engine)

    count = 0
    try:
        async with session_factory() as session:
            result = await session.execute(select(User.username, User.email))
            rows = result.fetchall()
            count = len(rows)

            for username, email in rows:
                await checker.add_user(username, email)

        logger.info(
            f"Successfully seeded {count} usernames and {count} emails into RedisBloom filters."
        )
    finally:
        await close_db_engine(db_url)

    return count


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CloudJudge V2 CLI Administration Tool",
        prog="python -m src.cli",
    )
    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    # seed-bloom subcommand
    seed_parser = subparsers.add_parser(
        "seed-bloom",
        help="Seed RedisBloom filters from existing database users",
    )
    seed_parser.add_argument(
        "--redis-url",
        help="Redis connection URL (default: REDIS_URL env or redis://localhost:6379/0)",
    )
    seed_parser.add_argument(
        "--db-url",
        help="Database connection URL (default: DATABASE_URL env)",
    )

    args = parser.parse_args()

    if args.subcommand == "seed-bloom":
        asyncio.run(
            run_seed_bloom(
                redis_url=args.redis_url,
                db_url=args.db_url,
            )
        )


if __name__ == "__main__":
    main()

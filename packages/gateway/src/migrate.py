import os
import sys
from pathlib import Path
from typing import Optional

from alembic import command
from alembic.config import Config


def get_alembic_config(db_url: Optional[str] = None) -> Config:
    """Create Alembic Config pointing to packages/gateway/alembic.ini."""
    current_dir = Path(__file__).resolve().parent
    ini_path = current_dir.parent / "alembic.ini"
    if not ini_path.exists():
        ini_path = Path("packages/gateway/alembic.ini")

    config = Config(str(ini_path))
    target_url = (
        db_url
        or os.getenv("DATABASE_URL")
        or "postgresql+asyncpg://postgres:postgres@localhost:5432/cloud_judge"
    )
    config.set_main_option("sqlalchemy.url", target_url)
    return config


def run_migrations(
    db_url: Optional[str] = None, revision: str = "head"
) -> None:
    """Execute Alembic upgrade to specified revision (default 'head')."""
    config = get_alembic_config(db_url)
    command.upgrade(config, revision)


def run_downgrade(
    db_url: Optional[str] = None, revision: str = "base"
) -> None:
    """Execute Alembic downgrade to specified revision (default 'base')."""
    config = get_alembic_config(db_url)
    command.downgrade(config, revision)


if __name__ == "__main__":
    db_target = sys.argv[1] if len(sys.argv) > 1 else None
    print(
        f"Applying database migrations to {db_target or 'default database'}..."
    )
    run_migrations(db_target)
    print("Database migrations applied successfully.")

# Plan 13-02 Summary: Core Relational ORM Schemas & Alembic Migration Engine

## Execution Overview
Plan 13-02 implemented the core relational ORM schemas and the Alembic asynchronous migration engine for AlgoCeleris. It fulfilled requirements PG-03, PG-04, PG-05, PG-06, and PG-07.

## Key Deliverables Implemented

1. **Relational ORM Schemas (`packages/gateway/src/models/entities.py`, `packages/gateway/src/models/__init__.py`)**:
   - Converted `packages/gateway/src/models` into a unified package preserving backwards compatibility with Pydantic schemas (`schemas.py`) while exposing declarative SQLAlchemy 2.0 ORM entities (`entities.py`).
   - Defined `User` (`users` table):
     - `id`: UUID primary key with `uuid.uuid4` default
     - `username`: String(50), unique, indexed, non-nullable
     - `email`: String(255), unique, indexed, non-nullable
     - `password_hash`: String(255), non-nullable
     - `account_type`: String(20), default "free" ('free', 'pro', 'admin')
     - `college_name`: String(255), indexed, optional
     - `avatar_url`: String(500), optional
     - `created_at`, `updated_at`: timezone-aware DateTime with `CURRENT_TIMESTAMP` defaults
     - Cascade relationships with `Subscription`, `Submission`, and `ContestParticipation`
   - Defined `Subscription` (`subscriptions` table):
     - `id`: UUID primary key
     - `user_id`: UUID ForeignKey to `users.id` with `CASCADE` delete, indexed
     - `provider`: String(30) ('stripe', 'razorpay')
     - `customer_id`: String(100), optional
     - `subscription_id`: String(100), indexed, optional
     - `status`: String(30), default "active" ('active', 'past_due', 'canceled')
     - `current_period_end`: timezone-aware DateTime, optional
     - `created_at`: timezone-aware DateTime
   - Defined `Submission` (`submissions` table):
     - `id`: UUID primary key
     - `user_id`: UUID ForeignKey to `users.id` with `SET NULL` delete (guest submissions supported), indexed
     - `problem_slug`: String(100), indexed
     - `language`: String(20)
     - `code`: Text, non-nullable
     - `verdict`: String(30)
     - `runtime_ms`, `memory_kb`, `testcases_passed`, `total_testcases`: non-nullable Integers
     - `created_at`: timezone-aware DateTime, indexed
   - Defined `ContestParticipation` (`contest_participations` table):
     - `id`: UUID primary key
     - `user_id`: UUID ForeignKey to `users.id` with `CASCADE` delete, indexed
     - `contest_id`: String(100), indexed
     - `rank`: Integer, optional
     - `score`, `penalty_minutes`, `rating_delta`: Integers
     - `created_at`: timezone-aware DateTime
     - `UniqueConstraint("user_id", "contest_id", name="uq_user_contest")`

2. **Alembic Async Migration Environment (`packages/gateway/alembic.ini`, `packages/gateway/alembic/env.py`, `packages/gateway/alembic/script.py.mako`)**:
   - Initialized Alembic configuration pointing to `%(here)s/alembic` with `sqlalchemy.url` environment fallback.
   - Configured `env.py` to support both offline DDL emission and online asynchronous migrations using `AsyncEngine` (`async_engine_from_config` and `NullPool`).
   - Added thread-safe execution handling for environments where an event loop is already running.

3. **Baseline Migration Script (`packages/gateway/alembic/versions/0001_initial_schema.py`)**:
   - Authored initial migration defining DDL for all four tables (`users`, `subscriptions`, `submissions`, `contest_participations`) and their indexes.
   - Implemented clean `downgrade()` in reverse dependency order.

4. **Programmatic Migration Runner (`packages/gateway/src/migrate.py`)**:
   - Implemented `run_migrations()` and `run_downgrade()` callable from CLI or Python code.

5. **Test Suites (`packages/gateway/tests/test_models.py`, `packages/gateway/tests/test_migrations.py`)**:
   - `test_models.py`: Verified table names, column constraints, primary/foreign keys, indexes, cascades, and instance representations.
   - `test_migrations.py`: Verified upgrade and downgrade lifecycle on SQLite and applied migrations to live PostgreSQL container (`cloud_judge_postgres`).

## Verification Results
- `python3 -m unittest packages/gateway/tests/test_models.py`: 5/5 tests passed.
- `python3 -m unittest packages/gateway/tests/test_migrations.py`: 2/2 tests passed (SQLite test db + live PostgreSQL on port 5432).
- `docker exec cloud_judge_postgres psql -U postgres -d cloud_judge -c "\dt"`: confirmed tables `users`, `subscriptions`, `submissions`, `contest_participations`, and `alembic_version` created.
- `USE_IN_MEMORY_RATE_LIMIT=true python3 -m unittest discover packages/gateway/tests`: 80/80 tests passed.

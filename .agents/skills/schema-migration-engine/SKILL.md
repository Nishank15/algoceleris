---
name: schema-migration-engine
description: "Executes relational database migrations, validates rollback scripts, and checks query plans inside containers."
---

# Schema Migration Engine Protocol

## Objective
Manage relational database schema evolution safely within containerized environments, ensuring backward compatibility, zero downtime, and reversible migrations.

## Safety & Compatibility Invariants
- **No Unsafe Not-Null Columns**: Never add a `NOT NULL` constraint to an existing table without specifying a default value or running a multi-phase backfill.
- **No Destructive Drops**: Renaming or dropping active columns/tables in a single deployment is prohibited; use expand-and-contract patterns.
- **Index Guardrails**: Enforce non-blocking index creation where supported (e.g., `CREATE INDEX CONCURRENTLY` in PostgreSQL).
- **Mandatory Reversibility**: The `downgrade()` block must cleanly invert every mutation applied by `upgrade()`.

## Container Verification Pipeline
1. **Introspect & Generate**:
   - Compare ORM models against the current database schema:
     `docker compose exec <backend-service> alembic revision --autogenerate -m "<migration_name>"`
2. **Static Inspection**:
   - Inspect the generated migration file inside `alembic/versions/` to verify operations, constraints, and foreign key definitions.
3. **Upgrade Verification**:
   - Apply migration against local database container:
     `docker compose exec <backend-service> alembic upgrade head`
4. **Reversibility Drill**:
   - Step back one revision to verify the rollback path:
     `docker compose exec <backend-service> alembic downgrade -1`
   - Re-apply head migration to confirm clean state restoration:
     `docker compose exec <backend-service> alembic upgrade head`
5. **Schema Health Check**:
   - Verify table integrity and foreign key constraints via `docker compose exec <db-service> pg_isready`.
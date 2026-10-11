# Plan 14-01 Summary: RedisBloom Uniqueness Layer, Argon2id & CLI Seeder

## Execution Overview
Plan 14-01 delivered the core security primitives and uniqueness verification pipeline for Milestone v2.2, fulfilling requirements AUTH-01, AUTH-02, AUTH-03, and AUTH-04.

## Key Deliverables Implemented

1. **Service and Dependency Upgrades (`deploy/docker-compose.yml`, `packages/gateway/pyproject.toml`, `deploy/Dockerfile.gateway`)**:
   - Upgraded Redis service to `redis/redis-stack-server:latest` providing official RedisBloom module out-of-the-box on port 6379.
   - Added `argon2-cffi>=23.1.0` and `pyjwt>=2.8.0` to Python dependencies in gateway package and container definitions.

2. **RedisBloom Dual-Layer Uniqueness Checker (`packages/gateway/src/auth/bloom.py`, `packages/gateway/src/auth/__init__.py`)**:
   - Implemented `BloomUniquenessChecker` with `bf:usernames` and `bf:emails` filters.
   - Implemented `ensure_filters_initialized()` using `BF.RESERVE 0.001 1000000`.
   - Built two-layer validation pipeline:
     - **Layer 1**: Sub-millisecond pre-check with `BF.EXISTS`. 0% false negative rate guarantees instant `True` response if absent.
     - **Layer 2**: Direct PostgreSQL query fallback (`SELECT 1 FROM users WHERE lower(...) = ...`) when Bloom filter reports positive, completely absorbing potential false positives.
   - Built `InMemoryBloomFilter` with bitwise hashing for deterministic offline and in-memory test execution.

3. **Argon2id Security & Dual-Token Engine (`packages/gateway/src/auth/security.py`)**:
   - Configured Argon2id password hashing with production parameters (`time_cost=2`, `memory_cost=65536`, `parallelism=1`, `hash_len=32`, `type=Type.ID`).
   - Implemented `create_access_token` issuing 15-minute in-memory JWTs with user id, username, email, and role.
   - Implemented `create_refresh_token`, `register_refresh_token`, and `validate_and_cycle_refresh_token` supporting rotating 14-day tokens.
   - Built token family replay attack detection (`ReplayAttackException`): reusing an already-consumed refresh token immediately revokes the entire token family.

4. **CLI Seeder (`packages/gateway/src/cli.py`)**:
   - Implemented `python -m src.cli seed-bloom` querying existing usernames and emails from PostgreSQL and loading them into `bf:usernames` and `bf:emails`.

5. **Automated Unit Tests (`packages/gateway/tests/test_bloom.py`, `packages/gateway/tests/test_security.py`)**:
   - 14 automated tests covering Bloom filter fast path, false positive DB fallback absorption, Argon2id verification, token expiration, tampered signatures, token cycling, and replay attack revocation.
   - All 94 gateway tests passing cleanly.

## Verification
- `python3 -m unittest packages/gateway/tests/test_bloom.py packages/gateway/tests/test_security.py`: 14/14 passed.
- `python3 -m packages.gateway.src.cli seed-bloom --db-url "postgresql+asyncpg://postgres:postgres@localhost:5432/cloud_judge"`: executed successfully with code 0.
- `USE_IN_MEMORY_RATE_LIMIT=true python3 -m unittest discover packages/gateway/tests`: 94/94 passed.

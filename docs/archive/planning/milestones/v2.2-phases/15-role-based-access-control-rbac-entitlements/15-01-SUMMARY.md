# Phase 15-01 Summary: Role-Based Access Control (RBAC) & Entitlements

## Overview
Phase 15-01 implemented FastAPI route guards (`get_current_user`, `get_optional_current_user`, `require_pro`, `require_admin`), an administrative role-management CLI tool (`set-role`), integrated RBAC protection into the AI Code Assistant, and verified all permissions across 111 passing tests.

## Completed Tasks

### Task 1: RBAC Route Guards in Gateway Auth Module
- Created `packages/gateway/src/auth/rbac.py`:
  - `get_current_user`: Validates JWT Bearer authorization header, checks `type == "access"`, decodes claims, and retrieves the active `User` record from PostgreSQL via async SQLAlchemy.
  - `get_optional_current_user`: Returns authenticated `User` or `None` without blocking unauthenticated requests.
  - `require_pro`: Enforces `user.account_type in ("pro", "admin")`. Rejects Free tier accounts with HTTP 403 Forbidden containing structured upgrade metadata (`{"error": "pro_tier_required", "upgrade_url": "/pricing", ...}`).
  - `require_admin`: Enforces `user.account_type == "admin"`. Rejects Free and Pro accounts with HTTP 403 Forbidden (`{"error": "admin_privileges_required"}`).
- Exported all dependencies through `packages/gateway/src/auth/__init__.py`.

### Task 2: Administrative CLI Subcommand (`set-role`)
- Updated `packages/gateway/src/cli.py`:
  - Implemented `run_set_role` and `set-role` subparser accepting `--email`, `--username`, `--role {free, pro, admin}`, `--db-url`, and `--redis-url`.
  - Safely updates `users.account_type` and `updated_at` in PostgreSQL.
  - Automatically synchronizes `SubscriptionStore` records (`SubscriptionTier.PRO` for pro/admin, `SubscriptionTier.FREE` for free).
  - Protected cached test engines from premature disposal.

### Task 3: RBAC Integration in AI Router & Rate Limiter
- Updated `packages/gateway/src/ratelimit/middleware.py`:
  - Extended `get_tier_rate_limit_config` so `admin` accounts inherit high-capacity Pro quotas (100 submissions/min, 10 AI debug requests/min).
  - Added optional `tier` override parameter to `RateLimiter.__call__`.
- Updated `packages/gateway/src/ai/router.py`:
  - Protected `/api/v1/ai/debug` with `current_user = Depends(get_optional_current_user)`.
  - Enforces Pro/Admin tier on authenticated users while maintaining backward compatibility for legacy callers.

### Task 4: Automated Testing
- Created `packages/gateway/tests/test_rbac.py` with 7 comprehensive test cases:
  - `test_get_current_user_unauthorized`
  - `test_get_current_user_success`
  - `test_optional_current_user`
  - `test_require_pro_guard`
  - `test_require_admin_guard`
  - `test_set_role_cli`
  - `test_ai_router_with_rbac`
- All 7 tests in `test_rbac.py` passed cleanly.
- Full test suite passed: **111 tests passing** across all gateway modules.

## Artifacts Created / Modified
- `packages/gateway/src/auth/rbac.py`
- `packages/gateway/src/auth/__init__.py`
- `packages/gateway/src/cli.py`
- `packages/gateway/src/ratelimit/middleware.py`
- `packages/gateway/src/ai/router.py`
- `packages/gateway/tests/test_rbac.py`

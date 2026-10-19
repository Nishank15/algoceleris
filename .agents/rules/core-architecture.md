---
trigger: always_on
description: Core system architecture, runtime invariants, and security constraints for AlgoCeleris / Cloud-Judge V2
---

# Core Architecture Invariants

Every agent modifying this codebase MUST comply with the following architectural invariants derived from PROJECT.md. Do not introduce alternative architectures without an explicit human override.

## 1. System Topology & Ingress
- **Ingress / Load Balancer**: HAProxy Layer 7 reverse proxy (`deploy/haproxy/haproxy.cfg`, listening on `:8080`, plain `:80` at the edge). Every API path (`/api/v1/*`), WebSocket upgrade (`/ws/*`), and health probe (`/health`) is routed to the Rust Axum gateway pool, which also carries the default backend.
- **Gateway**: A single stateless Axum instance of `crates/judge-gateway` serves the platform on `:9000` (`PORT`). The legacy dual FastAPI gateways (`:8000`/`:8001`) have been removed from the HAProxy config and MUST NOT be reintroduced; `packages/gateway` is dormant at runtime and is retained only for Alembic migrations and parity tests. Gateway instances MUST remain completely stateless: all session, cache, and coordination state resides in Redis or PostgreSQL.
- **Asynchronous Task Queue**: Code submissions are pushed to the Redis queue (`submissions:queue`, mirrored to the legacy `judge:submissions` key) and consumed asynchronously by `judge-worker` daemons. Never evaluate code synchronously on the HTTP request loop.
- **Redis Event Streaming**: Workers publish progress frames and terminal verdicts onto Redis Pub/Sub channels (`submissions:{id}:events`, mirrored onto `judge:events:{id}`); the gateway subscribes and relays them to `/ws/submissions/{id}` clients. Proctoring telemetry relays the same way over `/ws/campus/assessments/{id}/proctor`, with Redis incident logs plus PostgreSQL persistence backing the faculty cockpit.
- **Server-Authoritative Evaluation**: Grading criteria live in PostgreSQL (`problems`, `problem_test_cases`, Alembic revision `0004`) and are seeded idempotently at gateway start from `crates/judge-db/src/problem_catalog.rs` (`repositories/problem.rs`). The gateway resolves the case set per request — public samples for `mode: "run"`, the full set for `mode: "submit"` — and client-supplied `test_cases` payloads MUST be ignored. Secret/hidden test cases MUST be masked out of every client-facing response.

## 2. Worker Engine & Sandbox Isolation
- **Resource Constraints**: Hard boundaries enforced via Linux cgroups:
  - Memory ceiling: 256MB.
  - CPU allocation: 1 vCPU.
  - Network namespace: Dropped (`unshare --net`). Zero outbound or inbound socket connections permitted during code execution.
- **Execution Target**: Daemons run directly on the Linux host/worker container. Do NOT implement per-submission dynamic Docker/Kubernetes container spin-up (sub-second evaluation startup latency is a hard requirement).
- **Supported Compilers**: GCC/G++ (C++20), Python 3.12, Java 21 OpenJDK.

## 3. Data Persistence & Caching
- **Relational Storage**: PostgreSQL 16 accessed from Rust through `sqlx` async connection pools (`crates/judge-db`).
  - Primary keys MUST use UUIDs.
  - All schema mutations MUST be performed via versioned Alembic migrations (`packages/gateway/alembic`, `alembic revision --autogenerate`). Never execute raw DDL scripts.
- **Uniqueness Checks**: Username and email availability MUST be checked case-insensitively, with PostgreSQL as the source of truth (the offline in-memory store is the fallback when no pool is configured).
- **Leaderboard Reads**: Contest leaderboards MUST be served from the in-memory/Redis-backed ranking store, never recomputed by scanning relational tables on every poll.

## 4. Authentication, Security & RBAC
- **Password Hashing**: RFC 9106 Argon2id only (`time_cost=2`, `memory_cost=65536`, `parallelism=4`).
- **Session Tokens**: Dual-token architecture:
  - Access Token: Short-lived (15 min) JWT kept exclusively in client-side memory. NEVER persist access tokens to `localStorage` or `sessionStorage`.
  - Refresh Token: Long-lived (7–14 days) random token stored inside an `HttpOnly`, `SameSite=Lax`, `Secure` cookie.
  - Replay Protection: Refresh token families tracked in Redis. Detect token reuse and revoke the entire family immediately upon anomaly detection.
- **RBAC & Route Guards**: Enforced via Axum extractors (`AuthenticatedUser`, `RequireStudent`, `RequireInstructor`, `RequireOrgAdmin` in `crates/judge-gateway/src/extractors/`). Insufficient permissions return structured 403 Problem Details payloads.
- **Admin Immunity**: External billing webhooks (Stripe / Razorpay) must explicitly check `user.account_type != 'admin'` before applying subscription downgrades or cancellations.

## 5. Anti-Abuse & Rate Limiting
- **AI Debug Quota**: `POST /api/v1/ai/debug` (alias `/api/v1/subscriptions/ai-debug`) is rate limited per user in Redis (`ratelimit:ai_debug:{user_id}`, fixed window): 5 requests / 10 min on the free tier, 60 / 10 min for pro roles, with HTTP 429 + `Retry-After` on exhaustion and an in-memory fallback when Redis is unavailable. Model-backed mode requires a session; the deterministic fallback is anonymous-allowed so offline development keeps working.
- **AI Debug Resilience**: The assistant calls an OpenAI/Gemini-compatible chat provider when `LLM_*` configuration is present and MUST degrade gracefully — model failure, timeout, or malformed output falls back to the deterministic diagnosis. Every response reports its origin via the `x-ai-debug-source` header (`llm` | `deterministic-fallback` | `deterministic`).
- **Plagiarism Detection**: Post-contest evaluation uses AST Winnowing (MOSS algorithm) on tokenized AST representations, invariant to identifier renaming, whitespace, and comments.

## 6. Frontend & Design Token Constraints
- **Design System**: Refero Linear Midnight precision palette.
  - Core tokens: Void (`#08090a`), Carbon (`#0f1011`), Obsidian (`#161718`), hairline borders (`#23252a`), Acid Lime (`#e4f222` reserved strictly for primary submit actions).
  - `--text-muted` in dark mode MUST stay at WCAG 2.1 AA contrast (≥ 4.5:1) against `--bg-surface`/`--bg-surface-elevated` while remaining visibly dimmer than `--text-secondary`.
  - Enforced-dark portals (`/campus/*`, `/hackathons/*`) pin `data-theme="dark"` via `RouteThemeScope` (`.enforced-dark-surface`). Theme toggle buttons carry `.theme-toggle-btn` and are hidden inside those scopes; do not add per-page toggles that fight the pinned theme.
- **Theme Inversion**: Light/Dark toggle relies on CSS custom property inversion via `:root[data-theme='light']`. Do not add layout-shifting inline color overrides.
- **Monaco Editor**: Switch themes via `monaco.editor.setTheme()` using a persistent editor reference. Never unmount the editor instance on theme change (preserves undo/redo buffers and cursor state).
- **Guest State Migration**: Unauthenticated runs save to client `localStorage`. On login/signup, hook `POST /api/v1/users/submissions/migrate-guest` automatically transfers guest records to PostgreSQL.

## 7. Out of Scope (Hard Constraints)
- Dynamic Kubernetes pod-per-submission orchestration.
- Native mobile applications (desktop responsive web is the sole focus).
- Manual human code review workflows.

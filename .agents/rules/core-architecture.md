---
trigger: always_on
---

---
trigger: always_on
description: Core system architecture, runtime invariants, and security constraints for AlgoCeleris / Cloud-Judge V2
---

# Core Architecture Invariants

Every agent modifying this codebase MUST comply with the following architectural invariants derived from PROJECT.md. Do not introduce alternative architectures without an explicit human override.

## 1. System Topology & Ingress
- **Ingress / Load Balancer**: HAProxy Layer 7 reverse proxy listening on port 8080. Handles round-robin balancing across dual FastAPI gateways (`gateway_1` on :8000, `gateway_2` on :8001) and upgrades WebSocket connections.
- **Stateless Gateways**: Gateway instances must remain completely stateless. All session, cache, and coordination state resides in Redis or PostgreSQL.
- **Asynchronous Task Queue**: Code submissions are pushed to Redis queues and consumed asynchronously by worker daemons; never evaluate code synchronously on the HTTP request loop.

## 2. Worker Engine & Sandbox Isolation
- **Resource Constraints**: Hard boundaries enforced via Linux cgroups:
  - Memory ceiling: 256MB.
  - CPU allocation: 1 vCPU.
  - Network namespace: Dropped (`unshare --net`). Zero outbound or inbound socket connections permitted during code execution.
- **Execution Target**: Daemons run directly on the Linux host/worker container. Do NOT implement per-submission dynamic Docker/Kubernetes container spin-up (sub-second evaluation startup latency is a hard requirement).
- **Supported Compilers**: GCC/G++ (C++20), Python 3.12, Java 21 OpenJDK.

## 3. Data Persistence & Caching
- **Relational Storage**: PostgreSQL 16 using SQLAlchemy 2.0 Async with `asyncpg` connection pooling and statement timeouts.
  - Primary keys MUST use UUIDs.
  - All schema mutations MUST be performed via versioned Alembic migrations (`alembic revision --autogenerate`). Never execute raw DDL scripts.
- **Probabilistic Cache (RedisBloom)**:
  - Username and email uniqueness checks MUST hit RedisBloom first (`BF.EXISTS`).
  - Only fall back to PostgreSQL if the Bloom filter reports a potential collision.
  - If RedisBloom is unavailable, gracefully fall back to the in-memory Bloom simulator.
- **Contest Leaderboards**: Real-time rank and ICPC penalty updates MUST use Redis Sorted Sets (`ZADD`, `ZRANGE`). Do not query relational databases for live scoreboard recalculations.

## 4. Authentication, Security & RBAC
- **Password Hashing**: RFC 9106 Argon2id only (`time_cost=2`, `memory_cost=65536`, `parallelism=4`).
- **Session Tokens**: Dual-token architecture:
  - Access Token: Short-lived (15 min) JWT kept exclusively in client-side memory. NEVER persist access tokens to `localStorage` or `sessionStorage`.
  - Refresh Token: Long-lived (7–14 days) random token stored inside an `HttpOnly`, `SameSite=Lax`, `Secure` cookie.
  - Replay Protection: Refresh token families tracked in Redis. Detect token reuse and revoke the entire family immediately upon anomaly detection.
- **RBAC & Route Guards**: Enforced via FastAPI dependencies (`require_pro`, `require_admin`). Returns structured 403 payloads on insufficient permissions.
- **Admin Immunity**: External billing webhooks (Stripe / Razorpay) must explicitly check `user.account_type != 'admin'` before applying subscription downgrades or cancellations.

## 5. Anti-Abuse & Rate Limiting
- **Rate Limiting**: Redis Token-Bucket algorithm guards all submission and AI endpoints.
- **Plagiarism Detection**: Post-contest evaluation uses AST Winnowing (MOSS algorithm) on tokenized AST representations, invariant to identifier renaming, whitespace, and comments.

## 6. Frontend & Design Token Constraints
- **Design System**: Refero Linear Midnight precision palette.
  - Core tokens: Void (`#08090a`), Carbon (`#0f1011`), Obsidian (`#161718`), hairline borders (`#23252a`), Acid Lime (`#e4f222` reserved strictly for primary submit actions).
- **Theme Inversion**: Light/Dark toggle relies on CSS custom property inversion via `:root[data-theme='light']`. Do not add layout-shifting inline color overrides.
- **Monaco Editor**: Switch themes via `monaco.editor.setTheme()` using a persistent editor reference. Never unmount the editor instance on theme change (preserves undo/redo buffers and cursor state).
- **Guest State Migration**: Unauthenticated runs save to client `localStorage`. On login/signup, hook `POST /api/v1/users/submissions/migrate-guest` automatically transfers guest records to PostgreSQL.

## 7. Out of Scope (Hard Constraints)
- Dynamic Kubernetes pod-per-submission orchestration.
- Native mobile applications (desktop responsive web is the sole focus).
- Manual human code review workflows.
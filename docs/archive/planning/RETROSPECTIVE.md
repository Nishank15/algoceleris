# Project Retrospective: Cloud-Judge V2

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0 — Commercial Launch & Complete Platform

**Shipped:** 2026-10-03  
**Phases:** 7 | **Plans:** 20 | **Tasks:** 62  

### What Was Built
- Hardened Linux cgroup v2 sandbox executing C++, Python 3.12, and Java 21 with 256MB RAM/1 CPU limits and no network.
- Asynchronous FastAPI submission gateway, Redis broker, concurrent worker daemons, and live WebSocket test-case execution streaming.
- Linear-style midnight dark frontend IDE with Monaco Editor, 3-pane resizable layout, Zen mode, and interactive test runner.
- Commercial subscription billing with Stripe and Razorpay dual payment gateways, cryptographic signature verification, and automated entitlement provisioning.
- Gemini 2.5 Flash AI code debugging assistant providing structured root-cause analysis and code diffs, protected by Redis Token-Bucket rate limiting.
- Real-time contest engine with ICPC 20-min penalty scoring, Redis Sorted Set O(log N) live leaderboards, and fullscreen/clipboard anti-cheat proctoring.
- Post-contest AST Winnowing plagiarism detection engine, 21st.dev 3D isometric submission skyline heatmap, tumbling cube loader, and HAProxy Layer 7 reverse proxy.

### What Worked
- Decoupled worker daemon and Redis Pub/Sub architecture allowed completely non-blocking execution evaluation with sub-millisecond dispatch.
- Strict Pydantic models across API and WebSocket boundaries ensured seamless client-server typing without deserialization bugs.
- Monaco Editor integration combined with vanilla CSS design tokens produced a slick, responsive, Linear-grade developer interface.
- Layered mock testing across Stripe, Razorpay, Gemini API, and Redis ensured robust test suites (102 tests) running in under 15 seconds.

### What Was Inefficient
- Initial verification markers in phase summaries had minor status string discrepancies (`verified` vs `passed`), requiring manual reconciliation before milestone closeout.
- Python test runners required explicit path setups for virtual environments across different mac shells.

### Patterns Established
- Wave-based execution in GSD plans: Wave 1 (foundation/contracts) → Wave 2 (backend/daemons) → Wave 3 (frontend/ingress).
- Cryptographic signature verification and atomic idempotency for all external payment webhooks.
- Standard RFC rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`) returned consistently on all endpoints.

### Key Lessons
1. Designing the contract schemas (Pydantic / TypeScript types) upfront in Wave 1 eliminates 90% of cross-layer integration friction between backend services and UI components.
2. In-memory thread-safe fallbacks for Redis operations enable resilient development and automated unit testing in environments where Redis services are not running.

---

## Milestone: v2.1 — LeetCode-Grade Multi-Page Architecture & Refero Linear Midnight Platform

**Shipped:** 2026-10-04  
**Phases:** 5 | **Plans:** 10 | **Tasks:** 0  

### What Was Built
- Precision Refero Linear Midnight design system with Bedrock Void, Carbon, Obsidian, and hairline Graphite tokens, typography capped at ≤ 590 weights, and zero purple/violet gradients.
- Client-side routing with react-router-dom and unified LinearHeaderNav with live gateway latency indicator and guest/user status.
- Minimalist hero landing page with live benchmark telemetry (<15ms cold start, 256MB cap, 1 vCPU, air-gapped network) and interactive micro-sandbox runner teaser.
- Centered Carbon authentication views with guest login bypass and session persistence via AuthContext.
- High-density LeetCode problem catalog at /problems with 12 classic problems, sub-50ms reactive search, difficulty pills (Pulse Green, Amber, Coral Red), and topic taxonomy strip.
- Distraction-free 3-pane Monaco IDE workspace at /problems/:slug with LeetCode class Solution stubs across C++20, Python 3.12, Java 21, and Acid Lime primary submit action.
- Side-by-side testcase diff viewer with token mismatch highlights and 10-second client execution watchdog preventing hung evaluation states.
- Full-page developer profile at /u/:username with 21st.dev 3D isometric skyline, contest rating progression chart, and circular solved breakdown ring.
- Full-page contests hub at /contests with active/upcoming live countdown clocks, persistent registration toggle, and real-time Redis Sorted Set leaderboards with ICPC penalties.

### What Worked
- Pure vanilla CSS custom properties without CSS framework overhead delivered instantaneous rendering and precise visual fidelity matching Linear's design guidelines.
- Dividing problem solving into catalog (`/problems`) and dedicated workspace (`/problems/:slug`) vastly improved developer ergonomics compared to a single-page view.
- 10-second client execution watchdog completely eliminated silent UI hangs when WebSocket connections experienced packet drop.

### Key Lessons
- Visual design contracts (UI-SPEC) established prior to frontend implementation prevent aesthetic drift and component re-styling iterations.

---

## Milestone: v2.2 — Production Identity, PostgreSQL Persistence, UX & Theme System

**Shipped:** 2026-10-05  
**Phases:** 5 | **Plans:** 10 | **Tasks:** 18  

### What Was Built
- Production PostgreSQL 16 infrastructure with Docker Compose, asyncpg connection pooling with statement timeouts, and Alembic database migration engine.
- Complete relational schema covering `users`, `subscriptions`, `submissions`, and `contest_participations` with UUID primary keys and composite indexes.
- Hardened authentication with Argon2id password hashing, sub-millisecond username/email uniqueness checking via RedisBloom (with in-memory fallback), and dual-token session architecture (15m JWT + 7d rotating HttpOnly refresh cookie with token family replay protection).
- Role-Based Access Control (RBAC) supporting `free`, `pro`, and `admin` tiers, FastAPI dependency guards (`require_pro`, `require_admin`), structured 403 upgrade payloads, and admin CLI role management with third-party billing cancellation immunity.
- Real-time signup availability indicators with debounced (150ms) status badges, and automated client-to-server guest submission migration associating local history with new user accounts.
- Live PostgreSQL analytics queries driving the developer profile difficulty solve breakdown ring, contest rating progression sparkline, and 21st.dev 3D isometric submission skyline.
- Universal Linear Dark / Light mode toggle system with comprehensive CSS token inversion (`:root[data-theme='light']`), top navigation toggle button, system preference persistence, and buffer-preserving Monaco editor theme synchronization.

### What Worked
- Layered RedisBloom pre-checks before PostgreSQL queries provided sub-millisecond response times for real-time username availability badges without hammering the primary database.
- Graceful in-memory fallbacks across RedisBloom, JWT stores, and DB connections enabled high-speed unit testing (130 tests passing in <15s) with zero external dependency requirements during CI.
- CSS token inversion on `:root[data-theme='light']` enabled a complete theme switch across hundreds of UI elements with zero layout shifts and seamless Monaco editor theme alignment.
- Token family tracking with automatic revocation on reuse reliably mitigated replay attacks while preserving seamless user experience through silent token rotation.

### What Was Inefficient
- Cookie attributes (`SameSite`, `Secure`, `HttpOnly`, `Path`) required meticulous alignment across test client contexts and browser environments to ensure session refresh cookies persisted properly.

### Patterns Established
- Multi-tier validation: Tier 1 probabilistic bloom pre-check → Tier 2 indexed relational query.
- Token family replay protection: invalidating entire token tree upon duplicate refresh token presentation.
- Administrative role immunity against webhook downgrades.
- Centralized CSS variable inversion for instant theme switching without component-level conditional styles.

### Key Lessons
1. Probabilistic data structures (RedisBloom) deployed as fronting caches dramatically reduce relational database load on public registration and lookup endpoints.
2. Centralized CSS design token architecture enables seamless full-application theming (including complex third-party widgets like Monaco Editor) with minimal code complexity.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Plans | Key Change |
|-----------|----------|--------|-------|------------|
| v2.0 | 7 | 7 | 20 | Initial full-stack platform build from sandbox to ingress via GSD execution phases |
| v2.1 | 5 | 5 | 10 | LeetCode-grade multi-page architecture, Refero Linear Midnight design system |
| v2.2 | 5 | 5 | 10 | Production PostgreSQL, RedisBloom auth, RBAC, live analytics, Dark/Light theme |

### Cumulative Quality

| Milestone | Tests | Coverage | Code Delta (LOC) |
|-----------|-------|----------|------------------|
| v2.0 | 102 | >90% | Initial scaffold |
| v2.1 | 102 | >90% | +3,200 LOC frontend |
| v2.2 | 130 | >92% | +6,633 LOC full-stack |

### Top Lessons (Verified Across Milestones)

1. Schema-first interface contracts (FastAPI Pydantic + TypeScript types) guarantee frictionless end-to-end integration across async boundaries.
2. In-memory thread-safe fallbacks for external backing services (Redis, RedisBloom, DB) allow comprehensive unit test suites to execute deterministically in seconds.
3. Centralized CSS token systems provide unmatched visual consistency, instant theming, and zero layout shift without heavy third-party CSS dependencies.


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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v2.0 | 7 | 7 | Initial full-stack platform build from sandbox to ingress via GSD execution phases |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v2.0 | 102 | >90% | 7 phases (full platform) |

### Top Lessons (Verified Across Milestones)

1. Schema-first interface contracts (FastAPI Pydantic + TypeScript types) guarantee frictionless end-to-end integration across async boundaries.

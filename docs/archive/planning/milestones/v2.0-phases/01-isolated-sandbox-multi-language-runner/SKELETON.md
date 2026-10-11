# Walking Skeleton — Cloud-Judge V2

**Phase:** 1
**Generated:** 2026-10-02

## Capability Proven End-to-End

A user submission in C++, Python, or Java can be compiled, executed inside an isolated cgroups resource-constrained environment (256MB RAM, 1 CPU, network drop), evaluated against test cases, and return an accurate verdict (Passed, TLE, MLE, CE, RE) with execution metrics.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Core Language | Python 3.12 | Native Linux cgroups integration, asyncio concurrency, rich typing, and seamless FastAPI integration in Phase 2 |
| Sandboxing Mechanism | Linux cgroups v2 (`/sys/fs/cgroup`) + Namespace Isolation | Native kernel enforcement with sub-millisecond setup overhead compared to heavy VM spinups |
| Local Dev Fallback | OS-adaptive executor (`setrlimit` / container boundary) | Allows frictionless development on macOS while enforcing strict cgroups v2 in Linux environments |
| Compilation & Toolchain | GCC 13+ (g++), Python 3.12, OpenJDK 21 | Industry standard versions for modern competitive programming |
| Data Model | Pydantic v2 Models (`ExecutionResult`, `TestCaseVerdict`) | Strict type safety, serialization, and clean contract handoff to FastAPI and WebSockets |
| Directory Layout | `packages/engine/` (core sandbox, runners, evaluator) | Modular architecture ready for queue integration in Phase 2 |

## Stack Touched in Phase 1

- [ ] Project scaffold (Python 3.12 `pyproject.toml`, pytest, ruff linting)
- [ ] Isolation Jail — cgroups v2 controller (`memory.max=256M`, `cpu.max=100000 100000`, `pids.max=64`, network drop)
- [ ] Multi-Language Runners — C++ (g++ C++20), Python 3.12, Java 21 OpenJDK
- [ ] Evaluation Engine — Test case input feeder, stdout/stderr collector, TLE/MLE watchdog, verdict generator
- [ ] Verification Suite — Automated test battery proving Accepted, TLE, MLE, CE, and RE across all three languages

## Out of Scope (Deferred to Later Slices)

- FastAPI HTTP gateway endpoints (Phase 2)
- Redis job broker and distributed worker queue polling (Phase 2)
- WebSocket client broadcasting (Phase 2)
- Monaco Editor frontend IDE (Phase 3)
- Tiered subscription gating and payment processing (Phase 4)
- AI debugging suggestions (Phase 5)
- Contest leaderboards and proctoring (Phase 6)
- AST-based plagiarism analysis (Phase 7)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Asynchronous queue pipeline & real-time WebSocket streaming
- Phase 3: Midnight dark Linear IDE frontend with Monaco editor
- Phase 4: Commercial subscriptions with Stripe & Razorpay gateways
- Phase 5: AI debugging assistant with Gemini 2.5 Flash
- Phase 6: Real-time contest engine and proctoring
- Phase 7: Plagiarism engine, 3D isometric analytics & HAProxy ingress

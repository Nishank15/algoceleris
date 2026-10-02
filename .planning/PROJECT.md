# Cloud-Judge V2

## What This Is

Cloud-Judge V2 is a production-grade, commercial online judge and competitive programming platform featuring a Linear-style midnight dark design. It provides multi-language sandboxed code execution, real-time streaming feedback, contest proctoring, AI-assisted debugging, plagiarism detection, and monetization via tiered subscriptions.

## Core Value

Secure, ultra-low-latency, real-time multi-language code evaluation sandboxing paired with a frictionless developer experience and contest integrity.

## Business Context

- **Customer**: Competitive programmers, software engineering interview candidates, university students, and contest organizers.
- **Revenue model**: Tiered subscription model (Free vs. Pro) powered by dual payment gateways (Stripe + Razorpay).
- **Success metric**: Sub-second execution queuing & dispatch latency, 99.99% sandbox isolation reliability, and active subscription conversion.
- **Strategy notes**: Commercial competitive programming platform delivering premium aesthetics, developer ergonomics, robust anti-cheat proctoring, and integrated AI tutoring.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Multi-language isolated execution sandbox (C++, Python 3.12, Java 21) with Linux cgroups (256MB RAM, 1 CPU, network disabled)
- [ ] Asynchronous task queue architecture (FastAPI gateway, Redis broker, concurrent worker daemon pool)
- [ ] Real-time execution streaming over WebSockets providing live per-test-case status and stdout/stderr feedback
- [ ] Next.js/Vite frontend IDE with Monaco Editor, 3-pane resizable layout, midnight dark Linear aesthetics, and Zen/Normal mode toggle
- [ ] Tiered subscription billing system (Free vs. Pro) integrating Stripe and Razorpay checkout & webhooks
- [ ] AI code assistant debugging suggestions powered by Gemini 2.5 Flash with Redis Token-Bucket rate limiting
- [ ] Real-time contest engine with live Redis Sorted Set leaderboards, fullscreen proctoring, and clipboard protection
- [ ] Post-contest plagiarism detection engine using AST-based Winnowing / MOSS algorithm
- [ ] Developer analytics including a 3D isometric contribution activity heatmap and custom isometric cube loader
- [ ] High-throughput Layer 7 reverse proxy and load balancing using HAProxy

### Out of Scope

- [ ] Native mobile apps — Web application with responsive desktop focus is priority for IDE experience
- [ ] Dynamic Kubernetes pod-per-run container orchestration — High overhead per submission; Linux cgroups daemon workers chosen for sub-second start latency

## Context

- Building Cloud-Judge V2 as a state-of-the-art commercial online judge platform.
- Security and isolation require cgroups v2/namespaces or containerized worker sandboxes with strict memory, CPU, process, and network limits.
- Modern frontend demands Linear-level craft: deep slate/black palettes, high-performance Monaco integration, silky smooth pane resizing, and responsive WebSocket updates.

## Constraints

- **Security**: Hardened sandbox execution: strict 256MB RAM, 1 CPU limit, no network access, dropped capabilities.
- **Performance**: Real-time test case streaming over WebSockets with minimal queue latency.
- **Architecture**: Decoupled FastAPI gateway, Redis queue, worker daemons, and HAProxy reverse proxy.
- **Rate Limiting**: Redis Token-Bucket algorithm for AI assistant and submission endpoints.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Linux cgroups over heavy VM spinup | Ultra-fast execution startup times critical for competitive programming | — Pending |
| WebSockets instead of HTTP polling | Lower latency and reduced server overhead during multi-testcase runs | — Pending |
| Dual payment gateways (Stripe + Razorpay) | Global coverage (Stripe) and seamless domestic India support (Razorpay) | — Pending |
| Gemini 2.5 Flash with Token-Bucket rate limits | Fast, intelligent debugging explanations with cost predictability and abuse prevention | — Pending |
| Redis Sorted Sets for contest leaderboards | O(log(N)) ranking updates and real-time range queries for live contests | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-02 after initialization*

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

- ✓ Multi-language isolated execution sandbox (C++, Python 3.12, Java 21) with Linux cgroups (256MB RAM, 1 CPU, network disabled) — v2.0
- ✓ Asynchronous task queue architecture (FastAPI gateway, Redis broker, concurrent worker daemon pool) — v2.0
- ✓ Real-time execution streaming over WebSockets providing live per-test-case status and stdout/stderr feedback — v2.0
- ✓ Frontend IDE with Monaco Editor, 3-pane resizable layout, midnight dark Linear aesthetics, and Zen/Normal mode toggle — v2.0
- ✓ Tiered subscription billing system (Free vs. Pro) integrating Stripe and Razorpay checkout & webhooks — v2.0
- ✓ AI code assistant debugging suggestions powered by Gemini 2.5 Flash with Redis Token-Bucket rate limiting — v2.0
- ✓ Real-time contest engine with live Redis Sorted Set leaderboards, fullscreen proctoring, and clipboard protection — v2.0
- ✓ Post-contest plagiarism detection engine using AST-based Winnowing / MOSS algorithm — v2.0
- ✓ Developer analytics including 21st.dev 3D isometric contribution activity skyline heatmap and tumbling cube loader — v2.0
- ✓ High-throughput Layer 7 reverse proxy and load balancing using HAProxy — v2.0

### Active (Next Milestone Candidates)

- [ ] Real-time multiplayer collaborative coding interview rooms with live cursors and shared terminal
- [ ] User-defined custom compiler flags and sandbox container image selection
- [ ] WebRTC webcam proctoring with automated face gaze tracking and acoustic anomaly detection

### Out of Scope

- [ ] Native mobile apps — Web application with responsive desktop focus is priority for IDE experience
- [ ] Dynamic Kubernetes pod-per-run container orchestration — High overhead per submission; Linux cgroups daemon workers chosen for sub-second start latency
- [ ] Manual human code review — Automated sandbox judge, AST plagiarism, and AI assistant handle evaluation

## Context

- Shipped Milestone v2.0 as a complete commercial competitive programming platform.
- Total 7 phases, 20 plans, 102 passing backend tests, and production Vite frontend bundle.
- Architecture: Decoupled FastAPI gateway, Redis queue broker, worker daemons, and HAProxy Layer 7 reverse proxy.

## Constraints

- **Security**: Hardened sandbox execution: strict 256MB RAM, 1 CPU limit, no network access, dropped capabilities.
- **Performance**: Real-time test case streaming over WebSockets with minimal queue latency.
- **Architecture**: Decoupled FastAPI gateway, Redis queue, worker daemons, and HAProxy reverse proxy.
- **Rate Limiting**: Redis Token-Bucket algorithm for AI assistant and submission endpoints.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Linux cgroups over heavy VM spinup | Ultra-fast execution startup times critical for competitive programming | ✓ Good |
| WebSockets instead of HTTP polling | Lower latency and reduced server overhead during multi-testcase runs | ✓ Good |
| Dual payment gateways (Stripe + Razorpay) | Global coverage (Stripe) and seamless domestic India support (Razorpay) | ✓ Good |
| Gemini 2.5 Flash with Token-Bucket rate limits | Fast, intelligent debugging explanations with cost predictability and abuse prevention | ✓ Good |
| Redis Sorted Sets for contest leaderboards | O(log(N)) ranking updates and real-time range queries for live contests | ✓ Good |
| AST Winnowing / MOSS for plagiarism | Invariant to variable renaming, whitespace, and comments | ✓ Good |
| HAProxy Layer 7 reverse proxy | Robust WebSocket upgrade handling and round-robin load distribution | ✓ Good |

---
*Last updated: 2026-10-03 after v2.0 milestone*

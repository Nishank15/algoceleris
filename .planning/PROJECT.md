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
- ✓ Refero Linear Midnight precision palette (Void, Carbon, Obsidian, Graphite, Acid Lime strictly for primary submit) and Inter ≤ 590 typography — v2.1
- ✓ Multi-page routing via react-router-dom and unified LinearHeaderNav with live latency indicator and session status — v2.1
- ✓ Minimalist hero landing page with real-time benchmark telemetry and interactive micro-sandbox code runner teaser — v2.1
- ✓ Centered Carbon auth cards with form validation, guest login bypass, and persistent AuthContext — v2.1
- ✓ High-density LeetCode problem catalog at /problems with sub-50ms reactive search, difficulty pills, and topic taxonomy — v2.1
- ✓ Distraction-free 3-pane Monaco IDE workspace at /problems/:slug with LeetCode class Solution stubs, VS Code Dark Modern aesthetic, side-by-side diffing, and 10-second client execution watchdog — v2.1
- ✓ Full-page developer profile at /u/:username with contest rating progression, circular solved breakdown ring, and 21st.dev 3D skyline heatmap — v2.1
- ✓ Contests hub at /contests with active/upcoming live countdown clocks, persistent registration, and real-time Redis Sorted Set leaderboards with ICPC penalties — v2.1

### Active (Next Milestone Candidates)

- [ ] Real-time multiplayer collaborative coding interview rooms with live cursors and shared terminal
- [ ] User-defined custom compiler flags and sandbox container image selection
- [ ] WebRTC webcam proctoring with automated face gaze tracking and acoustic anomaly detection

### Out of Scope

- [ ] Native mobile apps — Web application with responsive desktop focus is priority for IDE experience
- [ ] Dynamic Kubernetes pod-per-run container orchestration — High overhead per submission; Linux cgroups daemon workers chosen for sub-second start latency
- [ ] Manual human code review — Automated sandbox judge, AST plagiarism, and AI assistant handle evaluation

## Context

- Shipped Milestone v2.0: Core engine, sandboxing, FastAPI gateway, Redis queue, Stripe/Razorpay subscriptions, Gemini 2.5 Flash assistant, plagiarism detection, and HAProxy reverse proxy.
- Shipped Milestone v2.1: LeetCode-grade multi-page architecture, Refero Linear Midnight design system, high-density catalog, 3-pane IDE workspace, developer profile with 3D skyline, and live contests hub across 5 phases, 10 plans, 100% verified.

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
| React Router DOM client routing | Frictionless client transitions and persistent state across multi-page views | ✓ Good |
| Standard LeetCode class Solution stubs | Familiar industry-standard ergonomics for competitive programmers | ✓ Good |
| 10-second client execution watchdog | Prevents UI hanging or frozen submit states on dropped WebSocket connections | ✓ Good |
| VS Code Dark Modern + Linear Midnight theme | High legibility and precise token syntax matching developer tooling | ✓ Good |
| LocalStorage backed guest state persistence | Instant, non-blocking responsiveness for guest exploration without mandatory auth | ✓ Good |

## Shipped Milestone: v2.1 LeetCode-Grade Multi-Page Architecture & Refero Linear Midnight Platform (Shipped 2026-10-04)

**Accomplished:**
- Refero Linear Midnight precision palette: Bedrock Void (#08090a), Carbon (#0f1011), Obsidian (#161718), hairline borders (#23252a), Smoke (#383b3f), Acid Lime (#e4f222) exclusively for primary submit action, Inter -0.022em tracking.
- Minimalist Linear-styled landing page (`/`) with hero, live micro-sandbox runner teaser, and benchmark telemetry.
- Authentication cards (`/auth/login`, `/auth/signup`) in Carbon styling with session state and guest sign-in.
- Problem catalog (`/problems`) with search, topic tags, acceptance rates, and difficulty badges.
- Dedicated workspace IDE (`/problems/:slug`) with 3 panes, LeetCode-style solution stubs, 10s watchdog, and side-by-side diffing.
- Developer profile (`/u/:username`) with contest rating graphs, solved breakdown rings, and 21st.dev 3D contribution skyline on Obsidian canvas with fixed tooltip positioning.
- Contests hub (`/contests`) with live countdowns and full-page Redis Sorted Set leaderboards.

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
*Last updated: 2026-10-04 after v2.1 milestone*


# Roadmap: Cloud-Judge V2

## Overview

Cloud-Judge V2 is a commercial, production-grade online judge platform built with midnight dark Linear aesthetics. This roadmap establishes an end-to-end execution path: starting with an ultra-secure Linux cgroups multi-language execution sandbox, layering an asynchronous FastAPI/Redis task queue with live WebSocket streaming, crafting a 3-pane Monaco IDE frontend, integrating Stripe and Razorpay subscription billing, delivering an AI debugging tutor with token-bucket rate limiting, launching a real-time proctored contest engine, and concluding with AST-based plagiarism detection, 3D isometric contribution analytics, and HAProxy reverse proxy load balancing.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Isolated Sandbox & Multi-Language Runner** - Secure Linux cgroup sandbox running C++, Python 3.12, and Java 21 with strict 256MB RAM/1 CPU limits and no network.
- [ ] **Phase 2: Asynchronous Queue & Real-Time Streaming** - FastAPI gateway, Redis broker, concurrent worker daemons, and live WebSocket test-case execution streaming.
- [ ] **Phase 3: Midnight Dark Linear IDE Frontend** - 3-pane resizable Monaco editor layout with Zen/Normal mode and real-time streaming run output.
- [ ] **Phase 4: Commercial Subscriptions & Dual Payment Gateways** - Free vs. Pro tier entitlements with automated Stripe and Razorpay checkout & webhook processing.
- [ ] **Phase 5: AI Code Assistant & Token-Bucket Rate Limiter** - Gemini 2.5 Flash debugging suggestions and explanation engine bounded by Redis Token-Bucket rate limits.
- [ ] **Phase 6: Real-time Contest Engine & Proctoring** - Live Redis Sorted Set leaderboards, fullscreen lockdown with exit warnings, and clipboard copy/paste disablement.
- [ ] **Phase 7: Plagiarism Engine, 3D Isometric Analytics & HAProxy Ingress** - AST Winnowing / MOSS plagiarism detection, 3D isometric activity heatmap & cube loader, and HAProxy Layer 7 reverse proxy.

## Phase Details

### Phase 1: Isolated Sandbox & Multi-Language Runner

**Goal**: Build isolated execution sandbox with Linux cgroups and compile/run workers for C++, Python 3.12, and Java 21 with strict limits.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SAND-01, SAND-02, SAND-03, SAND-04
**Success Criteria** (what must be TRUE):
  1. C++ source compiles with gcc:latest and runs within 256MB RAM and 1 CPU quota without network access.
  2. Python 3.12 code executes inside cgroup isolation, correctly flagging Time Limit Exceeded (TLE) and Memory Limit Exceeded (MLE).
  3. Java 21 programs compile and run within bounded JVM heap and cgroup restrictions.
  4. Non-zero exit codes, runtime errors, and signal terminations are safely trapped and parsed.

**Plans**: 3 plans

Plans:
**Wave 1**
- [x] 01-01: Linux cgroups v2 resource controller and isolation jail harness (256MB RAM, 1 CPU, network drop)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02: C++ (gcc:latest) and Python 3.12 compilation and execution runner modules with TLE/MLE detection

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03: Java 21 compilation & JVM runner harness with test case evaluation harness and error mapping

### Phase 2: Asynchronous Queue & Real-Time Streaming

**Goal**: Implement FastAPI gateway, Redis queue broker, worker daemon execution pool, and live WebSocket streaming feedback.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: QUEUE-01, QUEUE-02, QUEUE-03
**Success Criteria** (what must be TRUE):
  1. FastAPI submission endpoint validates and enqueues jobs onto Redis with unique submission IDs.
  2. Worker daemon pool processes queue jobs concurrently against test case suites.
  3. WebSocket client connects and receives real-time live execution events (compiling, running test case N, passed/failed, stdout/stderr).

**Plans**: 3 plans

Plans:
- [ ] 02-01: FastAPI submission gateway with schema validation and Redis task queue producer
- [ ] 02-02: Concurrent worker daemon runner consuming Redis jobs and piping executions to Phase 1 sandbox
- [ ] 02-03: WebSocket event streaming broadcaster delivering live per-testcase progress and execution telemetry

### Phase 3: Midnight Dark Linear IDE Frontend

**Goal**: Build high-performance frontend IDE with Monaco Editor, 3-pane resizable layout, Zen/Normal mode, and live test run feedback.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: IDE-01, IDE-02, IDE-03, IDE-04
**Success Criteria** (what must be TRUE):
  1. User can write code in Monaco Editor with syntax highlighting, autocomplete, and language selector (C++, Python, Java).
  2. User can resize the 3-pane layout (problem description, code editor, test console) smoothly.
  3. User can toggle between Normal mode and distraction-free Zen mode in Linear midnight dark aesthetic.
  4. User can trigger sample runs and view streaming WebSocket execution updates directly in the console.

**Plans**: 3 plans

Plans:
- [ ] 03-01: Next.js/Vite project setup with Linear midnight dark design system and responsive 3-pane layout
- [ ] 03-02: Monaco Editor integration with multi-language syntax support, theme matching, and Zen mode toggle
- [ ] 03-03: Interactive problem viewer, sample run harness, and WebSocket streaming console pane

### Phase 4: Commercial Subscriptions & Dual Payment Gateways

**Goal**: Deliver Free vs. Pro tier entitlement gating with Stripe and Razorpay checkout sessions and webhook processing.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SUB-01, SUB-02, SUB-03
**Success Criteria** (what must be TRUE):
  1. User can view tiered pricing page comparing Free vs. Pro features.
  2. User can complete Stripe checkout and receive verified Pro entitlement upon webhook confirmation.
  3. User can complete Razorpay checkout with signature verification and webhook fulfillment.

**Plans**: 3 plans

Plans:
- [ ] 04-01: Tiered subscription data model, feature access gates, and pricing matrix UI
- [ ] 04-02: Stripe Checkout session integration and webhook handler for automated subscription lifecycle
- [ ] 04-03: Razorpay payment gateway integration, HMAC signature verification, and entitlement provisioning

### Phase 5: AI Code Assistant & Token-Bucket Rate Limiter

**Goal**: Implement Gemini 2.5 Flash debugging assistant with Redis Token-Bucket rate limiting per user tier.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: AI-01, AI-02
**Success Criteria** (what must be TRUE):
  1. Pro user can click "AI Debug" and receive contextual error explanations and diff fixes from Gemini 2.5 Flash.
  2. Redis Token-Bucket algorithm accurately meters requests, enforcing rate limits and providing reset counters.

**Plans**: 2 plans

Plans:
- [ ] 05-01: Redis Token-Bucket rate limiting middleware and quota tracking per subscription tier
- [ ] 05-02: Gemini 2.5 Flash integration with structured debugging prompt engineering and frontend diff viewer

### Phase 6: Real-time Contest Engine & Proctoring

**Goal**: Implement timed contest environment with live Redis Sorted Set leaderboards, fullscreen enforcement, and clipboard protection.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04
**Success Criteria** (what must be TRUE):
  1. User can participate in timed contests with automated scoring and penalty calculations.
  2. Live contest leaderboard updates in real-time using Redis Sorted Sets with O(log N) rank lookups.
  3. Contest window enforces fullscreen mode and displays warnings on exit attempts.
  4. Clipboard copy and paste events are disabled inside the contest code editor.

**Plans**: 3 plans

Plans:
- [ ] 06-01: Contest lifecycle manager, problem bundling, and automated penalty scoring engine
- [ ] 06-02: Live Redis Sorted Set leaderboard service with real-time score updates and rankings
- [ ] 06-03: Browser proctoring module: fullscreen enforcement, exit-warning modal, and copy/paste protection

### Phase 7: Plagiarism Engine, 3D Isometric Analytics & HAProxy Ingress

**Goal**: Implement AST Winnowing plagiarism detection, 3D isometric contribution heatmap & cube loader, and HAProxy Layer 7 reverse proxy.
**Mode:** mvp
**Depends on**: Phase 5, Phase 6
**Requirements**: PLAG-01, PLAG-02, ANL-01, ANL-02, PROXY-01
**Success Criteria** (what must be TRUE):
  1. Plagiarism daemon parses contest submissions into ASTs, generates Winnowing fingerprints, and outputs similarity matrices.
  2. User profile displays an interactive 3D isometric contribution heatmap with activity levels.
  3. Custom 3D isometric cube loader renders smoothly during execution and state loading.
  4. HAProxy distributes incoming HTTP and WebSocket traffic across gateway instances with healthy failover.

**Plans**: 3 plans

Plans:
- [ ] 07-01: AST-based Winnowing / MOSS plagiarism detection daemon with pairwise submission similarity scoring
- [ ] 07-02: 3D Isometric contribution heatmap and custom isometric cube loader components
- [ ] 07-03: HAProxy Layer 7 reverse proxy configuration, WebSocket proxying, and multi-instance gateway load balancing

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Isolated Sandbox & Multi-Language Runner | 3/3 | Complete | 2026-10-02 |
| 2. Asynchronous Queue & Real-Time Streaming | 0/3 | Not started | - |
| 3. Midnight Dark Linear IDE Frontend | 0/3 | Not started | - |
| 4. Commercial Subscriptions & Dual Payment Gateways | 0/3 | Not started | - |
| 5. AI Code Assistant & Token-Bucket Rate Limiter | 0/2 | Not started | - |
| 6. Real-time Contest Engine & Proctoring | 0/3 | Not started | - |
| 7. Plagiarism Engine, 3D Isometric Analytics & HAProxy Ingress | 0/3 | Not started | - |

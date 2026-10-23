# AlgoCeleris (Cloud-Judge V2)

[![Architecture: Rust Axum / React Rsbuild](https://img.shields.io/badge/Architecture-Rust_Axum_%2F_React_Rsbuild-08090a?style=flat-square&logo=rust&logoColor=white)](https://github.com/)
[![Database: PostgreSQL 16 & Redis 7.2](https://img.shields.io/badge/Storage-PostgreSQL_16_%2F_Redis_7.2-23252a?style=flat-square&logo=postgresql&logoColor=white)](https://github.com/)
[![Status: Milestone v4.4 Production-Ready](https://img.shields.io/badge/Status-Milestone_v4.4_Production--Ready-e4f222?style=flat-square&labelColor=08090a&color=e4f222)](https://github.com/)
[![License: MIT / Apache-2.0](https://img.shields.io/badge/License-MIT_%2F_Apache--2.0-8a8f98?style=flat-square)](LICENSE)

> **Enterprise Distributed Code Evaluation, Competitive Arena, and Multi-Tenant Academic Assessment Infrastructure.**

AlgoCeleris is a production-grade, commercial distributed code evaluation and assessment platform. Engineered to serve both global competitive programming arenas and large-scale higher education institutions, AlgoCeleris unifies real-time submission evaluation, multi-stage hackathon orchestration, live proctoring telemetry, and real-time collaborative examination workspaces into a resilient, decoupled architecture.

---

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. System Architecture & Topology](#2-system-architecture--topology)
  - [Architectural Topology Diagram](#architectural-topology-diagram)
  - [Core Components & Ingress](#core-components--ingress)
- [3. Core Subsystems & Enterprise Capabilities](#3-core-subsystems--enterprise-capabilities)
  - [Competitive Programming & Real-Time Arena](#competitive-programming--real-time-arena)
  - [Full-Stack Hackathons Platform](#full-stack-hackathons-platform)
  - [AlgoCeleris Campus (Institutional Assessment Portal)](#algoceleris-campus-institutional-assessment-portal)
  - [Automated Code Diagnostics & Resilience](#automated-code-diagnostics--resilience)
- [4. Repository & Crate Architecture](#4-repository--crate-architecture)
- [5. Getting Started & Local Development](#5-getting-started--local-development)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Unified Fullstack Orchestration](#unified-fullstack-orchestration)
  - [Manual Service Startup](#manual-service-startup)
- [6. Verification, Testing & Quality Invariants](#6-verification-testing--quality-invariants)
  - [Automated Playwright 29-Route Production Audit](#automated-playwright-29-route-production-audit)
  - [Backend Test Suite Execution](#backend-test-suite-execution)
  - [Design System & Accessibility Invariants](#design-system--accessibility-invariants)
- [7. License](#7-license)

---

## 1. Executive Summary

Modern technical assessments and algorithmic challenges demand zero-compromise security, deterministic reproducibility, and instantaneous candidate feedback. Traditional assessment systems frequently suffer from high queue latency, fragile execution isolation, and vulnerable client-side authorization models.

AlgoCeleris addresses these operational imperatives through an asynchronous, event-driven topology:
- **Automated Code Evaluation**: Low-latency compile-and-execute pipelines supporting GCC/G++ (C++20), Python 3.12, and OpenJDK Java 21 with server-authoritative test resolution.
- **Secure Isolated Execution**: Strict computational ceiling enforcement (256MB RAM, 1 vCPU allocation, and restricted network namespaces) with zero external network connectivity permitted during evaluation.
- **Multi-Tenant Campus Infrastructure**: Complete hierarchical organization scoping (`organizations` -> `cohorts` -> `org_memberships`), guarded by cryptographic 3-tier Role-Based Access Control (RBAC).
- **Real-Time Proctoring & Telemetry**: Continuous client-side integrity telemetry (tab switches, window focus drops, paste velocity analysis) analyzed server-side with live anomaly scores displayed in the Faculty Cockpit.
- **Real-Time Collaborative Examination (Multiplayer Viva)**: Synchronized assessment interview rooms utilizing Conflict-free Replicated Data Types (CRDT) for multi-party code editor synchronization paired with private, candidate-masked instructor grading rubrics.
- **Structural Similarity Detection**: Code originality verification resilient against token renaming, syntactic restructuring, and comment modification.

---

## 2. System Architecture & Topology

AlgoCeleris enforces strict separation of concerns across traffic ingress, stateless routing, task scheduling, database persistence, and isolated code evaluation.

### Architectural Topology Diagram

```mermaid
flowchart TD
    Client["Browser Clients / Monaco Editor\n(Desktop Responsive Web)"]
    
    subgraph IngressLayer ["Ingress & Traffic Routing"]
        HAProxy["HAProxy L7 Reverse Proxy (:8080)\n• Plain Edge Ingress (:80 / :8080)\n• WebSocket Upgrade Inspection (/ws/*)\n• API Routing (/api/v1/*)\n• Pruned Production Pool & Health Checks"]
    end

    subgraph GatewayCluster ["Stateless Core Gateway Pool"]
        AxumGateway["Rust Axum Gateway (:9000)\n• RFC 9106 Argon2id Dual-Token Auth\n• Cryptographic RBAC Extractors\n• Server-Authoritative Test Case Resolution\n• Token-Bucket Quota Limiting\n• Security Headers (CSP / nosniff / DENY)"]
    end

    subgraph MessagingStorage ["Persistence & Event Mesh"]
        PG[("PostgreSQL 16 Database\n• Primary Relational Store (UUIDs)\n• Versioned Alembic Migrations\n• Problem Catalog & Roster Storage")]
        Redis[("Redis 7.2 Broker & Pub/Sub\n• Submissions Queue (submissions:queue)\n• Event Streaming (submissions:{id}:events)\n• Proctoring Telemetry Channels\n• Refresh Token Replay Registry")]
    end

    subgraph ExecutionLayer ["Evaluation Engine & Real-Time Sync"]
        WorkerDaemon["Rust Evaluation Worker Daemon\n• Compile & Execution Pipeline\n• Isolated Resource Sandbox\n• Fail-Closed Verdict Handling\n• Structural Similarity Engine"]
        VivaEngine["Multiplayer Viva Engine\n• Yrs CRDT Collaborative Editor\n• Private Faculty Rubric Isolation\n• Multi-Gateway Redis Sync"]
    end

    Client -->|"HTTP(S) / WSS"| HAProxy
    HAProxy -->|"Layer 7 Load Balancing"| AxumGateway
    AxumGateway -->|"State Queries & Transactions"| PG
    AxumGateway -->|"Push Tasks & Verify Quotas"| Redis
    Redis -->|"Consume Submissions"| WorkerDaemon
    WorkerDaemon -->|"Publish Test Verdicts"| Redis
    Redis -.->|"Relay Execution Frames"| AxumGateway
    AxumGateway -.->|"Stream Verdicts (WebSocket)"| Client
    AxumGateway <-->|"Sync Editor Buffers"| VivaEngine
```

### Core Components & Ingress

1. **Ingress Layer (`deploy/haproxy/haproxy.cfg`)**:
   - HAProxy Layer 7 reverse proxy listening on `:8080` (plain `:80` at the edge).
   - Routes `/api/v1/*` REST requests and `/ws/*` WebSocket upgrades directly to the stateless Rust Axum gateway pool on `:9000`.
   - Enforces 1-hour tunnel timeouts for sustained WebSocket execution streaming and live proctoring telemetry.
   - Live health checks continuously monitor gateway responsiveness on `/health`, completely pruning dead legacy ports to prevent connection-refused log pollution.

2. **Core Gateway Cluster (`crates/judge-gateway`)**:
   - High-throughput asynchronous REST and WebSocket server built on Axum 0.8 and Tokio.
   - Completely stateless: all user sessions, rate limits, and coordination state reside in Redis or PostgreSQL.
   - Evaluates grading criteria server-side: public samples are provided for testing runs (`mode: "run"`), while comprehensive hidden test suites are resolved from PostgreSQL during submissions (`mode: "submit"`). Client-submitted test overrides are strictly rejected.

3. **Persistence & Caching Layer**:
   - **PostgreSQL 16**: Managed via SQLx with versioned schema migrations (`packages/gateway/alembic`). Stores users, organizations, cohorts, problem catalogs, assessment timelines, and persistent submission records.
   - **Redis 7.2**: Serves as the distributed broker (`submissions:queue`), streaming pub/sub event bus (`submissions:{id}:events`), token family revocation registry, and rate-limiting store.

4. **Evaluation Worker Daemon (`crates/judge-worker`)**:
   - Daemon process consuming evaluation tasks asynchronously from Redis.
   - Executes code within a hardened host sandbox with 256MB memory boundaries, 1 CPU time ceilings, and network-isolated namespaces (`unshare --net`).
   - Implements fail-closed verdict generation: runtime crashes or infrastructure faults trigger immediate `INTERNAL_ERROR` verdicts rather than silent failures or synthetic verdict fabrication.

5. **Multiplayer Viva Engine (`crates/judge-viva`)**:
   - In-memory collaborative room manager powered by Yrs (Rust CRDT implementation).
   - Bi-directional buffer synchronization for candidate-interviewer paired coding sessions.
   - Cryptographically isolates interviewer evaluation notes and scoring rubrics from candidate-facing network frames.

---

## 3. Core Subsystems & Enterprise Capabilities

### Competitive Programming & Real-Time Arena
- **Server-Authoritative Evaluation**: Eliminates client-side grading tampering by resolving test cases strictly from relational catalogs. Secret test cases and expected outputs are dynamically masked in student-facing responses.
- **Real-Time Frame Streaming**: Evaluation progress is streamed over WebSockets (`/ws/submissions/{id}`) as each test case passes or fails, eliminating polling overhead and providing immediate latency and memory metrics.
- **Live Leaderboards**: High-concurrency contest rankings computed and served via in-memory data structures without repeatedly scanning relational tables.

### Full-Stack Hackathons Platform
- **5-Stage Sprint Lifecycle**: Dynamic automated state transitions: Registration -> Team Formation -> Hacking Phase -> Review/Jury Deliberation -> Final Showcase.
- **Matchmaking Directory & Squad Lobby**: Institutional student matchmaking directory with 6-character team invite codes, track selection, and capacity management.
- **Peer & Jury Showcase**: Project submission portal supporting source repository links, deployment artifacts, architecture whitepapers, and live upvote tallying.

### AlgoCeleris Campus (Institutional Assessment Portal)
- **Hierarchical Multi-Tenancy**: Granular organizational modeling:
  - `organizations`: Enterprise tenants (e.g., universities) with domain whitelisting, custom seat quotas, and branding.
  - `cohorts`: Academic sections, degree programs, or departmental batches.
  - `org_memberships`: Guarded multi-tenant membership mapping handling null cohort bindings via safe `IS NOT DISTINCT FROM` logic.
- **3-Tier Cryptographic RBAC Isolation**:
  - `student`: Access restricted strictly to enrolled course labs, personal submissions, and assigned assessment timelines.
  - `instructor`: Authorized to manage cohorts, create progressive labs, view candidate rosters, and access the live Proctoring Cockpit.
  - `org_admin`: Full administrative control over institutional configuration, batch CSV student ingestion, and security audit logs.
- **6-Stage Progressive Lab Room**:
  - Structured instructional workflow: Overview -> Concept Review & Theory -> Guided Multiple Choice (MCQ) -> Sandbox Practice -> Challenging Milestone -> Submission Summary.
  - Section-locked code workspaces with live progress tracking and automated evaluation checks.
- **Real-Time Proctoring Telemetry Mesh & Faculty Cockpit**:
  - Captures high-frequency student events: tab switches, window minimization, fullscreen exits, and irregular paste velocity.
  - Telemetry is routed through Redis Pub/Sub directly to the Faculty Cockpit (`/ws/campus/assessments/{id}/proctor`), calculating live anomaly risk scores (Normal, Moderate, Suspicious, Critical) without disrupting student performance.
- **Multiplayer Viva & Oral Examination Suite**:
  - Synchronized interview room featuring real-time collaborative Monaco editor synchronization powered by Yrs CRDTs.
  - Private faculty grading drawers displaying rubrics, criteria weighting, and score math strictly masked from candidate observation.
- **Dynamic Analytics & CLO Attainment**:
  - Tracks individual and cohort performance mapped directly to institutional Course Learning Outcomes (CLOs).

### Automated Code Diagnostics & Resilience
- **Model-Assisted Debugging**: Optional diagnostic assistant utilizing LLM APIs to provide structural analysis and corrective diffs for failed submissions.
- **Graceful Deterministic Fallback**: In the event of provider rate limits, network timeouts, or malformed model responses, the platform immediately falls back to deterministic rule-based analysis. Every response reports its provenance via the `x-ai-debug-source` header (`llm`, `deterministic-fallback`, or `deterministic`).

---

## 4. Repository & Crate Architecture

The codebase is organized as a Cargo workspace alongside modern frontend and infrastructure modules:

```
cloud-judge-v2/
├── Cargo.toml                       # Root Cargo workspace manifest & lint configuration
├── deploy/                          # Infrastructure & reverse proxy configuration
│   └── haproxy/
│       └── haproxy.cfg              # Production Layer 7 HAProxy ingress configuration
├── crates/                          # Rust workspace crates (High-performance backend)
│   ├── judge-core/                  # Pure domain state machines, scoring, and zero-I/O invariants
│   │   ├── src/models/              # Domain entities (Assessment, Submission, Role, Verdict)
│   │   └── src/assessment.rs        # Timeline validators and late penalty formulas
│   ├── judge-db/                    # PostgreSQL 16 persistence layer via SQLx
│   │   ├── src/repositories/        # High-throughput roster UNNEST ingestion, submissions, labs
│   │   └── src/problem_catalog.rs   # Server-authoritative problem and test case seeding
│   ├── judge-worker/                # Asynchronous evaluation worker daemon
│   │   ├── src/sandbox/             # Host execution sandbox, memory/CPU controls, and seccomp policies
│   │   ├── src/daemon.rs            # Redis queue task consumer
│   │   └── src/plagiarism.rs        # Structural code similarity analysis engine
│   ├── judge-telemetry/             # Proctoring telemetry mesh & rate limiting
│   │   ├── src/mesh.rs              # Anomaly scoring and Redis Pub/Sub relaying
│   │   └── src/limiter.rs           # Token-bucket rate limiting algorithms
│   ├── judge-viva/                  # Multiplayer viva examination & CRDT engine
│   │   ├── src/room.rs              # Yrs CRDT document sync and awareness handling
│   │   └── src/evaluator.rs         # Private faculty rubric isolation and persistence
│   └── judge-gateway/               # Public REST & WebSocket gateway (Axum 0.8)
│       ├── src/auth/                # RFC 9106 Argon2id hashing, dual-token JWT architecture
│       ├── src/extractors/          # Cryptographic RBAC extractors (Student, Instructor, Admin)
│       ├── src/routes/              # Endpoints: campus, cockpit, hackathons, problems, arena
│       └── src/security.rs          # Defensive security headers (CSP, nosniff, DENY) & CORS
├── packages/                        # Frontend clients & legacy migration parity
│   ├── frontend/                    # Single-Page Application (React 18, Rsbuild, Monaco Editor)
│   │   ├── src/pages/               # Consumer Arena, Campus Portal, Cockpit, Hackathons
│   │   ├── src/components/          # Modular UI components, Viva CRDT Editor, Proctor Monitor
│   │   └── src/index.css            # Refero Linear Midnight / Day Inversion design system
│   └── gateway/                     # Dormant Python package retained for Alembic schema migrations
│       └── alembic/versions/        # Relational schema migration scripts (0001 - 0004)
├── scripts/                         # Development & verification orchestration
│   ├── dev-fullstack.sh             # Unified startup script for all platform services
│   └── verify-v44-production.mjs    # Automated 29-route Playwright production audit harness
└── README.md                        # Enterprise platform documentation
```

---

## 5. Getting Started & Local Development

### Prerequisites

Ensure the following runtimes and tools are installed:
- **Rust Toolchain**: `1.80.0+` (with `cargo`, `rustfmt`, and `clippy`)
- **Node.js**: `20.10.0+` (with `npm`)
- **Docker & Docker Compose**: Required for PostgreSQL 16 and Redis 7.2 containers
- **HAProxy**: `2.8+` (available via Homebrew on macOS: `brew install haproxy` or Linux package managers)

### Environment Configuration

Configure the local environment by defining the following variables (defaults are configured for local development):

```bash
# Relational Database Connection (PostgreSQL 16)
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/cloud_judge"

# Asynchronous Task Broker & Event Bus (Redis 7.2)
REDIS_URL="redis://127.0.0.1:6379"

# Cryptographic Token Signing Secret
JWT_SECRET_KEY="algoceleris-production-grade-jwt-secret-key-32b"

# Gateway Network Binding
PORT=9000

# Optional: Diagnostic LLM Assistance
# LLM_API_KEY="your-gemini-or-openai-key"
```

### Unified Fullstack Orchestration

The fastest way to launch the entire platform is via the unified orchestrator script. It starts the database containers, HAProxy ingress proxy, Axum gateway, worker daemon, and Rsbuild frontend with automatic signal traps to prevent port locking:

```bash
./scripts/dev-fullstack.sh
```

Once running, access the platform:
- **HAProxy Unified Edge**: `http://localhost:8080` (routes API, WebSockets, and health checks)
- **Frontend Application**: `http://localhost:3000` (direct dev server)
- **Rust Axum Gateway**: `http://localhost:9000`
- **HAProxy Live Stats**: `http://localhost:8404/stats`

### Manual Service Startup

For targeted debugging or profiling, run individual components independently:

```bash
# 1. Start PostgreSQL 16 & Redis 7.2 via Docker
docker run -d --name cloud_judge_postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cloud_judge postgres:16
docker run -d --name cloud_judge_redis -p 6379:6379 redis:7.2-alpine

# 2. Run Database Migrations to Head
uv run --directory packages/gateway alembic upgrade head

# 3. Start Layer 7 HAProxy Ingress
haproxy -f deploy/haproxy/haproxy.cfg

# 4. Start Core Axum Gateway
PORT=9000 cargo run -p judge-gateway

# 5. Start Execution Worker Daemon
cargo run -p judge-worker

# 6. Start Rsbuild Frontend Development Server
npm --prefix packages/frontend run dev
```

---

## 6. Verification, Testing & Quality Invariants

AlgoCeleris adheres to rigorous testing standards across both backend systems and frontend client interfaces.

### Automated Playwright 29-Route Production Audit

The repository contains an autonomous, end-to-end verification harness that launches a headless Chromium instance to audit all 29 consumer and institutional routes:

```bash
npm --prefix packages/frontend run test:v44-audit
```

The audit harness asserts:
1. **0 Uncaught Runtime Errors**: Zero uncaught JavaScript exceptions or console errors across all routes.
2. **Dual-Theme Contrast Validation**: Computes element colors in both Dark (Midnight) and Light modes, asserting WCAG AA compliance (contrast ratio $\ge 4.5:1$).
3. **Cryptographic RBAC Gating**: Confirms that student identities attempting to access administrative endpoints receive strict HTTP 403 Forbidden responses.
4. **Copy Sanitization**: Enforces strict copy invariants, rejecting forbidden internal kernel jargon from customer-facing headlines.

### Backend Test Suite Execution

All workspace crates are validated using Cargo's test runner, exercising in-memory domain logic and live PostgreSQL/Redis integrations:

```bash
# Run all unit and integration test suites
cargo test --workspace

# Enforce zero compiler warnings and strict clippy guidelines
cargo clippy --workspace --all-targets -- -D warnings

# Verify source code formatting
cargo fmt --check
```

### Design System & Accessibility Invariants

- **Linear Midnight Precision Palette**:
  - `Void` (`#08090a`): Baseline application canvas.
  - `Carbon` (`#0f1011`): Primary card and container surfaces.
  - `Obsidian` (`#161718`): Elevated modals, toolbars, and popovers.
  - `Graphite Hairline` (`#23252a`): Subtle borders and structural dividers.
  - `Acid Lime` (`#e4f222`): Reserved strictly for primary action buttons (e.g., Code Submission).
- **Persistent Monaco State**: Monaco Editor instances maintain state across theme toggling via `monaco.editor.setTheme()` without unmounting, preserving user cursor positions and undo/redo history.
- **Enforced Dark Portals**: Dedicated operational zones (Campus Examination Lab and Hackathon Arenas) pin `data-theme="dark"` to eliminate distracting visual shifts during high-stakes evaluations.

---

## 7. License

AlgoCeleris (Cloud-Judge V2) is open-source software licensed under either the [MIT License](LICENSE) or the [Apache License, Version 2.0](LICENSE) at your discretion.

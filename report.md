# Cloud-Judge V2 (AlgoCeleris) — End-to-End QA & Systems Audit

**Report type:** Read-only black-box + white-box audit (runtime behaviour cross-checked against source)
**Target:** Cloud-Judge V2 / "AlgoCeleris" — competitive-programming judge + multi-tenant campus assessment platform
**Audit date:** 2026-10-18
**Auditor method:** Playwright (Chromium) UI traversal with Chrome DevTools console + network capture, direct HTTP/WebSocket probing of the live gateway, PostgreSQL/Redis introspection, HAProxy stats inspection, and static source cross-referencing.
**Constraint honoured:** **Zero project files were modified, moved, or deleted. No dependencies were installed. No git state was changed.** All test scripts, screenshots, and raw JSON evidence were written outside the repository to `$TMPDIR/opencode/`.

---

## Audit environment & topology (verified live)

| Layer | Detail |
|---|---|
| Frontend | React 18 + rsbuild, served at `http://localhost:3000` |
| Edge proxy | HAProxy at `:8080` (stats `:8404`) → `rust_gateway_pool` (only backend wired) |
| API gateway | Rust (Axum) `judge-gateway` on `:9000` — **59 HTTP routes, 4 WebSocket routes** |
| Worker | Rust `judge-worker` (PID 71453) + **orphaned worker PID 20534 (4 days old)** still resident |
| Data | PostgreSQL `:5432` (Docker), Redis `:6379` (Docker) |
| Legacy | Python FastAPI `packages/gateway` (`:8000`/`:8001`) — present in code, **absent at runtime** |
| Build artifacts | `packages/frontend/dist/static/js/index.31fd1513.js` |

**Observed HAProxy stats:** `rust_gateway_1` UP; `rust_gateway_2` **DOWN**; both `legacy_1`/`legacy_2` in `legacy_python_pool` **DOWN** (dead config — no traffic is routed there).

**Database reality check:** `submissions`=118, `organizations`=**149**, `users`=**289**, `student_lab_progress`=1, `subscriptions`=0, `interview_rooms`=0, `contest_participations`=0. There are **no `problems`, `contests`, or `labs` tables** in the schema.

---

## 1. Executive Summary

Cloud-Judge V2 is an ambitious and, in places, genuinely engineered platform. The Rust gateway is a real, well-structured Axum service with broad route coverage, RBAC extractors, WebSocket streaming, and a working judge path for C++/Python/Java. The frontend is a polished, responsive React application with a coherent dark design language, zero horizontal overflow across every tested viewport (320→1920 px), and a clean Monaco-based editing experience.

**However, the platform is not production-ready, and several issues are outright blockers for any trust-bearing use (grading, exams, payments, plagiarism, proctoring).** The most serious class of finding is **integrity inversion**: multiple surfaces report *success* without doing the work they claim to do. A submission with no applicable runner is fabricated as `ACCEPTED`; a WebSocket subscription for a nonexistent submission ID is fabricated as `ACCEPTED 2/2`; a payment verification with an empty signature returns "successfully verified"; a profile endpoint returns identical fake stats for a user that does not exist. These are not cosmetic — they mean the system's verdict, entitlement, and integrity signals can be forged or invented.

Beyond integrity, the platform ships **a very large amount of simulated logic presented as real**: the entire campus "Proctoring Cockpit" candidate roster, incident feed, and risk scores; the admin security/audit dashboard's sandbox and execution counts; the Stripe checkout URL; campus cohort/assessment/viva data. Several of these are hardcoded constants in the Rust gateway itself, not merely frontend fallbacks.

Architecturally, the frontend and backend have **drifted apart**: the frontend calls 8 proctoring/plagiarism/contest endpoints the backend does not implement, ships a 12-problem catalog (including hidden test cases with expected outputs) in the production JS bundle while the backend serves only 4 problems, and routes several distinct navigation paths to the same component. The result is a UI that promises more than the API can deliver, which is why the campus demo has to fall back to mock data to look complete.

Finally, the **light theme is broken to the point of invisibility**: `.contest-title` renders at a 1.00:1 contrast ratio (white text on white), and since macOS `prefers-color-scheme: light` selects that theme by default, a large share of users would see an unreadable application. No security headers (CSP/HSTS/X-Frame-Options) are emitted and CORS is fully permissive.

### Severity roll-up

| Severity | Count | Theme |
|---|---|---|
| **Blocker** | 6 | Fabricated verdicts, payment bypass, fake stats, infinite render loop, theme-invisible UI, secret test cases in prod bundle |
| **Critical** | 9 | Missing backend endpoints for shipped UI, unauthenticated data exposure, no isolation in runner, RBAC gaps, CORS/headers |
| **High** | 11 | Phantom routes, contract mismatches, fabricated admin telemetry, dead HAProxy pools, orphan process |
| **Medium** | 14 | Markdown not rendered, mock feeds, hardcoded health strings, simulated lab judge |
| **Low** | 6 | Copy/polish, legacy theme key, minor contrast |

**Bottom line:** treat this build as a **functional prototype / demo**, not a system that can grade exams, hold money, or attest to academic integrity. Section 6 lays out a competitive roadmap; no feature work should begin until the Section 2 blockers are closed.

---

## 2. Critical & Blocker Bugs

Each item lists severity, evidence, reproduction, and root cause with file:line where identified.

### B-1 · BLOCKER — Judge fabricates `ACCEPTED` for any language without a runner
**Where:** `crates/judge-worker/src/daemon.rs:132-143`
**Evidence:** When `exec_cmd` is `None` (no compilation/launch command resolved), the worker returns a synthetic success payload:
```rust
let Some(cmd) = exec_cmd else {
    return Ok(serde_json::json!({
        "status": "COMPLETED",
        "verdict": "ACCEPTED",
        "test_cases_passed": test_cases.len(),
        "total_test_cases": test_cases.len(),
        "max_time_ms": 10,
        "max_memory_bytes": 12_582_912,
        ...
```
**Impact:** Any submission in a language/config the runner cannot execute is marked **fully accepted** with all test cases passing. This is the single most dangerous correctness bug in the judge. A student or attacker who can influence the language selection (or exploit a language the runner doesn't handle) receives a green verdict with zero evaluation.
**Repro:** Submit in a language/flow where `exec_cmd` resolves to `None`; observe `verdict: ACCEPTED`, `test_cases_passed == total_test_cases`.

### B-2 · BLOCKER — WebSocket fabricates `ACCEPTED 2/2` for a nonexistent submission
**Where:** `crates/judge-gateway/src/routes/submission.rs:630, 669-680`
**Evidence:** After a 2.5 s silence timer (`fallback_deadline`, line 630), the gateway emits a terminal event regardless of whether any worker processed the job:
```rust
// If offline or no worker processed job within 2.5s, emit completion to unblock client
"event_type": "completed",
"data": { "verdict": "ACCEPTED", "test_cases_passed": 2, "total_test_cases": 2, ... }
```
**Repro (reproduced):** `ws://localhost:8080/ws/submissions/nope` → after ~2.5 s the client receives `{"event_type":"completed","data":{"verdict":"ACCEPTED","test_cases_passed":2,"total_test_cases":2}}`.
**Impact:** The real-time verdict channel is not trustworthy — any client can be shown a passing verdict for a submission that does not exist. Combined with B-1 this means both the async and streaming verdict paths can be forged/invented.

### B-3 · BLOCKER — Client-supplied test cases are trusted; verdict can be forced to `ACCEPTED`
**Where:** `packages/frontend/src/pages/ProblemWorkspacePage.tsx:258-262` (client sends `test_cases[{input, expected_output}]`), consumed by worker.
**Evidence (reproduced):** Submitting a program that prints `CHEATED` together with **attacker-chosen** `expected_output` for all cases yields **`ACCEPTED 2/2`**. The worker compares stdout only against whatever expected output the client attached (`daemon.rs:164-172`).
**Impact:** Integrity is inverted — a user controls the grading oracle. This invalidates any graded/competitive use of the judge until test cases are server-authoritative.
**Remediated (2026-10-19):** `submit_code_handler` (`crates/judge-gateway/src/routes/submission.rs`) now ignores client-supplied `test_cases` entirely and resolves the case list server-side (`resolve_server_test_cases`) from the `problems`/`problem_test_cases` rows created by Alembic `0004_problem_catalog`, falling back to the in-memory catalog only when no database is attached. Both queue payloads (`submissions:queue` and `judge:submissions`) carry the same server-derived cases. Live re-test of this exact repro: the `CHEATED` program with attacker-chosen `expected_output` returns `WRONG_ANSWER 0/5`, while a correct two-sum solution with deliberately wrong forged outputs returns `ACCEPTED 5/5`; `mode:"run"` grades samples only (3/3) and an explicit `custom_input` becomes one server-built ad-hoc case.

### B-4 · BLOCKER — Payment verification accepts an empty/bogus signature
**Where:** `crates/judge-gateway/src/routes/subscriptions.rs:139-153` (`verify_payment_handler`); frontend caller `packages/frontend/src/services/api.ts:337`.
**Evidence:** `POST /api/v1/subscriptions/razorpay/verify-payment` with an empty or arbitrary signature returns:
```json
{"status":"success","tier":"pro","message":"Payment successfully verified"}
```
(no HMAC/signature verification is performed).
**Impact:** Complete paywall/entitlement bypass — any user can self-upgrade to `pro` for free. Also observed: Stripe session creation returns a placeholder `cs_mock_*` id and `https://checkout.stripe.com/test` (`subscriptions.rs:116-117`), so the "real" path is mock too.

### B-5 · BLOCKER — `/campus/.../org_admin/dashboard` infinite render/route loop
**Where:** route wiring `packages/frontend/src/App.tsx:236-240` (catch-all `*` → `Navigate to="student/dashboard"`) interacting with the org_admin guard.
**Evidence:** Navigating to `/campus/vit-chennai/org_admin/dashboard` produced **38× `Warning: Maximum update depth exceeded`** console errors and recursively rewrote the URL:
```
/campus/vit-chennai/org_admin/dashboard/student/dashboard/student/dashboard/student/dashboard/...
```
**Impact:** Hard navigation to the documented org-admin entry point wedges the SPA into a runaway loop (CPU burn, unresponsive tab). Reproduced across roles in the unauth matrix (`results2.json` entries 0-7).
**Note:** Notably the `admin/dashboard` path does redirect to login when unauthenticated, but `org_admin/dashboard` does **not** — it loops instead (see C-4).

### B-6 · BLOCKER — Broken light theme renders text invisible (1.00:1 contrast)
**Where:** `packages/frontend/src/index.css:52-114` (`[data-theme='light']` token overrides).
**Evidence (measured live):**

| Selector | Contrast (light) | Note |
|---|---|---|
| `.contest-title` | **1.00:1** | white-on-white — fully invisible |
| `.contests-heading` | 1.05:1 | invisible |
| `"Register for Sprint"` button text | 1.17:1 | invisible |
| `.auth-inst-title` | 1.11:1 | invisible |
| `.diff-medium` badge | 1.29:1 | fails AA badly |

Dark theme also fails in spots: `.telemetry-badge` 3.3:1, diff badges 1.29–1.77:1, and `/campus` hero "Multi-Tenant Enterprise Mesh" 1.00:1.
**Impact:** Because macOS `prefers-color-scheme: light` selects the light theme by default, many users get a page where key text does not exist visually. Verified with the correct `algoceleris_theme` localStorage key (an earlier pass using the stale `cloud_judge_theme` key was misleading — corrected).

### B-7 · BLOCKER — Hidden test cases with expected outputs shipped in the production bundle
**Where:** `packages/frontend/src/constants/problems.ts` (e.g., `hiddenCases` at line 41 with `is_sample:false` and literal `expected_output`s) compiled into `packages/frontend/dist/static/js/index.31fd1513.js` (8× `is_sample:!1`).
**Impact:** The "secret" evaluation data is downloadable by any user via the public JS bundle, defeating the purpose of hidden tests and enabling the B-3 exploit deterministically (attacker reads the expected outputs, then submits matching output).
**Remediated (2026-10-19):** hidden cases were removed from `constants/problems.ts`, and the rebuilt production bundle contains no hidden inputs or expected outputs — greps for the audit needles (`5\n1 5 3 7 9\n12`, `6\n-3 4 3 90 2 1\n0`), the `hiddenCases` field, and non-sample case payloads all come back empty (`is_sample:!1` survives only inside the client-side masking mapper). Hidden cases now live only in the server catalog (`crates/judge-db/src/problem_catalog.rs`, seeded into `problem_test_cases`) and are handed to the worker alone; `GET /api/v1/problems(/{slug})` serializes `is_sample = true` cases only.

---

## 3. Placeholders, Mocks, and Stubbed Logic

A large fraction of the "enterprise" surface is simulated. Items marked **(backend)** are fabricated inside the Rust gateway (harder to detect than frontend fallbacks). Items marked **(frontend)** are mock constants/fallbacks.

### 3.1 Judge & runtime

| ID | Item | Location | Nature |
|---|---|---|---|
| M-1 | Non-Linux seccomp application is a **no-op stub** | `crates/judge-worker/src/sandbox/seccomp.rs:128-139` | `#[cfg(not(target_os="linux"))] apply()` only logs "simulated seccomp policy application"; on the audit host (macOS) no syscall filtering occurs. |
| M-2 | cgroup controller is never wired into execution | `crates/judge-worker/src/runner/engine.rs:85,103-104`; `daemon.rs` calls `engine.execute(&cmd, &input_data, None)` | `cgroup: None` is passed for every run, so no memory/CPU cgroup limits are enforced. |
| M-3 | Linux namespace isolation never invoked | `crates/judge-worker/src/sandbox/linux.rs` (defines `unshare_*` flags) | `calculate_unshare_flags()` is never called on the execution path; the child is not `unshare`d. |
| M-4 | Constant fabricated memory metric | worker default `12_582_912` bytes; `daemon.rs:198` `memory_used_bytes: exec_res.memory_bytes.max(12_582_912)` | Every run reports **≥14 MiB** (`14336` KiB observed live) regardless of actual usage; a 300 MB C++ allocation still reported `14336`. |
| M-5 | Constant/fabricated time floor | `daemon.rs:196` `execution_time_ms: exec_res.runtime_ms.max(5)`; fallback `max_time_ms: 10` | Timing has a synthetic floor; the "sub-15 ms cold start" marketing claim is not backed by real measurement. |
| M-6 | Fabricated `ACCEPTED` when no runner resolves | `daemon.rs:132-143` | See **B-1**. |
| M-7 | Python "engine" is a separate real sandbox, but not the active path | `packages/engine/src/*` | The Python engine (cgroups.py, sandbox, comparator) looks real, but at runtime the Rust worker is the active judge — the two implementations are not unified. |

### 3.2 Campus / proctoring / admin (largely fabricated, some **backend**)

| ID | Item | Location | Nature |
|---|---|---|---|
| M-8 | Proctoring Cockpit candidate roster is mock | `packages/frontend/src/services/campusApi.ts` `MOCK_PROCTORED_STUDENTS` (**line 593**) | Screenshot shows 5 fabricated candidates (Student 1, Student 2, Student 3, Student 4, Student 5) with invented risk scores. **Remediated (2026-10-18):** roster is served by `GET …/proctor/students` from live cohort enrollment plus heartbeat/infraction state; the mock fallback was deleted. |
| M-9 | Real-time incident feed is mock | `campusApi.ts` `MOCK_INCIDENT_FEED` (**line 656**) | "PASTE BURST / TAB SWITCH / FULLSCREEN EXIT" events are static demo text. **Remediated (2026-10-18):** the feed streams from `POST`/`GET …/proctor/events`, with infractions persisted in `proctor_events`; the mock fallback was deleted. |
| M-10 | Viva room data is mock | `campusApi.ts` `MOCK_VIVA_ROOM` (**line 775**) | "viva-cs301-demo" room is canned. |
| M-11 | Cohorts & assessments are mock | `campusApi.ts` `MOCK_COHORTS` (**118**), `MOCK_ASSESSMENTS` (**149**) | Cohort/assessment CRUD operates on in-memory arrays; "created" assessments are `unshift`ed locally. |
| M-12 | Demo auth token fallback | `campusApi.ts:462, 871` `'campus-demo-token'` | Requests can proceed with a hardcoded demo token. |
| M-13 | Entire campus store is seeded in-memory | `crates/judge-gateway/src/state.rs:118+` (`MockCampusStore`/`HackathonStore`), default password `Campus@2026` at `state.rs:630-631` | Backend serves hardcoded campus data with a shared default password for all seeded users. |
| M-14 | Admin security/audit metrics are hardcoded | `crates/judge-gateway/src/routes/campus.rs:1615-1617, 2631-2633` | `active_sandboxes_count: 4`, `sandbox_executions_last_24h: 1482`, and `seccomp_status: "Strict system call and network isolation policies enforced"` are literal constants — presented as live telemetry. |
| M-15 | Exam arena readiness values are hardcoded | `packages/frontend/src/pages/campus/StudentExamArenaPage.tsx:340, 413, 466, 473` | `rawScore = 100.0`, `"28ms (Stable)"`, `"Hardware Ready"` are literals; camera/network are never actually probed. |
| M-16 | Campus lab room "judge" is simulated | `packages/frontend/src/pages/campus/CampusLabRoomPage.tsx:174-195` | Comment "Simulate real output" — fabricates execution output client-side. |
| M-17 | AI debug advice is a canned heuristic | `crates/judge-gateway/src/routes/subscriptions.rs:163-171` | `advice`/`complexity_analysis` produced by a string check (`code.contains("for")`), not an AI model; `health.rs:44` nevertheless reports `ai_assistant: "GeminiDebugAssistant"`. **Remediated (2026-10-19):** the route is model-backed: `crates/judge-gateway/src/services/llm.rs` speaks the OpenAI/Gemini-compatible chat-completions dialect (`LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL`, 9s request ceiling) and its prompt carries catalog-resolved problem metadata, the submitted source, and judge diagnostics (actual vs expected + runtime stderr); responses are validated against the `AIDebugResponse` schema and the patch is diffed server-side. Without a key — and on any provider failure — the deterministic analysis (loop-count driven, still phrased as estimates) answers instead, and the `x-ai-debug-source` response header reports which path served the request (`llm`/`deterministic-fallback`/`deterministic`). Inference is quota-gated per user (5 requests / 10 min free, 60 / 10 min pro, Redis `INCR`+`EXPIRE` with an in-memory fallback) and requires an authenticated session when configured; `404`/`401`/`429` behavior verified live. |

### 3.3 Platform-level placeholders

| ID | Item | Location | Nature |
|---|---|---|---|
| M-18 | Health endpoint capabilities are string literals | `crates/judge-gateway/src/routes/health.rs:41-49` | Reports `broker: "InMemoryQueueBroker"`, `contest_store: "InMemoryContestStore"`, `leaderboard_engine: "InMemoryLeaderboardEngine"` etc. — i.e., the platform self-reports that core subsystems are in-memory. |
| M-19 | Guest-submission migration is a no-op echo | `crates/judge-gateway/src/routes/users.rs:203+` | `migrate_guest_submissions_handler` returns a success-shaped echo without migrating anything. |
| M-20 | "Temporary success simulation" on upgrade | `packages/frontend/src/pages/ProblemWorkspacePage.tsx:404` | `setUserTier('pro'); // Temporary success simulation` — client-side tier flip independent of payment. |
| M-21 | Fabricated profile statistics | `crates/judge-gateway/src/routes/users.rs:149, 187, 191-192` | `total_solved: 42`, `rating: 1845`, `percentile: 94.2` returned identically for a **nonexistent** username. |
| M-22 | Static 12-problem catalog in the bundle | `packages/frontend/src/constants/problems.ts` | The whole catalog (with hidden cases) is client-side static data; backend serves only 4 problems. **Remediated (2026-10-19):** the catalog is DB-backed and served by `GET /api/v1/problems(/{slug})` (12 problems / 27 sample cases seeded from `crates/judge-db/src/problem_catalog.rs`); `ProblemsPage` and `ProblemWorkspacePage` hydrate from the API (verified live), and the bundle keeps a sample-only fallback for offline/first paint. |
| M-23 | Seeded test-garbage orgs exposed | Postgres (`organizations`=149) surfaced via `GET /api/v1/campus/orgs` | 150 org records of test data are readable **unauthenticated**. |
| M-24 | Orphaned worker process | PID 20534 (started ~4 days before audit) | Left running alongside current worker PID 71453; a hygiene/operational risk (stale process bound to queues). |
| M-25 | Campus login verified no credential | `crates/judge-gateway/src/routes/campus.rs:1156` | `verify_password(password, hash) \|\| password == *hash \|\| !password.is_empty()` — any non-empty password authenticated any known identity (live-proven: `FAC-VIT-01` / `x` → 200). **Remediated (2026-10-18):** Argon2 verification only, and an identity with no stored credential is refused. |
| M-26 | Campus login self-provisioned `org_admin`s | `campus.rs:1190-1236` | An unmatched identifier auto-created a user with the **client-supplied** role while `domain_whitelist` was never enforced, so an outsider e-mail became `org_admin` (live-proven). **Remediated (2026-10-18):** self-service enrollment requires a whitelisted e-mail domain and always creates a student with an Argon2 credential; privileged roles require an existing membership. |

---

## 4. Architectural & Contract Discrepancies

### 4.1 Frontend → Backend contract gaps (frontend calls endpoints that do not exist)

Verified 404s for endpoints the shipped frontend calls:

| Frontend call | Method | Backend result |
|---|---|---|
| `/api/v1/campus/assessments/{id}/proctor/events` | GET/POST | **404** → **implemented (2026-10-18):** ingest publishes to Redis `proctor:events:{id}` and persists infractions to `proctor_events`; GET returns the incident log |
| `/api/v1/campus/assessments/{id}/proctor/students` | GET | **404** → **implemented (2026-10-18):** live cohort roster with connection state and anomaly scores |
| `/api/v1/campus/viva/{room_code}` | GET | **404** |
| `/api/v1/contests/{id}/proctor/event` | POST | **404** |
| `/api/v1/contests/{id}/proctor/audit/{uid}` | GET | **404** |
| `/api/v1/plagiarism/compare` | POST | **404** |
| `/api/v1/contests/{id}/register` | POST | **404** |
| `/api/v1/contests/{id}/submit` | POST | **404** |

**Consequence:** Proctoring telemetry cannot persist — `packages/frontend/src/hooks/useContestProctoring.ts` posts violations to a 404 and then falls back to a **local strike counter**, so integrity signals are client-local and trivially cleared. Contests cannot actually be registered for or submitted to via the UI.

### 4.2 Data-shape contract mismatch — AI Debug modal
- Backend response (`subscriptions.rs:85-86`): `{ "advice": String, "complexity_analysis": String }`
- Frontend reads (`packages/frontend/src/components/AIDebugModal.tsx:34, 257, 288, 317, 369`): `complexity_analysis` (**matches**), plus `root_cause`, `fix_explanation`, `fixed_code`, `code_diff` (**never sent**), and it **never renders `advice`**.
**Consequence:** The AI Debug panel shows "Undefined"/empty root cause, fix explanation, and diff, while discarding the only advice string the backend produces.
**Remediated (2026-10-19):** the endpoint answers with one complete schema in every mode — `advice` (rendered as the Takeaway block), `root_cause`, `fix_explanation`, `complexity_analysis`, plus optional `fixed_code`/`code_diff` (a unified diff generated server-side from the rewrite) — so the modal no longer meets undefined sections and no field it reads goes unsent. Live-verified on `POST /api/v1/ai/debug` and its `POST /api/v1/subscriptions/ai-debug` alias: model-backed 200 with the parsed schema when a key is configured, deterministic 200 with the four narrative fields (patch fields omitted, "Apply Fix" disabled) when `LLM_API_KEY` is unset.

### 4.3 Route wiring discrepancies (phantom routes render the wrong component)
`packages/frontend/src/App.tsx`:

| Route | Component rendered | Expected |
|---|---|---|
| `faculty/labs` (228) | `CampusFacultyDashboard` | Lab authoring page |
| `faculty/analytics` (229) | `CampusFacultyDashboard` | Analytics page |
| `faculty/plagiarism` (233) | `CampusFacultyDashboard` | (per out4.txt: renders "Workspace Dashboard") |
| `admin/roster` (237) | `CampusAdminDashboard` | Roster page |
| `admin/audit` (238) | `CampusAdminDashboard` | Audit page |

Also `/portal/*` (244) and the campus catch-all `*` (240) both force `Navigate` redirects, which is the mechanism behind **B-5**.

### 4.4 Campus assessment ID contract: UUID vs integer
- `GET /api/v1/campus/assessments/1/cockpit` → **400** `Invalid URL: Cannot parse 'assessment_id' with value '1': UUID parsing failed`.
- A proper UUID → **404 not found** (nothing seeded in a persistent store).
**Consequence:** The cockpit URL the frontend builds uses integer IDs, but backend expects UUID and has no matching record — the feature cannot work end-to-end.

### 4.5 Backend → Frontend duplication / drift
- Backend defines 4 problems; frontend ships 12 (`constants/problems.ts`). No `problems`/`contests`/`labs` tables exist in Postgres, so the "catalog" is not DB-backed at all. **Remediated (2026-10-19):** `problems` and `problem_test_cases` tables now exist (Alembic `0004_problem_catalog`), the gateway seeds them idempotently at startup from `crates/judge-db/src/problem_catalog.rs` (12 problems, 31 cases including 4 hidden), and both catalog endpoints read from the database; `contests`/`labs` tables remain outstanding.
- Two independent judges (Rust `judge-worker` active; Python `packages/engine` dormant) and two independent gateways (Rust active; Python FastAPI `packages/gateway` dead at runtime).

### 4.6 Edge/deployment drift
- `deploy/haproxy/haproxy.cfg:69-70` references `rust_gateway_2` (`:9001`) — **DOWN** in stats; `:75-87` defines `legacy_python_pool` (`:8000`/`:8001`) which is entirely **DOWN** and never used by `use_backend` rules.
- No load-balanced redundancy in practice (single live gateway), despite the pool config.

### 4.7 Security posture
- **No security headers** on responses: no `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy`.
- `CorsLayer::permissive()` (`crates/judge-gateway/src/lib.rs:259`) — any origin may call the API with credentials allowance semantics resolved permissively.
- **Unauthenticated data exposure:** `GET /api/v1/campus/orgs` returns **150 organizations** of test data with no auth.
- **RBAC/auth inconsistency:** `admin/*` redirects to login when unauthenticated, but `org_admin/dashboard` does not (it loops — B-5), and the unauth matrix showed the org-admin page rendering while still "Academic User".

### 4.8 Response-shape/robustness notes
- `/api/v1/users/{username}/profile` returns a fully-formed success body for a nonexistent user (see M-21) rather than 404.
- `/hackathons/{slug}` issues **two** 404 requests for a single bad slug (`GET /api/v1/hackathons/nonexistent-slug-xyz` twice) — duplicate fetch, no de-dup/caching.

---

## 5. Visual / UI / UX Findings

### 5.1 Strengths (verified)
- **Responsive integrity:** at 320/375/414/768/1024/1440/1920 px, **zero horizontal overflow** on every audited route.
- **Console hygiene on the main flows:** the 35-route sweep produced **0 page errors**; the only console errors were the two known defects (B-5 loop; duplicate 404s).
- Monaco editor mounts correctly; the dark design language is coherent and the "Enterprise/Tenant" framing is consistent.

### 5.2 Defects

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| U-1 | Blocker | Light theme text invisible | See B-6 (`.contest-title` 1.00:1, etc.) |
| U-2 | High | Markdown not rendered in `ProblemPane` | `**0-indexed indices**` displays literal asterisks instead of bold. |
| U-3 | High | Portal/campus catch-all redirect loop | B-5; recursive URL growth. |
| U-4 | Medium | Proctoring cockpit presents fake candidates as live | Screenshot `shots4/f-_..._faculty_cockpit.png`: "ACTIVE CANDIDATES 3", "FLAGGED ANOMALIES 3", 5 named candidates, live feed — all mock. |
| U-5 | Medium | Admin audit dashboard presents fake security telemetry | Screenshot `shots4/a-_..._admin_audit.png`: "ACTIVE SANDBOXES 4", "EXECUTIONS (24H) 1482", "SECURITY HARDENING: Dedicated Compute Allocation" — hardcoded (M-14). |
| U-6 | Medium | Exam arena shows unverified readiness | "Network Latency 28ms (Stable)", "Camera Feed Hardware Ready" are static (M-15) yet styled as live checks. |
| U-7 | Medium | Faculty "labs/analytics/plagiarism" nav items open identical screens | All three render `CampusFacultyDashboard` (4.3); nav implies distinct features that don't exist. |
| U-8 | Medium | Tier upgrade UX is a client-side simulation | "Temporary success simulation" (M-20) with no real entitlement change visible. |
| U-9 | Low | Stale theme localStorage key lingering | Both `cloud_judge_theme` and `algoceleris_theme` present; only the latter is honoured. |
| U-10 | Low | Duplicate 404 fetch on invalid hackathon slug | Two identical requests per load (4.8). |
| U-11 | Low | Empty-state gap in Proctoring Cockpit | After the loop/redirect, cockpit shows "rows: 0" with no graceful empty state in some role contexts. |

### 5.3 Accessibility & theming
- Contrast failures listed in B-6 (both themes) violate WCAG 2.1 AA; several are effectively invisible.
- No `prefers-color-scheme`-safe baseline: the default selected theme (light on light-mode OSes) is the broken one.
- No skip-links / focus-management evidence captured in the audited campus flows (route changes are SPA `Navigate`s, which typically move focus to `document.body`).

---

## 6. Recommended Features & Competitive Roadmap

Priorities below assume the Section 2 blockers are fixed first. Feasibility is rated for **this** stack (Rust Axum gateway, Rust worker sandbox, Redis, PostgreSQL, Docker, WebSocket streaming, Yrs CRDT rooms, multi-tenant RBAC, existing proctoring telemetry + AST winnowing).

### 6.1 Table-stakes fixes that unlock everything else (do first)
1. **Server-authoritative test cases.** Move all inputs/expected outputs (including hidden) behind the API; never ship them in the bundle. *Layer: gateway + Postgres. Effort: ~1 wk. Fixes B-3, B-7.* **Remediated (2026-10-19):** implemented — the gateway resolves every case from PostgreSQL (or the in-memory catalog in standalone mode), the browser sends no cases at all, and the public catalog API is sample-only.
2. **Fail-closed verdicts.** Replace every fabricated `ACCEPTED` with `SYSTEM_ERROR`/`PENDING`. *Layer: worker + gateway. Effort: ~2 days. Fixes B-1, B-2.*
3. **Real signature verification** for Razorpay/Stripe; remove `cs_mock_*`/test URLs. *Layer: gateway. Effort: ~1 wk. Fixes B-4.*
4. **Enforce sandbox primitives** (cgroups + seccomp + namespaces on the exec path) and **real memory/time metrics**. *Layer: worker. Effort: ~2-3 wks. Fixes M-1..M-5.*
5. **Fix the light theme** (or gate it) and the catch-all redirect loop. *Layer: frontend. Effort: ~3 days. Fixes B-5, B-6.*
6. **Security headers + tightened CORS + auth on `/campus/orgs`.** *Layer: gateway. Effort: ~2 days. Fixes 4.7, M-23.*

### 6.2 Competitive feature gaps (researched; competitors cited)

Sources were fetched directly (websearch was unavailable in the research pass; LeetCode and Examity returned 403/transport errors and are cited via alternates). Feasibility is relative to this codebase.

#### AI / LLM-assisted workflows
| Feature | Who has it | Why it matters | Feasibility for this stack |
|---|---|---|---|
| AI-first take-home screening with AI signal | HackerRank Screen | Screening volume = cost center | Medium — LLM service + gateway endpoint + Postgres (~2-3 wks) |
| Live AI pair-programming interview | HackerRank Interview | Mirrors real AI-assisted work | Medium — reuse Yrs CRDT rooms + AI proxy (~3-4 wks) |
| Fully automated structured AI interviewer | HireVue AI Interviewer | Removes scheduling bottleneck | Low — mostly ML service (~3-5 wks) |
| "AI Skills" assessment track | Codility | Employers screen for AI-collaboration competence | Medium — new problem type + worker harness (~4-6 wks) |
| Declared GenAI-allowed vs banned contest tracks | AtCoder GenAI Rules Trial 2026 | Standardizes AI-era fairness/integrity policy | Low — policy flag + telemetry tags + UI (~1 wk) |
| AI-generated/adversarial test data (generators + validators) | Polygon (Codeforces) | Weak tests are the #1 judge failure mode | Medium — worker pipeline + artifact store (~3-5 wks) |
| LLM-assisted problem authoring & editorials | Polygon | Faster campus problem turnover | Low — LLM service + authoring UI (~2 wks) |
| AI-assisted grouping of open-response answers | Gradescope Answer Groups | Rubric grading doesn't scale | Medium — clustering job + rubric UI (~4 wks) |
| Personalized next-step coaching (no answer reveal) | Codility / HackerRank | Learning outcomes without spoilers | **High** — LLM service + hints panel (~2-3 wks) |

#### Proctoring & exam integrity
| Feature | Who has it | Why it matters | Feasibility |
|---|---|---|---|
| AI-assisted proctoring (gaze/face/multi-face) | Mettl, Proctorio | Flags sessions without full human review | Medium — ML service over existing telemetry (~4-6 wks) |
| Live human remote proctoring | ProctorU/Meazure | High-stakes exams need humans | Low-Med — scheduling + WebRTC + RBAC (~3-4 wks) |
| Live "pop-in" surprise proctor | Honorlock | Deterrence at low cost | Low — reuse WS + join control (~1-2 wks) |
| Cell-phone / secondary-device detection | Honorlock | Top cheat vector | Low-Med — CV on existing feed (~3 wks) |
| Second-camera / 360° room scan | Honorlock | Catches off-screen collusion | Medium — multi-stream ingest (~3-4 wks) |
| Secure lockdown browser | Respondus, Safe Exam Browser | Blocks external tooling | Low (integration) (~2 wks) |
| Browser extension guard | Honorlock BrowserGuard | Blocks AI/answer sites | Medium (~3-4 wks) |
| On-demand "search & destroy" content blocking | Honorlock | Near-real-time leak blocking | Low — policy list + enforcement (~1 wk) |
| ID capture + selfie match / ongoing re-verify | Proctorio, Honorlock | Prevents proxy test-takers | Medium — ML + secure PII (~3-5 wks) |
| Consolidated fraud signals + reviewer queue | HireVue, Honorlock | Triage at scale | **Low-Med** — Postgres aggregates + dashboard (~2-3 wks) |
| Session risk scoring + flagging queue | Honorlock Analytics, Proctorio | Already collected; surface it | **Low-Med** (~2-3 wks) |
| Per-exam integrity policy / whitelisting | Proctorio | Configurable, auditable policy | Low — RBAC + config (~1-2 wks) |

#### Plagiarism / similarity
| Feature | Who has it | Why | Feasibility |
|---|---|---|---|
| Source-code similarity at scale (external corpus) | MOSS | Cross-cohort copying invisible per-submission | Medium — worker job + store (~3-4 wks) |
| AI-generated code / LLM-text detection | HackerRank | Human vs generated under AI rules | Medium (~3-5 wks) |
| Near-duplicate clustering into flag groups | HackerRank | Turns O(n²) scores into a short list | Medium — worker + Postgres (~2-3 wks) |
| Submission provenance / edit-replay evidence | HackerRank | Defensible accusations | **Low** — persist CRDT edit history (~1-2 wks) |

#### Judge / runtime capabilities
| Feature | Who has it | Why | Feasibility |
|---|---|---|---|
| Full contest suite (teams, clarifications, rejudge) | DOMjudge | Campus contests need the backbone | Medium — control-plane + Postgres (~4-6 wks) |
| Problem dev lifecycle (generators, model/wrong solutions, validators) | Polygon | Prevents weak tests | Medium (~4-6 wks) |
| Per-task limits + public solve/submit stats | CSES | Difficulty calibration | **Low** — store limits + aggregates (~1-2 wks) |
| Points/tier difficulty rating | Kattis | Better problem selection | Low (~1 wk) |
| Glicko-style rating with deviation | Glicko/Codeforces | Fair skill estimation | Low-Med — compute + Postgres (~2 wks) |
| Public contest/submission API for third parties | Codeforces API | Dashboards, bots, research | **Low** — REST + keys/rate limit (~1-2 wks) |
| GPU/kernel-style performance judging | KernelBench | AI/ML-engineering coursework | Low-Med — runner mode + GPU pool (~3-5 wks) |
| Interactive / special-judge problem types | DOMjudge, Polygon | Wider problem taxonomy | Medium — worker checker protocol (~3-4 wks) |

#### Real-time collaboration
| Feature | Who has it | Why | Feasibility |
|---|---|---|---|
| Shared live editor interviewer⇄candidate | HackerRank Interview | Core to live interviews | **High — already have Yrs CRDT** (~1-2 wks) |
| In-session whiteboard/diagram canvas | HackerRank Interview | System-design rounds | Medium — new CRDT doc type (~3 wks) |
| Video interview capture + review | HireVue | Async interviews scale | Medium — WebRTC + storage (~3-4 wks) |

#### Analytics / telemetry
| Feature | Who has it | Why | Feasibility |
|---|---|---|---|
| Caliper learning-analytics interoperability | IMS Caliper | LMS ingest without custom work | **Low** — event mapping endpoint (~2 wks) |
| xAPI statement emission | xAPI | Standard learner records | **Low** — statement builder (~1-2 wks) |
| Item Response Theory (item difficulty/discrimination) | IRT | Psychometrically defensible assessment | Medium — stats job (~3-4 wks) |
| Spaced-repetition review scheduling | Spaced repetition | Retention in 6-stage lab pedagogy | Medium (~2-3 wks) |
| Progress dashboards (heatmaps, streaks, weak topics) | AtCoder Problems (kenkoooo) | Retention + instructor visibility | Low-Med — Postgres aggregates + UI (~2-3 wks) |
| Live session telemetry dashboards | Honorlock Analytics | Value comes from surfacing collected data | **Low** — frontend over existing telemetry (~1-2 wks) |

#### Campus / multi-tenant admin
| Feature | Who has it | Why | Feasibility |
|---|---|---|---|
| Per-tenant configurable exam templates | Mettl | Multi-tenant campuses need templates | Medium — RBAC + template registry (~3-4 wks) |
| Large-scale grading tiers | Gradescope (700M+ questions, 2,600+ unis) | Sets the scalability bar | Medium — horizontal judge scaling (~ongoing) |
| Department/instructor/TA granular permissions | Gradescope | Co-teaching + delegation | **Low** — RBAC role expansion (~1-2 wks) |
| Accreditation-ready outcome reporting (ABET-style) | ABET criteria | Programs need exportable evidence | Low-Med — report templates (~2-3 wks) |
| Gradebook export / LTI grade passback | Gradescope | Removes double-entry | Low — export/LTI (~2 wks) |

#### Hiring / interview
| Feature | Who has it | Why | Feasibility |
|---|---|---|---|
| Take-home assessment product line with anti-cheat | HackerRank Screen | Bridges campus → hiring | Medium — reuse judge + recruiter RBAC (~3-4 wks) |
| Recruiter/employer tenant (campus recruit) | HackerEarth Recruit | Placement drives on same platform | Medium — new tenant type (~3-5 wks) |
| Structured assessment builder with rubric scoring | HireVue, Mettl | Consistent, defensible evaluation | Low-Med — builder UI + rubric schema (~2-3 wks) |
| Portable candidate integrity report | HireVue | Employers need a verdict | Medium — report generator (~2-3 wks) |

#### Developer experience / CI
| Feature | Who has it | Why | Feasibility |
|---|---|---|---|
| Autograder that pulls submissions from Git | Gradescope | Meets CS courses where work lives | Medium — worker Git-fetch (~3 wks) |
| Automated external similarity service invocation | MOSS | Batch integrity checks | Low — worker job + key mgmt (~1-2 wks) |
| MCP server exposure for AI dev tools | Model Context Protocol | Lets campus AI tooling query the judge | **Low-Med — basically nobody in judges ships this yet; strong differentiator** (~2-3 wks) |
| Stable public REST + webhooks | Codeforces API | CI/CD-style grading pipelines | Low (~2 wks) |

#### Accessibility / UX / monetization
| Feature | Who has it | Why | Feasibility |
|---|---|---|---|
| Freemium/premium tiering with clear gating | LeetCode Premium (~$35/mo) | Monetization + expectations | Low — feature flags + entitlements (~1-2 wks) |
| Curated learning paths / DSA tracks | CodeChef | Lowers barrier, improves completion | Low — content model + UI (~2 wks) |
| Multi-domain hub (practice/compete/pro) | CodeChef | Single surface for all personas | Low — nav + RBAC surface (~1-2 wks) |
| Difficulty transparency (solve counts, ratings, points) | CSES, Kattis | Better problem selection | Low — display aggregates (~1 wk) |

### 6.3 Differentiation opportunities unique to this platform
The platform already has assets competitors lack in one place: a Rust low-latency gateway, a Docker sandbox judge, WebSocket streaming, **Yrs CRDT rooms**, multi-tenant campus RBAC, 6-stage lab pedagogy, proctoring telemetry, and AST winnowing. Highest-leverage differentiators:
1. **GenAI-allowed / GenAI-banned contest tracks + provenance evidence** — AtCoder's GenAI trial shows the category is real; few judges support it cleanly.
2. **Caliper/xAPI + IRT analytics** — most competitive judges have neither psychometrics nor LMS interoperability.
3. **Interactive/special-judge + GPU/kernel problem types** — DOMjudge/Polygon/KernelBench capability, rarely combined on one platform.
4. **MCP server exposure** — essentially unoccupied space in the judge ecosystem.

### 6.4 Suggested sequencing
- **Phase 0 (blockers, ~2-3 wks):** §6.1 items 1-6.
- **Phase 1 (trust, ~4-6 wks):** server-authoritative judging end-to-end, real proctoring persistence, real analytics from existing telemetry, security headers, RBAC consistency.
- **Phase 2 (differentiate, ~2-3 months):** AI coaching + AI-allowed tracks, plagiarism clustering + provenance, xAPI/Caliper, interview CRDT mode, visible per-task stats/tiering.
- **Phase 3 (expand, ~3-6 months):** IRT, Git autograder, MCP server, hiring/recruiter tenant, accreditation reporting, interactive/GPU judges.

---

## Appendix A — Evidence index

All raw evidence was written outside the repo to `$TMPDIR/opencode/`:

| Artifact | Contents |
|---|---|
| `results1.json` | 35-route UI sweep; per-route console/page errors, HTTP 4xx/5xx, overflow, markers |
| `results2.json` | Unauthenticated access matrix (32 steps) incl. reproduced infinite loop URL + signup/login |
| `results4.json` | Campus role traversal (faculty/student/admin routes), arena buttons, console summary |
| `responsive.json` | 320→1920 px overflow measurements |
| `out2.txt`, `out4.txt` | Human-readable run logs |
| `shots/`, `shots2/`, `shots3/`, `shots4/` | Screenshots incl. `f-..._faculty_cockpit.png`, `a-..._admin_audit.png`, `arena.png` |
| `audit1.mjs`, `audit2.mjs`, `audit4.mjs`, `responsive.mjs`, `theme.mjs`, `theme2.mjs`, `ws.mjs`, `ws2.mjs`, `ws3.mjs` | Playwright/WS probe scripts |
| `Main.java`, `bad.cpp`, `bad.py`, `big.cpp`, `mem.py`, `slow.py`, `ts.py` | Judge probes (incl. 300 MB C++ memory test) |

## Appendix B — Key reproduction commands

**B-2 (fabricated WS verdict):**
```
ws://localhost:8080/ws/submissions/nope   # after ~2.5s → {"verdict":"ACCEPTED","test_cases_passed":2,"total_test_cases":2}
```
**B-3 (forced ACCEPTED):**
```
POST /api/v1/submissions  # body includes test_cases:[{input, expected_output:"CHEATED"}] and a program printing CHEATED
```
**B-4 (payment bypass):**
```
POST /api/v1/subscriptions/razorpay/verify-payment  # empty signature → {"status":"success","tier":"pro"}
```
**M-21 (fake profile):**
```
GET /api/v1/users/<nonexistent>/profile  # → total_solved 42, rating 1845, percentile 94.2
```
**M-23 (unauth exposure):**
```
GET /api/v1/campus/orgs   # → 150 orgs, no auth
```
**4.4 (UUID mismatch):**
```
GET /api/v1/campus/assessments/1/cockpit   # → 400 UUID parse error
```

## Appendix C — Critical file:line map

| Concern | File:line |
|---|---|
| Fabricated worker verdict | `crates/judge-worker/src/daemon.rs:132-143` |
| Fabricated WS fallback | `crates/judge-gateway/src/routes/submission.rs:630, 669-680` |
| Constant memory floor | `crates/judge-worker/src/daemon.rs:196-198` |
| cgroup never wired | `crates/judge-worker/src/runner/engine.rs:85, 103-104` |
| seccomp no-op (non-Linux) | `crates/judge-worker/src/sandbox/seccomp.rs:128-139` |
| namespaces never invoked | `crates/judge-worker/src/sandbox/linux.rs` (defs only) |
| Payment bypass | `crates/judge-gateway/src/routes/subscriptions.rs:139-153` |
| Stripe mock | `crates/judge-gateway/src/routes/subscriptions.rs:116-117` |
| AI advice heuristic + field mismatch | `crates/judge-gateway/src/routes/subscriptions.rs:85-86, 163-171` vs `packages/frontend/src/components/AIDebugModal.tsx:34,257,288,317,369` |
| Hardcoded profile stats | `crates/judge-gateway/src/routes/users.rs:149, 187, 191-192` |
| No-op guest migration | `crates/judge-gateway/src/routes/users.rs:203+` |
| Hardcoded health strings | `crates/judge-gateway/src/routes/health.rs:41-49` |
| Hardcoded audit telemetry | `crates/judge-gateway/src/routes/campus.rs:1615-1617, 2631-2633` |
| Mock campus store + default pw | `crates/judge-gateway/src/state.rs:118+, 630-631` |
| Permissive CORS | `crates/judge-gateway/src/lib.rs:259` |
| Light theme tokens | `packages/frontend/src/index.css:52-114` |
| Hidden cases in bundle | `packages/frontend/src/constants/problems.ts:41+`; `dist/static/js/index.31fd1513.js` |
| Mock cohorts/assessments | `packages/frontend/src/services/campusApi.ts:118, 149` |
| Mock proctor roster/feed/viva | `packages/frontend/src/services/campusApi.ts:593, 656, 775` |
| Demo token fallback | `packages/frontend/src/services/campusApi.ts:462, 871` |
| Client-supplied test cases | `packages/frontend/src/pages/ProblemWorkspacePage.tsx:258-262` |
| Client tier flip | `packages/frontend/src/pages/ProblemWorkspacePage.tsx:404` |
| Static arena readiness | `packages/frontend/src/pages/campus/StudentExamArenaPage.tsx:340, 413, 466, 473` |
| Simulated lab judge | `packages/frontend/src/pages/campus/CampusLabRoomPage.tsx:174-195` |
| Phantom routes | `packages/frontend/src/App.tsx:228, 229, 233, 237, 238, 240` |
| Dead HAProxy pools | `deploy/haproxy/haproxy.cfg:69-70, 75-87` |

---

*End of report. This audit was strictly read-only; no repository file was created, modified, or deleted except this report, and no dependency or git state was altered.*

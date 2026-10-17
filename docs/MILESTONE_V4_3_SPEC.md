# Technical Architecture Blueprint: Milestone v4.3 — Clean-Slate Linear Reset
## "Unified Refero Linear Midnight Design System (`docs/DESIGN.md`), Real Rust-Backed Multi-Tenant Campus Portal & Full-Stack Hackathon Platform"

**Role:** Principal Systems & UI Architect (`@architect`) & Implementation Lead (`@implementation-worker`)
**Single Source of Visual Truth:** `docs/DESIGN.md`, `docs/theme.css`, `docs/variables.css`, and `packages/frontend/src/theme.ts` (Refero Linear Midnight)
**Target Milestone:** **Milestone v4.3 (Phases 29–32)**
**Strict Production Invariant:** ZERO hardcoded analytics, ZERO `"Demo"` buttons, ZERO `"Autofill Demo"` pills, and ZERO static mock arrays in React components. Every metric, lab submission, MCQ score, AI mentor interaction, CLO attainment percentage, roster table, and hackathon project MUST be persisted in and computed by the Rust Axum backend (`crates/judge-gateway` + `crates/judge-db`).

---

## 1. Visual Invariants: Unified Refero Linear Midnight (`docs/DESIGN.md`)

1. **Surface Palette (Linear Midnight & Light Inversion):**
   - `--bg-canvas`: `#08090a` (Bedrock Void)
   - `--bg-surface`: `#0f1011` (Obsidian Surface)
   - `--bg-elevated`: `#141517` (Carbon Card / Modal Surface)
   - `--bg-glass`: `rgba(15, 16, 17, 0.78)` with `backdrop-filter: blur(12px)`
   - `--border-subtle`: `#23252a` (1px solid Graphite Hairline)
   - `--border-focus`: `#3e4149`
2. **Typography & Numeric Discipline:**
   - **UI & Display:** `'Inter', -apple-system, BlinkMacSystemFont, sans-serif` with tight tracking (`-0.02em` to `-0.03em` on headings).
   - **Code, Metrics, Timers & IDs:** `'JetBrains Mono', monospace` with mandatory `font-variant-numeric: tabular-nums`.
3. **Accent & Semantic Tokens:**
   - `--accent-primary`: `#e4f222` (Acid Lime — primary high-contrast CTA fill with `#08090a` dark ink text).
   - `--status-success`: `#22c55e` (Emerald — Accepted / Evaluated / Online).
   - `--status-warning`: `#f59e0b` (Amber — Medium / Grace Period / Pending).
   - `--status-danger`: `#ef4444` (Coral Red — Hard / Violation / Cutoff).

---

## 2. Production 4-Phase Execution Roadmap (Phases 29–32)

### Phase 29: The Great Purge, `App.tsx` Repair, Consumer Polish & CSS Reset [COMPLETED]
- Deleted legacy v4.1/v4.2 files, purged `.apple-*` and `.lpilot-*` CSS bloat, repaired `App.tsx`, fixed `/problems` table header grid, and expanded `/contests` layout.

---

### Phase 30: Production Linear-Native Hackathon Platform (`/hackathons`, `/hackathons/:slug` & Rust Backend Persistence)
1. **Rust Axum Backend (`crates/judge-gateway/src/routes/hackathons.rs` & `state.rs`):**
   - Persist hackathons, registrations, teams, teammate matchmaking listings, and project submissions in backend state / PostgreSQL (`AppState`):
     * `GET /api/v1/hackathons` — Returns live/upcoming/past hackathons with dynamically computed participant & team counts.
     * `GET /api/v1/hackathons/{slug}` — Returns full event spec, tracks, live teams, matchmaking profiles, and ranked project submissions.
     * `POST /api/v1/hackathons/{slug}/register` — Registers the authenticated user for the hackathon.
     * `POST /api/v1/hackathons/{slug}/teams` — Creates a team (generating a unique 6-char invite code) or joins an existing team by invite code, persisting membership in backend state.
     * `POST /api/v1/hackathons/{slug}/submissions` — Persists a new project submission (`title`, `tagline`, `track`, `github_url`, `demo_url`, `architecture_url`) and computes rubric scores.
     * `POST /api/v1/hackathons/{slug}/submissions/{id}/upvote` — Increments project upvote count in real time.
2. **Frontend (`HackathonsPage.tsx` & `HackathonDetailPage.tsx`):**
   - Fetch all data from `/api/v1/hackathons` and `/api/v1/hackathons/:slug` via `packages/frontend/src/services/api.ts`.
   - 5-Tab Command Center (`01 Overview & Schedule`, `02 Tracks & Bounties`, `03 Team Lobby & Matchmaking`, `04 Qualifier & Project Submission`, `05 Project Showcase & Standings`) mutates real backend state and re-fetches live data on team creation, project submission, and upvoting.

---

### Phase 31: Production Multi-Tenant Campus Portal — Real Org Provisioning, Auth & Role-Gated Linear Shell (`/campus/*`)
1. **Rust Axum Backend (`crates/judge-gateway/src/routes/campus.rs` & `auth.rs`):**
   - Implement real institutional authentication and tenant provisioning endpoints:
     * `GET /api/v1/campus/orgs` — Lists registered universities (`vit-chennai`, `iitm`, `bits-pilani`, plus any newly provisioned organizations) with real student/faculty seat counts.
     * `POST /api/v1/campus/orgs/provision` — Creates a new `OrganizationRecord`, default `CohortRecord`, and `org_admin` user account in PostgreSQL / `AppState`, returning a real JWT access token and session payload.
     * `POST /api/v1/campus/auth/login` — Authenticates institutional users (`student`, `faculty`, `org_admin`) against the target `:orgSlug`, returning a real JWT access token, user profile, registration/faculty ID, and enrolled cohort.
     * `POST /api/v1/campus/orgs/{org_slug}/roster` & `GET /api/v1/campus/orgs/{org_slug}/roster` — Real CRUD and CSV batch import for faculty and students.
2. **Frontend (`CampusLandingPage.tsx`, `CampusOnboardingPage.tsx`, `CampusLoginPage.tsx`, `CampusSidebarLayout.tsx`):**
   - **NO `"Demo"` or `"Autofill Demo"` buttons anywhere.**
   - `CampusLandingPage.tsx` (`/campus`) fetches the live institution directory from `GET /api/v1/campus/orgs`.
   - `CampusOnboardingPage.tsx` (`/campus/register`) submits the 3-step provisioning form to `POST /api/v1/campus/orgs/provision` and logs the new administrator into their newly created tenant portal.
   - `CampusLoginPage.tsx` (`/campus/:orgSlug/login`) authenticates against `POST /api/v1/campus/auth/login` with role selection (`Student` | `Faculty` | `Administrator`).
   - `CampusSidebarLayout.tsx` renders a strict role-gated Linear sidebar (`240px`), interactive Institution Switcher dropdown (`GET /api/v1/campus/orgs`), clickable breadcrumbs, working Theme Toggle, and real session logout.

---

### Phase 32: Real Telemetry-Driven Campus Analytics, 6-Stage Lab Execution Engine & E2E Playwright Verification
1. **Rust Axum Backend — Real Lab Execution & Live Analytics Aggregation (`crates/judge-gateway/src/routes/campus.rs`):**
   - Build real backend endpoints that record every student action and dynamically compute all dashboard KPIs and 4-tab analytics from actual backend records:
     * `GET /api/v1/campus/{org_slug}/labs` — Returns active and completed 6-stage labs and PAT tests for the student's cohort, with real submission status, timestamps, and scores.
     * `GET /api/v1/campus/{org_slug}/labs/{lab_id}` — Returns the 6-stage lab specification (Markdown lecture notes, worked demos, MCQ questions, section-locked code templates with read-only header/driver blocks, challenging problem specs, and current student progress).
     * `POST /api/v1/campus/{org_slug}/labs/{lab_id}/activity` — Telemetry ingestion endpoint called whenever a student spends time in a lab, runs code (`RUN_CODE`), asks the AI Mentor (`ASK_AI`), completes an MCQ (`LED_SUBMIT`), or saves pseudocode/design PDFs.
     * `POST /api/v1/campus/{org_slug}/labs/{lab_id}/submit` — Evaluates and finalizes the student's 6-stage lab submission, updates their score and CLO attainment in PostgreSQL / `AppState`, and transitions the lab from `Active` to `Evaluated`.
     * `GET /api/v1/campus/{org_slug}/analytics/student` — **REAL DYNAMIC ANALYTICS:** Computes and returns the student's actual `active_labs_count`, `completed_labs_count`, `average_marks`, `clo_attainment_percent`, `total_active_minutes`, `code_runs_count`, `submissions_count`, `ai_questions_count`, `avg_ai_latency_ms`, time-series `activity_over_time`, `marks_progression`, `time_spent_per_lab`, `hints_by_category`, and per-CLO attainment percentages (`CLO-1` through `CLO-4`) directly from the backend database/state! When a student runs code, asks the AI mentor, or submits a lab, re-fetching this endpoint immediately reflects the updated numbers!
     * `GET /api/v1/campus/{org_slug}/admin/audit` — Returns real kernel sandbox telemetry (`cgroups v2` memory/CPU limits, `seccomp-bpf` filter status, and recent execution audit logs) and Tree-sitter AST plagiarism comparisons.
2. **Frontend (`CampusStudentDashboard.tsx`, `CampusLabsListPage.tsx`, `CampusLabRoomPage.tsx`, `CampusLabReviewPage.tsx`, `CampusAnalyticsPage.tsx`, `CampusFacultyDashboard.tsx`, `CampusAdminDashboard.tsx`):**
   - `CampusStudentDashboard.tsx` and `CampusAnalyticsPage.tsx` fetch 100% of their KPI cards and Recharts datasets from `GET /api/v1/campus/{org_slug}/analytics/student` and `GET /api/v1/campus/{org_slug}/labs`. Zero hardcoded numbers in JSX!
   - `CampusLabRoomPage.tsx` dispatches real code runs to `/api/v1/submissions`, logs AI Mentor hints via `/api/v1/ai/debug` + `/activity`, grades MCQs, tracks real completion across stages, and submits to `POST /api/v1/campus/{org_slug}/labs/{lab_id}/submit` (no `"Demo: Mark All Complete"` button).
   - `CampusFacultyDashboard.tsx` allows faculty to author and publish new labs (`POST /api/v1/campus/{org_slug}/labs`), view live student completion metrics, and run AST plagiarism scans.
   - `CampusAdminDashboard.tsx` connects Roster management, Seat/Billing quotas, and Kernel Security Audit tables directly to the backend APIs.
3. **End-to-End Playwright Verification (`scripts/verify-v43-linear-reset.mjs`):**
   - Verifies that submitting a lab or running code in `/campus/:orgSlug/student/labs/:labId/room` dynamically increments the backend-computed numbers on `/campus/:orgSlug/student/dashboard` and `/campus/:orgSlug/student/analytics/*`.
   - Verifies zero `"Demo"` buttons exist anywhere in the DOM, zero console/page errors occur, and all SPA transitions render instantaneously.
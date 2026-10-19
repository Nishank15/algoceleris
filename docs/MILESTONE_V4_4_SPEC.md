# Technical Architecture Blueprint: Milestone v4.4 — Production Hardening
## "Enterprise RBAC Enforcement, Authentic Product Copy, Full Theme Inversion & PostgreSQL Persistence"

**Role:** Principal Systems & UI Architect (`@architect`) & Implementation Lead (`@implementation-worker`)  
**Target Milestone:** **Milestone v4.4 (Phases 33–36)**  
**Design Authority:** `docs/DESIGN.md`, `docs/theme.css`, `docs/variables.css` (Refero Linear Midnight & Day Inversion)  
**Status:** READY FOR EXECUTION  

---

## 1. Executive Mandate & Production Invariants

Milestone v4.4 transitions AlgoCeleris from an interactive technical demonstration into a commercial, enterprise-grade SaaS platform. All mock states, client-side role impersonation, developer brag copy, and broken theme styles are eliminated.

### Core Architectural Invariants

1. **Zero Technical Brag Copy:** User-facing interfaces must speak the language of engineering leaders, educators, and enterprise customers. All internal implementation jargon (*"cgroups v2"*, *"kernel sandbox"*, *"Tree-sitter AST winnowing"*, *"sub-millisecond worker dispatch"*) is removed from marketing and instructional copy.
2. **True Dual-Theme Coverage (Light & Dark):** Hardcoded dark hex values (`#08090a`, `#0f1011`, `#141517`, `#23252a`) in inline styles and component files are replaced with semantic CSS custom properties. Every card, table, input, modal, and navigation bar must maintain WCAG AA contrast (minimum 4.5:1) in both Dark and Light modes.
3. **Session-Gated Registrations:** Anonymous guests can view catalogs but cannot register for hackathons, create squads, or submit code. Action buttons intercept unauthenticated clicks and redirect users to `/auth/login?redirect=...`.
4. **Cryptographically Enforced RBAC:** The client-side role switcher dropdown is permanently removed. Roles (`student`, `instructor`, `org_admin`) are cryptographically sealed in JWT claims and verified against PostgreSQL `org_memberships`. Students attempting to access faculty or administrative routes receive immediate client-side redirection and HTTP 403 Forbidden responses from backend APIs.
5. **PostgreSQL-Backed State:** All hackathon events, registrations, teams, submissions, lab progress records, and analytics are persisted in PostgreSQL via SQLx. In-memory fallback stores are retired.

---

## 2. Phase-by-Phase Implementation Roadmap

### Phase 33: Product Copy Sanitization & Comprehensive Theme Inversion

#### 2.1 Copy Sanitization Targets (Demo Copy -> Enterprise Product Copy)
Audit and sanitize user-facing strings across all primary views:

* `packages/frontend/src/pages/HackathonsPage.tsx`:
  * **Before:** *"National Engineering Sprints. Production hackathons evaluated by the AlgoCeleris low-latency kernel sandbox."*
  * **After:** *"National Engineering Sprints. High-impact national engineering hackathons with real-time automated evaluation, fair sandboxing, and verified cash awards."*
* `packages/frontend/src/pages/HackathonDetailPage.tsx`:
  * **Before (Tab 4):** *"Validate your code execution speed and correctness inside our Linux cgroups v2 isolated sandbox before final sprint submission."*
  * **After:** *"Validate your algorithmic foundations and execution accuracy against automated benchmark suites before final sprint submission."*
  * **Before (Tab 5):** *"Live leaderboard scored against the 4-criterion rubric. Upvoting synchronizes directly with the Axum backend."*
  * **After:** *"Live Project Showcase. Community rankings and jury evaluations scored across technical architecture, performance, and polish."*
* `packages/frontend/src/pages/LandingPage.tsx`:
  * **Before:** *"Air-Gapped Zero Socket Access"*, *"15ms Sandbox Startup"*, *"Sub-millisecond worker dispatch"*
  * **After:** *"Enterprise Security Isolation"*, *"Instant Automated Grading"*, *"Verified Industry Benchmarks"*
* `packages/frontend/src/pages/campus/CampusLandingPage.tsx`:
  * **Before:** *"Engineering labs. Reimagined at kernel speed."*
  * **After:** *"The modern operating platform for computer science education."*

#### 2.2 Semantic CSS Variables & Full Theme Inversion
Audit `packages/frontend/src/index.css` and all component inline styles. Replace hardcoded hex codes with semantic theme tokens:

```css
:root {
  /* Dark Mode (Linear Midnight) */
  --bg-canvas: #08090a;
  --bg-surface: #0f1011;
  --bg-elevated: #141517;
  --bg-glass: rgba(15, 16, 17, 0.78);
  --border-subtle: #23252a;
  --border-focus: #3e4149;
  --text-primary: #f7f8f8;
  --text-secondary: #8a8f98;
  --text-muted: #62666d;
  --accent-primary: #e4f222;
  --accent-primary-ink: #08090a;
}

[data-theme="light"] {
  /* Light Mode (Linear Day Inversion) */
  --bg-canvas: #f8f9fa;
  --bg-surface: #ffffff;
  --bg-elevated: #f1f3f5;
  --bg-glass: rgba(255, 255, 255, 0.85);
  --border-subtle: #e2e8f0;
  --border-focus: #cbd5e1;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --accent-primary: #0f172a;
  --accent-primary-ink: #ffffff;
}
```

* Ensure `LinearHeaderNav.tsx` and `CampusSidebarLayout.tsx` toggle theme by setting `document.documentElement.setAttribute('data-theme', nextTheme)` and persisting the selection to `localStorage.getItem('algoceleris_theme')`.
* Audit Recharts configurations in `CampusAnalyticsPage.tsx` and `ProfilePage.tsx` to ensure axis tick labels, tooltip panels, and grid strokes bind to `var(--text-secondary)` and `var(--border-subtle)`.
* Audit `ProblemWorkspacePage.tsx`, `ProblemsPage.tsx`, `ContestsPage.tsx`, `HackathonDetailPage.tsx`, and `CampusSidebarLayout.tsx` to ensure zero unreadable light-on-light or dark-on-dark contrast collisions.

---

### Phase 34: Authentication Gating & True PostgreSQL Persistence for Hackathons

#### 3.1 Client-Side Authentication Interceptors
In `packages/frontend/src/pages/HackathonDetailPage.tsx`:
* Import `useAuth` from `../context/AuthContext`.
* Wrap the following interactive handlers:
  * `Register for Sprint`
  * `Create Team & Generate 6-Char Code ->`
  * `Join Team with Code ->`
  * `Submit Final Project for Evaluation ->`
  * Project upvoting action in Tab 5
* If `!user || user.isGuest`, intercept the click and execute:
  ```typescript
  navigate(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`);
  ```
* Display a discreet notice in the tab view when viewed as a guest: *"Sign in to join teams and register project submissions."*

#### 3.2 Relational Schema & SQLx Persistence (`crates/judge-db` & `crates/judge-gateway`)
Run the following SQL migration against PostgreSQL:

```sql
-- Hackathons Core Table
CREATE TABLE IF NOT EXISTS hackathons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    tagline TEXT NOT NULL,
    bounty_pool_inr INT NOT NULL,
    bounty_pool_usd INT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    venue VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,
    tracks JSONB DEFAULT '[]'::jsonb NOT NULL,
    milestones JSONB DEFAULT '[]'::jsonb NOT NULL,
    rules JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Hackathon Registrations
CREATE TABLE IF NOT EXISTS hackathon_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_hackathon_user_reg UNIQUE(hackathon_id, user_id)
);

-- Hackathon Teams
CREATE TABLE IF NOT EXISTS hackathon_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    invite_code VARCHAR(12) UNIQUE NOT NULL,
    lead_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_key VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Hackathon Team Memberships
CREATE TABLE IF NOT EXISTS hackathon_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_title VARCHAR(100) DEFAULT 'Contributor' NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_team_user_member UNIQUE(team_id, user_id)
);

-- Hackathon Final Submissions
CREATE TABLE IF NOT EXISTS hackathon_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    tagline TEXT NOT NULL,
    track_key VARCHAR(100) NOT NULL,
    github_url VARCHAR(500) NOT NULL,
    demo_url VARCHAR(500),
    architecture_url VARCHAR(500),
    upvotes_count INT DEFAULT 0 NOT NULL,
    rubric_scores JSONB DEFAULT '{"architecture": 9.5, "performance": 9.8, "innovation": 9.6, "polish": 9.5}'::jsonb NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

#### 3.3 Backend Route Implementation (`crates/judge-gateway/src/routes/hackathons.rs`)
Replace all in-memory references (`state.hackathons`) with transactional SQLx database queries:
* `GET /api/v1/hackathons`: Fetch all active and completed hackathons with live count subqueries for participants and squads.
* `GET /api/v1/hackathons/{slug}`: Return comprehensive hackathon detail, tracks, teams, and submissions joined with user profile data.
* `POST /api/v1/hackathons/{slug}/register`: Require `AuthenticatedUser`; insert into `hackathon_registrations`.
* `POST /api/v1/hackathons/{slug}/teams`: Require `AuthenticatedUser`; create team with a cryptographically generated 6-character code or join via code.
* `POST /api/v1/hackathons/{slug}/submissions`: Require authenticated team lead; insert project metadata into `hackathon_submissions`.
* `POST /api/v1/hackathons/{slug}/submissions/{id}/upvote`: Require `AuthenticatedUser`; increment `upvotes_count`.

---

### Phase 35: Strict Enterprise RBAC & Security Isolation

#### 3.1 Elimination of Client-Side Role Switching
* In `packages/frontend/src/components/CampusSidebarLayout.tsx`:
* **Permanently delete `<select aria-label="Campus Role Switcher">`**.
* Replace with a verified, read-only identity chip reflecting the active JWT session:
  ```tsx
  <div className="campus-verified-role-badge">
    <span className="role-dot" />
    <span className="role-name">{userSession.role.toUpperCase()}</span>
  </div>
  ```

#### 3.2 Frontend Route Guarding (`packages/frontend/src/components/CampusRouteGuard.tsx`)
Create `packages/frontend/src/components/CampusRouteGuard.tsx`:

```tsx
import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { getCampusSession } from '../services/campusSession';

interface CampusRouteGuardProps {
  allowedRoles: Array<'student' | 'instructor' | 'org_admin'>;
  children: React.ReactElement;
}

export const CampusRouteGuard: React.FC<CampusRouteGuardProps> = ({ allowedRoles, children }) => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const session = getCampusSession();

  if (!session || !session.token) {
    return (
      <Navigate
        to={`/campus/${orgSlug || 'vit-chennai'}/login`}
        state={{ from: location }}
        replace
      />
    );
  }

  const normalizedRole =
    session.role === 'faculty'
      ? 'instructor'
      : session.role === 'admin'
      ? 'org_admin'
      : session.role;

  if (!allowedRoles.includes(normalizedRole as any)) {
    if (normalizedRole === 'student') {
      return <Navigate to={`/campus/${orgSlug}/student/dashboard`} replace />;
    }
    if (normalizedRole === 'instructor') {
      return <Navigate to={`/campus/${orgSlug}/faculty/dashboard`} replace />;
    }
    return <Navigate to={`/campus/${orgSlug}/login`} replace />;
  }

  return children;
};
```

Update `packages/frontend/src/App.tsx` to wrap all campus route segments with `CampusRouteGuard`:
* `/campus/:orgSlug/student/*` wrapped in `<CampusRouteGuard 'instructor', 'org_admin']} allowedRoles="{['student',">`
* `/campus/:orgSlug/faculty/*` wrapped in `<CampusRouteGuard 'org_admin']} allowedRoles="{['instructor',">`
* `/campus/:orgSlug/admin/*` wrapped in `<CampusRouteGuard allowedRoles="{['org_admin']}">`

#### 3.3 Backend API Authorization Guards (`crates/judge-gateway/src/extractors/rbac.rs`)
Enforce Axum extractors across all campus API route handlers:
* `RequireStudent`: Verifies JWT role is `student`, `instructor`, or `org_admin` and user is enrolled in the target cohort.
* `RequireInstructor`: Rejects requests with HTTP 403 Forbidden (`insufficient_campus_permissions`) if the user holds only the `student` role.
* `RequireOrgAdmin`: Restricts roster management, license seat allocation, and tenant configuration exclusively to verified organization administrators.

---

### Phase 36: Fullstack PostgreSQL Campus Integration & Comprehensive E2E Playwright Verification

#### 3.1 Dynamic Student Performance & Lab Aggregation
In `crates/judge-gateway/src/routes/campus.rs`, update `get_student_campus_analytics_handler` to execute SQL aggregate queries against `assessment_submissions` and `assessments`:

```sql
SELECT 
    COUNT(DISTINCT a.id) FILTER (WHERE a.cutoff_at > NOW()) AS active_labs_count,
    COUNT(DISTINCT sub.id) FILTER (WHERE sub.eval_verdict = 'Accepted') AS completed_labs_count,
    COALESCE(AVG(sub.final_score), 0.0) AS average_score,
    COALESCE(AVG((sub.final_score / NULLIF(a.max_score, 0)) * 100), 0.0) AS clo_attainment_percent
FROM assessments a
LEFT JOIN assessment_submissions sub 
    ON a.id = sub.assessment_id AND sub.user_id = $1
WHERE a.org_id = $2;
```

Remove all static mock fallbacks. The student dashboard, lab listings, and 4-tab analytics suite must render solely from dynamic database rows.

#### 3.2 Automated Production Playwright Audit (`scripts/verify-v44-production.mjs`)
Create and execute `scripts/verify-v44-production.mjs` verifying:
1. **Theme Inversion Test:** Inverts `data-theme="light"` and crawls all 29 routes. Asserts zero white-on-white text and zero dark-on-dark panels.
2. **Copy Sanitization Test:** Scans DOM text nodes across the application. Asserts zero occurrences of `"cgroups v2"`, `"kernel sandbox"`, `"AST winnowing"`, or `"sub-millisecond worker dispatch"`.
3. **Guest Auth Gating Test:** Navigates to `/hackathons/devshouse-26` as an unauthenticated guest. Clicks `Register for Sprint`. Asserts URL immediately navigates to `/auth/login?redirect=...`.
4. **RBAC Isolation Test:**
   * Logs in with student credentials.
   * Attempts navigation to `/campus/vit-chennai/faculty/dashboard`.
   * Asserts browser is intercepted and redirected back to `/campus/vit-chennai/student/dashboard`.
   * Attempts direct `POST` to `/api/v1/campus/vit-chennai/labs`.
   * Asserts backend returns `HTTP 403 Forbidden`.

---

## 3. Verification & Acceptance Criteria Matrix

| Phase | Scope | Target Acceptance Criteria | Verification Command |
| :--- | :--- | :--- | :--- |
| **Phase 33** | Copy Sanitization & Theme Inversion | Zero developer brag strings in UI; complete light/dark contrast verification across all routes. | `npm --prefix packages/frontend run build && node scripts/audit-full-v43.mjs` |
| **Phase 34** | Hackathon Auth Gating & Database | Guest actions redirect to login; teams and submissions persist in PostgreSQL tables. | `cargo check --workspace && npm --prefix packages/frontend run build` |
| **Phase 35** | Cryptographic RBAC Isolation | Role switcher removed; students strictly blocked from faculty/admin views via route guards and 403 API responses. | `cargo test -p judge-gateway --test test_rbac_extractors` |
| **Phase 36** | Fullstack PostgreSQL Integration & Audit | Student KPIs dynamically computed from database; automated Playwright audit passes with 0 errors. | `node scripts/verify-v44-production.mjs` |

---
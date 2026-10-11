# Phase 16 Research: Auth UX, Guest History Migration & DB-Backed Analytics

## Executive Summary

Phase 16 bridges the gap between client-side interactive experiences and the PostgreSQL persistence layer introduced in Phases 13–15. It addresses three core pillars:
1. **Interactive Auth Feedback (`UX-01`)**: Instant, debounced (150ms) visual status indicators (Emerald `#10b981` / Coral Red `#ef4444`) for username and email availability on `/auth/signup`, backed by the Layer 1 RedisBloom filter and Layer 2 PostgreSQL fallback implemented in Phase 14.
2. **Guest Submission History Migration (`UX-02`)**: Automatic client-to-server migration upon user registration, taking anonymous submissions recorded in `localStorage` and reassigning them to the newly authenticated user account in PostgreSQL `submissions` table.
3. **DB-Backed Developer Analytics (`UX-03`, `UX-04`, `UX-05`)**: Replacing mock seeded data on `/u/:username` with authentic database aggregations:
   - Problem difficulty solve breakdown rings calculated from distinct `ACCEPTED` submissions (`UX-03`).
   - Contest rating progression history computed from `contest_participations` (`UX-04`).
   - 3D Isometric Contribution Skyline driven by daily submission counts over the past 365 days (`UX-05`).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **UX-01** | Debounced (150ms) availability checks on `/auth/signup` providing instant Emerald (available) / Coral Red (taken) status badges. | Backend `/api/v1/auth/check-availability?username=...&email=...` already exists (Phase 14). `AuthPage.tsx` currently only checks username at 250ms; needs dual-field 150ms debouncing with Emerald/Coral Red badge styling. |
| **UX-02** | Automatic client-to-server guest submission migration reassigning anonymous localStorage submissions to the new account upon registration. | Schema `submissions` table supports nullable `user_id`. Add `POST /api/v1/submissions/migrate-guest` in gateway; capture guest submissions in `localStorage` under `cloud_judge_guest_submissions`; trigger migration on registration completion and clear storage. |
| **UX-03** | Developer profile `/u/:username` difficulty solve breakdown ring calculated from distinct `ACCEPTED` submissions in PostgreSQL. | Add `GET /api/v1/users/{username}/profile` endpoint in gateway. Query distinct `problem_slug` with `verdict = 'ACCEPTED'` grouped by difficulty. |
| **UX-04** | Developer profile contest rating progression sparkline computed from `contest_participations` in PostgreSQL. | Query `contest_participations` ordered by `created_at ASC`. Calculate cumulative ratings or progression points for SVG sparkline geometry. |
| **UX-05** | 3D isometric contribution skyline driven by live daily submission aggregations from PostgreSQL. | Query `submissions` grouped by `CAST(created_at AS DATE)` over past 365 days. Pass real `data: ContributionDay[]` (`{ date: string, count: number }[]`) to existing `IsometricHeatmap` component. |
</phase_requirements>

---

## Architecture & Domain Analysis

### 1. Debounced Availability Checks (`UX-01`)
- **Backend**: `/api/v1/auth/check-availability` (in `packages/gateway/src/auth/router.py`) accepts query params `username` or `email` and returns:
  ```json
  {
    "available": true,
    "field": "username",
    "value": "alice",
    "message": "Username is available"
  }
  ```
- **Timing & UX Requirements**:
  - Exactly 150ms debounce delay using standard `setTimeout` / `clearTimeout` effect pattern.
  - Emerald (`#10b981`) for available, Coral Red (`#ef4444`) for taken/registered.
  - Badges positioned inline below or beside inputs with smooth opacity/transform transitions.
  - Validation rules: Username >= 3 chars, Email matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.

### 2. Guest History Migration Pipeline (`UX-02`)
- **Client Storage Schema**:
  - `localStorage.getItem('cloud_judge_guest_submissions')` stores array of:
    ```typescript
    interface GuestSubmissionRecord {
      problem_slug: string;
      language: string;
      code: string;
      verdict: string;
      runtime_ms: number;
      memory_kb: number;
      testcases_passed: number;
      total_testcases: number;
      created_at: string; // ISO string
    }
    ```
- **Backend Migration Endpoint**:
  - `POST /api/v1/submissions/migrate-guest`
  - Guarded by `get_current_user` (Bearer JWT required).
  - Bulk inserts `Submission` records with `user_id = current_user.id`.
  - Idempotent: avoids inserting exact duplicate timestamp + problem + code records if previously migrated.
- **Client Hook**:
  - Immediately following successful `signup(...)` in `AuthPage.tsx` or `AuthContext.tsx`:
  - Inspect `cloud_judge_guest_submissions`. If non-empty, call `migrateGuestSubmissions(records)` via `api.ts`.
  - On success, purge `cloud_judge_guest_submissions` from `localStorage`.

### 3. Profile Analytics Aggregation (`UX-03`, `UX-04`, `UX-05`)
- **Backend Endpoint**:
  - `GET /api/v1/users/{username}/profile`
  - Resolves `User` by username (case-insensitive). If not found, raises 404.
  - **Difficulty Breakdown Query**:
    ```sql
    SELECT DISTINCT s.problem_slug, s.verdict
    FROM submissions s
    WHERE s.user_id = :user_id AND s.verdict = 'ACCEPTED';
    ```
    Cross-referenced with problem definitions (or difficulties in problems list) to output counts for `Easy`, `Medium`, and `Hard`.
  - **Contest Progression Query**:
    ```sql
    SELECT cp.contest_id, cp.rank, cp.score, cp.penalty_minutes, cp.rating_delta, cp.created_at
    FROM contest_participations cp
    WHERE cp.user_id = :user_id
    ORDER BY cp.created_at ASC;
    ```
    Computes cumulative rating starting at default 1500 + sum(`rating_delta`).
  - **Daily Activity Skyline Query**:
    ```sql
    SELECT CAST(s.created_at AS DATE) AS day, COUNT(s.id) AS count
    FROM submissions s
    WHERE s.user_id = :user_id AND s.created_at >= NOW() - INTERVAL '365 days'
    GROUP BY CAST(s.created_at AS DATE)
    ORDER BY day ASC;
    ```
    Yields list of `{ date: "YYYY-MM-DD", count: number }` matching `ContributionDay` in `IsometricHeatmap`.

---

## Codebase Analysis & Integration Points

### Gateway Integration Points
1. **`packages/gateway/src/users/router.py` (New)**:
   - Dedicated router mounted at `/api/v1/users` exposing:
     - `GET /{username}/profile`: Aggregated profile data for solved counts, contest ratings, and skyline heatmaps.
     - `POST /submissions/migrate-guest` (or in `submissions/router.py` / `api.py`): Reassigns local guest submissions.
2. **`packages/gateway/src/models/entities.py`**:
   - `User`, `Submission`, and `ContestParticipation` models already define the required fields and indexes (`users.username`, `submissions.user_id`, `submissions.created_at`, `contest_participations.user_id`).
3. **`packages/gateway/src/api.py`**:
   - Mount new `users_router` and `migration_router`.
   - Update submission handling so that when authenticated users submit code via `/api/v1/submissions`, a `Submission` entity is created or updated in PostgreSQL.

### Frontend Integration Points
1. **`packages/frontend/src/pages/AuthPage.tsx`**:
   - Implement 150ms debounced checks for both username and email.
   - Render Emerald / Coral Red status badges.
   - On signup success, trigger guest submission migration before navigating.
2. **`packages/frontend/src/services/api.ts`**:
   - Add `getUserProfile(username: string): Promise<UserProfileResponse>`.
   - Add `migrateGuestSubmissions(submissions: GuestSubmission[]): Promise<{ migrated_count: number }>`.
3. **`packages/frontend/src/services/problemService.ts`**:
   - Add helpers `getGuestSubmissions()`, `recordGuestSubmission(submission)`, `clearGuestSubmissions()`.
4. **`packages/frontend/src/pages/ProblemWorkspacePage.tsx`**:
   - Record completed evaluation outcomes into guest submission store when user is unauthenticated.
5. **`packages/frontend/src/pages/ProfilePage.tsx`**:
   - Replace deterministic random generators (`buildRatingHistory`, `generateContributions`) with live data from `getUserProfile`.
   - Feed authentic `ContributionDay[]` array into `<IsometricHeatmap data={dailyContributions} />`.

---

## Potential Pitfalls & Mitigations

1. **Date Timezone Inconsistencies in Skyline**:
   - *Pitfall*: SQLite and PostgreSQL handle `DATE` casting slightly differently in tests vs production (`strftime('%Y-%m-%d', created_at)` in SQLite vs `CAST(created_at AS DATE)` in PostgreSQL).
   - *Mitigation*: Use SQLAlchemy `func.date(Submission.created_at)` which compiles correctly across both SQLite and PostgreSQL.
2. **Cold-Start Profiles with Zero Submissions**:
   - *Pitfall*: If a newly registered user views `/u/:username`, aggregations may return empty lists, potentially breaking SVG sparklines or division by zero in percentages.
   - *Mitigation*: Ensure default fallback values (e.g. baseline 1500 rating, default empty arrays, 0% solved rings) so the page renders gracefully without errors.
3. **Guest Submission Replay / Migration Flood**:
   - *Pitfall*: Malformed or repeated guest submission payloads could create thousands of invalid submission rows.
   - *Mitigation*: Limit migration payload size to max 100 entries, validate language/verdict strings, and deduplicate by problem + timestamp.

---

## Validation Architecture

### Automated Tests
1. **`packages/gateway/tests/test_guest_migration.py`**:
   - Validates `POST /api/v1/submissions/migrate-guest`.
   - Verifies batch insertion of guest submissions into PostgreSQL `submissions` table.
   - Verifies rejection of unauthenticated calls (401 Unauthorized).
   - Verifies limit enforcement and validation.
2. **`packages/gateway/tests/test_profile_analytics.py`**:
   - Validates `GET /api/v1/users/{username}/profile`.
   - Verifies difficulty solve breakdown counts for Easy, Medium, Hard problems.
   - Verifies contest progression calculation from `contest_participations`.
   - Verifies 365-day daily submission counts formatted for the skyline heatmap.
   - Verifies 404 response for non-existent users.
3. **Frontend Build & Unit Validation**:
   - Run `npm --prefix packages/frontend run build` ensuring 0 TypeScript errors.
   - Verify debounced availability badges and profile loading behavior.

---

## Plan Decomposition

- **Wave 1 (Plan 16-01: Backend Analytics & Guest Migration Engine)**:
  - Implement `packages/gateway/src/users/router.py` with `GET /api/v1/users/{username}/profile` and `POST /api/v1/submissions/migrate-guest`.
  - Connect router in `packages/gateway/src/api.py`.
  - Create comprehensive tests in `packages/gateway/tests/test_guest_migration.py` and `packages/gateway/tests/test_profile_analytics.py`.
- **Wave 2 (Plan 16-02: Frontend Auth UX, Migration Hook & Dynamic Profile)**:
  - Update `packages/frontend/src/pages/AuthPage.tsx` with 150ms debounced availability checks for username and email with Emerald/Coral Red badges (`UX-01`).
  - Implement guest submission recording in `problemService.ts` / `ProblemWorkspacePage.tsx` and migration hook in `AuthPage.tsx` / `api.ts` (`UX-02`).
  - Update `packages/frontend/src/pages/ProfilePage.tsx` to fetch authentic analytics and drive the 3D Isometric Skyline (`UX-03`, `UX-04`, `UX-05`).

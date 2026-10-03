---
phase: 08
plan: "02"
requirements-completed: [NAV-01, NAV-02]
---
# 08-02 Summary — Routing infrastructure

- Added `react-router-dom`; `App.tsx` now routes `/`, `/auth/login`, `/auth/signup`, `/problems`, `/problems/:slug`, `/u/:username`, `/contests`.
- Existing IDE moved to `pages/ProblemWorkspacePage.tsx` (slug drives active problem; selector navigates).
- `LinearHeaderNav` with active links, live gateway latency pill, guest/user status.
- Landing/Auth/Problems/Profile/Contests are intentionally minimal shells for Phases 9–12.
- Verified: `npm run build` passes.

Note: `src/theme.ts` did not previously exist (Monaco theme lives in `constants/theme.ts`); created fresh.

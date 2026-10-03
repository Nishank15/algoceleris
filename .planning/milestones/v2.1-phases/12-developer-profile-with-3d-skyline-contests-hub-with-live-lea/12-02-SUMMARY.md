---
phase: 12
plan: "02"
requirements-completed:
  - CONT-01
  - CONT-02
---

# 12-02 Summary — Contests Hub with Live Countdown Clocks & Full-Page Real-Time Leaderboard

- **Contests Hub (`packages/frontend/src/pages/ContestsPage.tsx`)**:
  * Route `/contests` displays active, upcoming, and past contests fetched via `listContests()` with built-in fallback data.
  * Live countdown timers update every second in monospace font (`HH:MM:SS` or `X days, Y hours`) with Pulse Green highlight for active contests and Amber for upcoming contests.
  * One-click "Register" / "Registered" toggle persists user registration in `localStorage` under `cloud_judge_contest_registrations`.
  * Dynamic participant counter reflects registered state with instant UI updates.
  * "Enter Arena" directs active contest participants to the contest problem set.
- **Full-Page Real-Time Contest Leaderboard (`CONT-02`)**:
  * Toggle to full-page leaderboard view with back button returning to the Contests Hub.
  * Displays real-time standings powered by Redis Sorted Sets ($O(\log N)$ ranking).
  * Rank badges render Gold (#1), Silver (#2), Bronze (#3), and standard rank pills.
  * Competitor cell includes avatar, handle, link to `/u/:username`, and Pro/Free tier pill. Current user highlighted with subtle lime tint.
  * Problem matrix columns (A, B, C, D) display accepted status (`+attempts` in Pulse Green with time) or rejected attempts (`-attempts` in Coral Red).
  * Real-time WebSocket live stream via `subscribeContestLeaderboard()` with fallback 8-second polling and live status indicator ("LIVE SYNCED" / "OFFLINE (POLLING)").
- **Styling (`packages/frontend/src/index.css`)**:
  * Added `.contests-page-root`, `.contest-card`, `.countdown-timer-mono`, `.fp-board-table`, and matrix status cells following Refero Linear Midnight tokens.
- **Verification**:
  * `npm --prefix packages/frontend run build` compiles with 0 errors across 1,622 modules.

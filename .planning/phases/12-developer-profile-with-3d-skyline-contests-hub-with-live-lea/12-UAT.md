---
status: complete
phase: 12-developer-profile-with-3d-skyline-contests-hub-with-live-lea
source:
  - 12-01-SUMMARY.md
  - 12-02-SUMMARY.md
started: "2026-10-03T21:34:00Z"
updated: "2026-10-04T01:02:30Z"
---

## Current Test

[testing complete]

## Tests

### 1. Developer Profile Page & Metrics Card
expected: |
  Navigate to http://127.0.0.1:3000/u/developer.
  Profile displays user hero card with metadata, circular solved breakdown ring with Easy/Medium/Hard bars, contest rating chart with area glow, and recent submissions list.
result: pass

### 2. 3D Isometric Contribution Skyline
expected: |
  On the profile page under "Contribution Activity & 3D Skyline":
  - Component renders inside a fixed dark container (background: #0b0c0e, 1px solid #23252a border, 12px radius, 24px padding).
  - Segmented toggle pill in top-right switches between 2D (grid icon) and 3D (cube icon).
  - In 2D mode: The 4 stat metrics (1 year total, Busiest day, Longest streak, Current streak) render in a row below the flat calendar grid.
  - In 3D mode: The 3D canvas expands to fill container height, the 4 metrics become an absolute HUD overlay in corners, and bottom instruction reads "Drag to orbit · double-click to reset".
  - Hovering/clicking cubes displays date and submission count tooltips without clipping.
result: pass

### 3. Contests Hub & Live Countdown Timers
expected: |
  Navigate to http://127.0.0.1:3000/contests.
  Contests are grouped into Active, Upcoming, and Past sections.
  Active and upcoming contests feature live countdown clocks ticking down every second in monospace font (Pulse Green for live, Amber for upcoming).
  Active contest displays "LIVE NOW" with a pulsating green dot and an "Enter Arena" button.
result: pass

### 4. Contest Registration Toggle & Persistence
expected: |
  On any active or upcoming contest card (e.g. Biweekly Contest 138):
  - Click "Register". The button immediately switches to "✓ Registered" and the participant counter increments by 1.
  - Refresh the page: the contest remains marked as "Registered".
  - Click "Registered" again to unregister: state reverts cleanly.
result: pass

### 5. Full-Page Real-Time Contest Leaderboard & Problem Matrix
expected: |
  On any contest card at /contests, click "View Leaderboard":
  - View switches to the full-page leaderboard.
  - Displays rank badges (Gold #1, Silver #2, Bronze #3), competitor handle/avatar with Pro/Free badge, solved count, and ICPC penalty minutes.
  - Problem columns (A, B, C, D) render matrix cells with solved (+attempts and time) or rejected attempts (-attempts).
  - Connection status badge indicates "LIVE SYNCED" or "OFFLINE (POLLING)".
  - Clicking "← Contests Hub" returns to the contest list.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]

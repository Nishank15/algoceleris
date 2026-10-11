---
phase: 12
plan: "01"
requirements-completed:
  - PROF-01
  - PROF-02
---

# 12-01 Summary — Developer Profile with Circular Difficulty Ring, Rating Chart & 3D Isometric Skyline

- **Developer Profile Core (`packages/frontend/src/pages/ProfilePage.tsx`)**:
  * Route `/u/:username` displays a comprehensive developer profile adhering to Refero Linear Midnight dark aesthetics.
  * Hero card renders user avatar with initials, username, Pro or Free tier badge, bio, join date, global rank, acceptance rate, and current streak.
  * Dual-circle SVG progress ring shows total solved over catalog count, with animated progress bars for Easy (`#27a644`), Medium (`#f59e0b`), and Hard (`#eb5757`) difficulty tiers dynamically synced with `problemService.getSolvedProblemIds()`.
  * Contest rating progression chart features SVG sparkline with green gradient area glow, ranking title (Guardian/Knight), and global percentile.
  * Recent submissions log displays recently solved and attempted problems with difficulty pill, language used, and relative timestamps.
- **3D Isometric Contribution Skyline (`PROF-02`)**:
  * Embedded `IsometricHeatmap` from 21st.dev inside `.skyline-shell`.
  * Adheres to all 5 strict rendering rules:
    1. Fixed bounding container (`background: #0b0c0e`, `border: 1px solid #23252a`, `border-radius: 12px`, `padding: 24px`, `position: relative`, `overflow: hidden`).
    2. Top-right segmented toggle pill (`border: 1px solid #23252a`, `border-radius: 6px`) to switch between 2D (grid icon) and 3D (cube icon).
    3. In 2D mode, the 4 stat metrics (1 year total, Busiest day, Longest streak, Current streak) render in a row below the flat SVG calendar grid.
    4. In 3D mode, the 3D canvas expands to fill container height, and the 4 stat metrics become an absolute HUD overlay (top-right and bottom-left) overlapping the canvas; bottom instructions display "Drag to orbit · double-click to reset".
    5. Tooltips use canvas raycasting mapped to the bounding rect to prevent overlap issues.
- **Styling (`packages/frontend/src/index.css`)**:
  * Styled `.profile-page-root`, `.profile-hero-card`, `.solved-ring-container`, `.rating-chart-container`, and `.skyline-shell` using Void (`#08090a`), Carbon (`#0f1011`), and Graphite (`#23252a`) tokens.
- **Verification**:
  * `npm --prefix packages/frontend run build` compiles with 0 errors across 1,622 modules.

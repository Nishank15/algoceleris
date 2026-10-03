---
phase: 03-midnight-dark-linear-ide-frontend
date: 2026-10-02
status: approved
tags: [linear-design, midnight-dark, monaco-editor, 3-pane-layout, zen-mode, websocket-streaming]
---

# UI Design Contract: Linear Midnight Dark IDE Frontend

**Production-grade, commercial online judge IDE with Linear-inspired midnight obsidian styling, 3-pane resizable layout, distraction-free Zen mode, and real-time execution streaming.**

---

## 1. Visual Identity & Color Palette

### Midnight Dark Color Tokens

```css
:root {
  /* Surfaces */
  --bg-canvas: #090b10;        /* Deep obsidian base */
  --bg-surface: #0f121a;       /* Panel surface background */
  --bg-surface-elevated: #161b26; /* Hover / active card surface */
  --bg-surface-overlay: #1c2333;  /* Tooltips, modals, popovers */

  /* Borders & Dividers */
  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-active: rgba(99, 102, 241, 0.4);
  --border-divider: rgba(255, 255, 255, 0.05);

  /* Accents & Brand */
  --accent-primary: #6366f1;   /* Linear indigo */
  --accent-hover: #818cf8;     /* Indigo hover glow */
  --accent-secondary: #8b5cf6; /* Violet secondary */
  --accent-gradient: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);

  /* Verdict Status Colors */
  --color-accepted: #10b981;   /* Emerald green */
  --color-accepted-bg: rgba(16, 185, 129, 0.12);
  --color-wrong-answer: #f43f5e; /* Rose red */
  --color-wrong-answer-bg: rgba(244, 63, 94, 0.12);
  --color-timeout: #f59e0b;    /* Amber warning */
  --color-timeout-bg: rgba(245, 158, 11, 0.12);
  --color-running: #38bdf8;    /* Sky blue */
  --color-running-bg: rgba(56, 189, 248, 0.12);

  /* Typography */
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace;
}
```

---

## 2. Layout & Responsive Architecture

### 3-Pane Resizable Grid
1. **Top Navigation Bar (52px height):**
   - Brand logo with gradient badge: `CLOUD-JUDGE` `V2`
   - Problem Selector & Breadcrumb
   - Language selector (`C++20`, `Python 3.12`, `Java 21`)
   - Zen Mode trigger button
   - Execution Actions: `Run Sample Cases` (secondary) and `Submit Solution` (primary accent gradient)
2. **Left Pane (Problem Description, default 42% width):**
   - Markdown statement rendering
   - Mathematical notation support
   - Constraints, Input/Output specification
   - Sample cases with one-click copy
3. **Right Top Pane (Monaco Editor, default 60% height of right area):**
   - Monaco Editor instance with custom `linear-midnight` theme
   - Language-specific starter boilerplate template pre-populated
   - Line numbers, minimap toggle, font size adjustment
4. **Right Bottom Pane (Test Console, default 40% height of right area):**
   - Tab 1: **Test Cases** (interactive test inputs, custom testcase runner)
   - Tab 2: **Live Output** (WebSocket streaming progress, compilation status, per-testcase pass/fail pills)
   - Tab 3: **Diff Viewer** (formatted diff between actual and expected output on WRONG_ANSWER)

---

## 3. Zen Mode (Distraction-Free)

- **Behavior:**
  - Collapses left Problem pane and bottom Test Console pane smoothly using CSS transitions (`transform: translateX(-100%)`, `opacity: 0`).
  - Monaco editor expands to occupy 100% of viewport below header.
  - Displays persistent floating escape chip: `Press Esc or click to exit Zen Mode`.
  - Global `Escape` key listener exits Zen mode instantly.

---

## 4. Real-Time Streaming Output Specifications

- **WebSocket Connection:** connects to `ws://localhost:8000/ws/submissions/{submission_id}`
- **Pill Progression:**
  - `QUEUED`: Pulsing subtle grey dot
  - `COMPILING`: Spinning indigo loader
  - `TEST CASE 1/N`: Sky blue pulse while running
  - `PASSED`: Solid emerald badge with execution time (`14ms`)
  - `FAILED / WA`: Solid rose badge with diff preview button
  - `COMPLETED`: Summary card with total time, peak memory, and final verdict badge

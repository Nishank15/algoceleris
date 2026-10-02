---
phase: 03-midnight-dark-linear-ide-frontend
plan: "01"
subsystem: frontend
tags: [vite, react, typescript, linear-dark, resizable-layout, header]

requires: [02-03]
provides:
  - Frontend Vite project configured with React 18 and TypeScript
  - Linear midnight dark design system with CSS custom properties (#090b10 canvas, #0f121a surface, #6366f1 indigo)
  - ResizableLayout 3-pane responsive grid with horizontal and vertical drag splitters
  - Header navigation bar with brand badge, language selector, Zen toggle, and action buttons
affects: [03-02-PLAN, 03-03-PLAN]

actuals:
  tokens: 2200
  tasks: 3
  commits: 1

tech-stack:
  added: [vite, react, typescript, lucide-react]
  patterns: [css-design-tokens, resizable-panes, distraction-free-zen-mode]

key-files:
  created:
    - packages/frontend/package.json
    - packages/frontend/vite.config.ts
    - packages/frontend/tsconfig.json
    - packages/frontend/tsconfig.node.json
    - packages/frontend/index.html
    - packages/frontend/src/index.css
    - packages/frontend/src/types.ts
    - packages/frontend/src/components/Header.tsx
    - packages/frontend/src/components/ResizableLayout.tsx
    - packages/frontend/src/App.tsx

key-decisions:
  - "Configured Vite with port 3000 and proxy to localhost:8000 for seamless local dev with Gateway API and WebSocket endpoints"
  - "Adopted Linear midnight dark color tokens with Inter and JetBrains Mono typography for a sleek competitive programming aesthetic"
  - "Implemented smooth drag splitters with percentage width/height bounds (25%-65% width, 25%-80% height)"

patterns-established:
  - "ResizableLayout handles layout transitions cleanly between 3-pane mode and distraction-free Zen mode"

requirements-completed:
  - IDE-02
  - IDE-03

coverage:
  - id: IDE2
    description: "Resizable 3-pane layout (problem description, code editor, test cases/console)"
    requirement: "IDE-02"
    verification:
      - kind: build
        ref: "packages/frontend/src/components/ResizableLayout.tsx"
        status: pass
    human_judgment: false
  - id: IDE3
    description: "Linear-style midnight dark design with toggleable Zen/Normal distraction-free view"
    requirement: "IDE-03"
    verification:
      - kind: build
        ref: "packages/frontend/src/index.css"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-02
status: complete
---

# Phase 03 Plan 01: Linear Midnight Dark Frontend Scaffold & 3-Pane Layout Summary

## Overview

Plan 01 established the foundation for Cloud-Judge V2's web frontend:
- **Vite + React 18 + TypeScript** initialized in `packages/frontend`.
- **Linear Midnight Dark Design System** implemented in `packages/frontend/src/index.css`, featuring `#090b10` obsidian base, glassmorphic panels, subtle borders, custom scrollbars, and Inter / JetBrains Mono typography.
- **Top Navigation Header** with problem switcher, language selector, Zen mode toggle, and action buttons.
- **Resizable 3-Pane Layout** with drag splitters supporting left-right and top-bottom resizing, and seamless distraction-free Zen mode collapse.

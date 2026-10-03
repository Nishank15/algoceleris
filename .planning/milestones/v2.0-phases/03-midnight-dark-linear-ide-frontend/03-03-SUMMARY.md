---
phase: 03-midnight-dark-linear-ide-frontend
plan: "03"
subsystem: frontend
tags: [problem-viewer, diff-viewer, test-console, websocket-streaming, gateway-client]

requires: [03-01, 03-02, 02-03]
provides:
  - ProblemPane with markdown descriptions, tags, constraints, and one-click sample case copying
  - Problem database containing standard competitive programming challenges (Two Sum, Valid Palindrome, Longest Substring)
  - Gateway API client for submission dispatch and live WebSocket streaming client (/ws/submissions/{id})
  - Multi-tab TestConsole (Test Cases, Custom Input, Execution Output) with status pills and telemetry
  - Line-by-line DiffViewer highlighting differences between actual output and expected output on WRONG_ANSWER
  - Full end-to-end integration in App.tsx
affects: [Phase 4]

actuals:
  tokens: 2400
  tasks: 3
  commits: 1

tech-stack:
  added: [monaco-editor, websocket-client]
  patterns: [real-time-streaming-pills, visual-diffing, offline-simulation-fallback]

key-files:
  created:
    - packages/frontend/src/constants/problems.ts
    - packages/frontend/src/services/api.ts
    - packages/frontend/src/components/ProblemPane.tsx
    - packages/frontend/src/components/DiffViewer.tsx
    - packages/frontend/src/components/TestConsole.tsx
  modified:
    - packages/frontend/src/App.tsx
    - packages/frontend/src/index.css

key-decisions:
  - "Integrated WebSocket event listener directly to Gateway endpoint /ws/submissions/{id} with automatic fallback polling if offline"
  - "Implemented live status progression banner with spinner (QUEUED -> COMPILING -> RUNNING -> COMPLETED/FAILED)"
  - "Built line-by-line DiffViewer highlighting expected vs actual outputs on WRONG_ANSWER verdicts"

patterns-established:
  - "One-click copy with temporary checkmark feedback on sample test cases"

requirements-completed:
  - IDE-02
  - IDE-04

coverage:
  - id: IDE4
    description: "Real-time submission & test run feedback streaming live progress via WebSockets into the console pane"
    requirement: "IDE-04"
    verification:
      - kind: build
        ref: "packages/frontend/src/components/TestConsole.tsx"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-02
status: complete
---

# Phase 03 Plan 03: Problem Viewer, TestConsole & Streaming Feedback Summary

## Overview

Plan 03 finalized Phase 3 by connecting the user interface directly to the execution pipeline:
- **Problem Description Pane** (`ProblemPane.tsx`) displaying problem metadata, markdown formatting, constraints, and interactive sample case cards with one-click clipboard copying.
- **Problem Catalog** (`problems.ts`) with multiple difficulty-tiered challenges and hidden evaluation suites.
- **Gateway & Streaming API** (`api.ts`) managing async submission dispatch (`POST /api/v1/submissions`) and live telemetry streaming (`ws://localhost:8000/ws/submissions/{id}`).
- **Multi-Tab Test Console** (`TestConsole.tsx`) providing test case selection, custom input textarea, real-time status pill progression (`QUEUED` -> `COMPILING` -> `RUNNING` -> `COMPLETED`/`FAILED`), and execution metrics (time, memory, cases passed).
- **Visual Diff Viewer** (`DiffViewer.tsx`) rendering side-by-side output comparison on `WRONG_ANSWER` verdicts.
- **End-to-End Build** fully validated with Vite (`npm run build` succeeds cleanly in 3.67s, producing lightweight production bundles).

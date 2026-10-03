# Requirements: Milestone v2.1 LeetCode-Grade Multi-Page Architecture & Refero Linear Midnight Platform

**Defined:** 2026-10-03
**Core Value:** Secure, ultra-low-latency, real-time multi-language code evaluation sandboxing paired with a frictionless developer experience and contest integrity.

## v2.1 Requirements

Requirements for Milestone v2.1. Each maps to roadmap phases.

### Design System & Precision Palette

- [x] **DS-01**: Global CSS variables and design tokens implement the Refero Linear Midnight precision palette: Bedrock Void (#08090a), Carbon (#0f1011), Obsidian (#161718), hairline Graphite (#23252a) borders (0.5px/1px), Smoke (#383b3f) dividers, and Acid Lime (#e4f222) exclusively reserved for the primary submit action.
- [x] **DS-02**: Clean typography system enforcing Inter font, -0.022em tracking, font-weights capped at 590 (no 700+ bold), and complete eradication of purple, violet, blue gradients, and heavy drop shadows across all views.

### Routing Infrastructure & Navigation

- [x] **NAV-01**: Multi-page client-side routing configured via `react-router-dom` supporting `/`, `/auth/login`, `/auth/signup`, `/problems`, `/problems/:slug`, `/u/:username`, and `/contests`.
- [x] **NAV-02**: Unified top navigation bar adhering to Linear Midnight aesthetic displaying route links, live system latency indicator, user profile avatar / guest status, and seamless view switching.

### Landing Page & Telemetry Teaser

- [ ] **LAND-01**: Minimalist Linear-styled hero landing page (`/`) featuring platform value proposition, architectural highlights, and real-time benchmark telemetry indicators (sandbox startup latency, CPU quota, memory boundary).
- [ ] **LAND-02**: Interactive micro-sandbox runner teaser on the landing page allowing visitors to execute sample code directly with instant live evaluation feedback.

### Authentication & Session Management

- [ ] **AUTH-01**: Centered Carbon-styled authentication card views for `/auth/login` and `/auth/signup` with form validation, guest sign-in bypass, and session state persistence.
- [ ] **AUTH-02**: Auth state provider managing current user session, guest credentials, and protecting authenticated actions across all routes.

### Problem Catalog & Filtering

- [ ] **CAT-01**: High-density LeetCode-grade problem catalog at `/problems` displaying problem title, acceptance rate, difficulty badge, and solved status.
- [ ] **CAT-02**: Topic tag filtering (e.g. Array, DP, Trees, Graph), difficulty filter pills (Pulse Green #27a644 for Easy, Amber #f59e0b for Medium, Coral Red #eb5757 for Hard), and real-time title search.

### Distraction-Free IDE Workspace

- [ ] **IDE-01**: Dedicated 3-pane Monaco IDE workspace at `/problems/:slug` loading problem description, starter solution stubs (standard LeetCode `class Solution`), and testcase console.
- [ ] **IDE-02**: 10-second client-side execution watchdog that automatically intercepts and alerts if judging responses hang, preventing locked UI states.
- [ ] **IDE-03**: Side-by-side testcase output and expected result diffing view with visual mismatch highlighting.
- [ ] **IDE-04**: Primary execution action styled with high-contrast Acid Lime (#e4f222) Submit button with real-time test evaluation streaming.

### Developer Profile & 3D Skyline

- [ ] **PROF-01**: Full-page developer profile at `/u/:username` featuring user metadata, contest rating history chart, and circular solved difficulty breakdown ring.
- [ ] **PROF-02**: 21st.dev 3D isometric contribution skyline rendered in GitHub green levels on an Obsidian canvas with rock-solid fixed tooltip positioning and submission count inspectability.

### Contests Hub & Live Leaderboard

- [ ] **CONT-01**: Contests hub at `/contests` displaying active, upcoming, and past contests with live countdown clocks and registration status.
- [ ] **CONT-02**: Full-page contest leaderboard powered by real-time Redis Sorted Set scores with instant rank recalculation, penalty breakdowns, and live polling.

## Future Requirements (v2.2+)

Tracked for subsequent milestones.

- **COLLAB-01**: Real-time multiplayer collaborative coding interview rooms with live cursors and shared terminal.
- **CUSTOM-01**: User-defined custom compiler flags and sandbox container image selection.
- **AUDIO-01**: WebRTC webcam proctoring with automated face gaze tracking and acoustic anomaly detection.

## Out of Scope

Explicitly excluded to maintain execution velocity and focus.

| Feature | Reason |
|---------|--------|
| Native mobile applications (iOS/Android) | Desktop/web IDE experience is the priority for code writing and multi-pane layout |
| Pod-per-submission Kubernetes runner | High startup latency overhead; Linux cgroups daemon workers chosen for sub-second start time |
| Manual human code review | Automated sandbox judge, AST plagiarism, and AI assistant handle evaluation |
| Heavy WebGL 3D environments | Minimalist precision dark aesthetic prioritized over compute-heavy 3D engines |

## Traceability

Which phases cover which requirements. Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DS-01 | Phase 8 | Complete |
| DS-02 | Phase 8 | Complete |
| NAV-01 | Phase 8 | Complete |
| NAV-02 | Phase 8 | Complete |
| LAND-01 | Phase 9 | Pending |
| LAND-02 | Phase 9 | Pending |
| AUTH-01 | Phase 9 | Pending |
| AUTH-02 | Phase 9 | Pending |
| CAT-01 | Phase 10 | Pending |
| CAT-02 | Phase 10 | Pending |
| IDE-01 | Phase 11 | Pending |
| IDE-02 | Phase 11 | Pending |
| IDE-03 | Phase 11 | Pending |
| IDE-04 | Phase 11 | Pending |
| PROF-01 | Phase 12 | Pending |
| PROF-02 | Phase 12 | Pending |
| CONT-01 | Phase 12 | Pending |
| CONT-02 | Phase 12 | Pending |

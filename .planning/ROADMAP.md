# Roadmap: Cloud-Judge V2 — Milestone v2.1: LeetCode-Grade Multi-Page Architecture & Refero Linear Midnight Platform

## Overview

Milestone v2.1 transforms Cloud-Judge V2 from a single-view prototype into a high-density, multi-page competitive programming platform adhering to the Refero Linear Midnight precision aesthetic. The milestone executes across 5 phases (Phases 8 through 12): establishing the foundational precision design system and client-side routing; crafting the minimalist hero landing page with live micro-sandbox runner teaser and Carbon authentication; engineering the high-density LeetCode problem catalog with topic taxonomies; delivering the distraction-free 3-pane Monaco IDE workspace with solution stubs and a 10-second watchdog; and concluding with the full-page developer profile featuring 21st.dev 3D skyline analytics and the real-time contests hub.

## Phases

**Phase Numbering:**
- Integer phases (8, 9, 10, 11, 12): Planned milestone work
- Decimal phases: Urgent insertions

- [x] **Phase 8: Refero Linear Midnight Design System & Multi-Page Routing Infrastructure** - Core precision design tokens (Void/Carbon/Obsidian/Graphite/Acid Lime), Inter typography rules, react-router-dom multi-page architecture, and unified Linear top navigation bar.
- [x] **Phase 9: Linear Landing Page, Live Telemetry Teaser & Carbon Auth** - Minimalist hero landing page with real-time benchmark telemetry, live micro-sandbox code runner teaser, and centered Carbon auth cards with guest login.
- [ ] **Phase 10: High-Density LeetCode Problem Catalog & Topic Taxonomy** - High-density problem catalog with search, topic tags (Array, DP, Trees, Graph), acceptance rates, and difficulty badges (Pulse Green, Amber, Coral Red).
- [ ] **Phase 11: Distraction-Free 3-Pane Monaco IDE Workspace & Execution Watchdog** - 3-pane Monaco IDE workspace at `/problems/:slug`, standard `class Solution` stubs, 10-second client execution watchdog, side-by-side testcase diffing, and Acid Lime submit action.
- [ ] **Phase 12: Developer Profile with 3D Skyline & Contests Hub with Live Leaderboards** - Dedicated `/u/:username` developer profile with contest rating chart, solved breakdown ring, 21st.dev 3D isometric skyline, and full-page `/contests` hub with Redis live leaderboards.

## Phase Details

### Phase 8: Refero Linear Midnight Design System & Multi-Page Routing Infrastructure

**Goal**: Establish the strict Refero Linear Midnight precision palette, typography constraints, react-router-dom multi-page routing infrastructure, and unified navigation.
**Mode:** mvp
**Depends on**: Milestone v2.0 (Phase 7)
**Requirements**: DS-01, DS-02, NAV-01, NAV-02
**Success Criteria** (what must be TRUE):
  1. CSS design system enforces Bedrock Void (#08090a), Carbon (#0f1011), Obsidian (#161718), hairline Graphite borders (#23252a), Smoke dividers (#383b3f), and Acid Lime (#e4f222) reserved strictly for primary submit actions.
  2. All typography uses Inter with -0.022em tracking, weights strictly <= 590, and zero purple/violet/blue gradients or heavy drop shadows anywhere in the stylesheet.
  3. Client-side routing with `react-router-dom` seamlessly mounts routes for `/`, `/auth/login`, `/auth/signup`, `/problems`, `/problems/:slug`, `/u/:username`, and `/contests`.
  4. Unified top navigation bar renders route navigation, real-time system ping/latency indicator, and active user/guest avatar.

**Plans**: 2 plans

Plans:
**Wave 1**
- [x] 08-01: Refero Linear Midnight precision palette, Inter typography constraints, and CSS token architecture
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 08-02: React Router DOM multi-page routing infrastructure, unified LinearHeaderNav, and route shells

### Phase 9: Linear Landing Page, Live Telemetry Teaser & Carbon Auth

**Goal**: Deliver a minimalist Linear-styled landing page with live micro-sandbox runner teaser and centered Carbon authentication cards with guest sign-in.
**Mode:** mvp
**Depends on**: Phase 8
**Requirements**: LAND-01, LAND-02, AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. Landing page (`/`) renders high-impact minimalist hero section with system value proposition and live benchmark telemetry metrics (sandbox startup latency, CPU quota, memory limits).
  2. Visitors can type or click "Run" on an interactive micro-sandbox teaser on the landing page and observe real-time code execution against the judge backend.
  3. User can navigate to `/auth/login` and `/auth/signup` and interact with centered Carbon cards with input validation and session persistence.
  4. One-click "Continue as Guest" allows instant exploration without registration barriers.

**Plans**: 2 plans

Plans:
**Wave 1**
- [x] 09-01: AuthContext provider, session state persistence, and centered Carbon auth cards
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 09-02: Minimalist Linear landing page, benchmark telemetry grid, and live micro-sandbox runner teaser

### Phase 10: High-Density LeetCode Problem Catalog & Topic Taxonomy

**Goal**: Build a high-density, searchable LeetCode-style problem catalog with topic filtering, difficulty badges, and solved status indicators.
**Mode:** mvp
**Depends on**: Phase 8
**Requirements**: CAT-01, CAT-02
**Success Criteria** (what must be TRUE):
  1. `/problems` renders a dense, clean catalog displaying problem title, acceptance rate, topic tags, and solved/attempted status.
  2. Users can filter catalog instantly by topic tags (Array, Dynamic Programming, Trees, Graph, Math, String).
  3. Users can filter by difficulty pills colored with Pulse Green (#27a644) for Easy, Amber (#f59e0b) for Medium, and Coral Red (#eb5757) for Hard.
  4. Instant search query filters problem rows with sub-50ms responsiveness.

**Plans**: 2 plans

Plans:
**Wave 1**
- [x] 10-01: Problem taxonomy schema, acceptance rates, and expanded competitive problem dataset
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 10-02: High-density LeetCode catalog UI with sub-50ms search, difficulty pills, and topic filters

### Phase 11: Distraction-Free 3-Pane Monaco IDE Workspace & Execution Watchdog

**Goal**: Construct the dedicated 3-pane Monaco IDE workspace for `/problems/:slug` featuring starter solution stubs, 10-second client execution watchdog, side-by-side diffing, and Acid Lime submit action.
**Mode:** mvp
**Depends on**: Phase 8, Phase 10
**Requirements**: IDE-01, IDE-02, IDE-03, IDE-04
**Success Criteria** (what must be TRUE):
  1. Navigating to `/problems/:slug` initializes a distraction-free 3-pane workspace with problem description, Monaco editor pre-filled with standard `class Solution` stubs, and test console.
  2. Client-side watchdog aborts and alerts with actionable diagnostics if a submission/run evaluation does not resolve within 10 seconds, preventing hanging UI states.
  3. Testcase console features side-by-side output vs. expected result diffing with clear mismatch highlights.
  4. Primary submit button is rendered with high-contrast Acid Lime (#e4f222) exclusively, providing live real-time testcase streaming status.

Plans:
**Wave 1**
- [x] 11-01: Problem-specific LeetCode class Solution starter templates and 10-second client execution watchdog
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 11-02: Side-by-side testcase diff viewer with token mismatch highlights and Acid Lime streaming submit button

### Phase 12: Developer Profile with 3D Skyline & Contests Hub with Live Leaderboards

**Goal**: Deliver a full-page developer profile with 3D contribution skyline and a dedicated contests hub with live countdowns and full-page Redis leaderboards.
**Mode:** mvp
**Depends on**: Phase 8, Phase 11
**Requirements**: PROF-01, PROF-02, CONT-01, CONT-02
**Success Criteria** (what must be TRUE):
  1. `/u/:username` displays a comprehensive developer profile with user details, contest rating progression chart, and circular solved breakdown rings (Easy, Medium, Hard).
  2. 21st.dev 3D isometric contribution skyline is mounted on an Obsidian canvas with GitHub green level pillars and fixed tooltip positioning.
  3. `/contests` displays active, upcoming, and past contests with live countdown timers and registration buttons.
  4. Full-page contest leaderboard displays real-time Redis Sorted Set rankings with instant updates, ICPC penalties, and live polling.

# Technical Architecture Blueprint: Milestone v4.1 Specification
## "Isolated Multi-Tenant Campus Portal (LPilot Architecture), 3-Tier Institutional Hierarchy & Full-Stack Hackathon Platform"

**Role:** Systems Architect (`@architect`) & Implementation Lead (`@implementation-worker`)
**Status:** RATIFIED FOR EXECUTION
**Target Platform:** AlgoCeleris / Cloud-Judge V2 (Rust Axum 0.8 + React 19 + Rsbuild)
**Milestone:** v4.1 (Phases 19–24)
**Strict Invariant:** Zero regression on v4.0 Rust Gateway, Worker Sandbox, and Consumer Problem Catalog.

---

## 1. Executive Summary & Core Architectural Corrections

Milestone v4.1 resolves three structural defects in the platform and introduces the consumer Hackathon ecosystem:

1. **Complete Consumer vs. Institutional Separation:**
   - **Defect:** `Campus` was previously placed in the public consumer top navbar (`LinearHeaderNav.tsx`), mixing B2C competitive programming with private B2B university coursework.
   - **Solution:** Remove `Campus` from `LinearHeaderNav.tsx` and `Header.tsx`. Replace it with `Hackathons` (`/hackathons`). The public consumer header strictly displays: `Problems` | `Contests` | `Hackathons`.
   - **Entry Gateway:** The public `/auth/login` and `/auth/signup` pages (`AuthPage.tsx`) receive a dedicated Institutional Gateway footer card redirecting university users to `/campus` (the standalone Institutional Landing & Tenant Directory) or `/campus/register` (University Onboarding & Licensing).

2. **Multi-Tenant Institutional Onboarding, Licensing & Domain Isolation (`/campus/*`):**
   - **Landing (`/campus`):** Modeled directly on the LPilot (`lpilot.iprepai.co.in`) engineering education portal. Features `[Sign in to Institution ->]` and `[Provision Your University ->]`.
   - **Self-Serve University Provisioning & Payment (`/campus/register`):** A 3-step onboarding wizard where a University Dean / HOD / Admin registers their institution (e.g., `VIT Chennai`), configures their custom tenant slug/domain (`vit-chennai`, `@vitstudent.ac.in`), selects an institutional seat plan (Department Tier ₹14,999/sem vs. Campus Enterprise ₹49,999/sem), completes Razorpay/Stripe checkout, and auto-provisions `/campus/:orgSlug/*`.
   - **Split-Screen Co-Branded Login (`/campus/:orgSlug/login`):** 50% Royal Blue capability showcase panel (`AlgoCeleris × VIT CHENNAI`) + 50% Dark Obsidian portal login supporting `Student`, `Faculty`, and `Institution Admin` roles with 1-click Demo Credential autofill.

3. **Strict 3-Tier Academic Role Hierarchy (`org_admin` -> `faculty` -> `student`):**
   - **Defect:** Unauthenticated guests and students could previously view `/campus/calendar` and see the `+ New Assessment` button.
   - **Solution:** Enforce strict role-gated sidebar layouts (`CampusSidebarLayout.tsx`) and backend RBAC guards:
     * **`org_admin` (Institution Admin):** Manages university branding, domain whitelists, billing, faculty account provisioning, and bulk student CSV roster imports.
     * **`faculty` (Course Instructor / Professor):** Manages assigned course sections (e.g., `BACS101 - Section CH2025260101659`), authors 6-stage Lab Exercises and PAT Lab Tests (`+ New Lab / Assessment` is strictly restricted to Faculty), monitors the Live Proctor Cockpit, conducts 1-on-1 CRDT Viva grading, and reviews AST Plagiarism & Course Learning Outcome (CLO) matrices.
     * **`student` (Enrolled Student):** Views only their enrolled courses, Student Dashboard KPIs, Active/Completed Lab Exercises, Scheduled/Completed Lab Tests (PATs), the 6-Stage Progressive Lab Workspace, Read-Only Evaluated Submission Review, and the 4-Tab Personal Learning Analytics suite. Students NEVER see assessment creation buttons or proctor cockpits.

4. **LPilot-Grade 6-Stage Progressive Lab Room & 4-Tab Analytics:**
   - University coding labs follow a structured 6-stage pedagogical flow:
     `1. Content (Notes + Reference PDF)` -> `2. Demonstration Problems` -> `3. LED (Auto-graded MCQs)` -> `4. Practice Problems (Debugging & Problem Solving with Section-Locked Read-Only Boilerplate)` -> `5. Challenging Problems (Pseudocode + Design PDF Flowchart Upload + Code Editor)` -> `6. Submit (Completion Checklist Gatekeeper)`.

5. **Full-Stack Consumer Hackathon Platform (`/hackathons` & `/hackathons/:slug`):**
   - Complete hackathon discovery catalog, 5-tab Hackathon Command Center (`Overview & Timeline`, `Tracks & Bounties`, `Team Lobby & Invite Codes`, `Round 1 Algorithmic Qualifier & Round 2 Project Submission Portal`, `Project Showcase & Rubric Leaderboard`), backed by native Rust Axum routes (`/api/v1/hackathons/*`).

---

## 2. Routing & Navigation Topology

### 2.1 Public Consumer Platform (Uses `LinearHeaderNav.tsx`)
- `/` — Consumer Landing Page
- `/problems` — High-Density 5-Column Problem Catalog
- `/problems/:slug` — 3-Pane Monaco Coding Workspace
- `/contests` — Live Competitive Programming Contests & Leaderboards
- `/hackathons` — **NEW:** Hackathon Discovery Catalog & Featured Event Hero
- `/hackathons/:slug` — **NEW:** 5-Tab Hackathon Command Center (Teams, Tracks, Qualifier, Project Submissions, Showcase)
- `/u/:username` — Developer Profile & 3D Isometric Skyline
- `/auth/login` & `/auth/signup` — Consumer Auth Card + **Institutional Campus Gateway Redirect Card**

### 2.2 Standalone Institutional Campus Platform (NO Consumer Navbar)
- `/campus` — **Institutional B2B Landing Page & University Tenant Selector** (LPilot Hero, Institution Search/Selector, `[Sign in to Campus Portal]`, `[Register Your University]`)
- `/campus/register` — **3-Step University Onboarding, Subdomain Config & License Payment Wizard**
- `/campus/:orgSlug/login` (alias `/campus/login` defaults to `vit-chennai`) — **Split-Screen Co-Branded Institutional Login**
- `/campus/:orgSlug/*` — **Wrapped in `CampusSidebarLayout.tsx` (Dedicated Left Sidebar + Top Breadcrumb Bar)**:
  - **Student Routes (`role === 'student'`):**
    * `/campus/:orgSlug/student/dashboard` — 4 KPI Cards, Open Labs, Recent Evaluated Results, Needs Attention
    * `/campus/:orgSlug/student/labs` — Active Lab Exercises (filtered by class section)
    * `/campus/:orgSlug/student/labs/completed` — Completed Lab Exercises (5-filter bar, Evaluated scores, `View Details ->`, `Just Practice`)
    * `/campus/:orgSlug/student/labs/:labId/room` — **6-Stage Progressive Lab Workspace** (`Content`, `Demo`, `LED`, `Practice`, `Challenging`, `Submit`)
    * `/campus/:orgSlug/student/labs/:labId/review` — **8-Tab Read-Only Evaluated Lab Review** (`Evaluation Summary`, `Submission History`, `Feedback Summary`)
    * `/campus/:orgSlug/student/tests` — Active/Scheduled PAT Lab Tests (`StudentExamArenaPage`)
    * `/campus/:orgSlug/student/tests/completed` — Completed Lab Tests (`View Submission ->`, `Just Practice`)
    * `/campus/:orgSlug/student/analytics/learning-journey` — Learning Journey Analytics
    * `/campus/:orgSlug/student/analytics/programming` — Programming Analytics
    * `/campus/:orgSlug/student/analytics/ai-mentor` — AI Mentor Analytics
    * `/campus/:orgSlug/student/analytics/clo` — CLO Attainment Analytics
  - **Faculty Routes (`role === 'faculty'`):**
    * `/campus/:orgSlug/faculty/dashboard` — Faculty Cohort Overview, Active Labs/PATs, Pending Evaluations
    * `/campus/:orgSlug/faculty/labs/new` — **6-Stage Lab & PAT Assessment Authoring Studio** (`AssessmentCreatePage` enhanced)
    * `/campus/:orgSlug/faculty/cockpit/:assessmentId` — Live WebSocket Proctor Cockpit (`FacultyProctorCockpitPage`)
    * `/campus/:orgSlug/faculty/viva/:roomCode` — 1-on-1 CRDT Viva Grading Workspace (`VivaInterviewWorkspacePage`)
    * `/campus/:orgSlug/faculty/plagiarism` — Tree-sitter AST Plagiarism Matrix & Cohort CLO Reports
  - **Institution Admin Routes (`role === 'org_admin'`):**
    * `/campus/:orgSlug/admin/dashboard` — Seat Utilization, Active Departments, License Status, Domain Config, Faculty & Student Roster CSV Import

---

## 3. Detailed Phase Breakdown (Phases 19–24)

### Phase 19: Consumer Navbar Decoupling, Institutional Landing & Tenant Onboarding Wizard
**Files to Modify / Create:**
1. `packages/frontend/src/components/LinearHeaderNav.tsx` & `packages/frontend/src/components/Header.tsx`:
   - Remove `Campus` link (`to="/campus/calendar"`).
   - Add `Hackathons` link (`to="/hackathons"`).
2. `packages/frontend/src/pages/AuthPage.tsx`:
   - Add a sleek bottom card section inside the auth container:
     * Title: `🏛️ AlgoCeleris for Universities & Engineering Colleges`
     * Subtitle: `Access your institution's private programming labs, PAT assessments, and AI mentor portal.`
     * Primary Button: `Enter University Campus Portal ->` (navigates to `/campus`)
     * Secondary Link: `Register & Provision a New Institution ->` (navigates to `/campus/register`)
3. `packages/frontend/src/pages/campus/CampusLandingPage.tsx` (Route: `/campus`):
   - Modeled after LPilot `00:00`:
     * Blueprint grid background (`#0b1528` to `#08090a` radial gradient).
     * Co-branded showcase badge: `AlgoCeleris Campus · AI Co-Pilot for Programming Labs`.
     * Headline: `"The lab management system built for engineering education"`.
     * Subtitle: `"Combines progressive learning workflows, automated evaluation, section-locked code sandboxes, and AI-assisted tutoring into a single platform for faculty and students."`
     * Institution Quick-Select Pills: `VIT Chennai (vit-chennai.algoceleris.dev)`, `IIT Madras (iitm.algoceleris.dev)`, `NIT Trichy (nitt.algoceleris.dev)` + custom domain slug input.
     * CTA Buttons: `[Sign in to Institution Portal ->]` (routes to `/campus/vit-chennai/login`) and `[Provision Your University]` (routes to `/campus/register`).
4. `packages/frontend/src/pages/campus/CampusOnboardingPage.tsx` (Route: `/campus/register`):
   - 3-Step Self-Serve University Provisioning & Payment Flow:
     * **Step 1: Institution Identity & Domain Config:** Organization Name (`Vellore Institute of Technology, Chennai`), Tenant Slug (`vit-chennai`), Official Email Domains (`@vitstudent.ac.in, @vit.ac.in`), Admin Name, Admin Email, Password, Accent Color & Logo URL.
     * **Step 2: Institutional License Tier Selection:**
       - `Department License` (`₹14,999 / semester` or `$199 / mo`): Up to 500 students, 10 faculty seats, 6-stage coding labs, automated evaluation.
       - `Campus Enterprise License` (`₹49,999 / semester` or `$699 / mo`): Unlimited students & cohorts, AI Mentor Co-Pilot, Live WebSocket Proctoring Cockpit, CRDT Viva Rooms, Tree-sitter AST Plagiarism Engine, CLO Analytics.
     * **Step 3: Checkout & Auto-Provisioning:** Calls `POST /api/v1/campus/orgs/provision` (and Razorpay/Stripe checkout modal simulation), saves the tenant in state/backend, logs the user in as `org_admin`, and redirects to `/campus/:orgSlug/admin/dashboard`.

---

### Phase 20: Split-Screen Co-Branded Login & Strict 3-Tier Role Sidebar Layout
**Files to Create / Modify:**
1. `packages/frontend/src/pages/campus/CampusLoginPage.tsx` (Routes: `/campus/login`, `/campus/:orgSlug/login`):
   - **Left 50% Panel (Royal Blue Architectural Grid `#172554` / `#1e3a8a`):**
     * Co-branded Header: `[AlgoCeleris Logo] | [VIT CHENNAI — Vellore Institute of Technology]`
     * Subtitle: `Your AI Co-Pilot for Programming Labs`
     * Hero Heading: `"Master Programming With Your AI Learning Companion"`
     * Description: `"Practice lab exercises, get instant feedback on your code, and grow from understanding concepts to mastering programming skills."`
     * 2x2 Feature Cards:
       1. `AI Mentor` — Personalized guidance & hints
       2. `Smart Code Evaluation` — Instant compilation & feedback
       3. `Adaptive Practice` — Personalized coding challenges
       4. `Learning Analytics` — Track your skills & progress
   - **Right 50% Panel (Obsidian `#090a0f`):**
     * Top Portal Mode Pill: `● Student portal` / `● Faculty portal` / `● Admin portal`
     * Heading: `"Welcome back"` / `"Access your courses and lab sessions"`
     * Form Fields:
       - `Login ID`: Placeholder `"Registration number or email"` (e.g., `nishank.chhipa2025@vitstudent.ac.in`)
       - `Password`: Password input with show/hide eye button
       - `Remember me` checkbox + `Forgot password?` link
     * Role Selector & Submit Button:
       - Primary Blue Button: `Sign in as Student ▾` (with segmented role switcher or dropdown for `Student`, `Faculty`, `Institution Admin`)
       - Secondary Outlined Button: `First Time Login`
       - **Quick Demo Credentials Bar (For instant evaluation):** 3 compact pills (`🎓 Demo Student: Nishank`, `👨‍🏫 Demo Faculty: Dr. Saravanan P`, `👑 Demo Admin: Dean CSE`) that auto-fill credentials and sign in with 1 click.
2. `packages/frontend/src/components/CampusSidebarLayout.tsx`:
   - Dedicated institutional shell with a collapsible `248px` left sidebar and clean top bar (`ID: 25BCE1642 | Role Badge | Theme Toggle`).
   - **Role-Based Navigation Tree:**
     * **When `campusRole === 'student'`:**
       - `Navigation`: `Dashboard` (`/campus/:orgSlug/student/dashboard`)
       - `Lab Exercises`: `Active Lab Exercises` (`/campus/:orgSlug/student/labs`), `Completed Lab Exercises` (`/campus/:orgSlug/student/labs/completed`)
       - `Lab Test`: `Lab Tests` (`/campus/:orgSlug/student/tests`), `Completed Lab Tests` (`/campus/:orgSlug/student/tests/completed`)
       - `Analytics`: `Learning Journey`, `Programming Analytics`, `AI Mentor Analytics`, `CLO Analytics`
     * **When `campusRole === 'faculty'`:**
       - `Navigation`: `Faculty Dashboard` (`/campus/:orgSlug/faculty/dashboard`)
       - `Course Authoring`: `Create Lab / PAT (+ New)` (`/campus/:orgSlug/faculty/labs/new`), `Manage Lab Exercises` (`/campus/:orgSlug/student/labs`)
       - `Live Supervision`: `Proctor Cockpit` (`/campus/:orgSlug/faculty/cockpit/midterm-1`), `Viva Grading Rooms` (`/campus/:orgSlug/faculty/viva/VIVA-CS201-9871`)
       - `Integrity & Outcomes`: `AST Plagiarism & CLOs` (`/campus/:orgSlug/faculty/plagiarism`)
     * **When `campusRole === 'org_admin'`:**
       - `Administration`: `Institution Overview & Roster` (`/campus/:orgSlug/admin/dashboard`), `License & Billing` (`/campus/register`)
   - **Bottom User Profile Card:**
     * Displays Avatar initials (`NC`), Full Name (`NISHANK CHHIPA`), ID (`nishank.chhipa2025@vitstudent.ac.in`), and upward popover menu with:
       - `Switch Portal Role (Student / Faculty / Admin)` (for seamless testing without logging out)
       - `Change password`
       - `Logout` (returns to `/campus/:orgSlug/login`)

---

### Phase 21: LPilot Student Dashboard, Active/Completed Lab Lists & 8-Tab Read-Only Review
**Files to Create / Modify:**
1. `packages/frontend/src/pages/campus/CampusStudentDashboard.tsx` (`/campus/:orgSlug/student/dashboard`):
   - **4 Top KPI Cards:**
     1. `Active labs`: `1` (`Open right now`)
     2. `Completed labs`: `23` (`Submitted & evaluated`)
     3. `Average marks`: `8.82` (`Across submissions`)
     4. `CLO attainment`: `0%` (`Average outcome`)
   - **Open Labs Section:** Card for `PPS_11_Multi_Threading` (`BACS101 · In 4 days`) clicking through to the 6-stage lab room.
   - **Bottom 2-Column Split:**
     * Left (`Recent results` with `View all`):
       - `Week 12_Generics` (`BACS101 · 20/20 (100%)` `[Evaluated]`)
       - `Week 11_Multithreading` (`BACS101 · 20/20 (100%)` `[Evaluated]`)
       - `Week 10_PPS` (`BACS101 · 18.5/18.5 (100%)` `[Evaluated]`)
     * Right (`Needs your attention`): `"Deadlines and areas to focus on — Nothing urgent right now — you're all caught up."`
2. `packages/frontend/src/pages/campus/CampusLabsListPage.tsx` (Handles Active Labs, Completed Labs, Active Lab Tests, Completed Lab Tests):
   - **Active Lab Exercises View:** Class filter (`All Classes`, `BACS101 - CH2025260101659`). Card displays title `PPS_11_Multi_Threading`, `Active` green text, Start/End timestamps, and full-width blue button `[Open Lab ->]`.
   - **Completed Lab Exercises View:**
     * 5-Filter Bar: `Course` (`All courses`), `Semester` (`All semesters`), `Faculty` (`All faculty` / `Dr. SARAVANAN P`), `Evaluation Status` (`All statuses` / `Evaluated`), `Submitted between` (Date picker).
     * 2-Column Card Grid (`Week 12_Generics`, `Week 11_Multithreading`, `Week 10_PPS`, `Week 10_PPS_Serialization`): Each card shows `Evaluated` blue badge, `Faculty: Dr. SARAVANAN P`, `Start`, `End`, `Submitted`, `Score: 20/20 (100%)`, primary button `[View Details ->]` (routes to Read-Only Review), and secondary button `[>< Just Practice]`.
   - **Completed Lab Tests (PAT) View:**
     * 3-Column Card Grid (`Java 25 27_L910_PAT2_131026`, `Java 25 27_L52_PAT3_101026`, `Java Fall 26 27_PAT2_L9 L10`, `Mock Pat`) with `Pending Evaluation` / `Evaluated` badges, `Course: Problem Solving Using Java`, `Questions: 1 / 1 answered`, `Score: 24.5 / 30 (81.67%)`, `[View Submission ->]`, `[>< Just Practice]`.
3. `packages/frontend/src/pages/campus/CampusLabReviewPage.tsx` (`/campus/:orgSlug/student/labs/:labId/review`):
   - Top info banner: `"Completed Lab Exercise — This lab exercise has already been submitted. You are viewing your submission and evaluation in read-only mode."`
   - 8 Horizontal Review Tabs: `Content`, `Demonstration Problems`, `LED` (`LED Assessment Complete: 5/5 100%`), `Practice Problems` (Read-only code view), `Challenging Problems`, `Evaluation Summary` (Itemized breakdown showing `Public 2/2 · Private 2/2` test cases and `5/5 100%` scores), `Submission History`, `Feedback Summary`.

---

### Phase 22: 6-Stage Progressive Lab Exercise Workspace (`CampusLabRoomPage.tsx`)
**File to Create:** `packages/frontend/src/pages/campus/CampusLabRoomPage.tsx` (Route: `/campus/:orgSlug/student/labs/:labId/room`)
- **Top Workspace Header:**
  * Left: `ID: 8 | Student`
  * Right: `[<- Back to Active Lab Exercises]`
  * Sub-bar: Lab Title (`PPS_11_Multi_Threading`), live tabular countdown (`⏱ 92:32:14 left`), Student Name (`NISHANK CHHIPA`).
- **6 Horizontal Workflow Stage Tabs:**
  1. **`Content` Tab:**
     * Sub-tabs: `Learning Content` (rich structured lecture notes with Java/C++ code snippets on Generics & Multithreading) and `Reference PDF` (embedded interactive PDF viewer panel + download button).
  2. **`Demonstration Problems` Tab:**
     * Worked example problems with annotated solution code and step-by-step execution trace.
  3. **`LED` (Learning by Doing) Tab:**
     * Interactive MCQ Quiz (`10 questions`, progress counter `0/10 answered`).
     * Each question card shows question number, title (e.g., `"Give Correct Statement"`), `1 mark`, `Easy` badge, 4 selectable radio option rows, and instant check/save state.
  4. **`Practice Problems` Tab:**
     * Top sub-tabs: `Debugging Code (6)` and `Problem Solving (4)`.
     * **Left Pane (40% width):** Numbered problem selector pills (`1`, `2`, `3`, `4`, `5`, `6` — red for incomplete, green for solved), Problem Title (`Thread Never Actually Started (extends Thread)`), `Medium`, `Marks: 10`, full problem description and sample I/O.
     * **Right Pane (60% width):**
       - Status indicator (`● Not Completed` / `● Completed`), sub-tabs `Code Editor` | `Final Submission`, `Editor theme: Dark`.
       - **Section-Locked Code Workspace:**
         * **Top Locked Block (`Section 1: Fixed — read only`):** Grayed-out non-editable header displaying `import java.util.Scanner; class NumberPrinter extends Thread { ... }`.
         * **Middle Editable Solution Block (`Writable Solution Area`):** Active Monaco Editor where the student writes/fixes the core logic.
         * **Bottom Locked Block (`Section 2: Fixed — read only`):** Non-editable driver `public class Main { public static void main(String[] args) { ... } }`.
       - Action Bar: `[Run Code]`, `[Ask AI Mentor Hint]`, `[Submit Practice Problem]`.
  5. **`Challenging Problems` Tab:**
     * **Left Pane (40% width):** Numbered pills (`1..4`), Title (`Deadlock-Free Locking of Two Shared Resources`), `High`, `Marks: 10`, detailed concurrency specification.
     * **Right Pane (60% width):** 3-stage sub-navigation:
       - **Sub-tab 1 (`Pseudocode`):** `"Outline your approach before coding. This is part of the evaluation."` Structured numbered text editor (`1. Read input`, `2. Process`, `3. Print result`) with auto-save.
       - **Sub-tab 2 (`Code Editor`):**
         * **`Design (PDF)` Upload Box:** `"Optionally upload your design — flowchart, UML, or approach — as a single PDF (max 5 MB). Uploading again replaces the current file."` + `[Upload Design PDF]` file picker showing uploaded filename badge.
         * Below the PDF uploader: The Section-Locked Code Workspace.
       - **Sub-tab 3 (`Final Submission`):** Displays public & private test case results.
  6. **`Submit` Tab:**
     * Centered `Submit Lab Exercise` card displaying the live **`Completion checklist`**:
       - `LED`: `X/10 completed`
       - `Practice Problems`: `Y/10 completed`
       - `Challenging Problems`: `Z/4 completed`
     * If incomplete, displays amber warning banner `"⚠️ Not ready to submit — Complete every part above before you can submit this lab exercise"` and a `[ Demo: Mark All Sections Complete & Submit Lab]` button for instant testing.

---

### Phase 23: 4-Tab Student Learning Analytics & Faculty/Admin Management Portals
**Files to Create:**
1. `packages/frontend/src/pages/campus/CampusAnalyticsPage.tsx` (Routes: `/campus/:orgSlug/student/analytics/:tab`):
   - Top filter bar: `All courses ▾`, `All time ▾`.
   - **Tab 1 (`learning-journey`):**
     * KPIs: `Active time (18h 59m)`, `Labs engaged (24)`, `Activities (490)`, `Submissions (209)`.
     * Recharts Visualizations: `Activity over time` (smooth blue line chart), `Activity breakdown` (`RUN_CODE` vs `ASK_AI` bar chart), `Time spent per lab` (horizontal bar chart across `Lab Ex 1` to `Week 12_Generics`).
   - **Tab 2 (`programming`):**
     * KPIs: `Code runs (476)`, `Submissions (209)`, `Average marks (8.82)`, `Best marks (18.75)`.
     * Recharts Visualizations: `Marks progression` (line chart of awarded marks per submission), `Code runs over time` (daily execution count line chart).
   - **Tab 3 (`ai-mentor`):**
     * KPIs: `AI questions (14)`, `Avg response (1.4s)`, `Hints used (14)`, `Mentors used (2)`.
     * Recharts Visualizations: `AI questions over time`, `Average response time (ms)`, `Hints by type` (`debugging` vs `problem_solving` horizontal bar chart).
   - **Tab 4 (`clo`):**
     * KPIs: `CLOs tracked (4)`, `Average attainment (84%)`, `Strongest CLO (CLO-2: Concurrency 92%)`, `Weakest CLO (CLO-4: Generics 76%)`.
     * Recharts Visualizations: `Attainment by CLO` bar chart and `Attainment trend` line chart.
2. `packages/frontend/src/pages/campus/CampusFacultyDashboard.tsx` & `CampusAdminDashboard.tsx`:
   - **Faculty View:** Cohort selector (`BACS101 - CH2025260101659`), `+ Create New 6-Stage Lab / PAT Exam` CTA button, active lab completion progress bars (`58/64 students submitted`), quick links to `Live Proctor Cockpit`, `Viva Grading Room`, and `Tree-sitter AST Plagiarism Matrix`.
   - **Admin View:** University License status (`Enterprise Active`), Seat usage (`1,420 / Unlimited Students`, `42 Faculty`), Allowed Email Domains (`@vitstudent.ac.in`), Faculty invitation form, and Student Roster CSV batch uploader.

---

### Phase 24: Full-Stack Consumer Hackathon Platform (`/hackathons` & Rust Gateway Routes)
**Files to Create / Modify:**
1. `packages/frontend/src/pages/HackathonsPage.tsx` (Route: `/hackathons`):
   - **Flagship Hero Banner:** `DevsHouse '26 — National Systems & AI Buildathon`, Live Countdown (`tabular-nums`), Prize Pool (`₹5,00,000 / $6,000`), Mode badge (`Hybrid · VIT Chennai & Online`), Track pills (`Rust & Systems`, `Agentic AI`, `FinTech & Quant`, `Open Innovation`), and `[Enter Hackathon Command Center ->]`.
   - **Filterable Hackathon Grid:** Filter by `All`, `Live Now`, `Upcoming`, `Past`, and track tags. Cards for `DevsHouse '26`, `CSI ORIGIN 2026`, `Build With Gemma AI Challenge`, and `AlgoCeleris Global Rust Sprint`.
2. `packages/frontend/src/pages/HackathonDetailPage.tsx` (Route: `/hackathons/:slug`):
   - **5-Tab Hackathon Command Center:**
     * **Tab 1 (`Overview & Timeline`):** Interactive 5-phase milestone stepper (`1. Registration & Team Formation` -> `2. Algorithmic Coding Qualifier` -> `3. Idea & Architecture Abstract` -> `4. 48-Hour Build Sprint` -> `5. Live Demo & Rubric Judging`), rules, and eligibility.
     * **Tab 2 (`Tracks & Bounties`):** Detailed track cards with problem statements (e.g., *Emergency Response Dispatch Engine*, *High-Throughput Distributed Rate Limiter*), sponsor API bounties, and prize distribution.
     * **Tab 3 (`Team Lobby & Matchmaking`):**
       - **My Team Panel:** Create a new team (generates a copyable 6-char invite code like `FLOW-26`), or join an existing team via invite code.
       - **Teammate Matchmaking Directory:** Browse solo participants looking for teams, filtered by role (`Backend / Rust`, `Frontend / Three.js`, `ML / AI`) with `[Invite to Team]` action.
     * **Tab 4 (`Qualifier & Project Submission`):**
       - **Round 1 (Algorithmic Qualifier):** Launch button into timed coding problems evaluated by the Rust Worker sandbox.
       - **Round 2 (Project Submission Portal):** Form with `Project Title` (e.g., `Nirnay`), `Tagline`, `Selected Track`, `GitHub Repository URL`, `Live Deployment URL`, `Architecture Diagram / Deck PDF Upload`, and `Video Demo URL`, with instant submission state.
     * **Tab 5 (`Project Showcase & Leaderboard`):**
       - Gallery of submitted projects with tech stack tags, GitHub/Demo links, community upvote button, and live 4-criterion Judge Rubric breakdown (`Technical Depth`, `Architecture`, `Innovation`, `UX Polish`).
3. **Rust Gateway Backend Routes (`crates/judge-gateway/src/routes/hackathons.rs` & `lib.rs`):**
   - Implement and mount:
     * `GET /api/v1/hackathons` — List all hackathons with metadata, prize pools, and registration counts.
     * `GET /api/v1/hackathons/{slug}` — Detailed hackathon spec, tracks, timeline, teams, and project showcase.
     * `POST /api/v1/hackathons/{slug}/register` — Register user/team for a hackathon.
     * `POST /api/v1/hackathons/{slug}/teams` — Create or join a hackathon team with invite code generation.
     * `POST /api/v1/hackathons/{slug}/submissions` — Submit or update a hackathon project artifact.
     * `POST /api/v1/campus/orgs/provision` — Provision a new university tenant from the `/campus/register` wizard.

---

## 4. Verification & Acceptance Criteria Matrix

| Phase | Deliverable | Verification Command |
|---|---|---|
| **Phase 19** | Navbar decoupled (`Hackathons` in, `Campus` out), `/auth/login` institutional gateway card, `/campus` landing & `/campus/register` onboarding wizard | `npm --prefix packages/frontend run build` |
| **Phase 20** | `/campus/:orgSlug/login` LPilot split-screen login + `CampusSidebarLayout.tsx` strict 3-role sidebar (`student`, `faculty`, `org_admin`) | `npm --prefix packages/frontend run build` |
| **Phase 21** | LPilot Student Dashboard, Active/Completed Lab & PAT lists with 5-filter bar, and 8-tab Read-Only Evaluated Lab Review | `npm --prefix packages/frontend run build` |
| **Phase 22** | 6-Stage Progressive Lab Room (`Content`, `Demo`, `LED MCQs`, `Practice w/ Locked Code Sections`, `Challenging w/ Pseudocode & PDF Upload`, `Submit Checklist`) | `npm --prefix packages/frontend run build` |
| **Phase 23** | 4-Tab Student Learning Analytics (`Learning Journey`, `Programming`, `AI Mentor`, `CLO`) + Faculty & Admin Dashboards | `npm --prefix packages/frontend run build` |
| **Phase 24** | `/hackathons` catalog, `/hackathons/:slug` 5-tab Command Center, and Rust Axum `/api/v1/hackathons/*` endpoints | `cargo check --workspace && npm --prefix packages/frontend run build` |
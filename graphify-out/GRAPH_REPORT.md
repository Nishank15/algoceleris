# Graph Report - cloud-judge-v2  (2026-10-17)

## Corpus Check
- 235 files · ~232,169 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 3, .css 3, .gateway 1)

## Summary
- 2888 nodes · 5717 edges · 161 communities (140 shown, 21 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 194 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0b7df2d0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- CampusLabRoomPage.tsx
- cli.cjs
- judge-core/src/lib.rs
- ProblemWorkspacePage.tsx
- campusApi.ts
- components_heatmap.tsx
- IsometricHeatmap.tsx
- judge-core/src/lib.rs
- api.ts
- gen-capability-registry.cjs
- verify-local-runtime.mjs
- frontend/package.json
- judge-db/src/lib.rs
- DbError
- gen-loop-host-contract.cjs
- test_cockpit_apis.rs
- VivaClusterMessage
- judge-core/src/models.rs
- judge-db/src/models.rs
- auth.rs
- routes/submission.rs
- WorkerError
- test_secret_masking.rs
- Linear — Style Reference
- test_viva_isolation.rs
- judge-worker/src/lib.rs
- ast.rs
- hackathons.rs
- SubmissionRecord
- AppState
- VivaRoom
- test-phase12-exam-arena.mjs
- TelemetryEvent
- Cloud-Judge V2 (AlgoCeleris) — Milestone v4.3 Comprehensive Audit Report
- AuthContext.tsx
- Local Storage
- judge-viva/src/ws.rs
- VivaDoc
- ProfilePage.tsx
- WorkerDaemon
- cli-exit.cjs
- engine.rs
- test-phase11-faculty-scheduler.mjs
- Test generation (plan → generate → heal)
- compilerOptions
- subscriptions.rs
- RubricEvaluationUpdate
- contests.rs
- test-phase14-viva-workspace.mjs
- fix-slash-commands.cjs
- shellcheck-fetch.cjs
- test_assessment_lifecycle.rs
- test_telemetry_mesh.rs
- App.tsx
- NewMember
- ProctorEventRecord
- users.rs
- AwarenessEnvelope
- src/theme.ts
- test-phase17-haproxy-cutover.mjs
- drift-scan.cjs
- TestConsole.tsx
- test-phase13-proctor-cockpit.mjs
- new.cjs
- TelemetryRelay
- SeccompAction
- Browser Session Management
- Verdict
- test-phase3-mobile-hardening.mjs
- Tracing
- TokenBucket
- LinuxSandbox
- ref_assert
- 4. 18 Micro-Phases Across 7 Tracks
- ref_fs
- TelemetryError
- CommandConfig
- compilerOptions
- test-phase1-relative-endpoints.mjs
- cockpit.rs
- ref_assert
- judge-core
- audit-full-v43.mjs
- alias-drift-families.cjs
- dev-fullstack.sh
- hooks/package.json
- PART I: MILESTONE v2.3 ARCHITECTURAL BLUEPRINT
- 3. Heal
- "AlgoCeleris Campus: Multi-Tenant Institutional Assessment & Live Proctoring Portal"
- 6. The 11 Implementation Phases (Atomic Execution Plan)
- tasteskill: Anti-Slop Frontend Skill
- Appendix B - Canonical Sources (read these before reinventing)
- GatewayError
- Browser Automation with playwright-cli
- playwright-cli/SKILL.md
- IMPLEMENTATION_PLAN.md
- api.ts
- 2. Phase Summaries (Phases 19–24)
- test_auth_gateway.rs
- RubricEvaluationUpdate
- Running Custom Playwright Code
- 4. DESIGN ENGINEERING DIRECTIVES (Bias Correction)
- github-release-notes.cjs
- test_secret_masking.rs
- 10. REFERENCE VOCABULARY (Pattern Names the Agent Should Know)
- Video Recording
- Core Architecture Invariants
- PlagiarismDetector
- 2. Production 4-Phase Execution Roadmap (Phases 29–32)
- GEMINI.md
- 2. Phase-by-Phase Roadmap (Phases 25–28)
- `cli.cjs extract`
- 9. AI TELLS (Forbidden Patterns)
- Execution Workflow
- Advanced Mocking with run-code
- lint.cjs
- DbPool
- APPENDICES - Real Source-Backed Reference Material
- 11. REDESIGN PROTOCOL
- 3. DEFAULT ARCHITECTURE & CONVENTIONS
- 6. PERFORMANCE & ACCESSIBILITY GUARDRAILS
- "Rust Core & Rspack Migration — High-Throughput Kernel Sandboxing & Complete Backend Re-architecture"
- AssessmentStatus
- 12. THE BLOCK LIBRARY (Contract - Implementations Land Here Iteratively)
- 5. CONTEXT-AWARE PROACTIVITY
- 8. DARK MODE PROTOCOL
- Attaching Screenshots and Videos to Pull Requests
- Schema Migration Engine Protocol
- Strategic Context Compaction Protocol
- Eval-Driven Verification Protocol
- Web Interface Guidelines
- Systems Architect Specification
- Code Reviewer and Security Critic Prompt
- Quality & Acceptance Critic Protocol
- Implementation Worker Protocol
- Codebase Investigator Specification
- AST-Search-First Protocol
- Domain-Specific Validation Rules
- Event-Bus & Message Pipeline Guidelines
- Continuous Behavioral Learning Protocol
- 7. DIAL DEFINITIONS (Technical Reference)
- Cloud-Judge V2 Vision & Feature Requirements
- security-critic.md
- Attaching to a Running Browser
- StatusCode
- 1. Planning
- ErrorBoundary
- CampusRole
- deserialize
- MembershipStatus
- Track D: High-Performance Kernel Sandbox & Plagiarism Engine (Phases 6–8)

## God Nodes (most connected - your core abstractions)
1. `GatewayError` - 106 edges
2. `AppState` - 98 edges
3. `fetchWithFallback()` - 53 edges
4. `DbError` - 49 edges
5. `react` - 47 edges
6. `VivaError` - 40 edges
7. `lucide-react` - 36 edges
8. `create_router()` - 34 edges
9. `WorkerError` - 34 edges
10. `AssessmentRecord` - 29 edges

## Surprising Connections (you probably didn't know these)
- `5.1 Palette & Color Tokens` --references--> `CampusSidebarLayout()`  [INFERRED]
  REPORT_V4.3.md → packages/frontend/src/components/CampusSidebarLayout.tsx
- `6. Detailed Feature-by-Feature Scorecard (24 Modules)` --references--> `CampusSidebarLayout()`  [INFERRED]
  REPORT_V4.3.md → packages/frontend/src/components/CampusSidebarLayout.tsx
- `Phase 25: Routing Bug Fix, Apple Design Tokens & `/campus` Gallery Overhaul (+ Apple Store Configurator `/campus/register`)` --references--> `ScrollToTop()`  [INFERRED]
  IMPLEMENTATION_PLAN.md → packages/frontend/src/App.tsx
- `Phase 29: The Great Purge, `App.tsx` Repair, Consumer Polish & CSS Reset [COMPLETED]` --references--> `ScrollToTop()`  [INFERRED]
  IMPLEMENTATION_PLAN.md → packages/frontend/src/App.tsx
- `3.2 Workspace Mobile Hardening (`ProblemWorkspacePage.tsx` & `ResizableLayout.tsx`)` --references--> `ResizableLayout()`  [INFERRED]
  IMPLEMENTATION_PLAN.md → packages/frontend/src/components/ResizableLayout.tsx

## Import Cycles
- 2-file cycle: `crates/judge-worker/src/runner/engine.rs -> crates/judge-worker/src/runner/mod.rs -> crates/judge-worker/src/runner/engine.rs`

## Communities (161 total, 21 thin omitted)

### Community 1 - "CampusLabRoomPage.tsx"
Cohesion: 0.11
Nodes (22): CodeEditor(), CodeEditorProps, LINEAR_MIDNIGHT_THEME, LINEAR_MIDNIGHT_THEME_NAME, getInitialTheme(), Theme, ThemeContext, ThemeContextType (+14 more)

### Community 2 - "cli.cjs"
Cohesion: 0.11
Nodes (27): assembleChangelog(), cmdExtract(), cmdGithubReleaseNotes(), cmdRender(), cmdVerify(), {
  compareSemverCore,
  isStableTripletSemver,
}, { ExitError, runMain }, fs (+19 more)

### Community 3 - "judge-core/src/lib.rs"
Cohesion: 0.06
Nodes (18): calculate_late_penalty(), transition_assessment_state(), validate_assessment_timeline(), validate_rubric_balance(), DomainError, AssessmentClosed, CutoffExceeded, InvalidPenalty (+10 more)

### Community 4 - "ProblemWorkspacePage.tsx"
Cohesion: 0.06
Nodes (54): AIDebugModal(), AIDebugModalProps, DeveloperAnalyticsModal(), DeveloperAnalyticsModalProps, Header(), HeaderProps, MicroSandboxTeaser(), SNIPPETS (+46 more)

### Community 5 - "campusApi.ts"
Cohesion: 0.07
Nodes (48): Phase 3: Pure Domain Core (`judge-core`: Zero-I/O Domain Entities, Error Types & Invariants) [COMPLETED], calculateRiskScore(), FacultyProctorCockpitPage(), resolveRiskSeverity(), STARTER_CODES, StudentExamArenaPage(), calculateRubricWeightedTotal(), DEFAULT_VIVA_CRITERIA (+40 more)

### Community 6 - "components_heatmap.tsx"
Cohesion: 0.07
Nodes (47): barHeight(), BG_FALLBACK, buildGrid(), Cam, camera(), Cell, clamp01(), computeStats() (+39 more)

### Community 7 - "IsometricHeatmap.tsx"
Cohesion: 0.07
Nodes (47): barHeight(), BG_FALLBACK, buildGrid(), Cam, camera(), Cell, clamp01(), computeStats() (+39 more)

### Community 8 - "judge-core/src/lib.rs"
Cohesion: 0.17
Nodes (8): AssessmentSubmission, AssessmentSubmissionRecord, Cohort, CohortRecord, InterviewRoomRecord, Organization, OrganizationRecord, UserRecord

### Community 9 - "api.ts"
Cohesion: 0.17
Nodes (20): ContestLeaderboardModal(), ContestLeaderboardModalProps, buildFallbackContests(), ContestsPage(), derivePhase(), fallbackLeaderboard(), formatCountdown(), mkProblems() (+12 more)

### Community 10 - "gen-capability-registry.cjs"
Cohesion: 0.08
Nodes (34): buildRegistry(), CAPABILITIES_DIR, capValidator, ADR-0894, CLUSTERS(), CLUSTERS_PATH, CONFIG_SCHEMA_PATH, deriveCapabilityClusters() (+26 more)

### Community 11 - "verify-local-runtime.mjs"
Cohesion: 0.07
Nodes (24): { basename }, MARKED_SUITES, playwright, __dirname, __filename, ROOT_DIR, SNAPSHOT_DIR, backendPool (+16 more)

### Community 12 - "frontend/package.json"
Cohesion: 0.06
Nodes (32): dependencies, lucide-react, monaco-editor, @monaco-editor/react, react, react-dom, react-router-dom, recharts (+24 more)

### Community 14 - "DbError"
Cohesion: 0.15
Nodes (18): DbError, Domain, ForeignKeyViolation, NotFound, PoolError, SerializationError, Sqlx, UniqueViolation (+10 more)

### Community 15 - "gen-loop-host-contract.cjs"
Cohesion: 0.08
Nodes (29): assertPointsCoverage(), buildContract(), CANONICAL_POINTS, ADR-0894, CONTRACT_PATH, coveredKindsInRegion(), crossCheckRoleFamilies(), crossCheckRoles() (+21 more)

### Community 16 - "test_cockpit_apis.rs"
Cohesion: 0.10
Nodes (16): create_router(), test_auth_http_login_refresh_logout_flow(), test_health_endpoints(), test_signup_and_registration_flow(), generate_test_token(), setup_test_assessment(), test_live_postgres_cockpit_and_viva_if_available(), test_private_rubric_endpoint_permits_instructor_and_rejects_candidates() (+8 more)

### Community 17 - "VivaClusterMessage"
Cohesion: 0.10
Nodes (10): decode(), format_viva_channel(), TABLE, VivaClusterMessage, Awareness, CrdtUpdate, RubricUpdate, VivaRedisRelay (+2 more)

### Community 18 - "judge-core/src/models.rs"
Cohesion: 0.22
Nodes (14): Assessment, AssessmentMode, Exam, Homework, Viva, AssessmentSubmission, Cohort, Language (+6 more)

### Community 19 - "judge-db/src/models.rs"
Cohesion: 0.19
Nodes (18): ChallengingProblemSpec, HackathonEntity, HackathonMatchmakerItem, HackathonMilestoneItem, HackathonRegistrationItem, HackathonShowcaseItem, HackathonStore, HackathonTeamItem (+10 more)

### Community 20 - "auth.rs"
Cohesion: 0.19
Nodes (17): encode_access_token(), AvailabilityQuery, AvailabilityResponse, check_availability_handler(), clear_refresh_cookie(), DbUser, extract_refresh_token(), format_refresh_cookie() (+9 more)

### Community 21 - "routes/submission.rs"
Cohesion: 0.16
Nodes (16): role_level(), determine_stream_role(), get_submission_handler(), GetSubmissionResponse, handle_submission_socket(), mask_test_case_json(), mask_test_case_results(), SECRET_TEST_MASK (+8 more)

### Community 22 - "WorkerError"
Cohesion: 0.09
Nodes (15): WorkerError, CgroupError, Domain, Io, NamespaceError, ParseError, PermissionDenied, SyscallError (+7 more)

### Community 23 - "test_secret_masking.rs"
Cohesion: 0.08
Nodes (5): main(), shutdown_signal(), test_campus_phase31_complete_lifecycle(), test_campus_phase32_lab_engine_and_dynamic_analytics(), test_hackathons_catalog_and_dynamic_lifecycle()

### Community 24 - "Linear — Style Reference"
Cohesion: 0.05
Nodes (37): Agent Prompt Guide, Badge / Status Tag, Berkeley Mono — Code-adjacent UI text — issue IDs (ENG-2703), keyboard shortcuts, monospaced metadata · `--font-berkeley-mono`, Border Radius, Card (Product Screenshot Frame), Card (Subtle), Components, CSS Custom Properties (+29 more)

### Community 25 - "test_viva_isolation.rs"
Cohesion: 0.13
Nodes (4): setup_viva_server(), test_candidate_rubric_masking_invariant(), test_evaluator_frame_delivery(), viva_ws_endpoint()

### Community 27 - "ast.rs"
Cohesion: 0.15
Nodes (12): AstTokenizer, is_comment(), is_identifier(), is_literal(), StructuralToken, walk_ast(), compute_kgram_hashes(), Fingerprint (+4 more)

### Community 28 - "hackathons.rs"
Cohesion: 0.17
Nodes (15): create_or_join_team_handler(), get_hackathon_detail_handler(), HackathonDetailResponse, HackathonRegisterRequest, HackathonRegisterResponse, HackathonSubmissionRequest, HackathonSubmissionResponse, HackathonSummary (+7 more)

### Community 29 - "SubmissionRecord"
Cohesion: 0.20
Nodes (10): Submission, SubmissionRecord, create_submission(), finalize_assessment_submission(), get_assessment_submission(), get_submission_by_id(), SubmissionRepository, SubmissionRepository<'a> (+2 more)

### Community 30 - "AppState"
Cohesion: 0.06
Nodes (87): OrgMembershipRecord, AccessTokenClaims, AuthenticatedUser, OptionalUser, RequireInstructor, RequireOrgAdmin, RequireStudent, resolve_target_assessment_id() (+79 more)

### Community 31 - "VivaRoom"
Cohesion: 0.12
Nodes (5): AWARENESS_BROADCAST_CAPACITY, CRDT_BROADCAST_CAPACITY, RUBRIC_BROADCAST_CAPACITY, VivaRoom, VivaRoomManager

### Community 32 - "test-phase12-exam-arena.mjs"
Cohesion: 0.08
Nodes (21): appTsxPath, appTsxSrc, arenaPagePath, arenaSrc, baseTime, campusApiPath, campusApiSrc, cutoffTime (+13 more)

### Community 33 - "TelemetryEvent"
Cohesion: 0.18
Nodes (14): RiskScore, RiskSeverity, Critical, Elevated, Low, calculate_risk_score(), CandidateProctorState, ProctorAlertFrame (+6 more)

### Community 34 - "Cloud-Judge V2 (AlgoCeleris) — Milestone v4.3 Comprehensive Audit Report"
Cohesion: 0.11
Nodes (18): 1. Executive Audit Summary, 2.1 Missing React Hook Imports in `CampusLabsListPage.tsx`, 2.2 Role Switcher Route Desynchronization in `CampusSidebarLayout.tsx`, 2.3 Campus Organization Directory Seeding in `judge-gateway`, 2.4 Playwright Leaderboard View Assertion, 2. Critical Bugs & Runtime Exceptions (Blockers Resolved), 3. Incomplete or Broken Interactive Features, 4. Data Integrity & Mock String Leaks (+10 more)

### Community 35 - "AuthContext.tsx"
Cohesion: 0.31
Nodes (12): AuthContext, AuthContextType, AuthProvider(), restoreSession(), GUEST_USER, mapAuthUser(), authLogin(), authLogout() (+4 more)

### Community 36 - "Local Storage"
Cohesion: 0.06
Nodes (35): Advanced: Multiple Cookies or Custom Options, Advanced: Multiple Operations, Authentication State Reuse, Clear All Cookies, Clear All localStorage, Clear sessionStorage, Common Patterns, Cookies (+27 more)

### Community 37 - "judge-viva/src/ws.rs"
Cohesion: 0.21
Nodes (3): handle_telemetry_socket(), CLIENT_OUTBOUND_QUEUE_CAPACITY, handle_viva_socket()

### Community 39 - "ProfilePage.tsx"
Cohesion: 0.12
Nodes (28): PROBLEMS, useAuth(), AuthPage(), AuthPageProps, ProblemsPage(), SortField, SortOrder, DIFF_COLORS (+20 more)

### Community 41 - "cli-exit.cjs"
Cohesion: 0.11
Nodes (23): ADR-3889, CONTRACT_VERSION_KEY, exitCodeFor(), exitCodeRegistryModule, findExitContractFlag(), getContractVersion(), getJsonErrorMode(), getPendingOutcome() (+15 more)

### Community 42 - "engine.rs"
Cohesion: 0.13
Nodes (6): DEFAULT_MEMORY_LIMIT_BYTES, DEFAULT_OUTPUT_LIMIT_BYTES, DEFAULT_TIME_LIMIT, ExecutionEngine, ExecutionResult, read_bounded_stream()

### Community 43 - "test-phase11-faculty-scheduler.mjs"
Cohesion: 0.10
Nodes (18): appTsxPath, appTsxSrc, calendarPagePath, calendarPageSrc, campusApiPath, campusApiSrc, createPagePath, createPageSrc (+10 more)

### Community 44 - "Test generation (plan → generate → heal)"
Cohesion: 0.17
Nodes (12): 0. How generation works, 2.1 Inputs, 2.2 Generate one scenario, 2.3 Generate multiple scenarios, 2.4 Run generated tests, 2. Generate, Add assertions manually, Building a test file (+4 more)

### Community 45 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 47 - "subscriptions.rs"
Cohesion: 0.24
Nodes (14): ai_debug_handler(), AIDebugRequest, AIDebugResponse, create_razorpay_order_handler(), create_stripe_checkout_handler(), EntitlementsResponse, get_entitlements_handler(), RazorpayOrderRequest (+6 more)

### Community 48 - "RubricEvaluationUpdate"
Cohesion: 0.11
Nodes (16): AwarenessEnvelope, VivaError, CrdtSyncError, DatabaseError, Domain, InvalidRubricEvaluation, Json, ProtocolError (+8 more)

### Community 49 - "contests.rs"
Cohesion: 0.27
Nodes (11): build_mock_leaderboard(), contest_leaderboard_ws_handler(), ContestProblemSummary, ContestSummary, get_contest_handler(), get_contest_leaderboard_handler(), get_global_leaderboard_handler(), handle_leaderboard_socket() (+3 more)

### Community 50 - "test-phase14-viva-workspace.mjs"
Cohesion: 0.12
Nodes (13): appTsxPath, appTsxSrc, campusApiPath, campusApiSrc, criteria, indexCssPath, indexCssSrc, parsedAwareness (+5 more)

### Community 51 - "fix-slash-commands.cjs"
Cohesion: 0.18
Nodes (14): buildColonPattern(), buildPattern(), COMMANDS_DIR, EXTENSIONS, fs, isTestFile(), path, processDir() (+6 more)

### Community 52 - "shellcheck-fetch.cjs"
Cohesion: 0.14
Nodes (12): ARCH_MAP, CACHE_DIR, CACHED_BIN_PATH, { ExitError }, extractFileFromTar(), fs, https, httpsGetFollowingRedirects() (+4 more)

### Community 53 - "test_assessment_lifecycle.rs"
Cohesion: 0.27
Nodes (10): generate_test_token(), setup_test_hierarchy(), test_chronological_timeline_validation_rejects_malformed_dates(), test_faculty_force_submit_and_status_transition(), test_grace_period_submission_calculates_ceiling_hour_late_penalty(), test_live_postgres_assessment_lifecycle_if_available(), test_on_time_submission_accepts_with_zero_deduction(), test_post_cutoff_submission_strictly_rejected_with_403() (+2 more)

### Community 55 - "App.tsx"
Cohesion: 0.09
Nodes (45): App(), ErrorBoundaryProps, ErrorBoundaryState, ScrollToTop(), CampusSidebarLayout(), loadOrgs(), LinearHeaderNav(), User (+37 more)

### Community 56 - "NewMember"
Cohesion: 0.25
Nodes (7): NewMember, batch_insert_memberships(), build_batch_insert_query(), list_cohort_memberships(), MembershipRepository, MembershipRepository<'a>, test_benchmark_batch_roster_query_construction_5000()

### Community 57 - "ProctorEventRecord"
Cohesion: 0.30
Nodes (8): ProctorEventCounts, ProctorEventRecord, get_candidate_event_counts(), list_assessment_events(), ProctorRepository, ProctorRepository<'a>, record_proctor_event(), test_proctor_event_repository_flow()

### Community 58 - "users.rs"
Cohesion: 0.26
Nodes (11): ContestRatingPoint, DailyContributionPoint, DifficultyBreakdown, DifficultyStats, get_user_profile_handler(), GuestSubmissionItem, migrate_guest_submissions_handler(), MigrateGuestSubmissionsRequest (+3 more)

### Community 59 - "AwarenessEnvelope"
Cohesion: 0.23
Nodes (6): AwarenessMessage, CursorMove, PeerLeave, PresenceUpdate, CursorPosition, PeerPresence

### Community 60 - "src/theme.ts"
Cohesion: 0.13
Nodes (14): ACID_LIME, AMBER, BEDROCK_VOID, CARBON, CORAL_RED, Difficulty, DIFFICULTY_COLORS, GRAPHITE_BORDER (+6 more)

### Community 61 - "test-phase17-haproxy-cutover.mjs"
Cohesion: 0.12
Nodes (13): { execSync }, { execSync }, cfgContent, createMockServer(), HAPROXY_CFG, HAPROXY_PID, makeHttpRequest(), makeWebSocketUpgrade() (+5 more)

### Community 62 - "drift-scan.cjs"
Cohesion: 0.18
Nodes (9): fs, isInsideRoot(), isUnderSkippedDir(), path, regexScanStats, scanTree(), SKIP_DIR_NAMES, walk() (+1 more)

### Community 63 - "TestConsole.tsx"
Cohesion: 0.23
Nodes (12): diffTokens(), DiffViewer(), DiffViewerProps, IsometricCubeLoader(), IsometricCubeLoaderProps, isWatchdogError(), TestConsole(), TestConsoleProps (+4 more)

### Community 64 - "test-phase13-proctor-cockpit.mjs"
Cohesion: 0.15
Nodes (12): applyTelemetryEvent(), appTsxPath, appTsxSrc, calculateRiskScore(), campusApiPath, campusApiSrc, cockpitPagePath, cockpitSrc (+4 more)

### Community 65 - "new.cjs"
Cohesion: 0.21
Nodes (12): ADJECTIVES, ALLOWED_TYPES, { ExitError, runMain }, fs, generateFragmentName(), main(), NOUNS_A, NOUNS_B (+4 more)

### Community 66 - "TelemetryRelay"
Cohesion: 0.14
Nodes (4): TelemetryMesh, format_telemetry_channel(), TelemetryRelay, .LOCAL_BROADCAST_CAPACITY

### Community 67 - "SeccompAction"
Cohesion: 0.18
Nodes (7): SeccompAction, Allow, Errno, KillProcess, KillThread, Trap, SyscallPolicy

### Community 68 - "Browser Session Management"
Cohesion: 0.13
Nodes (15): 1. Name Browser Sessions Semantically, 2. Always Clean Up, 3. Delete Stale Browser Data, A/B Testing Sessions, Best Practices, Browser Session Commands, Browser Session Configuration, Browser Session Isolation Properties (+7 more)

### Community 69 - "Verdict"
Cohesion: 0.25
Nodes (8): Verdict, Accepted, CompilationError, MemoryLimitExceeded, Pending, RuntimeError, TimeLimitExceeded, WrongAnswer

### Community 70 - "test-phase3-mobile-hardening.mjs"
Cohesion: 0.17
Nodes (11): cssContent, cssPath, editorContent, editorPath, layoutContent, navContent, navPath, resizableLayoutPath (+3 more)

### Community 71 - "Tracing"
Cohesion: 0.12
Nodes (16): 1. Start Tracing Before the Problem, 2. Clean Up Old Traces, Analyzing Performance, Basic Usage, Best Practices, Capturing Evidence, Debugging Failed Actions, Limitations (+8 more)

### Community 72 - "TokenBucket"
Cohesion: 0.24
Nodes (3): DEFAULT_BURST_CAPACITY, DEFAULT_REFILL_RATE, TokenBucket

### Community 74 - "ref_assert"
Cohesion: 0.29
Nodes (5): consoleErrors, http500Errors, pageErrors, rootDir, snapshotDir

### Community 75 - "4. 18 Micro-Phases Across 7 Tracks"
Cohesion: 0.10
Nodes (21): 4. 18 Micro-Phases Across 7 Tracks, Phase 10: Multiplayer Viva Engine & Yrs CRDT Synchronization (`judge-viva`) [COMPLETED], Phase 11: Real-Time Dual-Gateway Distribution & Strict Rubric Privacy Isolation [COMPLETED], Phase 12: Axum Gateway HTTP Server, Tower Middleware & Dual-Token Auth (`judge-gateway`) [COMPLETED], Phase 13: Multi-Tenant RBAC Extractors & Organization Hierarchy (`judge-gateway`) [COMPLETED], Phase 14: Assessment Lifecycle Management & Deadline Gatekeeper APIs (`judge-gateway`) [COMPLETED], Phase 15: Secret Test Suite Evaluation & Masking Gateway Layer [COMPLETED], Phase 16: Faculty Cockpit & Viva Escalation Management Endpoints [COMPLETED] (+13 more)

### Community 76 - "ref_fs"
Cohesion: 0.22
Nodes (6): fs, payload, prohibitedPatterns, command, fs, input

### Community 77 - "TelemetryError"
Cohesion: 0.18
Nodes (8): TelemetryError, ChannelClosed, ConnectionError, IdentityMismatch, Json, RateLimitExceeded, Redis, SerializationError

### Community 78 - "CommandConfig"
Cohesion: 0.09
Nodes (9): CppRunner, JavaRunner, CommandConfig, PythonRunner, DEFAULT_CGROUP_ROOT, DEFAULT_CPU_MAX_QUOTA, DEFAULT_MEMORY_HIGH_BYTES, DEFAULT_MEMORY_MAX_BYTES (+1 more)

### Community 79 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 80 - "test-phase1-relative-endpoints.mjs"
Cohesion: 0.25
Nodes (7): apiContent, apiPath, navContent, navPath, rootDir, viteConfigPath, viteContent

### Community 81 - "cockpit.rs"
Cohesion: 0.21
Nodes (14): CandidateCockpitSummary, get_proctor_cockpit_handler(), get_viva_rubric_handler(), handle_proctor_socket(), handle_viva_socket(), proctor_stream_handler(), ProctorCockpitResponse, provision_viva_escalation_handler() (+6 more)

### Community 82 - "ref_assert"
Cohesion: 0.13
Nodes (9): RFC-7807, cssContent, indexCssPath, lightMutedHex, lightThemeMatch, rootDir, consoleErrors, pageErrors (+1 more)

### Community 83 - "judge-core"
Cohesion: 0.67
Nodes (6): judge-core, judge-db, judge-gateway, judge-telemetry, judge-viva, judge-worker

### Community 84 - "audit-full-v43.mjs"
Cohesion: 0.38
Nodes (5): assertRootNotEmpty(), rootDir, scanDomStrings(), scanDomStyles(), stats

### Community 94 - "PART I: MILESTONE v2.3 ARCHITECTURAL BLUEPRINT"
Cohesion: 0.10
Nodes (21): 1.1 Problem Audit & Root Cause Analysis, 1.2 Architectural Specification, 1.3 Acceptance Criteria & Verification, 2.1 Concentric Border-Radii Audit & Mathematical Enforcement, 2.2 Tabular Figures & Numerical Stability (`font-variant-numeric: tabular-nums`), 2.3 Optical Alignment, Icon-Text Pairings & Contrast Audit, 3.1 Responsive Breakpoints & Viewport Architecture, 3.2 Workspace Mobile Hardening (`ProblemWorkspacePage.tsx` & `ResizableLayout.tsx`) (+13 more)

### Community 95 - "3. Heal"
Cohesion: 0.33
Nodes (6): 3.1 Find failing tests, 3.2 Debug one failure, 3.3 Apply the fix, 3.4 Reconcile with the spec, 3.5 Iteration and giving up, 3. Heal

### Community 96 - ""AlgoCeleris Campus: Multi-Tenant Institutional Assessment & Live Proctoring Portal""
Cohesion: 0.17
Nodes (12): 1. Executive Architectural Scope & Domain Model, 2. Multi-Tenant Relational Schema (PostgreSQL 16 & Alembic `0002_campus_portal.py`), 3. Gateway Multi-Tenant RBAC Architecture, 4.1 State Machine Lifecycle, 4.2 Automated Late Penalty Formulation, 4.3 Secret Test Cases & Masking Policy, 4. Assessment Engine State Machine & Deadline Gatekeepers, 5.1 Proctoring Telemetry WebSocket (`/ws/campus/assessments/{id}/proctor`) (+4 more)

### Community 97 - "6. The 11 Implementation Phases (Atomic Execution Plan)"
Cohesion: 0.17
Nodes (12): 6. The 11 Implementation Phases (Atomic Execution Plan), Phase 10: Multiplayer Viva & Collaborative Interview Engine (Yjs CRDT & Live Cursors) [COMPLETED], Phase 11: Faculty Assessment Scheduler, Interactive Calendar & Rubric Builder UI: [COMPLETED], Phase 12: Student Exam Arena, Fullscreen Proctoring Lock & Auto-Submit Watchdog UI: [COMPLETED], Phase 13: Faculty Live Proctoring Cockpit & Real-Time Integrity Dashboard UI: [COMPLETED], Phase 14: 3-Pane Viva Interview Workspace & Private Instructor Rubric Drawer UI: [COMPLETED], Phase 15: Multi-Role End-to-End Playwright Verification Suite & Chaos Load Test [COMPLETED], Phase 5: Multi-Tenant Campus Relational Schema & Alembic Migrations [COMPLETED] (+4 more)

### Community 98 - "tasteskill: Anti-Slop Frontend Skill"
Cohesion: 0.13
Nodes (15): 0.A Read these signals first, 0.B Output a one-line "Design Read" before generating, 0. BRIEF INFERENCE (Read the Room Before Anything Else), 0.C If the brief is ambiguous, ask one question, do not guess, 0.D Anti-Default Discipline, 13. OUT OF SCOPE, 14. FINAL PRE-FLIGHT CHECK, 1.A Dial Inference (design read → dial values) (+7 more)

### Community 99 - "Appendix B - Canonical Sources (read these before reinventing)"
Cohesion: 0.13
Nodes (15): Appendix B - Canonical Sources (read these before reinventing), Apple Liquid Glass (Apple platforms only), Atlassian, Bootstrap, Carbon, Fluent UI, GOV.UK, Material Web (+7 more)

### Community 100 - "GatewayError"
Cohesion: 0.12
Nodes (15): TokenStore, GatewayError, BadRequest, Conflict, Database, Domain, Forbidden, InternalError (+7 more)

### Community 101 - "Browser Automation with playwright-cli"
Cohesion: 0.07
Nodes (27): Attaching screenshots and videos to pull requests, Browser Automation with playwright-cli, Browser Sessions, Commands, Core, DevTools, Emulation, Example: Debugging with DevTools (+19 more)

### Community 102 - "playwright-cli/SKILL.md"
Cohesion: 0.21
Nodes (4): Examples, Inspecting Element Attributes, Debugging Playwright Tests, Running Playwright Tests

### Community 103 - "IMPLEMENTATION_PLAN.md"
Cohesion: 0.25
Nodes (7): 1. Executive Roadmap & Milestone Matrix, 1. Visual Invariants: Unified Refero Linear Midnight (`docs/DESIGN.md`), 3. Milestone v4.3 Verification & Acceptance Criteria Matrix, PART II: MILESTONE v3.0 ARCHITECTURAL BLUEPRINT, PART VI: MILESTONE v4.3 ARCHITECTURAL BLUEPRINT (Phases 29–32), Technical Architecture Blueprint: Cloud-Judge V2 Roadmap & Execution Plan, "Unified Refero Linear Midnight Design System (`docs/DESIGN.md`), Real Rust-Backed Multi-Tenant Campus Portal & Full-Stack Hackathon Platform"

### Community 104 - "api.ts"
Cohesion: 0.04
Nodes (67): HackathonDetailPage(), HackathonsPage(), loadData(), ActivityCategoryItem, ActivityPoint, aiDebug(), AiHintCategoryItem, AiSessionTrendItem (+59 more)

### Community 105 - "2. Phase Summaries (Phases 19–24)"
Cohesion: 0.18
Nodes (11): 1. Executive Intent & Invariants, 2. Phase Summaries (Phases 19–24), 3. Milestone v4.1 Verification & Acceptance Criteria Matrix, "Isolated Multi-Tenant Campus Portal (LPilot Architecture), 3-Tier Institutional Hierarchy & Full-Stack Hackathon Platform", PART IV: MILESTONE v4.1 ARCHITECTURAL BLUEPRINT, Phase 19: Consumer Navbar Decoupling, Institutional Landing & Tenant Onboarding Wizard, Phase 20: Split-Screen Co-Branded Login & Strict 3-Tier Role Sidebar Layout, Phase 21: LPilot Student Dashboard, Active/Completed Lab Lists & 8-Tab Read-Only Review (+3 more)

### Community 106 - "test_auth_gateway.rs"
Cohesion: 0.09
Nodes (14): hash_password(), verify_password(), ACCESS_TOKEN_EXPIRATION_SECONDS, decode_access_token(), decode_refresh_token(), DEFAULT_JWT_SECRET, encode_refresh_token(), REFRESH_TOKEN_EXPIRATION_SECONDS (+6 more)

### Community 107 - "RubricEvaluationUpdate"
Cohesion: 0.18
Nodes (8): RubricEvaluationUpdate, VivaWsClientMessage, Awareness, RubricEvaluation, VivaWsServerMessage, Awareness, Error, RubricEvaluation

### Community 108 - "Running Custom Playwright Code"
Cohesion: 0.15
Nodes (13): Clipboard, Complex Workflows, Error Handling, File Downloads, Frames and Iframes, Geolocation, JavaScript Execution, Media Emulation (+5 more)

### Community 109 - "4. DESIGN ENGINEERING DIRECTIVES (Bias Correction)"
Cohesion: 0.17
Nodes (12): 4.10 Quotes & Testimonials, 4.11 Page Theme Lock (Light / Dark Mode Consistency), 4.1 Typography, 4.2 Color Calibration, 4.3 Layout Diversification, 4.4 Materiality, Shadows, Cards, 4.5 Interactive UI States, 4.6 Data & Form Patterns (+4 more)

### Community 111 - "github-release-notes.cjs"
Cohesion: 0.16
Nodes (17): buildGithubReleaseNotesIr(), changedFragmentPaths(), classifyGroup(), compareUrl(), cp, FIXED_GROUPS, formatBullet(), loadFragmentsFromRange() (+9 more)

### Community 112 - "test_secret_masking.rs"
Cohesion: 0.15
Nodes (8): generate_test_token(), test_admin_query_receives_unmasked_details(), test_candidate_query_masks_secret_test_cases(), test_instructor_query_receives_unmasked_details(), test_live_redis_intake_queue_and_pubsub_masking(), test_submission_intake_creates_pending_record_and_pushes_queue(), test_submission_intake_validations(), test_websocket_stream_payload_serialization_masks_for_students()

### Community 113 - "10. REFERENCE VOCABULARY (Pattern Names the Agent Should Know)"
Cohesion: 0.20
Nodes (10): 10. REFERENCE VOCABULARY (Pattern Names the Agent Should Know), Animation Library Choice, Cards & Containers, Galleries & Media, Hero Paradigms, Layout & Grids, Micro-Interactions & Effects, Navigation & Menus (+2 more)

### Community 114 - "Video Recording"
Cohesion: 0.20
Nodes (10): 1. Use Descriptive Filenames, 2. Record entire hero scripts., 3. Attach the recording to the pull request, Basic Recording, Best Practices, Cursor, Target Highlight and Click Point, Limitations, Overlay API Summary (+2 more)

### Community 115 - "Core Architecture Invariants"
Cohesion: 0.22
Nodes (8): 1. System Topology & Ingress, 2. Worker Engine & Sandbox Isolation, 3. Data Persistence & Caching, 4. Authentication, Security & RBAC, 5. Anti-Abuse & Rate Limiting, 6. Frontend & Design Token Constraints, 7. Out of Scope (Hard Constraints), Core Architecture Invariants

### Community 116 - "PlagiarismDetector"
Cohesion: 0.28
Nodes (3): MatchedRange, PlagiarismDetector, PlagiarismReport

### Community 117 - "2. Production 4-Phase Execution Roadmap (Phases 29–32)"
Cohesion: 0.22
Nodes (8): 1. Visual Invariants: Unified Refero Linear Midnight (`docs/DESIGN.md`), 2. Production 4-Phase Execution Roadmap (Phases 29–32), Phase 29: The Great Purge, `App.tsx` Repair, Consumer Polish & CSS Reset [COMPLETED], Phase 30: Production Linear-Native Hackathon Platform (`/hackathons`, `/hackathons/:slug` & Rust Backend Persistence), Phase 31: Production Multi-Tenant Campus Portal — Real Org Provisioning, Auth & Role-Gated Linear Shell (`/campus/*`), Phase 32: Real Telemetry-Driven Campus Analytics, 6-Stage Lab Execution Engine & E2E Playwright Verification, Technical Architecture Blueprint: Milestone v4.3 — Clean-Slate Linear Reset, "Unified Refero Linear Midnight Design System (`docs/DESIGN.md`), Real Rust-Backed Multi-Tenant Campus Portal & Full-Stack Hackathon Platform"

### Community 118 - "GEMINI.md"
Cohesion: 0.22
Nodes (8): Architecture, Constraints, Conventions, Developer Profile, GSD Workflow Enforcement, Project, Project Skills, Technology Stack

### Community 119 - "2. Phase-by-Phase Roadmap (Phases 25–28)"
Cohesion: 0.22
Nodes (9): 1. Architectural Mandate & Anti-Slop Discipline, 2. Phase-by-Phase Roadmap (Phases 25–28), 3. Milestone v4.2 Verification & Acceptance Criteria Matrix, "Apple Design System Overhaul (`docs/DESIGN-apple.md`), Zero-Slop Visual Engineering & Functional Portal Parity", PART V: MILESTONE v4.2 ARCHITECTURAL BLUEPRINT (Phases 25–28) [SUPERSEDED BY v4.3], Phase 25: Routing Bug Fix, Apple Design Tokens & `/campus` Gallery Overhaul (+ Apple Store Configurator `/campus/register`), Phase 26: Apple-Grade Institutional Login, Sidebar Shell & Complete Admin/Faculty Dashboards (Zero Placeholders), Phase 27: Apple-Grade Student Dashboard, 6-Stage Lab Workspace, Read-Only Review & 4-Tab Analytics (+1 more)

### Community 120 - "`cli.cjs extract`"
Cohesion: 0.22
Nodes (7): changeset/ — release-notes tooling, `cli.cjs extract`, Examples, Exit codes, Flags, Output shape, Version validation

### Community 121 - "9. AI TELLS (Forbidden Patterns)"
Cohesion: 0.25
Nodes (8): 9.A Visual & CSS, 9. AI TELLS (Forbidden Patterns), 9.B Typography, 9.C Layout & Spacing, 9.D Content & Data ("Jane Doe" Effect), 9.E External Resources & Components, 9.F Production-Test Tells (banned outright), 9.G EM-DASH BAN (the single most-violated Tell)

### Community 122 - "Execution Workflow"
Cohesion: 0.25
Nodes (7): Execution Workflow, Image-to-Code Engineering Protocol, Objective, Step 1: Visual Deconstruction (Do Not Write Code Yet), Step 2: Design Token & Library Mapping, Step 3: High-Fidelity Implementation, Step 4: Visual Self-Audit Checklist

### Community 123 - "Advanced Mocking with run-code"
Cohesion: 0.22
Nodes (8): Advanced Mocking with run-code, CLI Route Commands, Conditional Response Based on Request, Delayed Response, Modify Real Response, Request Mocking, Simulate Network Failures, URL Patterns

### Community 124 - "lint.cjs"
Cohesion: 0.18
Nodes (14): evaluateLint(), { ExitError, runMain }, findPrFieldDrift(), isFragment(), isUserFacing(), LINT_REASON, main(), { parseFragment } (+6 more)

### Community 125 - "DbPool"
Cohesion: 0.18
Nodes (3): check_health(), create_connection_pool(), DbPool

### Community 126 - "APPENDICES - Real Source-Backed Reference Material"
Cohesion: 0.29
Nodes (6): APPENDICES - Real Source-Backed Reference Material, Appendix A - Install Commands per Design System, Appendix C - Apple Liquid Glass: Honest Web Approximation, Safer web approximation skeleton, What is NOT official, What is official

### Community 127 - "11. REDESIGN PROTOCOL"
Cohesion: 0.29
Nodes (7): 11.A Detect the Mode (first action), 11.B Audit Before Touching, 11.C Preservation Rules, 11.D Modernisation Levers (priority order), 11.E Decision Tree: Targeted Evolution vs Full Redesign, 11.F What Never Changes Silently, 11. REDESIGN PROTOCOL

### Community 128 - "3. DEFAULT ARCHITECTURE & CONVENTIONS"
Cohesion: 0.29
Nodes (7): 3.A Stack, 3.B State, 3.C Icons, 3.D Emoji Policy, 3. DEFAULT ARCHITECTURE & CONVENTIONS, 3.E Responsiveness & Layout Mechanics, 3.F Dependency Verification (mandatory)

### Community 129 - "6. PERFORMANCE & ACCESSIBILITY GUARDRAILS"
Cohesion: 0.29
Nodes (7): 6.A Hardware Acceleration, 6.B Reduced Motion (mandatory), 6.C Dark Mode (mandatory for any consumer-facing page), 6.D Core Web Vitals Targets, 6.E DOM Cost, 6.F Z-Index Restraint, 6. PERFORMANCE & ACCESSIBILITY GUARDRAILS

### Community 130 - ""Rust Core & Rspack Migration — High-Throughput Kernel Sandboxing & Complete Backend Re-architecture""
Cohesion: 0.22
Nodes (9): 1. Executive Architectural Scope & High-Throughput Topology, 2. Crate Boundaries & Cargo Workspace Architecture, 3. Compiler Invariants & Hardware Constraints, 5. Milestone v4.0 Acceptance Criteria Summary Table, Acceptance Criteria for Milestone v2.3 Execution, Detailed Crate Responsibilities & Invariants, PART III: MILESTONE v4.0 ARCHITECTURAL BLUEPRINT, Performance Objectives & Architectural Motivations (+1 more)

### Community 131 - "AssessmentStatus"
Cohesion: 0.33
Nodes (6): AssessmentStatus, Active, Closed, Draft, GracePeriod, Scheduled

### Community 132 - "12. THE BLOCK LIBRARY (Contract - Implementations Land Here Iteratively)"
Cohesion: 0.40
Nodes (5): 12.A File Location, 12.B Required Frontmatter, 12.C Required Body Sections, 12.D Block-Library Discipline, 12. THE BLOCK LIBRARY (Contract - Implementations Land Here Iteratively)

### Community 133 - "5. CONTEXT-AWARE PROACTIVITY"
Cohesion: 0.40
Nodes (5): 5.A Sticky-Stack - Canonical Skeleton, 5.B Horizontal-Pan - Canonical Skeleton, 5.C Scroll-Reveal Stagger - Canonical Skeleton (lighter alternative), 5. CONTEXT-AWARE PROACTIVITY, 5.D Forbidden Animation Patterns

### Community 134 - "8. DARK MODE PROTOCOL"
Cohesion: 0.40
Nodes (5): 8.A Token Strategy (pick one, stick to it), 8.B Do Not Prescribe Specific Colors Here, 8.C Default Mode, 8.D Test in Both Modes Before Finishing, 8. DARK MODE PROTOCOL

### Community 135 - "Attaching Screenshots and Videos to Pull Requests"
Cohesion: 0.40
Nodes (5): Attaching Screenshots and Videos to Pull Requests, From a local session, From CI, Limits, When to attach

### Community 136 - "Schema Migration Engine Protocol"
Cohesion: 0.40
Nodes (4): Container Verification Pipeline, Objective, Safety & Compatibility Invariants, Schema Migration Engine Protocol

### Community 137 - "Strategic Context Compaction Protocol"
Cohesion: 0.40
Nodes (4): Boundary Decision Guidelines, Compaction Checklist, Operational Mandate, Strategic Context Compaction Protocol

### Community 138 - "Eval-Driven Verification Protocol"
Cohesion: 0.40
Nodes (4): Eval-Driven Verification Protocol, Phase 1: Test-First Regression Capture, Phase 2: Implementation & Green Verification, Phase 3: Project-Wide Sanity Check

### Community 139 - "Web Interface Guidelines"
Cohesion: 0.40
Nodes (4): Guidelines Source, How It Works, Usage, Web Interface Guidelines

### Community 140 - "Systems Architect Specification"
Cohesion: 0.50
Nodes (3): Blueprint Output Requirements, Operational Boundaries, Systems Architect Specification

### Community 141 - "Code Reviewer and Security Critic Prompt"
Cohesion: 0.50
Nodes (3): Code Reviewer and Security Critic Prompt, Review Scope, Tone and Format

### Community 142 - "Quality & Acceptance Critic Protocol"
Cohesion: 0.50
Nodes (3): Quality & Acceptance Critic Protocol, Review Criteria, Verdict Output Format

### Community 143 - "Implementation Worker Protocol"
Cohesion: 0.50
Nodes (3): Delivery Checklist, Implementation Worker Protocol, Operational Mandates

### Community 144 - "Codebase Investigator Specification"
Cohesion: 0.50
Nodes (3): Codebase Investigator Specification, Operational Boundaries, Protocol

### Community 145 - "AST-Search-First Protocol"
Cohesion: 0.50
Nodes (3): AST-Search-First Protocol, Execution Rules, Operational Mandate

### Community 146 - "Domain-Specific Validation Rules"
Cohesion: 0.50
Nodes (3): Domain-Specific Validation Rules, Frontend UI Mutexes (`packages/frontend/src/`), Gateway & Backend Mutexes (`packages/gateway/`)

### Community 147 - "Event-Bus & Message Pipeline Guidelines"
Cohesion: 0.50
Nodes (3): Core Requirements, Event-Bus & Message Pipeline Guidelines, Operational Mandate

### Community 148 - "Continuous Behavioral Learning Protocol"
Cohesion: 0.50
Nodes (3): Confidence Scoring Thresholds, Continuous Behavioral Learning Protocol, Extraction Trigger

### Community 149 - "7. DIAL DEFINITIONS (Technical Reference)"
Cohesion: 0.50
Nodes (4): 7. DIAL DEFINITIONS (Technical Reference), DESIGN_VARIANCE (Level 1-10), MOTION_INTENSITY (Level 1-10), VISUAL_DENSITY (Level 1-10)

### Community 150 - "Cloud-Judge V2 Vision & Feature Requirements"
Cohesion: 0.50
Nodes (3): Cloud-Judge V2 Vision & Feature Requirements, Commercial & Competition Features, Core Capabilities

### Community 153 - "Attaching to a Running Browser"
Cohesion: 0.40
Nodes (5): Attach by channel name, Attach via browser extension, Attach via CDP endpoint, Attaching to a Running Browser, Detach

### Community 155 - "1. Planning"
Cohesion: 0.40
Nodes (5): 1.1 Prerequisite: workspace, 1.2 Prerequisite: seed test, 1.3 Explore the app, 1.4 Write the spec file, 1. Planning

### Community 156 - "ErrorBoundary"
Cohesion: 0.22
Nodes (6): 2. Clean-Slate Purge & 4-Phase Execution Roadmap (Phases 29–32), Phase 29: The Great Purge, `App.tsx` Repair, Consumer Polish & CSS Reset [COMPLETED], Phase 30: Production Linear-Native Hackathon Platform (`/hackathons`, `/hackathons/:slug` & Rust Backend Persistence) [COMPLETED], Phase 31: Production Multi-Tenant Campus Portal — Real Org Provisioning, Auth & Role-Gated Linear Shell (`/campus/*`) [COMPLETED], Phase 32: Real Telemetry-Driven Campus Analytics, 6-Stage Lab Execution Engine & E2E Playwright Verification, ErrorBoundary

### Community 157 - "CampusRole"
Cohesion: 0.50
Nodes (4): CampusRole, Instructor, OrgAdmin, Student

### Community 158 - "deserialize"
Cohesion: 0.24
Nodes (7): health_handler(), HealthResponse, get_problem_catalog(), get_problem_handler(), list_problems_handler(), Problem, TestCaseItem

### Community 159 - "MembershipStatus"
Cohesion: 0.50
Nodes (4): MembershipStatus, Active, Invited, Suspended

### Community 160 - "Track D: High-Performance Kernel Sandbox & Plagiarism Engine (Phases 6–8)"
Cohesion: 0.50
Nodes (4): Phase 6: Linux cgroups v2 Resource Controller & Namespace Isolation (`judge-worker`) [COMPLETED], Phase 7: Seccomp-BPF Strict Filters & Multi-Language Sandboxed Runners [COMPLETED], Phase 8: High-Performance AST Winnowing & Plagiarism Engine [COMPLETED], Track D: High-Performance Kernel Sandbox & Plagiarism Engine (Phases 6–8)

## Knowledge Gaps
- **111 isolated node(s):** `ADR-0894`, `ADR-1244`, `ADR-0857`, `ADR-2782`, `ADR-0959` (+106 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1189 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GatewayError` connect `GatewayError` to `judge-core/src/lib.rs`, `users.rs`, `test_auth_gateway.rs`, `DbError`, `subscriptions.rs`, `RubricEvaluationUpdate`, `cockpit.rs`, `contests.rs`, `auth.rs`, `routes/submission.rs`, `StatusCode`, `deserialize`, `hackathons.rs`, `AppState`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `ADR-0894`, `ADR-1244`, `ADR-0857` to the rest of the system?**
  _111 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `judge-gateway/src/lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.025440517151496193 - nodes in this community are weakly interconnected._
- **Why does `playwright` connect `verify-local-runtime.mjs` to `frontend/package.json`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `CampusLabRoomPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1076923076923077 - nodes in this community are weakly interconnected._
- **Should `cli.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.11088709677419355 - nodes in this community are weakly interconnected._
- **Should `judge-core/src/lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.0603921568627451 - nodes in this community are weakly interconnected._
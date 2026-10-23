# Graph Report - cloud-judge-v2  (2026-10-23)

## Corpus Check
- 254 files · ~279,740 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 3, .css 3, .gateway 1)

## Summary
- 3418 nodes · 6891 edges · 175 communities (151 shown, 24 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 243 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2eccca9e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cockpit.rs
- api.ts
- useAuth
- ProblemWorkspacePage.tsx
- campus.rs
- auth.rs
- App.tsx
- judge-db/src/lib.rs
- create_router
- campusApi.ts
- 6.2 Competitive feature gaps (researched; competitors cited)
- detector.rs
- subscriptions.rs
- problems.rs
- test_problem_catalog.rs
- test_cockpit_apis.rs
- CampusLabRoomPage.tsx
- frontend/package.json
- hackathons.rs
- components_heatmap.tsx
- GatewayError
- rate_limit.rs
- routes/assessment.rs
- ProfilePage.tsx
- VivaRoom
- AssessmentRecord
- llm.rs
- security.rs
- verify_razorpay_payment_handler
- judge-db/src/models.rs
- judge-worker/src/lib.rs
- test_viva_isolation.rs
- state.rs
- VivaDoc
- VivaClusterMessage
- TelemetryError
- test-phase4-integration.mjs
- engine.rs
- 2. Phase-by-Phase Implementation Roadmap
- rbac.rs
- test_telemetry_mesh.rs
- AwarenessEnvelope
- WorkerDaemon
- 4. 18 Micro-Phases Across 7 Tracks
- deserialize
- test_ai_debug_llm.rs
- TelemetryEvent
- IsometricHeatmap.tsx
- test_assessment_lifecycle.rs
- judge-core/src/lib.rs
- contests.rs
- PART I: MILESTONE v2.3 ARCHITECTURAL BLUEPRINT
- test-phase13-proctor-cockpit.mjs
- gen-capability-registry.cjs
- judge-viva/src/ws.rs
- WorkerError
- diagnose
- test_ai_debug.rs
- Linear — Style Reference
- verify-v45-proctor-telemetry.mjs
- assessment_id.rs
- "AlgoCeleris Campus: Multi-Tenant Institutional Assessment & Live Proctoring Portal"
- 6. The 11 Implementation Phases (Atomic Execution Plan)
- test_execution_sandbox.rs
- DiffOp
- 2. Phase Summaries (Phases 19–24)
- VivaError
- verify-v44-production.mjs
- Core Architecture Invariants
- SubmissionRecord
- verify-local-runtime.mjs
- judge-telemetry/src/ws.rs
- path
- IMPLEMENTATION_PLAN.md
- 2. Phase-by-Phase Roadmap (Phases 25–28)
- 2. Clean-Slate Purge & 4-Phase Execution Roadmap (Phases 29–32)
- judge-core/src/models.rs
- LlmConfig
- ref_assert
- gen-loop-host-contract.cjs
- cli.cjs
- cli-exit.cjs
- ProctorEventRecord
- judge-core
- DbError
- test-phase12-exam-arena.mjs
- 3. Heal
- AlgoCeleris (Cloud-Judge V2)
- ContestsPage.tsx
- test-phase11-faculty-scheduler.mjs
- Browser Session Management
- DomainError
- github-release-notes.cjs
- Storage Management
- compilerOptions
- playwright-cli/SKILL.md
- lint.cjs
- Tracing
- test-phase14-viva-workspace.mjs
- ref_fs
- fix-slash-commands.cjs
- shellcheck-fetch.cjs
- tasteskill: Anti-Slop Frontend Skill
- Appendix B - Canonical Sources (read these before reinventing)
- Browser Automation with playwright-cli
- src/theme.ts
- test-phase17-haproxy-cutover.mjs
- drift-scan.cjs
- 2. Sequential Atomic Execution Phases (Phases 33–37)
- Cloud-Judge V2 (AlgoCeleris) — Milestone v4.3 Comprehensive Audit Report
- new.cjs
- Running Custom Playwright Code
- SeccompAction
- 4. DESIGN ENGINEERING DIRECTIVES (Bias Correction)
- Commands
- detector.rs
- test-phase3-mobile-hardening.mjs
- DbPool
- TokenBucket
- LinuxSandbox
- 10. REFERENCE VOCABULARY (Pattern Names the Agent Should Know)
- Video Recording
- `cli.cjs extract`
- Cookies
- 2. Production 4-Phase Execution Roadmap (Phases 29–32)
- GEMINI.md
- 9. AI TELLS (Forbidden Patterns)
- Execution Workflow
- Advanced Mocking with run-code
- Local Storage
- dependencies
- compilerOptions
- test-phase1-relative-endpoints.mjs
- APPENDICES - Real Source-Backed Reference Material
- 11. REDESIGN PROTOCOL
- 3. DEFAULT ARCHITECTURE & CONVENTIONS
- 6. PERFORMANCE & ACCESSIBILITY GUARDRAILS
- devDependencies
- audit-full-v43.mjs
- 2. Critical Bugs & Runtime Exceptions (Blockers Resolved)
- 12. THE BLOCK LIBRARY (Contract - Implementations Land Here Iteratively)
- 5. CONTEXT-AWARE PROACTIVITY
- 8. DARK MODE PROTOCOL
- Schema Migration Engine Protocol
- Strategic Context Compaction Protocol
- Eval-Driven Verification Protocol
- Web Interface Guidelines
- Phase 34: Complete Copy Purge (Infrastructure Jargon -> Enterprise Product Voice) [COMPLETED & VERIFIED]
- Systems Architect Specification
- Code Reviewer and Security Critic Prompt
- Quality & Acceptance Critic Protocol
- Implementation Worker Protocol
- Codebase Investigator Specification
- AST-Search-First Protocol
- Domain-Specific Validation Rules
- Event-Bus & Message Pipeline Guidelines
- alias-drift-families.cjs
- Continuous Behavioral Learning Protocol
- 7. DIAL DEFINITIONS (Technical Reference)
- MembershipStatus
- Cloud-Judge V2 Vision & Feature Requirements
- Phase 1: Telemetry & Relative Endpoint Fixes
- dev-fullstack.sh
- security-critic.md
- hooks/package.json

## God Nodes (most connected - your core abstractions)
1. `AppState` - 123 edges
2. `GatewayError` - 122 edges
3. `DbError` - 60 edges
4. `fetchWithFallback()` - 55 edges
5. `create_router()` - 51 edges
6. `react` - 49 edges
7. `VivaError` - 40 edges
8. `lucide-react` - 37 edges
9. `AssessmentRecord` - 35 edges
10. `WorkerError` - 34 edges

## Surprising Connections (you probably didn't know these)
- `3.2 Frontend Route Guarding (`packages/frontend/src/components/CampusRouteGuard.tsx`)` --references--> `CampusRouteGuard()`  [INFERRED]
  docs/MILESTONE_V4_4_SPEC.md → packages/frontend/src/components/CampusRouteGuard.tsx
- `5.1 Palette & Color Tokens` --references--> `CampusSidebarLayout()`  [INFERRED]
  REPORT_V4.3.md → packages/frontend/src/components/CampusSidebarLayout.tsx
- `6. Detailed Feature-by-Feature Scorecard (24 Modules)` --references--> `CampusSidebarLayout()`  [INFERRED]
  REPORT_V4.3.md → packages/frontend/src/components/CampusSidebarLayout.tsx
- `3.1 Client-Side Authentication Interceptors` --references--> `useAuth()`  [INFERRED]
  docs/MILESTONE_V4_4_SPEC.md → packages/frontend/src/context/AuthContext.tsx
- `37.3 Target Deliverables & Verification Checklist` --references--> `CampusLabRoomPage()`  [INFERRED]
  IMPLEMENTATION_PLAN.md → packages/frontend/src/pages/campus/CampusLabRoomPage.tsx

## Import Cycles
- 1-file cycle: `crates/judge-gateway/src/routes/subscriptions.rs -> crates/judge-gateway/src/routes/subscriptions.rs`
- 1-file cycle: `crates/judge-gateway/src/services/llm.rs -> crates/judge-gateway/src/services/llm.rs`
- 1-file cycle: `crates/judge-gateway/src/services/rate_limit.rs -> crates/judge-gateway/src/services/rate_limit.rs`
- 2-file cycle: `crates/judge-worker/src/runner/engine.rs -> crates/judge-worker/src/runner/mod.rs -> crates/judge-worker/src/runner/engine.rs`

## Communities (175 total, 24 thin omitted)

### Community 1 - "cockpit.rs"
Cohesion: 0.10
Nodes (46): CandidateCockpitSummary, derive_connection_state(), discover_enrolled_candidates(), ensure_assessment_membership(), get_proctor_cockpit_handler(), get_proctor_events_handler(), get_proctored_students_handler(), get_viva_rubric_handler() (+38 more)

### Community 2 - "api.ts"
Cohesion: 0.05
Nodes (73): AuthContext, AuthContextType, AuthProvider(), restoreSession(), GUEST_USER, mapAuthUser(), HackathonDetailPage(), HackathonsPage() (+65 more)

### Community 3 - "useAuth"
Cohesion: 0.19
Nodes (12): CodeEditor(), LinearHeaderNav(), LINEAR_MIDNIGHT_THEME, LINEAR_MIDNIGHT_THEME_NAME, useAuth(), User, getInitialTheme(), Theme (+4 more)

### Community 4 - "ProblemWorkspacePage.tsx"
Cohesion: 0.05
Nodes (77): 3.2 Workspace Mobile Hardening (`ProblemWorkspacePage.tsx` & `ResizableLayout.tsx`), AIDebugModal(), AIDebugModalProps, Narrative(), CodeEditorProps, DeveloperAnalyticsModal(), DeveloperAnalyticsModalProps, diffTokens() (+69 more)

### Community 5 - "campus.rs"
Cohesion: 0.08
Nodes (35): ActivityCategoryItem, ActivityPoint, AiHintCategoryItem, AiSessionTrendItem, batch_ingest_members_handler(), BatchIngestRequest, BatchIngestResponse, BatchMemberItem (+27 more)

### Community 6 - "auth.rs"
Cohesion: 0.05
Nodes (34): verify_password(), ACCESS_TOKEN_EXPIRATION_SECONDS, decode_access_token(), decode_refresh_token(), DEFAULT_JWT_SECRET, encode_access_token(), encode_refresh_token(), REFRESH_TOKEN_EXPIRATION_SECONDS (+26 more)

### Community 7 - "App.tsx"
Cohesion: 0.06
Nodes (63): 33.4 Acceptance Criteria, 36.2 Exact Files to Modify, Phase 25: Routing Bug Fix, Apple Design Tokens & `/campus` Gallery Overhaul (+ Apple Store Configurator `/campus/register`), Phase 29: The Great Purge, `App.tsx` Repair, Consumer Polish & CSS Reset [COMPLETED], App(), CampusRedirect(), ErrorBoundary, ErrorBoundaryProps (+55 more)

### Community 9 - "create_router"
Cohesion: 0.14
Nodes (16): create_router(), generate_test_token(), test_live_postgres_rbac_and_batch_ingest(), test_org_admin_creates_cohort_and_batch_roster_and_instructor_reads(), test_phase36_instructor_and_admin_tier_permissions(), test_phase36_student_cannot_create_lab_or_view_audit(), test_student_attempting_instructor_action_returns_403(), test_unauthenticated_request_returns_401() (+8 more)

### Community 10 - "campusApi.ts"
Cohesion: 0.07
Nodes (46): candidateLabel(), candidateRoll(), FacultyProctorCockpitPage(), playCriticalAlert(), STARTER_CODES, StudentExamArenaPage(), calculateRubricWeightedTotal(), DEFAULT_VIVA_CRITERIA (+38 more)

### Community 11 - "6.2 Competitive feature gaps (researched; competitors cited)"
Cohesion: 0.05
Nodes (43): 1. Executive Summary, 2. Critical & Blocker Bugs, 4.1 Frontend → Backend contract gaps (frontend calls endpoints that do not exist), 4.2 Data-shape contract mismatch — AI Debug modal, 4.3 Route wiring discrepancies (phantom routes render the wrong component), 4.4 Campus assessment ID contract: UUID vs integer, 4.5 Backend → Frontend duplication / drift, 4.6 Edge/deployment drift (+35 more)

### Community 12 - "detector.rs"
Cohesion: 0.15
Nodes (12): AstTokenizer, is_comment(), is_identifier(), is_literal(), StructuralToken, walk_ast(), compute_kgram_hashes(), Fingerprint (+4 more)

### Community 13 - "subscriptions.rs"
Cohesion: 0.07
Nodes (21): ai_debug_handler(), AIDebugRequest, AIDebugResponse, assemble_debug_context(), CatalogMetadata, count_loop_constructs(), deterministic_analysis_flags_nested_scans(), deterministic_debug_response() (+13 more)

### Community 14 - "problems.rs"
Cohesion: 0.21
Nodes (14): catalog(), CatalogProblem, CatalogTestCase, find(), get_problem_handler(), init_problem_catalog(), list_problems_handler(), Problem (+6 more)

### Community 15 - "test_problem_catalog.rs"
Cohesion: 0.06
Nodes (13): main(), shutdown_signal(), test_campus_org_directory_narrows_payload_for_anonymous_callers(), test_campus_phase31_complete_lifecycle(), test_campus_phase32_lab_engine_and_dynamic_analytics(), test_hackathons_catalog_and_dynamic_lifecycle(), decode_json(), submit_payload() (+5 more)

### Community 16 - "test_cockpit_apis.rs"
Cohesion: 0.10
Nodes (14): decode_body(), enroll_candidate(), generate_test_token(), json_body(), proctor_ingest_request(), proctor_read_request(), setup_test_assessment(), test_live_postgres_cockpit_and_viva_if_available() (+6 more)

### Community 17 - "CampusLabRoomPage.tsx"
Cohesion: 0.14
Nodes (19): 35.1 Problem Scope & Technical Audit, 35.2 Exact Files to Modify, 35.3 Target Deliverables, 35.4 Acceptance Criteria, Phase 35: Relational PostgreSQL Persistence & Zero In-Memory Fallbacks [COMPLETED & VERIFIED], CampusLabReviewPage(), fetchLab(), CampusLabRoomPage() (+11 more)

### Community 18 - "frontend/package.json"
Cohesion: 0.09
Nodes (17): name, private, scripts, build, dev, preview, test:v44-audit, type (+9 more)

### Community 19 - "hackathons.rs"
Cohesion: 0.08
Nodes (37): OptionalUser, role_level(), calculate_milestone_status(), create_or_join_team_handler(), ensure_user_exists(), get_hackathon_detail_handler(), HackathonDetailResponse, HackathonRegisterRequest (+29 more)

### Community 20 - "components_heatmap.tsx"
Cohesion: 0.07
Nodes (47): barHeight(), BG_FALLBACK, buildGrid(), Cam, camera(), Cell, clamp01(), computeStats() (+39 more)

### Community 21 - "GatewayError"
Cohesion: 0.09
Nodes (40): hash_password(), GatewayError, BadRequest, Conflict, Database, Domain, Forbidden, InternalError (+32 more)

### Community 22 - "rate_limit.rs"
Cohesion: 0.11
Nodes (18): AI_DEBUG_WINDOW, AI_DEBUG_WINDOW_SECONDS, AiDebugRateLimiter, consume_redis(), decision_from_redis(), free_tier_is_capped_at_the_free_limit(), FREE_TIER_LIMIT, KEY_PREFIX (+10 more)

### Community 23 - "routes/assessment.rs"
Cohesion: 0.25
Nodes (21): RequireInstructor, AssessmentResponse, create_assessment_handler(), create_cohort_assessment_handler(), CreateAssessmentRequest, do_create_assessment(), fetch_assessment_record(), force_submit_assessment_handler() (+13 more)

### Community 24 - "ProfilePage.tsx"
Cohesion: 0.12
Nodes (29): PROBLEMS, AuthPage(), AuthPageProps, ProblemsPage(), SortField, SortOrder, DIFF_COLORS, hashString() (+21 more)

### Community 25 - "VivaRoom"
Cohesion: 0.12
Nodes (5): AWARENESS_BROADCAST_CAPACITY, CRDT_BROADCAST_CAPACITY, RUBRIC_BROADCAST_CAPACITY, VivaRoom, VivaRoomManager

### Community 26 - "AssessmentRecord"
Cohesion: 0.18
Nodes (10): Assessment, AssessmentRecord, AssessmentRepository, AssessmentRepository<'a>, create_assessment(), get_assessment_by_id(), list_active_assessments(), list_cohort_assessments() (+2 more)

### Community 27 - "llm.rs"
Cohesion: 0.09
Nodes (27): ChatChoice, ChatChoiceMessage, ChatCompletionRequest, ChatCompletionResponse, ChatMessage, DebugContext, DEFAULT_LLM_BASE_URL, DEFAULT_LLM_MODEL (+19 more)

### Community 28 - "security.rs"
Cohesion: 0.12
Nodes (13): attach_security_headers(), configured_origins(), configured_origins_are_never_empty_and_always_parseable(), CONTENT_SECURITY_POLICY, cors_layer(), csp_value(), DEFAULT_ALLOWED_ORIGINS, DEFAULT_CONTENT_SECURITY_POLICY (+5 more)

### Community 29 - "verify_razorpay_payment_handler"
Cohesion: 0.29
Nodes (8): create_razorpay_order_handler(), create_stripe_checkout_handler(), get_entitlements_handler(), RazorpayOrderRequest, RazorpayVerifyRequest, StripeCheckoutRequest, verify_razorpay_payment_handler(), verify_razorpay_signature()

### Community 30 - "judge-db/src/models.rs"
Cohesion: 0.13
Nodes (19): Cohort, CohortRecord, HackathonRecord, HackathonRegistrationRecord, HackathonSubmissionRecord, HackathonTeamMemberRecord, HackathonTeamRecord, InterviewRoomRecord (+11 more)

### Community 32 - "test_viva_isolation.rs"
Cohesion: 0.12
Nodes (4): setup_viva_server(), test_candidate_rubric_masking_invariant(), test_evaluator_frame_delivery(), viva_ws_endpoint()

### Community 33 - "state.rs"
Cohesion: 0.16
Nodes (18): ChallengingProblemSpec, HackathonEntity, HackathonMatchmakerItem, HackathonMilestoneItem, HackathonRegistrationItem, HackathonShowcaseItem, HackathonStore, HackathonTeamItem (+10 more)

### Community 35 - "VivaClusterMessage"
Cohesion: 0.10
Nodes (10): decode(), format_viva_channel(), TABLE, VivaClusterMessage, Awareness, CrdtUpdate, RubricUpdate, VivaRedisRelay (+2 more)

### Community 36 - "TelemetryError"
Cohesion: 0.08
Nodes (13): TelemetryError, ChannelClosed, ConnectionError, IdentityMismatch, Json, RateLimitExceeded, Redis, SerializationError (+5 more)

### Community 37 - "test-phase4-integration.mjs"
Cohesion: 0.16
Nodes (19): campusLoginViaApi(), contrastRatio(), failed, freshPage(), normalize(), openTwoSumWorkspace(), readCockpitCandidate(), results (+11 more)

### Community 38 - "engine.rs"
Cohesion: 0.17
Nodes (5): DEFAULT_MEMORY_LIMIT_BYTES, DEFAULT_OUTPUT_LIMIT_BYTES, DEFAULT_TIME_LIMIT, ExecutionResult, read_bounded_stream()

### Community 39 - "2. Phase-by-Phase Implementation Roadmap"
Cohesion: 0.10
Nodes (20): 1. Executive Mandate & Production Invariants, 2.1 Copy Sanitization Targets (Demo Copy -> Enterprise Product Copy), 2.2 Semantic CSS Variables & Full Theme Inversion, 2. Phase-by-Phase Implementation Roadmap, 3.1 Client-Side Authentication Interceptors, 3.1 Dynamic Student Performance & Lab Aggregation, 3.1 Elimination of Client-Side Role Switching, 3.2 Automated Production Playwright Audit (`scripts/verify-v44-production.mjs`) (+12 more)

### Community 40 - "rbac.rs"
Cohesion: 0.29
Nodes (10): AccessTokenClaims, AuthenticatedUser, RequireOrgAdmin, RequireStudent, resolve_target_assessment_id(), resolve_target_cohort_id(), resolve_target_org_id(), resolve_target_org_slug() (+2 more)

### Community 42 - "AwarenessEnvelope"
Cohesion: 0.19
Nodes (7): AwarenessEnvelope, AwarenessMessage, CursorMove, PeerLeave, PresenceUpdate, CursorPosition, PeerPresence

### Community 44 - "4. 18 Micro-Phases Across 7 Tracks"
Cohesion: 0.06
Nodes (36): 1. Executive Architectural Scope & High-Throughput Topology, 2. Crate Boundaries & Cargo Workspace Architecture, 3. Compiler Invariants & Hardware Constraints, 4. 18 Micro-Phases Across 7 Tracks, 5. Milestone v4.0 Acceptance Criteria Summary Table, Acceptance Criteria for Milestone v2.3 Execution, Detailed Crate Responsibilities & Invariants, PART III: MILESTONE v4.0 ARCHITECTURAL BLUEPRINT (+28 more)

### Community 46 - "test_ai_debug_llm.rs"
Cohesion: 0.15
Nodes (18): ai_debug_body(), anonymous_model_backed_requests_are_rejected(), configure_provider(), free_tier_quota_returns_429_with_retry_after(), handle_connection(), malformed_provider_payloads_degrade_to_deterministic(), mock_response(), model_backed_debug_returns_the_parsed_analysis() (+10 more)

### Community 47 - "TelemetryEvent"
Cohesion: 0.17
Nodes (15): RiskScore, RiskSeverity, Critical, Elevated, Low, calculate_risk_score(), test_proctor_risk_score_aggregation(), CandidateProctorState (+7 more)

### Community 48 - "IsometricHeatmap.tsx"
Cohesion: 0.07
Nodes (47): barHeight(), BG_FALLBACK, buildGrid(), Cam, camera(), Cell, clamp01(), computeStats() (+39 more)

### Community 49 - "test_assessment_lifecycle.rs"
Cohesion: 0.27
Nodes (10): generate_test_token(), setup_test_hierarchy(), test_chronological_timeline_validation_rejects_malformed_dates(), test_faculty_force_submit_and_status_transition(), test_grace_period_submission_calculates_ceiling_hour_late_penalty(), test_live_postgres_assessment_lifecycle_if_available(), test_on_time_submission_accepts_with_zero_deduction(), test_post_cutoff_submission_strictly_rejected_with_403() (+2 more)

### Community 51 - "contests.rs"
Cohesion: 0.13
Nodes (22): build_mock_leaderboard(), contest_leaderboard_ws_handler(), ContestProblemSummary, ContestSummary, get_contest_handler(), get_contest_leaderboard_handler(), get_global_leaderboard_handler(), handle_leaderboard_socket() (+14 more)

### Community 52 - "PART I: MILESTONE v2.3 ARCHITECTURAL BLUEPRINT"
Cohesion: 0.12
Nodes (16): 2.1 Concentric Border-Radii Audit & Mathematical Enforcement, 2.2 Tabular Figures & Numerical Stability (`font-variant-numeric: tabular-nums`), 2.3 Optical Alignment, Icon-Text Pairings & Contrast Audit, 3.1 Responsive Breakpoints & Viewport Architecture, 3.3 Navigation Mobile Hardening (`LinearHeaderNav.tsx`), 3.4 Monaco Editor Touch & Virtual Keyboard Ergonomics, 3.5 Seamless Theme Inversion Transitions, 4.1 Verification Strategy (+8 more)

### Community 53 - "test-phase13-proctor-cockpit.mjs"
Cohesion: 0.15
Nodes (12): applyTelemetryEvent(), appTsxPath, appTsxSrc, calculateRiskScore(), campusApiPath, campusApiSrc, cockpitPagePath, cockpitSrc (+4 more)

### Community 54 - "gen-capability-registry.cjs"
Cohesion: 0.08
Nodes (34): buildRegistry(), CAPABILITIES_DIR, capValidator, ADR-0894, CLUSTERS(), CLUSTERS_PATH, CONFIG_SCHEMA_PATH, deriveCapabilityClusters() (+26 more)

### Community 55 - "judge-viva/src/ws.rs"
Cohesion: 0.13
Nodes (10): RubricEvaluationUpdate, CLIENT_OUTBOUND_QUEUE_CAPACITY, handle_viva_socket(), VivaWsClientMessage, Awareness, RubricEvaluation, VivaWsServerMessage, Awareness (+2 more)

### Community 56 - "WorkerError"
Cohesion: 0.09
Nodes (15): WorkerError, CgroupError, Domain, Io, NamespaceError, ParseError, PermissionDenied, SyscallError (+7 more)

### Community 57 - "diagnose"
Cohesion: 0.26
Nodes (12): analysis_without_core_sections_is_rejected(), completion_content(), diagnose(), extract_json_object(), into_response(), LlmError, Incomplete, Malformed (+4 more)

### Community 58 - "test_ai_debug.rs"
Cohesion: 0.14
Nodes (9): ProblemDetails, anonymous_offline_debug_returns_the_deterministic_analysis(), offline_app(), offline_requests_are_not_quota_limited(), post_ai_debug(), source_header(), spa_payload(), submissions_without_code_are_rejected() (+1 more)

### Community 59 - "Linear — Style Reference"
Cohesion: 0.05
Nodes (37): Agent Prompt Guide, Badge / Status Tag, Berkeley Mono — Code-adjacent UI text — issue IDs (ENG-2703), keyboard shortcuts, monospaced metadata · `--font-berkeley-mono`, Border Radius, Card (Product Screenshot Frame), Card (Subtle), Components, CSS Custom Properties (+29 more)

### Community 60 - "verify-v45-proctor-telemetry.mjs"
Cohesion: 0.13
Nodes (7): { execSync }, { execSync }, psql(), redisCli(), results, rootDir, tryExec()

### Community 61 - "assessment_id.rs"
Cohesion: 0.29
Nodes (7): assessment_id_for_slug(), AssessmentId, MAX_ASSESSMENT_HANDLE_LEN, nth_assessment_id(), ordered_mock_assessments(), resolve_assessment_id(), lab_assessment_id_for_lab_code()

### Community 62 - ""AlgoCeleris Campus: Multi-Tenant Institutional Assessment & Live Proctoring Portal""
Cohesion: 0.17
Nodes (12): 1. Executive Architectural Scope & Domain Model, 2. Multi-Tenant Relational Schema (PostgreSQL 16 & Alembic `0002_campus_portal.py`), 3. Gateway Multi-Tenant RBAC Architecture, 4.1 State Machine Lifecycle, 4.2 Automated Late Penalty Formulation, 4.3 Secret Test Cases & Masking Policy, 4. Assessment Engine State Machine & Deadline Gatekeepers, 5.1 Proctoring Telemetry WebSocket (`/ws/campus/assessments/{id}/proctor`) (+4 more)

### Community 63 - "6. The 11 Implementation Phases (Atomic Execution Plan)"
Cohesion: 0.17
Nodes (12): 6. The 11 Implementation Phases (Atomic Execution Plan), Phase 10: Multiplayer Viva & Collaborative Interview Engine (Yjs CRDT & Live Cursors) [COMPLETED], Phase 11: Faculty Assessment Scheduler, Interactive Calendar & Rubric Builder UI: [COMPLETED], Phase 12: Student Exam Arena, Fullscreen Proctoring Lock & Auto-Submit Watchdog UI: [COMPLETED], Phase 13: Faculty Live Proctoring Cockpit & Real-Time Integrity Dashboard UI: [COMPLETED], Phase 14: 3-Pane Viva Interview Workspace & Private Instructor Rubric Drawer UI: [COMPLETED], Phase 15: Multi-Role End-to-End Playwright Verification Suite & Chaos Load Test [COMPLETED], Phase 5: Multi-Tenant Campus Relational Schema & Alembic Migrations [COMPLETED] (+4 more)

### Community 65 - "DiffOp"
Cohesion: 0.27
Nodes (11): align_lines(), derived_diff_uses_language_specific_headers(), diff_extension(), diff_marks_changed_lines_with_context(), DiffOp, Add, Keep, Remove (+3 more)

### Community 66 - "2. Phase Summaries (Phases 19–24)"
Cohesion: 0.18
Nodes (11): 1. Executive Intent & Invariants, 2. Phase Summaries (Phases 19–24), 3. Milestone v4.1 Verification & Acceptance Criteria Matrix, "Isolated Multi-Tenant Campus Portal (LPilot Architecture), 3-Tier Institutional Hierarchy & Full-Stack Hackathon Platform", PART IV: MILESTONE v4.1 ARCHITECTURAL BLUEPRINT, Phase 19: Consumer Navbar Decoupling, Institutional Landing & Tenant Onboarding Wizard, Phase 20: Split-Screen Co-Branded Login & Strict 3-Tier Role Sidebar Layout, Phase 21: LPilot Student Dashboard, Active/Completed Lab Lists & 8-Tab Read-Only Review (+3 more)

### Community 67 - "VivaError"
Cohesion: 0.11
Nodes (15): VivaError, CrdtSyncError, DatabaseError, Domain, InvalidRubricEvaluation, Json, ProtocolError, Redis (+7 more)

### Community 68 - "verify-v44-production.mjs"
Cohesion: 0.20
Nodes (7): ADMIN_SESSION, FORBIDDEN_BRAG_TERMS, INSTRUCTOR_SESSION, results, rootDir, ROUTES, STUDENT_SESSION

### Community 69 - "Core Architecture Invariants"
Cohesion: 0.22
Nodes (8): 1. System Topology & Ingress, 2. Worker Engine & Sandbox Isolation, 3. Data Persistence & Caching, 4. Authentication, Security & RBAC, 5. Anti-Abuse & Rate Limiting, 6. Frontend & Design Token Constraints, 7. Out of Scope (Hard Constraints), Core Architecture Invariants

### Community 70 - "SubmissionRecord"
Cohesion: 0.17
Nodes (12): AssessmentSubmission, AssessmentSubmissionRecord, Submission, SubmissionRecord, create_submission(), finalize_assessment_submission(), get_assessment_submission(), get_submission_by_id() (+4 more)

### Community 71 - "verify-local-runtime.mjs"
Cohesion: 0.07
Nodes (24): { basename }, MARKED_SUITES, playwright, __dirname, __filename, ROOT_DIR, SNAPSHOT_DIR, backendPool (+16 more)

### Community 73 - "path"
Cohesion: 0.09
Nodes (9): CppRunner, JavaRunner, CommandConfig, PythonRunner, DEFAULT_CGROUP_ROOT, DEFAULT_CPU_MAX_QUOTA, DEFAULT_MEMORY_HIGH_BYTES, DEFAULT_MEMORY_MAX_BYTES (+1 more)

### Community 74 - "IMPLEMENTATION_PLAN.md"
Cohesion: 0.25
Nodes (7): 1. Executive Roadmap & Milestone Matrix, 1. Executive Summary & Root Cause Analysis, 3. Milestone v4.4 Verification & Acceptance Criteria Matrix, "Enterprise Platform Remediation: Zero-Contrast Dual-Theme Inversion, Authentic Product Copy Purge, PostgreSQL Persistence & Cryptographic RBAC Session Gating", PART II: MILESTONE v3.0 ARCHITECTURAL BLUEPRINT, PART VII: MILESTONE v4.4 ARCHITECTURAL BLUEPRINT, Technical Architecture Blueprint: Cloud-Judge V2 Roadmap & Execution Plan

### Community 75 - "2. Phase-by-Phase Roadmap (Phases 25–28)"
Cohesion: 0.25
Nodes (8): 1. Architectural Mandate & Anti-Slop Discipline, 2. Phase-by-Phase Roadmap (Phases 25–28), 3. Milestone v4.2 Verification & Acceptance Criteria Matrix, "Apple Design System Overhaul (`docs/DESIGN-apple.md`), Zero-Slop Visual Engineering & Functional Portal Parity", PART V: MILESTONE v4.2 ARCHITECTURAL BLUEPRINT (Phases 25–28) [SUPERSEDED BY v4.3], Phase 26: Apple-Grade Institutional Login, Sidebar Shell & Complete Admin/Faculty Dashboards (Zero Placeholders), Phase 27: Apple-Grade Student Dashboard, 6-Stage Lab Workspace, Read-Only Review & 4-Tab Analytics, Phase 28: Apple Developer / WWDC-Style Hackathon Hub (`/hackathons` & `/hackathons/:slug`)

### Community 76 - "2. Clean-Slate Purge & 4-Phase Execution Roadmap (Phases 29–32)"
Cohesion: 0.25
Nodes (8): 1. Visual Invariants: Unified Refero Linear Midnight (`docs/DESIGN.md`), 2. Clean-Slate Purge & 4-Phase Execution Roadmap (Phases 29–32), 3. Milestone v4.3 Verification & Acceptance Criteria Matrix, PART VI: MILESTONE v4.3 ARCHITECTURAL BLUEPRINT (Phases 29–32), Phase 30: Production Linear-Native Hackathon Platform (`/hackathons`, `/hackathons/:slug` & Rust Backend Persistence) [COMPLETED], Phase 31: Production Multi-Tenant Campus Portal — Real Org Provisioning, Auth & Role-Gated Linear Shell (`/campus/*`) [COMPLETED], Phase 32: Real Telemetry-Driven Campus Analytics, 6-Stage Lab Execution Engine & E2E Playwright Verification, "Unified Refero Linear Midnight Design System (`docs/DESIGN.md`), Real Rust-Backed Multi-Tenant Campus Portal & Full-Stack Hackathon Platform"

### Community 77 - "judge-core/src/models.rs"
Cohesion: 0.08
Nodes (32): Assessment, AssessmentMode, Exam, Homework, Viva, AssessmentStatus, Active, Closed (+24 more)

### Community 78 - "LlmConfig"
Cohesion: 0.38
Nodes (4): config_defaults_to_the_gemini_compatible_endpoint(), config_from(), config_normalises_overrides(), LlmConfig

### Community 79 - "ref_assert"
Cohesion: 0.13
Nodes (9): RFC-7807, cssContent, indexCssPath, lightMutedHex, lightThemeMatch, rootDir, consoleErrors, pageErrors (+1 more)

### Community 81 - "gen-loop-host-contract.cjs"
Cohesion: 0.08
Nodes (29): assertPointsCoverage(), buildContract(), CANONICAL_POINTS, ADR-0894, CONTRACT_PATH, coveredKindsInRegion(), crossCheckRoleFamilies(), crossCheckRoles() (+21 more)

### Community 82 - "cli.cjs"
Cohesion: 0.11
Nodes (27): assembleChangelog(), cmdExtract(), cmdGithubReleaseNotes(), cmdRender(), cmdVerify(), {
  compareSemverCore,
  isStableTripletSemver,
}, { ExitError, runMain }, fs (+19 more)

### Community 83 - "cli-exit.cjs"
Cohesion: 0.11
Nodes (23): ADR-3889, CONTRACT_VERSION_KEY, exitCodeFor(), exitCodeRegistryModule, findExitContractFlag(), getContractVersion(), getJsonErrorMode(), getPendingOutcome() (+15 more)

### Community 84 - "ProctorEventRecord"
Cohesion: 0.30
Nodes (8): ProctorEventCounts, ProctorEventRecord, get_candidate_event_counts(), list_assessment_events(), ProctorRepository, ProctorRepository<'a>, record_proctor_event(), test_proctor_event_repository_flow()

### Community 86 - "judge-core"
Cohesion: 0.67
Nodes (6): judge-core, judge-db, judge-gateway, judge-telemetry, judge-viva, judge-worker

### Community 87 - "DbError"
Cohesion: 0.17
Nodes (17): DbError, Domain, ForeignKeyViolation, NotFound, PoolError, SerializationError, Sqlx, UniqueViolation (+9 more)

### Community 88 - "test-phase12-exam-arena.mjs"
Cohesion: 0.08
Nodes (21): appTsxPath, appTsxSrc, arenaPagePath, arenaSrc, baseTime, campusApiPath, campusApiSrc, cutoffTime (+13 more)

### Community 89 - "3. Heal"
Cohesion: 0.09
Nodes (23): 0. How generation works, 1.1 Prerequisite: workspace, 1.2 Prerequisite: seed test, 1.3 Explore the app, 1.4 Write the spec file, 1. Planning, 2.1 Inputs, 2.2 Generate one scenario (+15 more)

### Community 90 - "AlgoCeleris (Cloud-Judge V2)"
Cohesion: 0.09
Nodes (22): 1. Executive Summary, 2. System Architecture & Topology, 3. Core Subsystems & Enterprise Capabilities, 4. Repository & Crate Architecture, 5. Getting Started & Local Development, 6. Verification, Testing & Quality Invariants, 7. License, AlgoCeleris Campus (Institutional Assessment Portal) (+14 more)

### Community 91 - "ContestsPage.tsx"
Cohesion: 0.18
Nodes (19): ContestLeaderboardModal(), ContestLeaderboardModalProps, buildFallbackContests(), ContestsPage(), derivePhase(), fallbackLeaderboard(), formatCountdown(), mkProblems() (+11 more)

### Community 92 - "test-phase11-faculty-scheduler.mjs"
Cohesion: 0.10
Nodes (18): appTsxPath, appTsxSrc, calendarPagePath, calendarPageSrc, campusApiPath, campusApiSrc, createPagePath, createPageSrc (+10 more)

### Community 93 - "Browser Session Management"
Cohesion: 0.10
Nodes (20): 1. Name Browser Sessions Semantically, 2. Always Clean Up, 3. Delete Stale Browser Data, A/B Testing Sessions, Attach by channel name, Attach via browser extension, Attach via CDP endpoint, Attaching to a Running Browser (+12 more)

### Community 94 - "DomainError"
Cohesion: 0.15
Nodes (15): calculate_late_penalty(), transition_assessment_state(), validate_assessment_timeline(), validate_rubric_balance(), DomainError, AssessmentClosed, CutoffExceeded, InvalidPenalty (+7 more)

### Community 95 - "github-release-notes.cjs"
Cohesion: 0.16
Nodes (17): buildGithubReleaseNotesIr(), changedFragmentPaths(), classifyGroup(), compareUrl(), cp, FIXED_GROUPS, formatBullet(), loadFragmentsFromRange() (+9 more)

### Community 96 - "Storage Management"
Cohesion: 0.11
Nodes (18): Authentication State Reuse, Clear sessionStorage, Common Patterns, Delete Database, Delete Single Item, Get Single Value, IndexedDB, List All sessionStorage Items (+10 more)

### Community 97 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 98 - "playwright-cli/SKILL.md"
Cohesion: 0.14
Nodes (9): Examples, Inspecting Element Attributes, Debugging Playwright Tests, Running Playwright Tests, Attaching Screenshots and Videos to Pull Requests, From a local session, From CI, Limits (+1 more)

### Community 99 - "lint.cjs"
Cohesion: 0.18
Nodes (14): evaluateLint(), { ExitError, runMain }, findPrFieldDrift(), isFragment(), isUserFacing(), LINT_REASON, main(), { parseFragment } (+6 more)

### Community 100 - "Tracing"
Cohesion: 0.12
Nodes (16): 1. Start Tracing Before the Problem, 2. Clean Up Old Traces, Analyzing Performance, Basic Usage, Best Practices, Capturing Evidence, Debugging Failed Actions, Limitations (+8 more)

### Community 101 - "test-phase14-viva-workspace.mjs"
Cohesion: 0.12
Nodes (13): appTsxPath, appTsxSrc, campusApiPath, campusApiSrc, criteria, indexCssPath, indexCssSrc, parsedAwareness (+5 more)

### Community 102 - "ref_fs"
Cohesion: 0.12
Nodes (11): fs, payload, prohibitedPatterns, command, fs, input, consoleErrors, http500Errors (+3 more)

### Community 103 - "fix-slash-commands.cjs"
Cohesion: 0.18
Nodes (14): buildColonPattern(), buildPattern(), COMMANDS_DIR, EXTENSIONS, fs, isTestFile(), path, processDir() (+6 more)

### Community 104 - "shellcheck-fetch.cjs"
Cohesion: 0.14
Nodes (12): ARCH_MAP, CACHE_DIR, CACHED_BIN_PATH, { ExitError }, extractFileFromTar(), fs, https, httpsGetFollowingRedirects() (+4 more)

### Community 105 - "tasteskill: Anti-Slop Frontend Skill"
Cohesion: 0.13
Nodes (15): 0.A Read these signals first, 0.B Output a one-line "Design Read" before generating, 0. BRIEF INFERENCE (Read the Room Before Anything Else), 0.C If the brief is ambiguous, ask one question, do not guess, 0.D Anti-Default Discipline, 13. OUT OF SCOPE, 14. FINAL PRE-FLIGHT CHECK, 1.A Dial Inference (design read → dial values) (+7 more)

### Community 106 - "Appendix B - Canonical Sources (read these before reinventing)"
Cohesion: 0.13
Nodes (15): Appendix B - Canonical Sources (read these before reinventing), Apple Liquid Glass (Apple platforms only), Atlassian, Bootstrap, Carbon, Fluent UI, GOV.UK, Material Web (+7 more)

### Community 107 - "Browser Automation with playwright-cli"
Cohesion: 0.13
Nodes (15): Attaching screenshots and videos to pull requests, Browser Automation with playwright-cli, Browser Sessions, Example: Debugging with DevTools, Example: Form submission, Example: Interactive session, Example: Multi-tab workflow, Installation (+7 more)

### Community 108 - "src/theme.ts"
Cohesion: 0.13
Nodes (14): ACID_LIME, AMBER, BEDROCK_VOID, CARBON, CORAL_RED, Difficulty, DIFFICULTY_COLORS, GRAPHITE_BORDER (+6 more)

### Community 109 - "test-phase17-haproxy-cutover.mjs"
Cohesion: 0.16
Nodes (11): cfgContent, createMockServer(), HAPROXY_CFG, HAPROXY_PID, makeHttpRequest(), makeWebSocketUpgrade(), nodes, requestCounts (+3 more)

### Community 110 - "drift-scan.cjs"
Cohesion: 0.18
Nodes (9): fs, isInsideRoot(), isUnderSkippedDir(), path, regexScanStats, scanTree(), SKIP_DIR_NAMES, walk() (+1 more)

### Community 111 - "2. Sequential Atomic Execution Phases (Phases 33–37)"
Cohesion: 0.14
Nodes (14): 2. Sequential Atomic Execution Phases (Phases 33–37), 33.1 Problem Scope & Technical Audit, 33.2 Exact Files to Modify, 33.3 Target Deliverables, 36.1 Problem Scope & Technical Audit, 36.3 Target Deliverables, 36.4 Acceptance Criteria, 37.1 Problem Scope & Verification Architecture (+6 more)

### Community 112 - "Cloud-Judge V2 (AlgoCeleris) — Milestone v4.3 Comprehensive Audit Report"
Cohesion: 0.14
Nodes (13): 1. Executive Audit Summary, 3. Interactive Features & WebSocket Integrity, 4. Data Integrity & Mock String Leaks, 5.1 Palette & Color Tokens, 5.2 Typography & Spacing, 5. Design System & Visual Discipline Audit (`docs/DESIGN.md`), 6. Detailed Feature-by-Feature Scorecard (24 Modules), 7. Sign-Off & Verification (+5 more)

### Community 113 - "new.cjs"
Cohesion: 0.21
Nodes (12): ADJECTIVES, ALLOWED_TYPES, { ExitError, runMain }, fs, generateFragmentName(), main(), NOUNS_A, NOUNS_B (+4 more)

### Community 114 - "Running Custom Playwright Code"
Cohesion: 0.15
Nodes (13): Clipboard, Complex Workflows, Error Handling, File Downloads, Frames and Iframes, Geolocation, JavaScript Execution, Media Emulation (+5 more)

### Community 115 - "SeccompAction"
Cohesion: 0.18
Nodes (7): SeccompAction, Allow, Errno, KillProcess, KillThread, Trap, SyscallPolicy

### Community 116 - "4. DESIGN ENGINEERING DIRECTIVES (Bias Correction)"
Cohesion: 0.17
Nodes (12): 4.10 Quotes & Testimonials, 4.11 Page Theme Lock (Light / Dark Mode Consistency), 4.1 Typography, 4.2 Color Calibration, 4.3 Layout Diversification, 4.4 Materiality, Shadows, Cards, 4.5 Interactive UI States, 4.6 Data & Form Patterns (+4 more)

### Community 117 - "Commands"
Cohesion: 0.17
Nodes (12): Commands, Core, DevTools, Emulation, Keyboard, Mouse, Navigation, Network (+4 more)

### Community 118 - "detector.rs"
Cohesion: 0.32
Nodes (3): MatchedRange, PlagiarismDetector, PlagiarismReport

### Community 119 - "test-phase3-mobile-hardening.mjs"
Cohesion: 0.17
Nodes (11): cssContent, cssPath, editorContent, editorPath, layoutContent, navContent, navPath, resizableLayoutPath (+3 more)

### Community 120 - "DbPool"
Cohesion: 0.31
Nodes (3): check_health(), create_connection_pool(), DbPool

### Community 121 - "TokenBucket"
Cohesion: 0.24
Nodes (3): DEFAULT_BURST_CAPACITY, DEFAULT_REFILL_RATE, TokenBucket

### Community 123 - "10. REFERENCE VOCABULARY (Pattern Names the Agent Should Know)"
Cohesion: 0.20
Nodes (10): 10. REFERENCE VOCABULARY (Pattern Names the Agent Should Know), Animation Library Choice, Cards & Containers, Galleries & Media, Hero Paradigms, Layout & Grids, Micro-Interactions & Effects, Navigation & Menus (+2 more)

### Community 124 - "Video Recording"
Cohesion: 0.20
Nodes (10): 1. Use Descriptive Filenames, 2. Record entire hero scripts., 3. Attach the recording to the pull request, Basic Recording, Best Practices, Cursor, Target Highlight and Click Point, Limitations, Overlay API Summary (+2 more)

### Community 125 - "`cli.cjs extract`"
Cohesion: 0.22
Nodes (7): changeset/ — release-notes tooling, `cli.cjs extract`, Examples, Exit codes, Flags, Output shape, Version validation

### Community 126 - "Cookies"
Cohesion: 0.22
Nodes (9): Advanced: Multiple Cookies or Custom Options, Clear All Cookies, Cookies, Delete a Cookie, Filter Cookies by Domain, Filter Cookies by Path, Get Specific Cookie, List All Cookies (+1 more)

### Community 127 - "2. Production 4-Phase Execution Roadmap (Phases 29–32)"
Cohesion: 0.22
Nodes (8): 1. Visual Invariants: Unified Refero Linear Midnight (`docs/DESIGN.md`), 2. Production 4-Phase Execution Roadmap (Phases 29–32), Phase 29: The Great Purge, `App.tsx` Repair, Consumer Polish & CSS Reset [COMPLETED], Phase 30: Production Linear-Native Hackathon Platform (`/hackathons`, `/hackathons/:slug` & Rust Backend Persistence), Phase 31: Production Multi-Tenant Campus Portal — Real Org Provisioning, Auth & Role-Gated Linear Shell (`/campus/*`), Phase 32: Real Telemetry-Driven Campus Analytics, 6-Stage Lab Execution Engine & E2E Playwright Verification, Technical Architecture Blueprint: Milestone v4.3 — Clean-Slate Linear Reset, "Unified Refero Linear Midnight Design System (`docs/DESIGN.md`), Real Rust-Backed Multi-Tenant Campus Portal & Full-Stack Hackathon Platform"

### Community 128 - "GEMINI.md"
Cohesion: 0.22
Nodes (8): Architecture, Constraints, Conventions, Developer Profile, GSD Workflow Enforcement, Project, Project Skills, Technology Stack

### Community 129 - "9. AI TELLS (Forbidden Patterns)"
Cohesion: 0.25
Nodes (8): 9.A Visual & CSS, 9. AI TELLS (Forbidden Patterns), 9.B Typography, 9.C Layout & Spacing, 9.D Content & Data ("Jane Doe" Effect), 9.E External Resources & Components, 9.F Production-Test Tells (banned outright), 9.G EM-DASH BAN (the single most-violated Tell)

### Community 130 - "Execution Workflow"
Cohesion: 0.25
Nodes (7): Execution Workflow, Image-to-Code Engineering Protocol, Objective, Step 1: Visual Deconstruction (Do Not Write Code Yet), Step 2: Design Token & Library Mapping, Step 3: High-Fidelity Implementation, Step 4: Visual Self-Audit Checklist

### Community 131 - "Advanced Mocking with run-code"
Cohesion: 0.25
Nodes (8): Advanced Mocking with run-code, CLI Route Commands, Conditional Response Based on Request, Delayed Response, Modify Real Response, Request Mocking, Simulate Network Failures, URL Patterns

### Community 132 - "Local Storage"
Cohesion: 0.25
Nodes (8): Advanced: Multiple Operations, Clear All localStorage, Delete Single Item, Get Single Value, List All localStorage Items, Local Storage, Set JSON Value, Set Value

### Community 133 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, lucide-react, monaco-editor, @monaco-editor/react, react, react-dom, react-router-dom, recharts

### Community 134 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 135 - "test-phase1-relative-endpoints.mjs"
Cohesion: 0.25
Nodes (7): apiContent, apiPath, navContent, navPath, rootDir, viteConfigPath, viteContent

### Community 136 - "APPENDICES - Real Source-Backed Reference Material"
Cohesion: 0.29
Nodes (6): APPENDICES - Real Source-Backed Reference Material, Appendix A - Install Commands per Design System, Appendix C - Apple Liquid Glass: Honest Web Approximation, Safer web approximation skeleton, What is NOT official, What is official

### Community 137 - "11. REDESIGN PROTOCOL"
Cohesion: 0.29
Nodes (7): 11.A Detect the Mode (first action), 11.B Audit Before Touching, 11.C Preservation Rules, 11.D Modernisation Levers (priority order), 11.E Decision Tree: Targeted Evolution vs Full Redesign, 11.F What Never Changes Silently, 11. REDESIGN PROTOCOL

### Community 138 - "3. DEFAULT ARCHITECTURE & CONVENTIONS"
Cohesion: 0.29
Nodes (7): 3.A Stack, 3.B State, 3.C Icons, 3.D Emoji Policy, 3. DEFAULT ARCHITECTURE & CONVENTIONS, 3.E Responsiveness & Layout Mechanics, 3.F Dependency Verification (mandatory)

### Community 139 - "6. PERFORMANCE & ACCESSIBILITY GUARDRAILS"
Cohesion: 0.29
Nodes (7): 6.A Hardware Acceleration, 6.B Reduced Motion (mandatory), 6.C Dark Mode (mandatory for any consumer-facing page), 6.D Core Web Vitals Targets, 6.E DOM Cost, 6.F Z-Index Restraint, 6. PERFORMANCE & ACCESSIBILITY GUARDRAILS

### Community 140 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, playwright, @rsbuild/core, @rsbuild/plugin-react, @types/react, @types/react-dom, typescript

### Community 141 - "audit-full-v43.mjs"
Cohesion: 0.38
Nodes (5): assertRootNotEmpty(), rootDir, scanDomStrings(), scanDomStyles(), stats

### Community 142 - "2. Critical Bugs & Runtime Exceptions (Blockers Resolved)"
Cohesion: 0.33
Nodes (6): 2.1 Missing React Hook Imports in `CampusLabsListPage.tsx`, 2.2 Role Switcher Route Desynchronization in `CampusSidebarLayout.tsx`, 2.3 Campus Organization Directory Seeding in `judge-gateway`, 2.4 Playwright Leaderboard View Assertion, 2.7 Silent Auth Refresh Handling, 2. Critical Bugs & Runtime Exceptions (Blockers Resolved)

### Community 143 - "12. THE BLOCK LIBRARY (Contract - Implementations Land Here Iteratively)"
Cohesion: 0.40
Nodes (5): 12.A File Location, 12.B Required Frontmatter, 12.C Required Body Sections, 12.D Block-Library Discipline, 12. THE BLOCK LIBRARY (Contract - Implementations Land Here Iteratively)

### Community 144 - "5. CONTEXT-AWARE PROACTIVITY"
Cohesion: 0.40
Nodes (5): 5.A Sticky-Stack - Canonical Skeleton, 5.B Horizontal-Pan - Canonical Skeleton, 5.C Scroll-Reveal Stagger - Canonical Skeleton (lighter alternative), 5. CONTEXT-AWARE PROACTIVITY, 5.D Forbidden Animation Patterns

### Community 145 - "8. DARK MODE PROTOCOL"
Cohesion: 0.40
Nodes (5): 8.A Token Strategy (pick one, stick to it), 8.B Do Not Prescribe Specific Colors Here, 8.C Default Mode, 8.D Test in Both Modes Before Finishing, 8. DARK MODE PROTOCOL

### Community 146 - "Schema Migration Engine Protocol"
Cohesion: 0.40
Nodes (4): Container Verification Pipeline, Objective, Safety & Compatibility Invariants, Schema Migration Engine Protocol

### Community 147 - "Strategic Context Compaction Protocol"
Cohesion: 0.40
Nodes (4): Boundary Decision Guidelines, Compaction Checklist, Operational Mandate, Strategic Context Compaction Protocol

### Community 148 - "Eval-Driven Verification Protocol"
Cohesion: 0.40
Nodes (4): Eval-Driven Verification Protocol, Phase 1: Test-First Regression Capture, Phase 2: Implementation & Green Verification, Phase 3: Project-Wide Sanity Check

### Community 149 - "Web Interface Guidelines"
Cohesion: 0.40
Nodes (4): Guidelines Source, How It Works, Usage, Web Interface Guidelines

### Community 150 - "Phase 34: Complete Copy Purge (Infrastructure Jargon -> Enterprise Product Voice) [COMPLETED & VERIFIED]"
Cohesion: 0.40
Nodes (5): 34.1 Problem Scope & Technical Audit, 34.2 Exact Files to Modify, 34.3 Target Deliverables & Copy Replacements, 34.4 Acceptance Criteria, Phase 34: Complete Copy Purge (Infrastructure Jargon -> Enterprise Product Voice) [COMPLETED & VERIFIED]

### Community 151 - "Systems Architect Specification"
Cohesion: 0.50
Nodes (3): Blueprint Output Requirements, Operational Boundaries, Systems Architect Specification

### Community 152 - "Code Reviewer and Security Critic Prompt"
Cohesion: 0.50
Nodes (3): Code Reviewer and Security Critic Prompt, Review Scope, Tone and Format

### Community 153 - "Quality & Acceptance Critic Protocol"
Cohesion: 0.50
Nodes (3): Quality & Acceptance Critic Protocol, Review Criteria, Verdict Output Format

### Community 154 - "Implementation Worker Protocol"
Cohesion: 0.50
Nodes (3): Delivery Checklist, Implementation Worker Protocol, Operational Mandates

### Community 155 - "Codebase Investigator Specification"
Cohesion: 0.50
Nodes (3): Codebase Investigator Specification, Operational Boundaries, Protocol

### Community 156 - "AST-Search-First Protocol"
Cohesion: 0.50
Nodes (3): AST-Search-First Protocol, Execution Rules, Operational Mandate

### Community 157 - "Domain-Specific Validation Rules"
Cohesion: 0.50
Nodes (3): Domain-Specific Validation Rules, Frontend UI Mutexes (`packages/frontend/src/`), Gateway & Backend Mutexes (`packages/gateway/`)

### Community 158 - "Event-Bus & Message Pipeline Guidelines"
Cohesion: 0.50
Nodes (3): Core Requirements, Event-Bus & Message Pipeline Guidelines, Operational Mandate

### Community 162 - "Continuous Behavioral Learning Protocol"
Cohesion: 0.50
Nodes (3): Confidence Scoring Thresholds, Continuous Behavioral Learning Protocol, Extraction Trigger

### Community 163 - "7. DIAL DEFINITIONS (Technical Reference)"
Cohesion: 0.50
Nodes (4): 7. DIAL DEFINITIONS (Technical Reference), DESIGN_VARIANCE (Level 1-10), MOTION_INTENSITY (Level 1-10), VISUAL_DENSITY (Level 1-10)

### Community 164 - "MembershipStatus"
Cohesion: 0.50
Nodes (4): MembershipStatus, Active, Invited, Suspended

### Community 165 - "Cloud-Judge V2 Vision & Feature Requirements"
Cohesion: 0.50
Nodes (3): Cloud-Judge V2 Vision & Feature Requirements, Commercial & Competition Features, Core Capabilities

### Community 166 - "Phase 1: Telemetry & Relative Endpoint Fixes"
Cohesion: 0.50
Nodes (4): 1.1 Problem Audit & Root Cause Analysis, 1.2 Architectural Specification, 1.3 Acceptance Criteria & Verification, Phase 1: Telemetry & Relative Endpoint Fixes

## Knowledge Gaps
- **123 isolated node(s):** `ADR-0894`, `ADR-1244`, `ADR-0857`, `ADR-2782`, `ADR-0959` (+118 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1398 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppState` connect `rbac.rs` to `routes/mod.rs`, `cockpit.rs`, `state.rs`, `campus.rs`, `auth.rs`, `create_router`, `deserialize`, `problems.rs`, `subscriptions.rs`, `test_cockpit_apis.rs`, `verify_razorpay_payment_handler`, `hackathons.rs`, `contests.rs`, `GatewayError`, `rate_limit.rs`, `routes/assessment.rs`, `DbPool`, `assessment_id.rs`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Are the 48 inferred relationships involving `create_router()` (e.g. with `main()` and `anonymous_model_backed_requests_are_rejected()`) actually correct?**
  _`create_router()` has 48 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0894`, `ADR-1244`, `ADR-0857` to the rest of the system?**
  _123 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `routes/mod.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.02492401215805471 - nodes in this community are weakly interconnected._
- **Why does `GatewayError` connect `GatewayError` to `cockpit.rs`, `VivaError`, `campus.rs`, `auth.rs`, `rbac.rs`, `subscriptions.rs`, `problems.rs`, `verify_razorpay_payment_handler`, `contests.rs`, `routes/assessment.rs`, `hackathons.rs`, `DbError`, `test_ai_debug.rs`, `assessment_id.rs`, `DomainError`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `cockpit.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09935710111046171 - nodes in this community are weakly interconnected._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04613807245386193 - nodes in this community are weakly interconnected._
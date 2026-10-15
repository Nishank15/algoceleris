# Graph Report - cloud-judge-v2  (2026-10-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2145 nodes · 4661 edges · 94 communities (75 shown, 19 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 178 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5ee507e2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 88
- Community 89

## God Nodes (most connected - your core abstractions)
1. `GatewayError` - 94 edges
2. `AppState` - 84 edges
3. `DbError` - 49 edges
4. `react` - 49 edges
5. `VivaError` - 40 edges
6. `lucide-react` - 38 edges
7. `fetchWithFallback()` - 35 edges
8. `WorkerError` - 34 edges
9. `create_router()` - 31 edges
10. `App()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `test_unauthenticated_request_returns_401()` --calls--> `create_router()`  [INFERRED]
  crates/judge-gateway/tests/test_rbac_extractors.rs → crates/judge-gateway/src/lib.rs
- `test_auth_http_login_refresh_logout_flow()` --calls--> `create_router()`  [INFERRED]
  crates/judge-gateway/tests/test_auth_gateway.rs → crates/judge-gateway/src/lib.rs
- `test_health_endpoints()` --calls--> `create_router()`  [INFERRED]
  crates/judge-gateway/tests/test_auth_gateway.rs → crates/judge-gateway/src/lib.rs
- `test_signup_and_registration_flow()` --calls--> `create_router()`  [INFERRED]
  crates/judge-gateway/tests/test_auth_gateway.rs → crates/judge-gateway/src/lib.rs
- `test_proctor_risk_score_aggregation()` --calls--> `calculate_risk_score()`  [INFERRED]
  crates/judge-core/tests/test_domain_invariants.rs → crates/judge-core/src/proctor.rs

## Import Cycles
- 2-file cycle: `crates/judge-worker/src/runner/engine.rs -> crates/judge-worker/src/runner/mod.rs -> crates/judge-worker/src/runner/engine.rs`

## Communities (94 total, 19 thin omitted)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (52): AccessTokenClaims, AuthenticatedUser, OptionalUser, RequireInstructor, RequireOrgAdmin, RequireStudent, resolve_target_assessment_id(), resolve_target_cohort_id() (+44 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (58): assembleChangelog(), cmdExtract(), cmdGithubReleaseNotes(), cmdRender(), cmdVerify(), {
  compareSemverCore,
  isStableTripletSemver,
}, { ExitError, runMain }, fs (+50 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (46): App(), CampusSidebarLayout(), CampusSidebarLayoutProps, CampusAnalyticsPage(), CampusFacultyDashboard(), CampusLabReviewPage(), ReviewTab, CampusLabRoomPage() (+38 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (53): AIDebugModal(), AIDebugModalProps, CodeEditorProps, DeveloperAnalyticsModal(), DeveloperAnalyticsModalProps, diffTokens(), DiffViewer(), DiffViewerProps (+45 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (53): PROBLEMS, AssessmentCreatePage(), CampusCalendarPage(), calculateRiskScore(), FacultyProctorCockpitPage(), resolveRiskSeverity(), STARTER_CODES, StudentExamArenaPage() (+45 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (47): barHeight(), BG_FALLBACK, buildGrid(), Cam, camera(), Cell, clamp01(), computeStats() (+39 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (47): barHeight(), BG_FALLBACK, buildGrid(), Cam, camera(), Cell, clamp01(), computeStats() (+39 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (18): calculate_late_penalty(), transition_assessment_state(), validate_assessment_timeline(), validate_rubric_balance(), DomainError, AssessmentClosed, CutoffExceeded, InvalidPenalty (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (38): ContestLeaderboardModal(), ContestLeaderboardModalProps, MicroSandboxTeaser(), SNIPPETS, useContestProctoring(), UseContestProctoringOptions, LandingPage(), ProblemWorkspacePage() (+30 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (35): buildRegistry(), CAPABILITIES_DIR, capValidator, ADR-0894, CLUSTERS(), CLUSTERS_PATH, CONFIG_SCHEMA_PATH, deriveCapabilityClusters() (+27 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (24): { basename }, MARKED_SUITES, playwright, __dirname, __filename, ROOT_DIR, SNAPSHOT_DIR, backendPool (+16 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (32): dependencies, lucide-react, monaco-editor, @monaco-editor/react, react, react-dom, react-router-dom, recharts (+24 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (18): DbError, Domain, ForeignKeyViolation, NotFound, PoolError, SerializationError, Sqlx, UniqueViolation (+10 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (28): assertPointsCoverage(), buildContract(), CANONICAL_POINTS, ADR-0894, CONTRACT_PATH, coveredKindsInRegion(), crossCheckRoleFamilies(), crossCheckRoles() (+20 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (12): generate_test_token(), setup_test_assessment(), test_live_postgres_cockpit_and_viva_if_available(), test_private_rubric_endpoint_permits_instructor_and_rejects_candidates(), test_proctor_cockpit_returns_aggregated_anomaly_counts_and_risk_tiering(), test_student_accessing_cockpit_endpoint_returns_403_forbidden(), test_viva_escalation_successfully_provisions_new_room_record(), generate_test_token() (+4 more)

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (12): AwarenessEnvelope, decode(), encode(), format_viva_channel(), TABLE, VivaClusterMessage, Awareness, CrdtUpdate (+4 more)

### Community 18 - "Community 18"
Cohesion: 0.10
Nodes (28): Assessment, AssessmentMode, Exam, Homework, Viva, AssessmentStatus, Active, Closed (+20 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (11): AssessmentSubmission, AssessmentSubmissionRecord, Cohort, CohortRecord, InterviewRoomRecord, Organization, OrganizationRecord, OrgMembershipRecord (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.18
Nodes (18): verify_password(), encode_access_token(), AvailabilityQuery, AvailabilityResponse, check_availability_handler(), clear_refresh_cookie(), DbUser, extract_refresh_token() (+10 more)

### Community 21 - "Community 21"
Cohesion: 0.16
Nodes (15): determine_stream_role(), get_submission_handler(), GetSubmissionResponse, handle_submission_socket(), mask_test_case_json(), mask_test_case_results(), SECRET_TEST_MASK, StreamParams (+7 more)

### Community 22 - "Community 22"
Cohesion: 0.10
Nodes (14): WorkerError, CgroupError, Domain, Io, NamespaceError, ParseError, PermissionDenied, SyscallError (+6 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (11): create_router(), main(), shutdown_signal(), generate_test_token(), test_admin_query_receives_unmasked_details(), test_candidate_query_masks_secret_test_cases(), test_instructor_query_receives_unmasked_details(), test_live_redis_intake_queue_and_pubsub_masking() (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (15): hash_password(), ACCESS_TOKEN_EXPIRATION_SECONDS, decode_access_token(), decode_refresh_token(), DEFAULT_JWT_SECRET, encode_refresh_token(), REFRESH_TOKEN_EXPIRATION_SECONDS, RefreshTokenClaims (+7 more)

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (4): setup_viva_server(), test_candidate_rubric_masking_invariant(), test_evaluator_frame_delivery(), viva_ws_endpoint()

### Community 27 - "Community 27"
Cohesion: 0.12
Nodes (15): TokenStore, GatewayError, BadRequest, Conflict, Database, Domain, Forbidden, InternalError (+7 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (19): CampusProvisionRequest, CampusProvisionResponse, create_or_join_team_handler(), get_hackathon_detail_handler(), HackathonDetailResponse, HackathonMilestoneItem, HackathonRegisterRequest, HackathonRegisterResponse (+11 more)

### Community 29 - "Community 29"
Cohesion: 0.20
Nodes (10): Submission, SubmissionRecord, create_submission(), finalize_assessment_submission(), get_assessment_submission(), get_submission_by_id(), SubmissionRepository, SubmissionRepository<'a> (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.21
Nodes (14): CandidateCockpitSummary, get_proctor_cockpit_handler(), get_viva_rubric_handler(), handle_proctor_socket(), handle_viva_socket(), proctor_stream_handler(), ProctorCockpitResponse, provision_viva_escalation_handler() (+6 more)

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (5): AWARENESS_BROADCAST_CAPACITY, CRDT_BROADCAST_CAPACITY, RUBRIC_BROADCAST_CAPACITY, VivaRoom, VivaRoomManager

### Community 32 - "Community 32"
Cohesion: 0.08
Nodes (21): appTsxPath, appTsxSrc, arenaPagePath, arenaSrc, baseTime, campusApiPath, campusApiSrc, cutoffTime (+13 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (14): RiskScore, RiskSeverity, Critical, Elevated, Low, calculate_risk_score(), CandidateProctorState, ProctorAlertFrame (+6 more)

### Community 34 - "Community 34"
Cohesion: 0.15
Nodes (12): AstTokenizer, is_comment(), is_identifier(), is_literal(), StructuralToken, walk_ast(), compute_kgram_hashes(), Fingerprint (+4 more)

### Community 35 - "Community 35"
Cohesion: 0.16
Nodes (21): LinearHeaderNav(), AuthContext, AuthContextType, AuthProvider(), restoreSession(), GUEST_USER, mapAuthUser(), useAuth() (+13 more)

### Community 36 - "Community 36"
Cohesion: 0.11
Nodes (10): TelemetryError, ChannelClosed, ConnectionError, IdentityMismatch, Json, RateLimitExceeded, Redis, SerializationError (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.11
Nodes (6): handle_telemetry_socket(), CLIENT_OUTBOUND_QUEUE_CAPACITY, handle_viva_socket(), VivaWsClientMessage, Awareness, RubricEvaluation

### Community 38 - "Community 38"
Cohesion: 0.09
Nodes (3): VivaDoc, .SHARED_TEXT_NAME, test_cgroup_controller_with_mock_filesystem()

### Community 39 - "Community 39"
Cohesion: 0.18
Nodes (19): ProblemsPage(), SortField, SortOrder, DIFF_COLORS, hashString(), LANGS, ProfilePage(), rankTitle() (+11 more)

### Community 40 - "Community 40"
Cohesion: 0.13
Nodes (4): CppRunner, JavaRunner, CommandConfig, PythonRunner

### Community 41 - "Community 41"
Cohesion: 0.16
Nodes (19): ADR-3889, CONTRACT_VERSION_KEY, exitCodeFor(), exitCodeRegistryModule, findExitContractFlag(), getContractVersion(), getJsonErrorMode(), getPendingOutcome() (+11 more)

### Community 42 - "Community 42"
Cohesion: 0.10
Nodes (13): Verdict, Accepted, CompilationError, MemoryLimitExceeded, Pending, RuntimeError, TimeLimitExceeded, WrongAnswer (+5 more)

### Community 43 - "Community 43"
Cohesion: 0.10
Nodes (18): appTsxPath, appTsxSrc, calendarPagePath, calendarPageSrc, campusApiPath, campusApiSrc, createPagePath, createPageSrc (+10 more)

### Community 44 - "Community 44"
Cohesion: 0.12
Nodes (13): VivaError, CrdtSyncError, DatabaseError, Domain, InvalidRubricEvaluation, Json, ProtocolError, Redis (+5 more)

### Community 45 - "Community 45"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 47 - "Community 47"
Cohesion: 0.24
Nodes (14): ai_debug_handler(), AIDebugRequest, AIDebugResponse, create_razorpay_order_handler(), create_stripe_checkout_handler(), EntitlementsResponse, get_entitlements_handler(), RazorpayOrderRequest (+6 more)

### Community 48 - "Community 48"
Cohesion: 0.14
Nodes (7): persist_rubric_evaluation(), RubricEvaluationUpdate, VivaWsServerMessage, Awareness, Error, RubricEvaluation, test_rubric_score_math_and_persistence()

### Community 49 - "Community 49"
Cohesion: 0.27
Nodes (11): build_mock_leaderboard(), contest_leaderboard_ws_handler(), ContestProblemSummary, ContestSummary, get_contest_handler(), get_contest_leaderboard_handler(), get_global_leaderboard_handler(), handle_leaderboard_socket() (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.12
Nodes (13): appTsxPath, appTsxSrc, campusApiPath, campusApiSrc, criteria, indexCssPath, indexCssSrc, parsedAwareness (+5 more)

### Community 51 - "Community 51"
Cohesion: 0.18
Nodes (14): buildColonPattern(), buildPattern(), COMMANDS_DIR, EXTENSIONS, fs, isTestFile(), path, processDir() (+6 more)

### Community 52 - "Community 52"
Cohesion: 0.14
Nodes (12): ARCH_MAP, CACHE_DIR, CACHED_BIN_PATH, { ExitError }, extractFileFromTar(), fs, https, httpsGetFollowingRedirects() (+4 more)

### Community 53 - "Community 53"
Cohesion: 0.27
Nodes (10): generate_test_token(), setup_test_hierarchy(), test_chronological_timeline_validation_rejects_malformed_dates(), test_faculty_force_submit_and_status_transition(), test_grace_period_submission_calculates_ceiling_hour_late_penalty(), test_live_postgres_assessment_lifecycle_if_available(), test_on_time_submission_accepts_with_zero_deduction(), test_post_cutoff_submission_strictly_rejected_with_403() (+2 more)

### Community 56 - "Community 56"
Cohesion: 0.25
Nodes (7): NewMember, batch_insert_memberships(), build_batch_insert_query(), list_cohort_memberships(), MembershipRepository, MembershipRepository<'a>, test_benchmark_batch_roster_query_construction_5000()

### Community 57 - "Community 57"
Cohesion: 0.30
Nodes (7): ProctorEventCounts, get_candidate_event_counts(), list_assessment_events(), ProctorRepository, ProctorRepository<'a>, record_proctor_event(), test_proctor_event_repository_flow()

### Community 58 - "Community 58"
Cohesion: 0.26
Nodes (11): ContestRatingPoint, DailyContributionPoint, DifficultyBreakdown, DifficultyStats, get_user_profile_handler(), GuestSubmissionItem, migrate_guest_submissions_handler(), MigrateGuestSubmissionsRequest (+3 more)

### Community 59 - "Community 59"
Cohesion: 0.23
Nodes (6): AwarenessMessage, CursorMove, PeerLeave, PresenceUpdate, CursorPosition, PeerPresence

### Community 60 - "Community 60"
Cohesion: 0.13
Nodes (14): ACID_LIME, AMBER, BEDROCK_VOID, CARBON, CORAL_RED, Difficulty, DIFFICULTY_COLORS, GRAPHITE_BORDER (+6 more)

### Community 61 - "Community 61"
Cohesion: 0.16
Nodes (11): cfgContent, createMockServer(), HAPROXY_CFG, HAPROXY_PID, makeHttpRequest(), makeWebSocketUpgrade(), nodes, requestCounts (+3 more)

### Community 62 - "Community 62"
Cohesion: 0.18
Nodes (9): fs, isInsideRoot(), isUnderSkippedDir(), path, regexScanStats, scanTree(), SKIP_DIR_NAMES, walk() (+1 more)

### Community 63 - "Community 63"
Cohesion: 0.25
Nodes (3): MatchedRange, PlagiarismDetector, PlagiarismReport

### Community 64 - "Community 64"
Cohesion: 0.15
Nodes (12): applyTelemetryEvent(), appTsxPath, appTsxSrc, calculateRiskScore(), campusApiPath, campusApiSrc, cockpitPagePath, cockpitSrc (+4 more)

### Community 65 - "Community 65"
Cohesion: 0.21
Nodes (12): ADJECTIVES, ALLOWED_TYPES, { ExitError, runMain }, fs, generateFragmentName(), main(), NOUNS_A, NOUNS_B (+4 more)

### Community 66 - "Community 66"
Cohesion: 0.21
Nodes (3): TelemetryMesh, TelemetryRelay, .LOCAL_BROADCAST_CAPACITY

### Community 67 - "Community 67"
Cohesion: 0.18
Nodes (7): SeccompAction, Allow, Errno, KillProcess, KillThread, Trap, SyscallPolicy

### Community 68 - "Community 68"
Cohesion: 0.28
Nodes (12): buildFallbackContests(), ContestsPage(), derivePhase(), fallbackLeaderboard(), formatCountdown(), mkProblems(), pad2(), participantCount() (+4 more)

### Community 69 - "Community 69"
Cohesion: 0.24
Nodes (9): CodeEditor(), LINEAR_MIDNIGHT_THEME, LINEAR_MIDNIGHT_THEME_NAME, getInitialTheme(), Theme, ThemeContext, ThemeContextType, ThemeProvider() (+1 more)

### Community 70 - "Community 70"
Cohesion: 0.17
Nodes (11): cssContent, cssPath, editorContent, editorPath, layoutContent, navContent, navPath, resizableLayoutPath (+3 more)

### Community 71 - "Community 71"
Cohesion: 0.31
Nodes (3): check_health(), create_connection_pool(), DbPool

### Community 72 - "Community 72"
Cohesion: 0.24
Nodes (3): DEFAULT_BURST_CAPACITY, DEFAULT_REFILL_RATE, TokenBucket

### Community 74 - "Community 74"
Cohesion: 0.18
Nodes (6): RFC-7807, consoleErrors, http500Errors, pageErrors, rootDir, snapshotDir

### Community 76 - "Community 76"
Cohesion: 0.22
Nodes (6): fs, payload, prohibitedPatterns, command, fs, input

### Community 78 - "Community 78"
Cohesion: 0.25
Nodes (5): DEFAULT_CGROUP_ROOT, DEFAULT_CPU_MAX_QUOTA, DEFAULT_MEMORY_HIGH_BYTES, DEFAULT_MEMORY_MAX_BYTES, DEFAULT_SWAP_MAX_BYTES

### Community 79 - "Community 79"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 80 - "Community 80"
Cohesion: 0.25
Nodes (7): apiContent, apiPath, navContent, navPath, rootDir, viteConfigPath, viteContent

### Community 81 - "Community 81"
Cohesion: 0.29
Nodes (4): ADR-3889, CODE_TO_NAME, EXIT_CODES, NAME_TO_CODE

### Community 82 - "Community 82"
Cohesion: 0.29
Nodes (5): cssContent, indexCssPath, lightMutedHex, lightThemeMatch, rootDir

### Community 83 - "Community 83"
Cohesion: 0.67
Nodes (6): judge-core, judge-db, judge-gateway, judge-telemetry, judge-viva, judge-worker

## Knowledge Gaps
- **111 isolated node(s):** `ADR-0894`, `ADR-0857`, `ADR-0959`, `ADR-1016`, `ADR-1244` (+106 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 726 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `playwright` connect `Community 11` to `Community 12`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **What connects `ADR-0894`, `ADR-0857`, `ADR-0959` to the rest of the system?**
  _111 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.032175032175032175 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Community 3` to `Community 35`, `Community 4`, `Community 69`, `Community 6`, `Community 7`, `Community 5`, `Community 9`, `Community 68`, `Community 39`, `Community 12`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07339878447872837 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05223880597014925 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07372229760289462 - nodes in this community are weakly interconnected._
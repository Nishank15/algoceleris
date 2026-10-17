//! # judge-gateway
//!
//! Production Axum gateway, Tower middleware, dual-token authentication,
//! and campus examination routing.

pub mod auth;
pub mod errors;
pub mod extractors;
pub mod routes;
pub mod state;

pub use auth::{
    decode_access_token, decode_refresh_token, encode_access_token, encode_refresh_token,
    hash_password, verify_password, AccessTokenClaims, RefreshTokenClaims, TokenStore,
    ACCESS_TOKEN_EXPIRATION_SECONDS, DEFAULT_JWT_SECRET, REFRESH_TOKEN_EXPIRATION_SECONDS,
};
pub use errors::{GatewayError, ProblemDetails};
pub use extractors::{
    role_level, AuthenticatedUser, RequireInstructor, RequireOrgAdmin, RequireStudent,
};
pub use routes::{
    add_org_roster_member_handler, ai_debug_handler, batch_ingest_members_handler,
    campus_login_handler, check_availability_handler, contest_leaderboard_ws_handler,
    create_assessment_handler, create_campus_lab_handler, create_cohort_assessment_handler,
    create_cohort_handler, create_or_join_team_handler, create_organization_handler,
    create_razorpay_order_handler, create_stripe_checkout_handler, force_submit_assessment_handler,
    get_assessment_handler, get_campus_admin_audit_handler, get_campus_lab_detail_handler,
    get_campus_labs_handler, get_cohort_roster_handler, get_contest_handler,
    get_contest_leaderboard_handler, get_entitlements_handler, get_global_leaderboard_handler,
    get_hackathon_detail_handler, get_org_roster_by_slug_handler, get_organization_handler,
    get_problem_handler, get_proctor_cockpit_handler, get_student_analytics_handler,
    get_submission_handler, get_user_profile_handler, get_viva_rubric_handler,
    grant_time_accommodation_handler, health_handler, list_cohort_assessments_handler,
    list_contests_handler, list_hackathons_handler, list_organizations_handler,
    list_problems_handler, login_handler, logout_handler, mask_test_case_json,
    mask_test_case_results, me_handler, migrate_guest_submissions_handler, proctor_stream_handler,
    provision_organization_handler, provision_viva_escalation_handler,
    record_campus_lab_activity_handler, refresh_handler, register_hackathon_handler,
    register_handler, submission_stream_handler, submit_assessment_solution_handler,
    submit_campus_lab_handler, submit_code_handler, submit_hackathon_project_handler,
    update_assessment_status_handler, update_viva_rubric_handler,
    upvote_hackathon_submission_handler, verify_razorpay_payment_handler, viva_room_ws_handler,
    AddRosterMemberRequest, AIDebugRequest, AIDebugResponse, AssessmentResponse, AvailabilityQuery,
    AvailabilityResponse, BatchIngestRequest, BatchIngestResponse, BatchMemberItem,
    CampusLoginRequest, CampusLoginResponse, CampusOrgSummary, CampusProvisionRequest,
    CampusProvisionResponse, CampusUserProfile, CandidateCockpitSummary, CohortResponse,
    ContestProblemSummary, ContestRatingPoint, ContestSummary, CreateAssessmentRequest,
    CreateCohortRequest, CreateOrganizationRequest, DailyContributionPoint, DifficultyBreakdown,
    DifficultyStats, EntitlementsResponse, ForceSubmitRequest, ForceSubmitResponse,
    GetSubmissionResponse, GrantAccommodationRequest, GrantAccommodationResponse,
    GuestSubmissionItem, HealthResponse, LeaderboardEntry, LoginRequest,
    MigrateGuestSubmissionsRequest, MigrateGuestSubmissionsResponse, OrganizationResponse,
    Problem, ProblemScoreInfo, ProctorCockpitResponse, ProfileStats, ProvisionVivaRequest,
    ProvisionVivaResponse, RazorpayOrderRequest, RazorpayOrderResponse, RazorpayVerifyRequest,
    RazorpayVerifyResponse, RegisterRequest, RosterMemberResponse, RosterQuery, StreamParams,
    StripeCheckoutRequest, StripeCheckoutResponse, SubmissionJob, SubmitAssessmentRequest,
    SubmitAssessmentResponse, SubmitCodeRequest, SubmitCodeResponse, TestCaseItem,
    TestCaseResult, TokenResponse, UpdateAssessmentStatusRequest, UpdateVivaRubricRequest,
    UserProfileResponse, UserResponse, VivaRubricResponse, SECRET_TEST_MASK,
};
pub use state::AppState;

use axum::routing::{get, patch, post};
use axum::Router;
use tower_http::compression::CompressionLayer;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

/// Builds and mounts all Axum gateway endpoints and Tower middleware.
#[allow(clippy::too_many_lines)]
pub fn create_router(state: AppState) -> Router {
    Router::new()
        // Health
        .route("/health", get(health_handler))
        .route("/api/v1/health", get(health_handler))
        // Auth
        .route("/api/v1/auth/login", post(login_handler))
        .route(
            "/api/v1/auth/signup",
            post(register_handler),
        )
        .route(
            "/api/v1/auth/register",
            post(register_handler),
        )
        .route("/api/v1/auth/refresh", post(refresh_handler))
        .route("/api/v1/auth/logout", post(logout_handler))
        .route("/api/v1/auth/me", get(me_handler))
        .route(
            "/api/v1/auth/check-availability",
            get(check_availability_handler),
        )
        // Problems Catalog
        .route("/api/v1/problems", get(list_problems_handler))
        .route("/api/v1/problems/{slug}", get(get_problem_handler))
        // Users & Analytics
        .route("/api/v1/users/{username}", get(get_user_profile_handler))
        .route(
            "/api/v1/users/{username}/profile",
            get(get_user_profile_handler),
        )
        .route(
            "/api/v1/users/submissions/migrate-guest",
            post(migrate_guest_submissions_handler),
        )
        // Contests & Leaderboard
        .route("/api/v1/contests", get(list_contests_handler))
        .route("/api/v1/contests/{contest_id}", get(get_contest_handler))
        .route(
            "/api/v1/contests/{contest_id}/leaderboard",
            get(get_contest_leaderboard_handler),
        )
        .route("/api/v1/leaderboard", get(get_global_leaderboard_handler))
        .route(
            "/ws/contests/{contest_id}/leaderboard",
            get(contest_leaderboard_ws_handler),
        )
        // Subscriptions & Monetization
        .route(
            "/api/v1/subscriptions/entitlements/{user_id}",
            get(get_entitlements_handler),
        )
        .route(
            "/api/v1/subscriptions/stripe/create-checkout-session",
            post(create_stripe_checkout_handler),
        )
        .route(
            "/api/v1/subscriptions/razorpay/create-order",
            post(create_razorpay_order_handler),
        )
        .route(
            "/api/v1/subscriptions/razorpay/verify-payment",
            post(verify_razorpay_payment_handler),
        )
        // AI Debugging Assistant
        .route("/api/v1/ai/debug", post(ai_debug_handler))
        // Campus Organizations, Provisioning & Institutional Auth
        .route(
            "/api/v1/campus/orgs",
            post(create_organization_handler).get(list_organizations_handler),
        )
        .route(
            "/api/v1/campus/orgs/provision",
            post(provision_organization_handler),
        )
        .route("/api/v1/campus/auth/login", post(campus_login_handler))
        .route(
            "/api/v1/campus/orgs/{org_slug}/roster",
            get(get_org_roster_by_slug_handler).post(add_org_roster_member_handler),
        )
        // Phase 32: 6-Stage Lab Execution Engine & Dynamic Telemetry
        .route(
            "/api/v1/campus/{org_slug}/labs",
            get(get_campus_labs_handler).post(create_campus_lab_handler),
        )
        .route(
            "/api/v1/campus/{org_slug}/labs/{lab_id}",
            get(get_campus_lab_detail_handler),
        )
        .route(
            "/api/v1/campus/{org_slug}/labs/{lab_id}/activity",
            post(record_campus_lab_activity_handler),
        )
        .route(
            "/api/v1/campus/{org_slug}/labs/{lab_id}/submit",
            post(submit_campus_lab_handler),
        )
        .route(
            "/api/v1/campus/{org_slug}/analytics/student",
            get(get_student_analytics_handler),
        )
        .route(
            "/api/v1/campus/{org_slug}/admin/audit",
            get(get_campus_admin_audit_handler),
        )
        .route("/api/v1/campus/orgs/{org_id}", get(get_organization_handler))
        .route(
            "/api/v1/campus/orgs/{org_id}/cohorts",
            post(create_cohort_handler),
        )
        .route(
            "/api/v1/campus/cohorts/{cohort_id}/roster",
            get(get_cohort_roster_handler),
        )
        .route(
            "/api/v1/campus/orgs/{org_id}/members/batch",
            post(batch_ingest_members_handler),
        )
        // Assessment Lifecycle & Deadline Gatekeeper
        .route("/api/v1/campus/assessments", post(create_assessment_handler))
        .route(
            "/api/v1/campus/cohorts/{cohort_id}/assessments",
            post(create_cohort_assessment_handler).get(list_cohort_assessments_handler),
        )
        .route(
            "/api/v1/campus/assessments/{assessment_id}",
            get(get_assessment_handler),
        )
        .route(
            "/api/v1/campus/assessments/{assessment_id}/submit",
            post(submit_assessment_solution_handler),
        )
        .route(
            "/api/v1/campus/assessments/{assessment_id}/accommodations",
            post(grant_time_accommodation_handler),
        )
        .route(
            "/api/v1/campus/assessments/{assessment_id}/force-submit",
            post(force_submit_assessment_handler),
        )
        .route(
            "/api/v1/campus/assessments/{assessment_id}/status",
            patch(update_assessment_status_handler),
        )
        // Proctoring Cockpit & Viva Escalation Management
        .route(
            "/api/v1/campus/assessments/{assessment_id}/cockpit",
            get(get_proctor_cockpit_handler),
        )
        .route(
            "/api/v1/campus/assessments/{assessment_id}/viva/provision",
            post(provision_viva_escalation_handler),
        )
        .route(
            "/api/v1/campus/viva/{room_code}/rubric",
            get(get_viva_rubric_handler).patch(update_viva_rubric_handler),
        )
        // Hackathons & Developer Competitions
        .route("/api/v1/hackathons", get(list_hackathons_handler))
        .route(
            "/api/v1/hackathons/{slug}",
            get(get_hackathon_detail_handler),
        )
        .route(
            "/api/v1/hackathons/{slug}/register",
            post(register_hackathon_handler),
        )
        .route(
            "/api/v1/hackathons/{slug}/teams",
            post(create_or_join_team_handler),
        )
        .route(
            "/api/v1/hackathons/{slug}/submissions",
            post(submit_hackathon_project_handler),
        )
        .route(
            "/api/v1/hackathons/{slug}/submissions/{id}/upvote",
            post(upvote_hackathon_submission_handler),
        )
        // Code Evaluation Intake & WebSocket Stream (Secret Test Masking Invariant)
        .route("/api/v1/submissions", post(submit_code_handler))
        .route("/api/v1/submissions/{id}", get(get_submission_handler))
        .route("/ws/submissions/{id}", get(submission_stream_handler))
        .route(
            "/ws/campus/assessments/{assessment_id}/proctor",
            get(proctor_stream_handler),
        )
        .route("/ws/campus/viva/{room_code}", get(viva_room_ws_handler))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .with_state(state)
}

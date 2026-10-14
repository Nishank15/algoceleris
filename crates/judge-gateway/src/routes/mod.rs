pub mod assessment;
pub mod auth;
pub mod campus;
pub mod cockpit;
pub mod contests;
pub mod health;
pub mod problems;
pub mod submission;
pub mod subscriptions;
pub mod users;

pub use auth::{
    check_availability_handler, login_handler, logout_handler, me_handler, refresh_handler,
    register_handler, AvailabilityQuery, AvailabilityResponse, LoginRequest, RegisterRequest,
    TokenResponse, UserResponse,
};
pub use contests::{
    contest_leaderboard_ws_handler, get_contest_handler, get_contest_leaderboard_handler,
    get_global_leaderboard_handler, list_contests_handler, ContestProblemSummary, ContestSummary,
    LeaderboardEntry, ProblemScoreInfo,
};
pub use problems::{get_problem_handler, list_problems_handler, Problem, TestCaseItem};
pub use subscriptions::{
    ai_debug_handler, create_razorpay_order_handler, create_stripe_checkout_handler,
    get_entitlements_handler, verify_razorpay_payment_handler, AIDebugRequest, AIDebugResponse,
    EntitlementsResponse, RazorpayOrderRequest, RazorpayOrderResponse, RazorpayVerifyRequest,
    RazorpayVerifyResponse, StripeCheckoutRequest, StripeCheckoutResponse,
};
pub use users::{
    get_user_profile_handler, migrate_guest_submissions_handler, ContestRatingPoint,
    DailyContributionPoint, DifficultyBreakdown, DifficultyStats, GuestSubmissionItem,
    MigrateGuestSubmissionsRequest, MigrateGuestSubmissionsResponse, ProfileStats,
    UserProfileResponse,
};

pub use cockpit::{
    get_proctor_cockpit_handler, get_viva_rubric_handler, proctor_stream_handler,
    provision_viva_escalation_handler, update_viva_rubric_handler, viva_room_ws_handler,
    CandidateCockpitSummary, ProctorCockpitResponse, ProvisionVivaRequest, ProvisionVivaResponse,
    UpdateVivaRubricRequest, VivaRubricResponse,
};

pub use submission::{
    get_submission_handler, mask_test_case_json, mask_test_case_results,
    submission_stream_handler, submit_code_handler, GetSubmissionResponse, StreamParams,
    SubmissionJob, SubmitCodeRequest, SubmitCodeResponse, TestCaseResult, SECRET_TEST_MASK,
};

pub use assessment::{
    create_assessment_handler, create_cohort_assessment_handler, force_submit_assessment_handler,
    get_assessment_handler, grant_time_accommodation_handler, list_cohort_assessments_handler,
    resolve_dynamic_status, submit_assessment_solution_handler, update_assessment_status_handler,
    AssessmentResponse, CreateAssessmentRequest, ForceSubmitRequest, ForceSubmitResponse,
    GrantAccommodationRequest, GrantAccommodationResponse, SubmitAssessmentRequest,
    SubmitAssessmentResponse, UpdateAssessmentStatusRequest,
};
pub use campus::{
    batch_ingest_members_handler, create_cohort_handler, create_organization_handler,
    get_cohort_roster_handler, get_organization_handler, BatchIngestRequest, BatchIngestResponse,
    BatchMemberItem, CohortResponse, CreateCohortRequest, CreateOrganizationRequest,
    OrganizationResponse, RosterMemberResponse,
};
pub use health::{health_handler, HealthResponse};

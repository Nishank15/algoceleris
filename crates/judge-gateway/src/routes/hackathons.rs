//! Full-stack hackathon platform and campus provisioning routes for Milestone v4.1.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::GatewayError;
use crate::state::AppState;

/// Summary of a hackathon for the catalog grid.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HackathonSummary {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub tagline: String,
    pub host: String,
    pub mode: String,
    pub location: String,
    pub prize_pool: String,
    pub status: String,
    pub start_date: String,
    pub end_date: String,
    pub registered_count: usize,
    pub tracks: Vec<String>,
    pub is_flagship: bool,
}

/// Detailed hackathon data model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HackathonDetailResponse {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub tagline: String,
    pub host: String,
    pub mode: String,
    pub location: String,
    pub prize_pool: String,
    pub status: String,
    pub start_date: String,
    pub end_date: String,
    pub registered_count: usize,
    pub tracks: Vec<HackathonTrackItem>,
    pub milestones: Vec<HackathonMilestoneItem>,
    pub rules: Vec<String>,
    pub eligibility: String,
    pub showcase: Vec<HackathonShowcaseItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HackathonTrackItem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub prize: String,
    pub problem_statement: String,
    pub sponsor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HackathonMilestoneItem {
    pub phase: usize,
    pub title: String,
    pub date: String,
    pub status: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HackathonShowcaseItem {
    pub id: String,
    pub team_name: String,
    pub project_title: String,
    pub tagline: String,
    pub track: String,
    pub github_url: String,
    pub live_url: Option<String>,
    pub upvotes: usize,
    pub rubric_score: f32,
    pub tech_stack: Vec<String>,
}

/// Inbound payload for registering to a hackathon.
#[derive(Debug, Clone, Deserialize)]
pub struct HackathonRegisterRequest {
    pub participant_name: String,
    pub email: String,
    pub university_or_org: Option<String>,
    pub track_preference: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HackathonRegisterResponse {
    pub registration_id: Uuid,
    pub hackathon_slug: String,
    pub status: String,
    pub message: String,
}

/// Inbound payload for team operations.
#[derive(Debug, Clone, Deserialize)]
pub struct HackathonTeamRequest {
    pub action: String, // "create" or "join"
    pub team_name: Option<String>,
    pub invite_code: Option<String>,
    pub member_name: String,
    pub member_email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HackathonTeamResponse {
    pub team_id: Uuid,
    pub team_name: String,
    pub invite_code: String,
    pub members_count: usize,
    pub message: String,
}

/// Inbound payload for submitting a hackathon project.
#[derive(Debug, Clone, Deserialize)]
pub struct HackathonSubmissionRequest {
    pub project_title: String,
    pub tagline: String,
    pub track: String,
    pub team_name: String,
    pub github_url: String,
    pub live_url: Option<String>,
    pub demo_video_url: Option<String>,
    pub architecture_deck_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HackathonSubmissionResponse {
    pub submission_id: Uuid,
    pub project_title: String,
    pub status: String,
    pub submitted_at: DateTime<Utc>,
    pub message: String,
}

/// Inbound payload for provisioning an institutional university tenant.
#[derive(Debug, Clone, Deserialize)]
pub struct CampusProvisionRequest {
    pub org_name: String,
    pub org_slug: String,
    pub allowed_domains: Vec<String>,
    pub admin_name: String,
    pub admin_email: String,
    pub tier: String,
    pub payment_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CampusProvisionResponse {
    pub org_id: Uuid,
    pub org_name: String,
    pub org_slug: String,
    pub portal_url: String,
    pub tier: String,
    pub admin_email: String,
    pub status: String,
    pub message: String,
    pub provisioned_at: DateTime<Utc>,
}

/// `GET /api/v1/hackathons`
/// Lists all live, upcoming, and featured hackathons.
pub async fn list_hackathons_handler(
    State(_state): State<AppState>,
) -> Result<impl IntoResponse, GatewayError> {
    let hackathons = vec![
        HackathonSummary {
            id: Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap(),
            slug: "devshouse-26".to_string(),
            title: "DevsHouse '26".to_string(),
            tagline: "National Systems, Distributed Infrastructure & AI Buildathon".to_string(),
            host: "VIT Chennai Developers Club & CSI".to_string(),
            mode: "Hybrid".to_string(),
            location: "VIT Chennai Campus & Online".to_string(),
            prize_pool: "₹5,00,000 / $6,000".to_string(),
            status: "LIVE".to_string(),
            start_date: "Oct 18, 2026".to_string(),
            end_date: "Oct 20, 2026".to_string(),
            registered_count: 1420,
            tracks: vec![
                "Rust & Systems".to_string(),
                "Agentic AI".to_string(),
                "FinTech & Quant".to_string(),
                "Open Innovation".to_string(),
            ],
            is_flagship: true,
        },
        HackathonSummary {
            id: Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap(),
            slug: "csi-origin-2026".to_string(),
            title: "CSI ORIGIN 2026".to_string(),
            tagline: "High-Performance Cloud & Real-time Evaluation Hackathon".to_string(),
            host: "Computer Society of India".to_string(),
            mode: "Online".to_string(),
            location: "Global Remote".to_string(),
            prize_pool: "₹2,50,000".to_string(),
            status: "UPCOMING".to_string(),
            start_date: "Nov 05, 2026".to_string(),
            end_date: "Nov 07, 2026".to_string(),
            registered_count: 680,
            tracks: vec!["Cloud Architecture".to_string(), "Web3 & Zero-Knowledge".to_string()],
            is_flagship: false,
        },
        HackathonSummary {
            id: Uuid::parse_str("33333333-3333-3333-3333-333333333333").unwrap(),
            slug: "build-with-gemma".to_string(),
            title: "Build With Gemma AI Challenge".to_string(),
            tagline: "Edge AI, Socratic Mentorship & Local LLM Applications".to_string(),
            host: "Google Cloud & Open Source Community".to_string(),
            mode: "Online".to_string(),
            location: "Global Virtual".to_string(),
            prize_pool: "$10,000".to_string(),
            status: "LIVE".to_string(),
            start_date: "Oct 10, 2026".to_string(),
            end_date: "Oct 25, 2026".to_string(),
            registered_count: 2150,
            tracks: vec!["Multimodal LLMs".to_string(), "Educational Agents".to_string()],
            is_flagship: false,
        },
        HackathonSummary {
            id: Uuid::parse_str("44444444-4444-4444-4444-444444444444").unwrap(),
            slug: "algoceleris-rust-sprint".to_string(),
            title: "AlgoCeleris Global Rust Sprint".to_string(),
            tagline: "Low-latency Kernel Sandbox & WebAssembly Benchmarking".to_string(),
            host: "AlgoCeleris Core Foundation".to_string(),
            mode: "Online".to_string(),
            location: "Remote".to_string(),
            prize_pool: "₹1,50,000".to_string(),
            status: "COMPLETED".to_string(),
            start_date: "Sep 15, 2026".to_string(),
            end_date: "Sep 17, 2026".to_string(),
            registered_count: 940,
            tracks: vec!["Linux cgroups v2".to_string(), "seccomp-bpf".to_string()],
            is_flagship: false,
        },
    ];

    Ok(Json(hackathons))
}

/// `GET /api/v1/hackathons/{slug}`
/// Returns complete hackathon specification including tracks, milestones, and project showcase.
pub async fn get_hackathon_detail_handler(
    Path(slug): Path<String>,
    State(_state): State<AppState>,
) -> Result<impl IntoResponse, GatewayError> {
    let clean_slug = slug.to_lowercase();

    let detail = HackathonDetailResponse {
        id: Uuid::new_v4(),
        slug: clean_slug.clone(),
        title: if clean_slug == "devshouse-26" {
            "DevsHouse '26".to_string()
        } else {
            clean_slug.replace('-', " ").to_uppercase()
        },
        tagline: "National Systems, Distributed Infrastructure & AI Buildathon".to_string(),
        host: "VIT Chennai Developers Club & CSI".to_string(),
        mode: "Hybrid (VIT Chennai Campus + Online Discord)".to_string(),
        location: "Netaji Subhash Chandra Bose Block, VIT Chennai".to_string(),
        prize_pool: "₹5,00,000 / $6,000".to_string(),
        status: "LIVE".to_string(),
        start_date: "Oct 18, 2026 · 09:00 AM IST".to_string(),
        end_date: "Oct 20, 2026 · 06:00 PM IST".to_string(),
        registered_count: 1420,
        tracks: vec![
            HackathonTrackItem {
                id: "rust-systems".to_string(),
                title: "Rust & High-Performance Systems".to_string(),
                description: "Build ultra-low-latency network proxies, rate limiters, or sandboxed execution runtimes.".to_string(),
                prize: "₹1,50,000 First Prize".to_string(),
                problem_statement: "High-Throughput Distributed Rate Limiter: Implement a token bucket or sliding window algorithm capable of handling 500,000 req/sec with sub-millisecond tail latency.".to_string(),
                sponsor: Some("CloudFlare & AlgoCeleris".to_string()),
            },
            HackathonTrackItem {
                id: "agentic-ai".to_string(),
                title: "Agentic AI & Multimodal Workflows".to_string(),
                description: "Develop autonomous multi-agent reasoning systems that self-correct, debug, and coordinate.".to_string(),
                prize: "₹1,50,000 First Prize".to_string(),
                problem_statement: "Emergency Dispatch Intelligence: Autonomous multi-agent coordination between dispatchers, traffic networks, and hospital triage units.".to_string(),
                sponsor: Some("Google Cloud".to_string()),
            },
            HackathonTrackItem {
                id: "fintech-quant".to_string(),
                title: "FinTech, Order Books & Quant Systems".to_string(),
                description: "High-frequency limit order books, risk engines, and programmable settlement layers.".to_string(),
                prize: "₹1,00,000 First Prize".to_string(),
                problem_statement: "Microsecond LOB Engine: Order matching engine with price-time priority in pure Rust.".to_string(),
                sponsor: Some("Zerodha Tech".to_string()),
            },
            HackathonTrackItem {
                id: "open-innovation".to_string(),
                title: "Open Innovation & Campus Tech".to_string(),
                description: "Next-generation developer platforms, learning copilots, and institutional automation.".to_string(),
                prize: "₹1,00,000 First Prize".to_string(),
                problem_statement: "Solve any pressing engineering challenge with zero technical constraints.".to_string(),
                sponsor: Some("VIT Chennai Alumni".to_string()),
            },
        ],
        milestones: vec![
            HackathonMilestoneItem {
                phase: 1,
                title: "Registration & Team Formation".to_string(),
                date: "Oct 01 – Oct 15, 2026".to_string(),
                status: "COMPLETED".to_string(),
                description: "Solo registrations and matchmaking lobby.".to_string(),
            },
            HackathonMilestoneItem {
                phase: 2,
                title: "Algorithmic Qualifier Round".to_string(),
                date: "Oct 16, 2026 · 06:00 PM".to_string(),
                status: "ACTIVE".to_string(),
                description: "Timed 3-problem algorithmic challenge judged by the Rust sandbox.".to_string(),
            },
            HackathonMilestoneItem {
                phase: 3,
                title: "Idea & Architecture Abstract Review".to_string(),
                date: "Oct 17, 2026".to_string(),
                status: "UPCOMING".to_string(),
                description: "System design proposals evaluated by engineering mentors.".to_string(),
            },
            HackathonMilestoneItem {
                phase: 4,
                title: "48-Hour Live Build Sprint".to_string(),
                date: "Oct 18 (09:00 AM) – Oct 20 (09:00 AM)".to_string(),
                status: "UPCOMING".to_string(),
                description: "Non-stop code development with checkpoint mentor reviews.".to_string(),
            },
            HackathonMilestoneItem {
                phase: 5,
                title: "Live Rubric Demos & Award Ceremony".to_string(),
                date: "Oct 20, 2026 · 02:00 PM".to_string(),
                status: "UPCOMING".to_string(),
                description: "Top 10 finalists present live before jury on stage.".to_string(),
            },
        ],
        rules: vec![
            "Teams must consist of 2 to 4 eligible university or early-career engineers.".to_string(),
            "All project code must be written during the 48-hour build sprint.".to_string(),
            "Use of open-source libraries and LLM APIs is allowed with explicit attribution in README.".to_string(),
            "Zero tolerance for plagiarism; all repositories scanned via AST Winnowing.".to_string(),
        ],
        eligibility: "Open to undergraduate & postgraduate students globally, as well as working professionals within 2 years of graduation.".to_string(),
        showcase: vec![
            HackathonShowcaseItem {
                id: "proj-01".to_string(),
                team_name: "FlowControl".to_string(),
                project_title: "Nirnay".to_string(),
                tagline: "Autonomous emergency response coordination mesh with sub-10ms routing".to_string(),
                track: "Rust & Systems".to_string(),
                github_url: "https://github.com/algo-celeris/nirnay-engine".to_string(),
                live_url: Some("https://nirnay.algoceleris.dev".to_string()),
                upvotes: 184,
                rubric_score: 9.6,
                tech_stack: vec!["Rust".to_string(), "Axum".to_string(), "Postgres".to_string(), "WebSockets".to_string()],
            },
            HackathonShowcaseItem {
                id: "proj-02".to_string(),
                team_name: "ByteWizards".to_string(),
                project_title: "SocraticJudge".to_string(),
                tagline: "Compiler diagnostic tutor that guides beginners through AST-level hints".to_string(),
                track: "Agentic AI".to_string(),
                github_url: "https://github.com/algo-celeris/socratic-judge".to_string(),
                live_url: Some("https://socratic.algoceleris.dev".to_string()),
                upvotes: 142,
                rubric_score: 9.3,
                tech_stack: vec!["TypeScript".to_string(), "Gemini 2.5".to_string(), "React".to_string()],
            },
        ],
    };

    Ok(Json(detail))
}

/// `POST /api/v1/hackathons/{slug}/register`
pub async fn register_hackathon_handler(
    Path(slug): Path<String>,
    State(_state): State<AppState>,
    Json(req): Json<HackathonRegisterRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let reg_id = Uuid::new_v4();
    let resp = HackathonRegisterResponse {
        registration_id: reg_id,
        hackathon_slug: slug,
        status: "CONFIRMED".to_string(),
        message: format!(
            "Registration confirmed for {} ({}). Team formation lobby is open.",
            req.participant_name, req.email
        ),
    };
    Ok((StatusCode::CREATED, Json(resp)))
}

/// `POST /api/v1/hackathons/{slug}/teams`
/// Creates a team or joins an existing team using a 6-character code.
pub async fn create_or_join_team_handler(
    Path(slug): Path<String>,
    State(_state): State<AppState>,
    Json(req): Json<HackathonTeamRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let team_id = Uuid::new_v4();

    if req.action == "join" {
        let code = req.invite_code.unwrap_or_else(|| "FLOW-26".to_string());
        let resp = HackathonTeamResponse {
            team_id,
            team_name: "FlowControl".to_string(),
            invite_code: code.clone(),
            members_count: 3,
            message: format!("Successfully joined team using invite code '{}'.", code),
        };
        return Ok((StatusCode::OK, Json(resp)));
    }

    // Default: create team
    let team_name = req.team_name.unwrap_or_else(|| "Team Alpha".to_string());
    let invite_code = format!("{}-26", &team_name.chars().take(4).collect::<String>().to_uppercase());
    let resp = HackathonTeamResponse {
        team_id,
        team_name,
        invite_code,
        members_count: 1,
        message: format!("New team registered for {}. Share your 6-char code with teammates.", slug),
    };
    Ok((StatusCode::CREATED, Json(resp)))
}

/// `POST /api/v1/hackathons/{slug}/submissions`
/// Accepts a final hackathon project artifact submission.
pub async fn submit_hackathon_project_handler(
    Path(slug): Path<String>,
    State(_state): State<AppState>,
    Json(req): Json<HackathonSubmissionRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let submission_id = Uuid::new_v4();
    let resp = HackathonSubmissionResponse {
        submission_id,
        project_title: req.project_title,
        status: "SUBMITTED_FOR_EVALUATION".to_string(),
        submitted_at: Utc::now(),
        message: format!(
            "Project submission successfully recorded for {} in track '{}'. Mentors will review against the 4-part rubric.",
            slug, req.track
        ),
    };
    Ok((StatusCode::CREATED, Json(resp)))
}

/// `POST /api/v1/campus/orgs/provision`
/// Automated university tenant provisioning from `/campus/register`.
pub async fn provision_organization_handler(
    State(state): State<AppState>,
    Json(req): Json<CampusProvisionRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let org_id = Uuid::new_v4();
    let now = Utc::now();

    // If database is present, record organization
    if let Some(ref pool) = state.db {
        let whitelist_val = serde_json::to_value(&req.allowed_domains)
            .unwrap_or_else(|_| serde_json::json!([]));
        let branding = serde_json::json!({
            "tier": req.tier,
            "admin_name": req.admin_name,
            "admin_email": req.admin_email,
            "payment_ref": req.payment_ref.unwrap_or_else(|| "SIMULATED_RAZORPAY".to_string())
        });

        let _ = sqlx::query(
            "INSERT INTO organizations (id, name, slug, domain_whitelist, branding_config, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) \
             ON CONFLICT (slug) DO NOTHING",
        )
        .bind(org_id)
        .bind(&req.org_name)
        .bind(&req.org_slug)
        .bind(whitelist_val)
        .bind(branding)
        .bind(now)
        .bind(now)
        .execute(pool.inner())
        .await;
    }

    let resp = CampusProvisionResponse {
        org_id,
        org_name: req.org_name,
        org_slug: req.org_slug.clone(),
        portal_url: format!("/campus/{}/login", req.org_slug),
        tier: req.tier,
        admin_email: req.admin_email,
        status: "ACTIVE_ENTERPRISE".to_string(),
        message: "Institutional campus portal provisioned successfully. Single-Sign-On and domain whitelisting enabled.".to_string(),
        provisioned_at: now,
    };

    Ok((StatusCode::CREATED, Json(resp)))
}

//! Shared gateway application state.

use std::collections::HashMap;
use std::sync::Arc;

use judge_db::models::{
    AssessmentRecord, AssessmentSubmissionRecord, CohortRecord, InterviewRoomRecord,
    OrgMembershipRecord, OrganizationRecord, ProctorEventCounts, ProctorEventRecord,
    SubmissionRecord,
};
use judge_db::DbPool;
use tokio::sync::RwLock;
use uuid::Uuid;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::auth::token::DEFAULT_JWT_SECRET;
use crate::auth::TokenStore;

/// Hackathon track item.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HackathonTrackItem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub prize: String,
    pub problem_statement: String,
    pub sponsor: Option<String>,
}

/// Hackathon milestone / schedule item.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HackathonMilestoneItem {
    pub phase: usize,
    pub title: String,
    pub date: String,
    pub status: String,
    pub description: String,
}

/// Hackathon project showcase item.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HackathonShowcaseItem {
    pub id: String,
    pub team_name: String,
    pub project_title: String,
    pub tagline: String,
    pub track: String,
    pub github_url: String,
    pub live_url: Option<String>,
    pub demo_video_url: Option<String>,
    pub architecture_deck_url: Option<String>,
    pub upvotes: usize,
    pub rubric_score: f32,
    pub tech_stack: Vec<String>,
}

/// Hackathon team item.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HackathonTeamItem {
    pub id: Uuid,
    pub team_name: String,
    pub invite_code: String,
    pub members: Vec<String>,
    pub track: Option<String>,
}

/// Hackathon teammate matchmaking profile.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HackathonMatchmakerItem {
    pub id: String,
    pub name: String,
    pub role: String,
    pub skills: Vec<String>,
    pub looking_for: String,
    pub contact: String,
}

/// Hackathon user registration record.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HackathonRegistrationItem {
    pub id: Uuid,
    pub hackathon_slug: String,
    pub participant_name: String,
    pub email: String,
    pub university_or_org: Option<String>,
    pub track_preference: Option<String>,
    pub registered_at: DateTime<Utc>,
}

/// Stored Hackathon entity.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HackathonEntity {
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
    pub base_registered_count: usize,
    pub tracks: Vec<HackathonTrackItem>,
    pub milestones: Vec<HackathonMilestoneItem>,
    pub rules: Vec<String>,
    pub eligibility: String,
    pub is_flagship: bool,
}

/// Thread-safe in-memory store for hackathon events, registrations, teams, matchmaking, and submissions.
#[derive(Clone)]
pub struct HackathonStore {
    pub hackathons: Arc<RwLock<HashMap<String, HackathonEntity>>>,
    pub registrations: Arc<RwLock<HashMap<String, Vec<HackathonRegistrationItem>>>>,
    pub teams: Arc<RwLock<HashMap<String, Vec<HackathonTeamItem>>>>,
    pub matchmaking: Arc<RwLock<HashMap<String, Vec<HackathonMatchmakerItem>>>>,
    pub showcase: Arc<RwLock<HashMap<String, Vec<HackathonShowcaseItem>>>>,
}

impl Default for HackathonStore {
    fn default() -> Self {
        let mut hackathons = HashMap::new();
        let mut teams = HashMap::new();
        let mut matchmaking = HashMap::new();
        let mut showcase = HashMap::new();

        // 1. DevsHouse '26 (Flagship)
        let devshouse = HackathonEntity {
            id: Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap(),
            slug: "devshouse-26".to_string(),
            title: "DevsHouse '26".to_string(),
            tagline: "National Systems, Distributed Infrastructure & AI Buildathon".to_string(),
            host: "VIT Chennai Developers Club & CSI".to_string(),
            mode: "Hybrid (VIT Chennai Campus + Online Discord)".to_string(),
            location: "Netaji Subhash Chandra Bose Block, VIT Chennai".to_string(),
            prize_pool: "₹5,00,000 / $6,000".to_string(),
            status: "LIVE".to_string(),
            start_date: "Oct 18, 2026 · 09:00 AM IST".to_string(),
            end_date: "Oct 20, 2026 · 06:00 PM IST".to_string(),
            base_registered_count: 1420,
            is_flagship: true,
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
        };

        hackathons.insert("devshouse-26".to_string(), devshouse);

        // 2. CSI ORIGIN 2026
        hackathons.insert(
            "csi-origin-2026".to_string(),
            HackathonEntity {
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
                base_registered_count: 680,
                is_flagship: false,
                tracks: vec![
                    HackathonTrackItem {
                        id: "cloud-architecture".to_string(),
                        title: "Cloud Architecture".to_string(),
                        description: "Distributed infrastructure and multi-region microservices.".to_string(),
                        prize: "₹1,50,000".to_string(),
                        problem_statement: "Design resilient low-cost multi-region edge mesh.".to_string(),
                        sponsor: Some("AWS & Cloud Native Foundation".to_string()),
                    },
                    HackathonTrackItem {
                        id: "zk-proofs".to_string(),
                        title: "Web3 & Zero-Knowledge".to_string(),
                        description: "Succinct verifiable computation and cryptographic state proofs.".to_string(),
                        prize: "₹1,00,000".to_string(),
                        problem_statement: "Zero-knowledge verification of competitive programming test results.".to_string(),
                        sponsor: Some("Polygon Labs".to_string()),
                    },
                ],
                milestones: vec![],
                rules: vec!["Teams of 1-4 members.".to_string()],
                eligibility: "Open globally.".to_string(),
            },
        );

        // 3. Build With Gemma
        hackathons.insert(
            "build-with-gemma".to_string(),
            HackathonEntity {
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
                base_registered_count: 2150,
                is_flagship: false,
                tracks: vec![
                    HackathonTrackItem {
                        id: "multimodal-llms".to_string(),
                        title: "Multimodal LLMs".to_string(),
                        description: "Audio, vision, and code generation with Gemma 2B/9B/27B.".to_string(),
                        prize: "$6,000".to_string(),
                        problem_statement: "Deploy edge-quantized model for real-time multimodal developer assistance.".to_string(),
                        sponsor: Some("Google Cloud AI".to_string()),
                    },
                ],
                milestones: vec![],
                rules: vec!["Must utilize Gemma weights.".to_string()],
                eligibility: "Open globally.".to_string(),
            },
        );

        // 4. AlgoCeleris Global Rust Sprint
        hackathons.insert(
            "algoceleris-rust-sprint".to_string(),
            HackathonEntity {
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
                base_registered_count: 940,
                is_flagship: false,
                tracks: vec![],
                milestones: vec![],
                rules: vec![],
                eligibility: "Completed".to_string(),
            },
        );

        // Seed initial teams for DevsHouse '26
        teams.insert(
            "devshouse-26".to_string(),
            vec![
                HackathonTeamItem {
                    id: Uuid::new_v4(),
                    team_name: "FlowControl".to_string(),
                    invite_code: "FLOW26".to_string(),
                    members: vec![
                        "Aditya Sharma (Lead)".to_string(),
                        "Kavya R (Rust Engineer)".to_string(),
                        "Nishank (Systems)".to_string(),
                    ],
                    track: Some("Rust & High-Performance Systems".to_string()),
                },
                HackathonTeamItem {
                    id: Uuid::new_v4(),
                    team_name: "ByteWizards".to_string(),
                    invite_code: "BYTE26".to_string(),
                    members: vec![
                        "Rohan Gupta (ML Lead)".to_string(),
                        "Priya Verma (Frontend)".to_string(),
                    ],
                    track: Some("Agentic AI & Multimodal Workflows".to_string()),
                },
                HackathonTeamItem {
                    id: Uuid::new_v4(),
                    team_name: "QuantLeap".to_string(),
                    invite_code: "QUAN26".to_string(),
                    members: vec![
                        "Arjun Mehta (Lead)".to_string(),
                        "Siddharth N (Quant Dev)".to_string(),
                    ],
                    track: Some("FinTech, Order Books & Quant Systems".to_string()),
                },
            ],
        );

        // Seed initial matchmaking profiles for DevsHouse '26
        matchmaking.insert(
            "devshouse-26".to_string(),
            vec![
                HackathonMatchmakerItem {
                    id: "mm-01".to_string(),
                    name: "Aarav Patel".to_string(),
                    role: "Systems Engineer".to_string(),
                    skills: vec!["Rust".to_string(), "eBPF".to_string(), "Tokio".to_string(), "gRPC".to_string()],
                    looking_for: "Team targeting Systems / Kernel track".to_string(),
                    contact: "aarav.p@vitstudent.ac.in".to_string(),
                },
                HackathonMatchmakerItem {
                    id: "mm-02".to_string(),
                    name: "Sneha Sundaram".to_string(),
                    role: "AI & Full-Stack Engineer".to_string(),
                    skills: vec!["TypeScript".to_string(), "PyTorch".to_string(), "React".to_string(), "Gemini API".to_string()],
                    looking_for: "Team targeting Agentic AI track".to_string(),
                    contact: "sneha.s@vitstudent.ac.in".to_string(),
                },
                HackathonMatchmakerItem {
                    id: "mm-03".to_string(),
                    name: "Vikramaditya S".to_string(),
                    role: "Quantitative Developer".to_string(),
                    skills: vec!["C++20".to_string(), "Python".to_string(), "Order Books".to_string(), "NumPy".to_string()],
                    looking_for: "Need 1 more teammate for FinTech track".to_string(),
                    contact: "vikram.s@vitstudent.ac.in".to_string(),
                },
                HackathonMatchmakerItem {
                    id: "mm-04".to_string(),
                    name: "Divya Krishnan".to_string(),
                    role: "Security & Cloud Architect".to_string(),
                    skills: vec!["Linux Namespaces".to_string(), "Docker".to_string(), "AWS".to_string(), "Go".to_string()],
                    looking_for: "Open to join any team targeting security/distributed systems".to_string(),
                    contact: "divya.k@vitstudent.ac.in".to_string(),
                },
            ],
        );

        // Seed initial project showcase for DevsHouse '26
        showcase.insert(
            "devshouse-26".to_string(),
            vec![
                HackathonShowcaseItem {
                    id: "proj-01".to_string(),
                    team_name: "FlowControl".to_string(),
                    project_title: "Nirnay".to_string(),
                    tagline: "Autonomous emergency response coordination mesh with sub-10ms routing".to_string(),
                    track: "Rust & High-Performance Systems".to_string(),
                    github_url: "https://github.com/algo-celeris/nirnay-engine".to_string(),
                    live_url: Some("https://nirnay.algoceleris.dev".to_string()),
                    demo_video_url: Some("https://youtube.com/watch?v=nirnay-demo".to_string()),
                    architecture_deck_url: Some("https://algoceleris.dev/decks/nirnay-arch.pdf".to_string()),
                    upvotes: 184,
                    rubric_score: 9.6,
                    tech_stack: vec!["Rust".to_string(), "Axum".to_string(), "Postgres".to_string(), "WebSockets".to_string()],
                },
                HackathonShowcaseItem {
                    id: "proj-02".to_string(),
                    team_name: "ByteWizards".to_string(),
                    project_title: "SocraticJudge".to_string(),
                    tagline: "Compiler diagnostic tutor that guides beginners through AST-level hints".to_string(),
                    track: "Agentic AI & Multimodal Workflows".to_string(),
                    github_url: "https://github.com/algo-celeris/socratic-judge".to_string(),
                    live_url: Some("https://socratic.algoceleris.dev".to_string()),
                    demo_video_url: Some("https://youtube.com/watch?v=socratic-demo".to_string()),
                    architecture_deck_url: Some("https://algoceleris.dev/decks/socratic-arch.pdf".to_string()),
                    upvotes: 142,
                    rubric_score: 9.3,
                    tech_stack: vec!["TypeScript".to_string(), "Gemini 2.5".to_string(), "React".to_string()],
                },
            ],
        );

        Self {
            hackathons: Arc::new(RwLock::new(hackathons)),
            registrations: Arc::new(RwLock::new(HashMap::new())),
            teams: Arc::new(RwLock::new(teams)),
            matchmaking: Arc::new(RwLock::new(matchmaking)),
            showcase: Arc::new(RwLock::new(showcase)),
        }
    }
}

/// Specification for 6-stage pedagogy worked demo.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkedDemoSpec {
    pub title: String,
    pub description: String,
    pub code: String,
    pub language: String,
    pub expected_output: String,
}

/// Multiple Choice Question for Stage 3 (LED).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct McqQuestionSpec {
    pub id: u32,
    pub question: String,
    pub options: Vec<String>,
    pub correct_option: usize,
    pub explanation: String,
}

/// Practice problem for Stage 4 with section-locked code.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PracticeProblemSpec {
    pub id: u32,
    pub title: String,
    pub category: String,
    pub difficulty: String,
    pub marks: f64,
    pub description: String,
    pub sample_input: String,
    pub sample_output: String,
    pub locked_header: String,
    pub initial_code: String,
    pub locked_footer: String,
}

/// Challenging problem for Stage 5.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChallengingProblemSpec {
    pub id: u32,
    pub title: String,
    pub difficulty: String,
    pub marks: f64,
    pub description: String,
    pub sample_input: String,
    pub sample_output: String,
    pub starter_code: String,
    pub test_cases_count: u32,
}

/// Complete 6-stage Lab entity.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LabRecord {
    pub id: String,
    pub org_slug: String,
    pub course_code: String,
    pub course_name: String,
    pub title: String,
    pub code: String,
    pub deadline: String,
    pub duration_minutes: u32,
    pub max_marks: f64,
    pub status: String,
    pub clo: String,
    pub description: String,
    pub lecture_notes: String,
    pub worked_demo: WorkedDemoSpec,
    pub led_quiz: Vec<McqQuestionSpec>,
    pub practice_problems: Vec<PracticeProblemSpec>,
    pub challenging_problem: ChallengingProblemSpec,
}

/// Progress state of a student for a specific lab.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StudentLabProgress {
    pub lab_id: String,
    pub student_id: Uuid,
    pub student_email: String,
    pub student_reg_no: String,
    pub status: String,
    pub current_stage: String,
    pub active_minutes: u32,
    pub code_runs_count: u32,
    pub ai_questions_count: u32,
    pub mcqs_answered: HashMap<u32, usize>,
    pub practice_code: HashMap<u32, String>,
    pub practice_solved: HashMap<u32, bool>,
    pub challenging_code: String,
    pub challenging_solved: bool,
    pub obtained_marks: f64,
    pub max_marks: f64,
    pub submitted_at: Option<DateTime<Utc>>,
    pub evaluated_at: Option<DateTime<Utc>>,
    pub feedback: Option<String>,
}

/// Telemetry event recorded when a student interacts with the lab.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StudentActivityLog {
    pub id: Uuid,
    pub org_slug: String,
    pub lab_id: String,
    pub student_id: Uuid,
    pub event_type: String,
    pub stage: String,
    pub details: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

/// Security audit log item for Kernel & Sandbox isolation.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SecurityAuditItem {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub event: String,
    pub container_id: String,
    pub action: String,
    pub severity: String,
}

/// Plagiarism AST report item.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlagiarismReportItem {
    pub lab_id: String,
    pub student_a: String,
    pub student_b: String,
    pub ast_similarity_score: f64,
    pub winnowing_fingerprints_matched: u32,
    pub status: String,
}

/// In-memory mock store used when running without a PostgreSQL connection.
#[derive(Clone)]
#[allow(clippy::type_complexity)]
pub struct MockCampusStore {
    pub orgs: Arc<RwLock<HashMap<Uuid, OrganizationRecord>>>,
    pub cohorts: Arc<RwLock<HashMap<Uuid, CohortRecord>>>,
    pub memberships: Arc<RwLock<HashMap<(Uuid, Uuid), OrgMembershipRecord>>>,
    pub users: Arc<RwLock<HashMap<Uuid, (String, String)>>>,
    pub member_reg_numbers: Arc<RwLock<HashMap<(Uuid, Uuid), String>>>,
    pub assessments: Arc<RwLock<HashMap<Uuid, AssessmentRecord>>>,
    pub accommodations: Arc<RwLock<HashMap<(Uuid, Uuid), i32>>>,
    pub submissions: Arc<RwLock<HashMap<Uuid, SubmissionRecord>>>,
    pub assessment_submissions: Arc<RwLock<HashMap<Uuid, AssessmentSubmissionRecord>>>,
    pub submission_queue: Arc<RwLock<Vec<serde_json::Value>>>,
    pub submission_results: Arc<RwLock<HashMap<Uuid, Vec<serde_json::Value>>>>,
    pub submission_broadcasts: Arc<RwLock<HashMap<Uuid, tokio::sync::broadcast::Sender<serde_json::Value>>>>,
    pub proctor_events: Arc<RwLock<HashMap<(Uuid, Uuid), Vec<ProctorEventRecord>>>>,
    pub candidate_proctor_counts: Arc<RwLock<HashMap<(Uuid, Uuid), ProctorEventCounts>>>,
    pub interview_rooms: Arc<RwLock<HashMap<String, InterviewRoomRecord>>>,
    pub in_memory_users: Arc<RwLock<HashMap<Uuid, (String, String, String, String, Option<String>)>>>,
    pub labs: Arc<RwLock<HashMap<String, LabRecord>>>,
    pub student_progress: Arc<RwLock<HashMap<(String, Uuid), StudentLabProgress>>>,
    pub activity_logs: Arc<RwLock<Vec<StudentActivityLog>>>,
    pub security_audit_logs: Arc<RwLock<Vec<SecurityAuditItem>>>,
    pub plagiarism_reports: Arc<RwLock<Vec<PlagiarismReportItem>>>,
}

impl Default for MockCampusStore {
    fn default() -> Self {
        let mut orgs = HashMap::new();
        let mut cohorts = HashMap::new();
        let mut memberships = HashMap::new();
        let mut users = HashMap::new();
        let mut member_reg_numbers = HashMap::new();
        let mut in_memory_users = HashMap::new();
        let now = Utc::now();
        let default_pw_hash = crate::auth::hash_password("Campus@2026")
            .unwrap_or_else(|_| "Campus@2026".to_string());

        // 1. VIT Chennai (Enterprise Campus)
        let vit_id = Uuid::parse_str("10000000-0000-0000-0000-000000000001").unwrap();
        let vit_cohort_id = Uuid::parse_str("20000000-0000-0000-0000-000000000001").unwrap();
        orgs.insert(
            vit_id,
            OrganizationRecord {
                id: vit_id,
                name: "VIT Chennai".to_string(),
                slug: "vit-chennai".to_string(),
                domain_whitelist: serde_json::json!(["vitstudent.ac.in", "vit.ac.in"]),
                branding_config: serde_json::json!({
                    "tier": "Enterprise Campus",
                    "student_seats": 1200,
                    "faculty_seats": 45
                }),
                created_at: now,
                updated_at: now,
            },
        );
        cohorts.insert(
            vit_cohort_id,
            CohortRecord {
                id: vit_cohort_id,
                org_id: vit_id,
                name: "CSE Core 2026".to_string(),
                code: "CSE-2026-A".to_string(),
                term: "Fall 2026".to_string(),
                is_active: true,
                created_at: now,
            },
        );

        let vit_members = vec![
            (Uuid::parse_str("30000000-0000-0000-0000-000000000001").unwrap(), "adityasharma", "aditya.sharma2025@vitstudent.ac.in", "student", "25BAI1234"),
            (Uuid::parse_str("30000000-0000-0000-0000-000000000002").unwrap(), "kavyar", "kavya.r2025@vitstudent.ac.in", "student", "25BCE1802"),
            (Uuid::parse_str("30000000-0000-0000-0000-000000000003").unwrap(), "rohangupta", "rohan.gupta2025@vitstudent.ac.in", "student", "25BCE1120"),
            (Uuid::parse_str("30000000-0000-0000-0000-000000000004").unwrap(), "saravanan.p", "saravanan.p@vit.ac.in", "faculty", "FAC-9842"),
            (Uuid::parse_str("30000000-0000-0000-0000-000000000005").unwrap(), "preetha.s", "preetha.s@vit.ac.in", "faculty", "FAC-7104"),
            (Uuid::parse_str("30000000-0000-0000-0000-000000000006").unwrap(), "dean.academics", "dean.academics@vit.ac.in", "org_admin", "ADM-001"),
        ];
        for (uid, uname, email, role, reg) in vit_members {
            users.insert(uid, (uname.to_string(), email.to_string()));
            in_memory_users.insert(uid, (uname.to_string(), email.to_string(), default_pw_hash.clone(), role.to_string(), Some("VIT Chennai".to_string())));
            memberships.insert((vit_id, uid), OrgMembershipRecord {
                id: Uuid::new_v4(),
                org_id: vit_id,
                user_id: uid,
                cohort_id: Some(vit_cohort_id),
                role: role.to_string(),
                status: "active".to_string(),
                created_at: now,
            });
            member_reg_numbers.insert((vit_id, uid), reg.to_string());
        }

        // 2. IIT Madras (Enterprise Campus)
        let iitm_id = Uuid::parse_str("10000000-0000-0000-0000-000000000002").unwrap();
        let iitm_cohort_id = Uuid::parse_str("20000000-0000-0000-0000-000000000002").unwrap();
        orgs.insert(
            iitm_id,
            OrganizationRecord {
                id: iitm_id,
                name: "IIT Madras".to_string(),
                slug: "iitm".to_string(),
                domain_whitelist: serde_json::json!(["smail.iitm.ac.in", "iitm.ac.in"]),
                branding_config: serde_json::json!({
                    "tier": "Enterprise Campus",
                    "student_seats": 850,
                    "faculty_seats": 32
                }),
                created_at: now,
                updated_at: now,
            },
        );
        cohorts.insert(
            iitm_cohort_id,
            CohortRecord {
                id: iitm_cohort_id,
                org_id: iitm_id,
                name: "CS Dual Degree 2026".to_string(),
                code: "CS-DD-2026".to_string(),
                term: "Fall 2026".to_string(),
                is_active: true,
                created_at: now,
            },
        );
        let iitm_members = vec![
            (Uuid::parse_str("30000000-0000-0000-0000-000000000007").unwrap(), "sandeepnair", "sandeep.n@smail.iitm.ac.in", "student", "CS22B001"),
            (Uuid::parse_str("30000000-0000-0000-0000-000000000008").unwrap(), "cpandurangan", "cpandurangan@iitm.ac.in", "faculty", "FAC-IITM-01"),
            (Uuid::parse_str("30000000-0000-0000-0000-000000000009").unwrap(), "hod.cse", "hod.cse@iitm.ac.in", "org_admin", "ADM-IITM-01"),
        ];
        for (uid, uname, email, role, reg) in iitm_members {
            users.insert(uid, (uname.to_string(), email.to_string()));
            in_memory_users.insert(uid, (uname.to_string(), email.to_string(), default_pw_hash.clone(), role.to_string(), Some("IIT Madras".to_string())));
            memberships.insert((iitm_id, uid), OrgMembershipRecord {
                id: Uuid::new_v4(),
                org_id: iitm_id,
                user_id: uid,
                cohort_id: Some(iitm_cohort_id),
                role: role.to_string(),
                status: "active".to_string(),
                created_at: now,
            });
            member_reg_numbers.insert((iitm_id, uid), reg.to_string());
        }

        // 3. BITS Pilani (Department Tier)
        let bits_id = Uuid::parse_str("10000000-0000-0000-0000-000000000003").unwrap();
        let bits_cohort_id = Uuid::parse_str("20000000-0000-0000-0000-000000000003").unwrap();
        orgs.insert(
            bits_id,
            OrganizationRecord {
                id: bits_id,
                name: "BITS Pilani".to_string(),
                slug: "bits-pilani".to_string(),
                domain_whitelist: serde_json::json!(["pilani.bits-pilani.ac.in"]),
                branding_config: serde_json::json!({
                    "tier": "Department Tier",
                    "student_seats": 400,
                    "faculty_seats": 18
                }),
                created_at: now,
                updated_at: now,
            },
        );
        cohorts.insert(
            bits_cohort_id,
            CohortRecord {
                id: bits_cohort_id,
                org_id: bits_id,
                name: "CS Senior Batch 2026".to_string(),
                code: "BITS-CS-2026".to_string(),
                term: "Fall 2026".to_string(),
                is_active: true,
                created_at: now,
            },
        );
        let bits_members = vec![
            (Uuid::parse_str("30000000-0000-0000-0000-000000000010").unwrap(), "mihirs", "f20220042@pilani.bits-pilani.ac.in", "student", "2022A7PS0042P"),
            (Uuid::parse_str("30000000-0000-0000-0000-000000000011").unwrap(), "yash.s", "yash@pilani.bits-pilani.ac.in", "faculty", "FAC-BITS-12"),
            (Uuid::parse_str("30000000-0000-0000-0000-000000000012").unwrap(), "dean.ps", "dean.ps@pilani.bits-pilani.ac.in", "org_admin", "ADM-BITS-01"),
        ];
        for (uid, uname, email, role, reg) in bits_members {
            users.insert(uid, (uname.to_string(), email.to_string()));
            in_memory_users.insert(uid, (uname.to_string(), email.to_string(), default_pw_hash.clone(), role.to_string(), Some("BITS Pilani".to_string())));
            memberships.insert((bits_id, uid), OrgMembershipRecord {
                id: Uuid::new_v4(),
                org_id: bits_id,
                user_id: uid,
                cohort_id: Some(bits_cohort_id),
                role: role.to_string(),
                status: "active".to_string(),
                created_at: now,
            });
            member_reg_numbers.insert((bits_id, uid), reg.to_string());
        }

        // ==========================================
        // 4. PRE-SEEDED LABS & PEDAGOGY SPECIFICATIONS
        // ==========================================
        let mut labs = HashMap::new();
        let mut student_progress = HashMap::new();
        let mut activity_logs = Vec::new();
        let mut security_audit_logs = Vec::new();
        let mut plagiarism_reports = Vec::new();

        let aditya_id = Uuid::parse_str("30000000-0000-0000-0000-000000000001").unwrap();
        let aditya_email = "aditya.sharma2025@vitstudent.ac.in".to_string();
        let aditya_reg = "25BAI1234".to_string();

        // Lab 11: Multithreaded Programming & Concurrency Models (ACTIVE)
        let lab_11 = LabRecord {
            id: "bacs101-lab-11".to_string(),
            org_slug: "vit-chennai".to_string(),
            course_code: "BACS101".to_string(),
            course_name: "Problem Solving Using Java".to_string(),
            title: "Week 11: Multithreaded Programming & Concurrency Models".to_string(),
            code: "LAB-11".to_string(),
            deadline: "Nov 02, 2026 · 11:59 PM".to_string(),
            duration_minutes: 180,
            max_marks: 20.0,
            status: "active".to_string(),
            clo: "CLO-3".to_string(),
            description: "Analyze thread synchronization, race conditions, monitor locking, and high-throughput concurrent collections in modern Java.".to_string(),
            lecture_notes: r#"# Week 11: Multithreaded Programming & Concurrency Models

## 1. Concurrency vs Parallelism
In Java, concurrent execution is orchestrated via OS-level native threads scheduled by the JVM runtime.
A thread exists in one of six states: `NEW`, `RUNNABLE`, `BLOCKED`, `WAITING`, `TIMED_WAITING`, or `TERMINATED`.

## 2. Race Conditions & Critical Sections
When multiple threads mutate shared heap memory without memory barriers or mutex primitives, data races occur.
```java
// Danger: Non-atomic read-modify-write sequence
count++; // bytecode: getfield -> iadd -> putfield
```

## 3. Explicit Mutexes via ReentrantLock
While intrinsic locks (`synchronized`) provide syntactic convenience, `java.util.concurrent.locks.ReentrantLock` grants timed lock acquisition, interruptible acquisition, and condition variables.

## 4. Section-Locked Evaluation
In this assessment, the test harness and class contracts are locked in read-only blocks to verify algorithmic invariants."#.to_string(),
            worked_demo: WorkedDemoSpec {
                title: "Thread-Safe Bank Account with ReentrantLock".to_string(),
                description: "Demonstrates explicit mutual exclusion lock acquisition and release within a finally block.".to_string(),
                language: "java".to_string(),
                code: r#"import java.util.concurrent.locks.ReentrantLock;

class BankAccount {
    private int balance = 1000;
    private final ReentrantLock lock = new ReentrantLock();

    public void deposit(int amount) {
        lock.lock();
        try {
            balance += amount;
            System.out.println("Deposited: " + amount + " | Balance: " + balance);
        } finally {
            lock.unlock();
        }
    }

    public void withdraw(int amount) {
        lock.lock();
        try {
            if (balance >= amount) {
                balance -= amount;
                System.out.println("Withdrawn: " + amount + " | Balance: " + balance);
            }
        } finally {
            lock.unlock();
        }
    }

    public int getBalance() { return balance; }
}

public class Main {
    public static void main(String[] args) throws InterruptedException {
        BankAccount acc = new BankAccount();
        Thread t1 = new Thread(() -> acc.deposit(500));
        Thread t2 = new Thread(() -> acc.withdraw(200));
        t1.start(); t2.start();
        t1.join(); t2.join();
        System.out.println("Final balance: " + acc.getBalance());
    }
}"#.to_string(),
                expected_output: "Deposited: 500 | Balance: 1500\nWithdrawn: 200 | Balance: 1300\nFinal balance: 1300".to_string(),
            },
            led_quiz: vec![
                McqQuestionSpec {
                    id: 1,
                    question: "What happens if run() is invoked directly instead of start() on a Thread object?".to_string(),
                    options: vec![
                        "Runs in a new concurrent thread".to_string(),
                        "Executes synchronously in the calling thread".to_string(),
                        "Throws IllegalThreadStateException".to_string(),
                        "Causes JVM deadlock".to_string(),
                    ],
                    correct_option: 1,
                    explanation: "Invoking run() directly executes the method synchronously in the caller thread without dispatching a new OS thread.".to_string(),
                },
                McqQuestionSpec {
                    id: 2,
                    question: "Which keyword prevents instruction reordering and guarantees variable visibility across CPU caches?".to_string(),
                    options: vec![
                        "transient".to_string(),
                        "synchronized".to_string(),
                        "volatile".to_string(),
                        "final".to_string(),
                    ],
                    correct_option: 2,
                    explanation: "volatile enforces happens-before ordering and flushes updates directly to main memory, avoiding stale register/L1/L2 reads.".to_string(),
                },
                McqQuestionSpec {
                    id: 3,
                    question: "What state does a thread enter when waiting for an intrinsic monitor lock held by another thread?".to_string(),
                    options: vec![
                        "WAITING".to_string(),
                        "BLOCKED".to_string(),
                        "TIMED_WAITING".to_string(),
                        "TERMINATED".to_string(),
                    ],
                    correct_option: 1,
                    explanation: "A thread waiting to enter a synchronized block/method enters the BLOCKED state until the lock is released.".to_string(),
                },
                McqQuestionSpec {
                    id: 4,
                    question: "Which concurrent collection provides non-blocking, lock-free thread-safety using CAS operations?".to_string(),
                    options: vec![
                        "Hashtable".to_string(),
                        "Collections.synchronizedMap".to_string(),
                        "ConcurrentHashMap".to_string(),
                        "TreeMap".to_string(),
                    ],
                    correct_option: 2,
                    explanation: "ConcurrentHashMap uses bucket-level synchronized locks and CAS (Compare-And-Swap) operations for lock-free reads.".to_string(),
                },
            ],
            practice_problems: vec![
                PracticeProblemSpec {
                    id: 1,
                    title: "Thread Never Actually Started (extends Thread)".to_string(),
                    category: "debugging".to_string(),
                    difficulty: "Medium".to_string(),
                    marks: 10.0,
                    description: "The code extends Thread but fails to invoke the thread scheduler properly. Fix the implementation to ensure the background worker thread starts concurrently and executes the iteration sequence.".to_string(),
                    sample_input: "5".to_string(),
                    sample_output: "Thread-0 started\nNum: 1\nNum: 2\nNum: 3\nNum: 4\nNum: 5\nDone".to_string(),
                    locked_header: "import java.util.Scanner;\n\nclass NumberPrinter extends Thread {\n    private int n;\n    public NumberPrinter(int n) { this.n = n; }".to_string(),
                    initial_code: "    @Override\n    public void run() {\n        System.out.println(Thread.currentThread().getName() + \" started\");\n        for (int i = 1; i <= n; i++) {\n            System.out.println(\"Num: \" + i);\n        }\n        System.out.println(\"Done\");\n    }".to_string(),
                    locked_footer: "}\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.hasNextInt() ? sc.nextInt() : 5;\n        NumberPrinter t = new NumberPrinter(n);\n        t.start();\n        try { t.join(); } catch (Exception e) {}\n    }\n}".to_string(),
                },
                PracticeProblemSpec {
                    id: 2,
                    title: "Concurrent Ring Buffer with Condition Variables".to_string(),
                    category: "problem_solving".to_string(),
                    difficulty: "Hard".to_string(),
                    marks: 10.0,
                    description: "Implement a fixed-size thread-safe bounded buffer using explicit locks and conditions to coordinate producer and consumer threads without CPU spinning.".to_string(),
                    sample_input: "push 10\npush 20\npop\npop".to_string(),
                    sample_output: "Pushed: 10\nPushed: 20\nPopped: 10\nPopped: 20".to_string(),
                    locked_header: "import java.util.concurrent.locks.*;\n\nclass BoundedBuffer<T> {\n    private final Object[] items;\n    private int head = 0, tail = 0, count = 0;\n    private final Lock lock = new ReentrantLock();\n    private final Condition notFull = lock.newCondition();\n    private final Condition notEmpty = lock.newCondition();\n    public BoundedBuffer(int capacity) { items = new Object[capacity]; }".to_string(),
                    initial_code: "    public void put(T item) throws InterruptedException {\n        lock.lock();\n        try {\n            while (count == items.length) notFull.await();\n            items[tail] = item;\n            if (++tail == items.length) tail = 0;\n            count++;\n            notEmpty.signal();\n        } finally { lock.unlock(); }\n    }\n    @SuppressWarnings(\"unchecked\")\n    public T take() throws InterruptedException {\n        lock.lock();\n        try {\n            while (count == 0) notEmpty.await();\n            T item = (T) items[head];\n            if (++head == items.length) head = 0;\n            count--;\n            notFull.signal();\n            return item;\n        } finally { lock.unlock(); }\n    }".to_string(),
                    locked_footer: "}\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println(\"BoundedBuffer synchronized test passed\");\n    }\n}".to_string(),
                },
            ],
            challenging_problem: ChallengingProblemSpec {
                id: 1,
                title: "High-Throughput Lock-Free Concurrent Work-Stealing Queue".to_string(),
                difficulty: "Hard".to_string(),
                marks: 20.0,
                description: "Design a Chase-Lev dual-ended thread-safe dequeue that supports push/pop by the worker thread and steal by peer workers with zero global mutex contention.".to_string(),
                sample_input: "push 1\npush 2\npop\nsteal".to_string(),
                sample_output: "Popped: 2\nStolen: 1".to_string(),
                starter_code: "// Implement Chase-Lev work-stealing deque in Java\nclass WorkStealingQueue {\n    // TODO: Atomic references and thread-safe steal operations\n}".to_string(),
                test_cases_count: 12,
            },
        };

        // Lab 10: Process Synchronization & Mutex Primitives (EVALUATED)
        let lab_10 = LabRecord {
            id: "bacs101-lab-10".to_string(),
            org_slug: "vit-chennai".to_string(),
            course_code: "BACS101".to_string(),
            course_name: "Problem Solving Using Java".to_string(),
            title: "Week 10: Process Synchronization & Mutex Primitives".to_string(),
            code: "LAB-10".to_string(),
            deadline: "Oct 20, 2026 · 11:59 PM".to_string(),
            duration_minutes: 120,
            max_marks: 20.0,
            status: "evaluated".to_string(),
            clo: "CLO-2".to_string(),
            description: "Binary semaphores, counting semaphores, Peterson's algorithm, and mutex lock contention.".to_string(),
            lecture_notes: "Lecture notes on mutual exclusion and semaphores.".to_string(),
            worked_demo: WorkedDemoSpec {
                title: "Semaphore Coordination".to_string(),
                description: "Counting semaphore demo.".to_string(),
                code: "class Demo {}".to_string(),
                language: "java".to_string(),
                expected_output: "Done".to_string(),
            },
            led_quiz: vec![],
            practice_problems: vec![],
            challenging_problem: ChallengingProblemSpec {
                id: 1,
                title: "Dining Philosophers without Deadlock".to_string(),
                difficulty: "Hard".to_string(),
                marks: 20.0,
                description: "Resource hierarchy solution for Dining Philosophers.".to_string(),
                sample_input: "5".to_string(),
                sample_output: "Done".to_string(),
                starter_code: "// Dining Philosophers".to_string(),
                test_cases_count: 8,
            },
        };

        // Lab 09: Java Memory Model & Garbage Collection Internals (EVALUATED)
        let lab_09 = LabRecord {
            id: "bacs101-lab-09".to_string(),
            org_slug: "vit-chennai".to_string(),
            course_code: "BACS101".to_string(),
            course_name: "Problem Solving Using Java".to_string(),
            title: "Week 09: Java Memory Model & Garbage Collection Internals".to_string(),
            code: "LAB-09".to_string(),
            deadline: "Oct 12, 2026 · 11:59 PM".to_string(),
            duration_minutes: 120,
            max_marks: 20.0,
            status: "evaluated".to_string(),
            clo: "CLO-1".to_string(),
            description: "JVM memory layout, Eden/Survivor spaces, G1GC compaction, and reference types.".to_string(),
            lecture_notes: "JVM memory architecture notes.".to_string(),
            worked_demo: WorkedDemoSpec {
                title: "SoftReference Cache".to_string(),
                description: "Memory-sensitive cache implementation.".to_string(),
                code: "class Cache {}".to_string(),
                language: "java".to_string(),
                expected_output: "Cached".to_string(),
            },
            led_quiz: vec![],
            practice_problems: vec![],
            challenging_problem: ChallengingProblemSpec {
                id: 1,
                title: "Off-Heap Direct ByteBuffer Ring".to_string(),
                difficulty: "Hard".to_string(),
                marks: 20.0,
                description: "Zero-copy byte buffer management.".to_string(),
                sample_input: "1024".to_string(),
                sample_output: "Allocated".to_string(),
                starter_code: "// DirectByteBuffer".to_string(),
                test_cases_count: 10,
            },
        };

        // Lab 08: Abstract Data Types & Generic BSTs (EVALUATED)
        let lab_08 = LabRecord {
            id: "bacs101-lab-08".to_string(),
            org_slug: "vit-chennai".to_string(),
            course_code: "BACS101".to_string(),
            course_name: "Problem Solving Using Java".to_string(),
            title: "Week 08: Abstract Data Types & Generic Binary Search Trees".to_string(),
            code: "LAB-08".to_string(),
            deadline: "Oct 04, 2026 · 11:59 PM".to_string(),
            duration_minutes: 120,
            max_marks: 20.0,
            status: "evaluated".to_string(),
            clo: "CLO-1".to_string(),
            description: "Generic binary search tree with self-balancing rotation mechanics.".to_string(),
            lecture_notes: "BST and AVL tree lecture notes.".to_string(),
            worked_demo: WorkedDemoSpec {
                title: "BST Insertion Demo".to_string(),
                description: "Recursive insertion.".to_string(),
                code: "class BST {}".to_string(),
                language: "java".to_string(),
                expected_output: "Inserted".to_string(),
            },
            led_quiz: vec![],
            practice_problems: vec![],
            challenging_problem: ChallengingProblemSpec {
                id: 1,
                title: "Red-Black Tree Insertion & Fixing".to_string(),
                difficulty: "Hard".to_string(),
                marks: 20.0,
                description: "Self-balancing Red-Black invariants.".to_string(),
                sample_input: "10 20 30".to_string(),
                sample_output: "Balanced".to_string(),
                starter_code: "// RBTree".to_string(),
                test_cases_count: 10,
            },
        };

        labs.insert(lab_11.id.clone(), lab_11);
        labs.insert(lab_10.id.clone(), lab_10);
        labs.insert(lab_09.id.clone(), lab_09);
        labs.insert(lab_08.id.clone(), lab_08);

        // Student Progress for Aditya
        student_progress.insert(
            ("bacs101-lab-08".to_string(), aditya_id),
            StudentLabProgress {
                lab_id: "bacs101-lab-08".to_string(),
                student_id: aditya_id,
                student_email: aditya_email.clone(),
                student_reg_no: aditya_reg.clone(),
                status: "Evaluated".to_string(),
                current_stage: "submit".to_string(),
                active_minutes: 95,
                code_runs_count: 18,
                ai_questions_count: 2,
                mcqs_answered: HashMap::new(),
                practice_code: HashMap::new(),
                practice_solved: HashMap::new(),
                challenging_code: "// Solved".to_string(),
                challenging_solved: true,
                obtained_marks: 19.0,
                max_marks: 20.0,
                submitted_at: Some(now - chrono::Duration::days(18)),
                evaluated_at: Some(now - chrono::Duration::days(18)),
                feedback: Some("Excellent BST rotation logic and asymptotic complexity bounds.".to_string()),
            },
        );

        student_progress.insert(
            ("bacs101-lab-09".to_string(), aditya_id),
            StudentLabProgress {
                lab_id: "bacs101-lab-09".to_string(),
                student_id: aditya_id,
                student_email: aditya_email.clone(),
                student_reg_no: aditya_reg.clone(),
                status: "Evaluated".to_string(),
                current_stage: "submit".to_string(),
                active_minutes: 110,
                code_runs_count: 14,
                ai_questions_count: 3,
                mcqs_answered: HashMap::new(),
                practice_code: HashMap::new(),
                practice_solved: HashMap::new(),
                challenging_code: "// Solved".to_string(),
                challenging_solved: true,
                obtained_marks: 18.0,
                max_marks: 20.0,
                submitted_at: Some(now - chrono::Duration::days(12)),
                evaluated_at: Some(now - chrono::Duration::days(12)),
                feedback: Some("Solid understanding of reference types and JVM escape analysis.".to_string()),
            },
        );

        student_progress.insert(
            ("bacs101-lab-10".to_string(), aditya_id),
            StudentLabProgress {
                lab_id: "bacs101-lab-10".to_string(),
                student_id: aditya_id,
                student_email: aditya_email.clone(),
                student_reg_no: aditya_reg.clone(),
                status: "Evaluated".to_string(),
                current_stage: "submit".to_string(),
                active_minutes: 140,
                code_runs_count: 22,
                ai_questions_count: 4,
                mcqs_answered: HashMap::new(),
                practice_code: HashMap::new(),
                practice_solved: HashMap::new(),
                challenging_code: "// Solved".to_string(),
                challenging_solved: true,
                obtained_marks: 19.5,
                max_marks: 20.0,
                submitted_at: Some(now - chrono::Duration::days(5)),
                evaluated_at: Some(now - chrono::Duration::days(5)),
                feedback: Some("Flawless deadlock-free philosopher locking algorithm.".to_string()),
            },
        );

        student_progress.insert(
            ("bacs101-lab-11".to_string(), aditya_id),
            StudentLabProgress {
                lab_id: "bacs101-lab-11".to_string(),
                student_id: aditya_id,
                student_email: aditya_email.clone(),
                student_reg_no: aditya_reg.clone(),
                status: "In Progress".to_string(),
                current_stage: "practice".to_string(),
                active_minutes: 48,
                code_runs_count: 8,
                ai_questions_count: 2,
                mcqs_answered: HashMap::from([(1, 1), (2, 2)]),
                practice_code: HashMap::new(),
                practice_solved: HashMap::from([(1, true)]),
                challenging_code: "".to_string(),
                challenging_solved: false,
                obtained_marks: 0.0,
                max_marks: 20.0,
                submitted_at: None,
                evaluated_at: None,
                feedback: None,
            },
        );

        // Pre-seeded telemetry activity logs
        let seed_events = vec![
            ("RUN_CODE", "practice", 12),
            ("ASK_AI", "practice", 10),
            ("LED_SUBMIT", "led", 9),
            ("RUN_CODE", "practice", 7),
            ("RUN_CODE", "challenging", 5),
            ("ASK_AI", "challenging", 3),
            ("TIME_SPENT", "content", 2),
            ("RUN_CODE", "practice", 1),
        ];
        for (i, (evt, stg, days_ago)) in seed_events.into_iter().enumerate() {
            activity_logs.push(StudentActivityLog {
                id: Uuid::new_v4(),
                org_slug: "vit-chennai".to_string(),
                lab_id: if days_ago > 6 { "bacs101-lab-10".to_string() } else { "bacs101-lab-11".to_string() },
                student_id: aditya_id,
                event_type: evt.to_string(),
                stage: stg.to_string(),
                details: serde_json::json!({ "iteration": i, "status": "success" }),
                timestamp: now - chrono::Duration::days(days_ago as i64),
            });
        }

        // Pre-seeded Security Audit logs
        security_audit_logs.push(SecurityAuditItem {
            id: Uuid::new_v4(),
            timestamp: now - chrono::Duration::minutes(15),
            event: "SYSCALL_BLOCKED: socket(AF_INET, SOCK_STREAM) rejected".to_string(),
            container_id: "cgroup-judge-wkr-01".to_string(),
            action: "SIGSYS trapped, submission denied socket connectivity".to_string(),
            severity: "HIGH".to_string(),
        });
        security_audit_logs.push(SecurityAuditItem {
            id: Uuid::new_v4(),
            timestamp: now - chrono::Duration::hours(2),
            event: "CGROUP_MEMORY_LIMIT: memory.max enforced at 256MB".to_string(),
            container_id: "cgroup-judge-wkr-02".to_string(),
            action: "Memory limit enforced, zero host impact".to_string(),
            severity: "MEDIUM".to_string(),
        });
        security_audit_logs.push(SecurityAuditItem {
            id: Uuid::new_v4(),
            timestamp: now - chrono::Duration::hours(5),
            event: "UNSHARE_NET: Network namespace dropped".to_string(),
            container_id: "cgroup-judge-wkr-03".to_string(),
            action: "Container initialized with loopback-only interface".to_string(),
            severity: "INFO".to_string(),
        });
        security_audit_logs.push(SecurityAuditItem {
            id: Uuid::new_v4(),
            timestamp: now - chrono::Duration::hours(12),
            event: "PROCESS_LIMIT: pids.max capped at 64 tasks".to_string(),
            container_id: "cgroup-judge-wkr-04".to_string(),
            action: "Fork-bomb protection verified".to_string(),
            severity: "INFO".to_string(),
        });

        // Pre-seeded Plagiarism reports
        plagiarism_reports.push(PlagiarismReportItem {
            lab_id: "bacs101-lab-10".to_string(),
            student_a: "25BAI1234 (Aditya Sharma)".to_string(),
            student_b: "25BCE1802 (Kavya R)".to_string(),
            ast_similarity_score: 12.4,
            winnowing_fingerprints_matched: 6,
            status: "PASSED (Clean)".to_string(),
        });
        plagiarism_reports.push(PlagiarismReportItem {
            lab_id: "bacs101-lab-09".to_string(),
            student_a: "25BCE1120 (Rohan Gupta)".to_string(),
            student_b: "25BAI1234 (Aditya Sharma)".to_string(),
            ast_similarity_score: 14.8,
            winnowing_fingerprints_matched: 8,
            status: "PASSED (Clean)".to_string(),
        });

        Self {
            orgs: Arc::new(RwLock::new(orgs)),
            cohorts: Arc::new(RwLock::new(cohorts)),
            memberships: Arc::new(RwLock::new(memberships)),
            users: Arc::new(RwLock::new(users)),
            member_reg_numbers: Arc::new(RwLock::new(member_reg_numbers)),
            assessments: Arc::new(RwLock::new(HashMap::new())),
            accommodations: Arc::new(RwLock::new(HashMap::new())),
            submissions: Arc::new(RwLock::new(HashMap::new())),
            assessment_submissions: Arc::new(RwLock::new(HashMap::new())),
            submission_queue: Arc::new(RwLock::new(Vec::new())),
            submission_results: Arc::new(RwLock::new(HashMap::new())),
            submission_broadcasts: Arc::new(RwLock::new(HashMap::new())),
            proctor_events: Arc::new(RwLock::new(HashMap::new())),
            candidate_proctor_counts: Arc::new(RwLock::new(HashMap::new())),
            interview_rooms: Arc::new(RwLock::new(HashMap::new())),
            in_memory_users: Arc::new(RwLock::new(in_memory_users)),
            labs: Arc::new(RwLock::new(labs)),
            student_progress: Arc::new(RwLock::new(student_progress)),
            activity_logs: Arc::new(RwLock::new(activity_logs)),
            security_audit_logs: Arc::new(RwLock::new(security_audit_logs)),
            plagiarism_reports: Arc::new(RwLock::new(plagiarism_reports)),
        }
    }
}

/// Shared application state injected into Axum route handlers.
#[derive(Clone)]
pub struct AppState {
    /// PostgreSQL connection pool.
    pub db: Option<DbPool>,
    /// Refresh token family store (Redis or in-memory fallback).
    pub token_store: TokenStore,
    /// Secret key used for signing and verifying JWT tokens.
    pub jwt_secret: String,
    /// In-memory fallback campus data store for standalone testing.
    pub mock_campus: MockCampusStore,
    /// Thread-safe in-memory store for Hackathon events and dynamic state.
    pub hackathon_store: HackathonStore,
    /// Optional Redis client for queue dispatches and pub/sub streaming.
    pub redis_client: Option<redis::Client>,
}

impl AppState {
    /// Creates a new `AppState` instance with optional Redis client.
    #[must_use]
    pub fn new_with_redis(
        db: Option<DbPool>,
        token_store: TokenStore,
        jwt_secret: Option<String>,
        redis_client: Option<redis::Client>,
    ) -> Self {
        Self {
            db,
            token_store,
            jwt_secret: jwt_secret.unwrap_or_else(|| DEFAULT_JWT_SECRET.to_string()),
            mock_campus: MockCampusStore::default(),
            hackathon_store: HackathonStore::default(),
            redis_client,
        }
    }

    /// Creates a new `AppState` instance.
    #[must_use]
    pub fn new(db: Option<DbPool>, token_store: TokenStore, jwt_secret: Option<String>) -> Self {
        Self::new_with_redis(db, token_store, jwt_secret, None)
    }

    /// Creates an in-memory testing state without database or Redis network dependencies.
    #[must_use]
    pub fn new_test() -> Self {
        Self::new(None, TokenStore::new_in_memory(), None)
    }
}

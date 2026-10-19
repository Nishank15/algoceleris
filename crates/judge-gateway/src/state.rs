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
use crate::services::rate_limit::AiDebugRateLimiter;

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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_iso: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_iso: Option<String>,
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
            tagline: "Campus Assessment Engineering & Evaluation Platform Buildathon".to_string(),
            host: "VIT Chennai Developers Club & AlgoCeleris".to_string(),
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
                    id: "evaluation-pipeline".to_string(),
                    title: "Assessment Evaluation Pipeline".to_string(),
                    description: "Extend the grading pipeline with custom checkers, weighted test groups and per-language runtimes.".to_string(),
                    prize: "₹1,50,000 First Prize".to_string(),
                    problem_statement: "Build a custom checker plugin that awards partial credit across weighted test groups and reports the result back into an assessment rubric.".to_string(),
                    sponsor: Some("AlgoCeleris Platform".to_string()),
                },
                HackathonTrackItem {
                    id: "integrity-signals".to_string(),
                    title: "Integrity & Proctoring Signals".to_string(),
                    description: "Session telemetry, anomaly scoring and faculty review workflows for supervised assessments.".to_string(),
                    prize: "₹1,50,000 First Prize".to_string(),
                    problem_statement: "Design an anomaly score over existing session telemetry (focus loss, clipboard bursts, submission timing) that produces explainable risk bands for faculty review.".to_string(),
                    sponsor: Some("AlgoCeleris Sentinel".to_string()),
                },
                HackathonTrackItem {
                    id: "faculty-tooling".to_string(),
                    title: "Faculty Assessment Tooling".to_string(),
                    description: "Question authoring, cohort scheduling, rubric design and curriculum outcome reporting.".to_string(),
                    prize: "₹1,00,000 First Prize".to_string(),
                    problem_statement: "Build a rubric builder that maps each question to a course learning outcome and reports cohort attainment per outcome.".to_string(),
                    sponsor: Some("VIT Chennai".to_string()),
                },
                HackathonTrackItem {
                    id: "student-experience".to_string(),
                    title: "Student Learning Experience".to_string(),
                    description: "Progressive lab stages, practice catalogs and feedback surfaces for students.".to_string(),
                    prize: "₹1,00,000 First Prize".to_string(),
                    problem_statement: "Design a progressive hint system for lab stages that guides students without revealing hidden test cases.".to_string(),
                    sponsor: Some("AlgoCeleris Campus".to_string()),
                },
            ],
            milestones: vec![
                HackathonMilestoneItem {
                    phase: 1,
                    title: "Registration & Team Formation".to_string(),
                    date: "Oct 01 – Oct 15, 2026".to_string(),
                    status: String::new(),
                    description: "Solo registrations, team formation and matchmaking.".to_string(),
                    start_iso: Some("2026-10-01T09:00:00+05:30".to_string()),
                    end_iso: Some("2026-10-15T18:00:00+05:30".to_string()),
                },
                HackathonMilestoneItem {
                    phase: 2,
                    title: "Algorithmic Qualifier Round".to_string(),
                    date: "Oct 15 (06:00 PM) – Oct 16 (06:00 PM)".to_string(),
                    status: String::new(),
                    description: "Timed three-problem set evaluated automatically against public and hidden test cases.".to_string(),
                    start_iso: Some("2026-10-15T18:00:00+05:30".to_string()),
                    end_iso: Some("2026-10-16T18:00:00+05:30".to_string()),
                },
                HackathonMilestoneItem {
                    phase: 3,
                    title: "Idea & Architecture Abstract Review".to_string(),
                    date: "Oct 16 (06:00 PM) – Oct 17 (11:59 PM)".to_string(),
                    status: String::new(),
                    description: "Proposals reviewed by platform engineers for scope and feasibility.".to_string(),
                    start_iso: Some("2026-10-16T18:00:00+05:30".to_string()),
                    end_iso: Some("2026-10-17T23:59:59+05:30".to_string()),
                },
                HackathonMilestoneItem {
                    phase: 4,
                    title: "48-Hour Live Build Sprint".to_string(),
                    date: "Oct 18 (09:00 AM) – Oct 20 (09:00 AM)".to_string(),
                    status: String::new(),
                    description: "Extended build window with scheduled mentor checkpoints.".to_string(),
                    start_iso: Some("2026-10-18T09:00:00+05:30".to_string()),
                    end_iso: Some("2026-10-20T09:00:00+05:30".to_string()),
                },
                HackathonMilestoneItem {
                    phase: 5,
                    title: "Live Rubric Demos & Award Ceremony".to_string(),
                    date: "Oct 20, 2026 · 02:00 PM".to_string(),
                    status: String::new(),
                    description: "Top ten finalists demo to the review panel.".to_string(),
                    start_iso: Some("2026-10-20T14:00:00+05:30".to_string()),
                    end_iso: Some("2026-10-20T18:00:00+05:30".to_string()),
                },
            ],
            rules: vec![
                "Teams of 2 to 4 students or early-career engineers.".to_string(),
                "All project code must be written during the 48-hour build sprint.".to_string(),
                "Open-source libraries are permitted with attribution in the project README.".to_string(),
                "Submissions are screened for code similarity before final scoring.".to_string(),
            ],
            eligibility: "Open to undergraduate and postgraduate students, and to working professionals within two years of graduation.".to_string(),
        };

        hackathons.insert("devshouse-26".to_string(), devshouse);

        // 2. CSI ORIGIN 2026
        hackathons.insert(
            "csi-origin-2026".to_string(),
            HackathonEntity {
                id: Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap(),
                slug: "csi-origin-2026".to_string(),
                title: "CSI ORIGIN 2026".to_string(),
                tagline: "Automated Evaluation at Scale & Institutional Rollout".to_string(),
                host: "Computer Society of India & AlgoCeleris".to_string(),
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
                        id: "platform-integration".to_string(),
                        title: "Platform Integration".to_string(),
                        description: "Roster sync, single sign-on and course tooling for campus deployments."
                            .to_string(),
                        prize: "₹1,50,000".to_string(),
                        problem_statement: "Sync a cohort roster from a university LMS into an AlgoCeleris organisation, including role mapping."
                            .to_string(),
                        sponsor: Some("Computer Society of India".to_string()),
                    },
                    HackathonTrackItem {
                        id: "academic-integrity".to_string(),
                        title: "Academic Integrity".to_string(),
                        description:
                            "Code similarity analysis, submission provenance and reviewer triage."
                                .to_string(),
                        prize: "₹1,00,000".to_string(),
                        problem_statement:
                            "Build a reviewer triage view over similarity results that ranks submission pairs and records the adjudication outcome."
                                .to_string(),
                        sponsor: Some("Computer Society of India".to_string()),
                    },
                ],
                milestones: vec![],
                rules: vec!["Teams of 1 to 4 members.".to_string()],
                eligibility: "Open to students and working professionals.".to_string(),
            },
        );

        // 3. Build With Gemma
        hackathons.insert(
            "build-with-gemma".to_string(),
            HackathonEntity {
                id: Uuid::parse_str("33333333-3333-3333-3333-333333333333").unwrap(),
                slug: "build-with-gemma".to_string(),
                title: "Build With Gemma AI Challenge".to_string(),
                tagline: "AI-Assisted Feedback for Programming Courses".to_string(),
                host: "Google Cloud & AlgoCeleris".to_string(),
                mode: "Online".to_string(),
                location: "Global Virtual".to_string(),
                prize_pool: "$10,000".to_string(),
                status: "LIVE".to_string(),
                start_date: "Oct 10, 2026".to_string(),
                end_date: "Oct 25, 2026".to_string(),
                base_registered_count: 2150,
                is_flagship: false,
                tracks: vec![HackathonTrackItem {
                    id: "assisted-feedback".to_string(),
                    title: "Assisted Feedback".to_string(),
                    description: "Turn compiler diagnostics and failing test cases into actionable student guidance."
                        .to_string(),
                    prize: "$6,000".to_string(),
                    problem_statement:
                        "Using Gemma, generate a targeted hint for a failing submission that references the failing test case without revealing the expected output."
                            .to_string(),
                    sponsor: Some("Google Cloud AI".to_string()),
                }],
                milestones: vec![],
                rules: vec!["Projects must use Gemma model weights.".to_string()],
                eligibility: "Open to students and working professionals.".to_string(),
            },
        );

        // 4. AlgoCeleris Global Rust Sprint
        hackathons.insert(
            "algoceleris-rust-sprint".to_string(),
            HackathonEntity {
                id: Uuid::parse_str("44444444-4444-4444-4444-444444444444").unwrap(),
                slug: "algoceleris-rust-sprint".to_string(),
                title: "AlgoCeleris Global Rust Sprint".to_string(),
                tagline: "Evaluation Runtime Reliability & Throughput Sprint".to_string(),
                host: "AlgoCeleris".to_string(),
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
                eligibility: "Open to Rust developers worldwide.".to_string(),
            },
        );

        // Seed initial teams for DevsHouse '26
        teams.insert(
            "devshouse-26".to_string(),
            vec![
                HackathonTeamItem {
                    id: Uuid::new_v4(),
                    team_name: "PartialCredit".to_string(),
                    invite_code: "PART26".to_string(),
                    members: vec![
                        "Student 1 (Lead)".to_string(),
                        "Student 2 (Backend)".to_string(),
                        "Student 6 (Checkers)".to_string(),
                    ],
                    track: Some("Assessment Evaluation Pipeline".to_string()),
                },
                HackathonTeamItem {
                    id: Uuid::new_v4(),
                    team_name: "SignalReview".to_string(),
                    invite_code: "SIGN26".to_string(),
                    members: vec![
                        "Student 3 (ML Lead)".to_string(),
                        "Student 7 (Frontend)".to_string(),
                    ],
                    track: Some("Integrity & Proctoring Signals".to_string()),
                },
                HackathonTeamItem {
                    id: Uuid::new_v4(),
                    team_name: "OutcomeMap".to_string(),
                    invite_code: "OUTM26".to_string(),
                    members: vec![
                        "Student 8 (Lead)".to_string(),
                        "Student 9 (Data)".to_string(),
                    ],
                    track: Some("Faculty Assessment Tooling".to_string()),
                },
            ],
        );

        // Seed initial matchmaking profiles for DevsHouse '26
        matchmaking.insert(
            "devshouse-26".to_string(),
            vec![
                HackathonMatchmakerItem {
                    id: "mm-01".to_string(),
                    name: "Student 10".to_string(),
                    role: "Backend Engineer".to_string(),
                    skills: vec![
                        "Rust".to_string(),
                        "PostgreSQL".to_string(),
                        "Axum".to_string(),
                        "Docker".to_string(),
                    ],
                    looking_for: "Team working on the evaluation pipeline track".to_string(),
                    contact: "student10@vitstudent.ac.in".to_string(),
                },
                HackathonMatchmakerItem {
                    id: "mm-02".to_string(),
                    name: "Student 11".to_string(),
                    role: "Frontend Engineer".to_string(),
                    skills: vec![
                        "TypeScript".to_string(),
                        "React".to_string(),
                        "Recharts".to_string(),
                        "Vite".to_string(),
                    ],
                    looking_for: "Team working on the faculty tooling track".to_string(),
                    contact: "student11@vitstudent.ac.in".to_string(),
                },
                HackathonMatchmakerItem {
                    id: "mm-03".to_string(),
                    name: "Student 12".to_string(),
                    role: "Data Engineer".to_string(),
                    skills: vec![
                        "Python".to_string(),
                        "SQL".to_string(),
                        "pandas".to_string(),
                        "Recharts".to_string(),
                    ],
                    looking_for: "Need one more teammate for the integrity signals track"
                        .to_string(),
                    contact: "student12@vitstudent.ac.in".to_string(),
                },
                HackathonMatchmakerItem {
                    id: "mm-04".to_string(),
                    name: "Student 13".to_string(),
                    role: "Platform Engineer".to_string(),
                    skills: vec![
                        "Linux".to_string(),
                        "Docker".to_string(),
                        "Redis".to_string(),
                        "Observability".to_string(),
                    ],
                    looking_for: "Open to any team working on deployment or integration"
                        .to_string(),
                    contact: "student13@vitstudent.ac.in".to_string(),
                },
            ],
        );

        // Seed initial project showcase for DevsHouse '26
        showcase.insert(
            "devshouse-26".to_string(),
            vec![
                HackathonShowcaseItem {
                    id: "proj-01".to_string(),
                    team_name: "PartialCredit".to_string(),
                    project_title: "GroupScorer".to_string(),
                    tagline:
                        "Checker plugin that awards partial credit across weighted test groups"
                            .to_string(),
                    track: "Assessment Evaluation Pipeline".to_string(),
                    github_url: "https://github.com/algo-celeris/group-scorer".to_string(),
                    live_url: Some("https://groupscorer.algoceleris.dev".to_string()),
                    demo_video_url: Some(
                        "https://youtube.com/watch?v=groupscorer-demo".to_string(),
                    ),
                    architecture_deck_url: Some(
                        "https://algoceleris.dev/decks/group-scorer.pdf".to_string(),
                    ),
                    upvotes: 184,
                    rubric_score: 9.6,
                    tech_stack: vec![
                        "Rust".to_string(),
                        "Axum".to_string(),
                        "PostgreSQL".to_string(),
                        "WebSockets".to_string(),
                    ],
                },
                HackathonShowcaseItem {
                    id: "proj-02".to_string(),
                    team_name: "SignalReview".to_string(),
                    project_title: "RiskBands".to_string(),
                    tagline: "Explainable anomaly bands for faculty review of proctored sessions"
                        .to_string(),
                    track: "Integrity & Proctoring Signals".to_string(),
                    github_url: "https://github.com/algo-celeris/risk-bands".to_string(),
                    live_url: Some("https://riskbands.algoceleris.dev".to_string()),
                    demo_video_url: Some("https://youtube.com/watch?v=riskbands-demo".to_string()),
                    architecture_deck_url: Some(
                        "https://algoceleris.dev/decks/risk-bands.pdf".to_string(),
                    ),
                    upvotes: 142,
                    rubric_score: 9.3,
                    tech_stack: vec![
                        "TypeScript".to_string(),
                        "React".to_string(),
                        "Recharts".to_string(),
                    ],
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

/// Evaluation safety audit log item.
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
    #[serde(alias = "winnowing_fingerprints_matched")]
    pub similarity_matches: u32,
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
    pub submission_broadcasts:
        Arc<RwLock<HashMap<Uuid, tokio::sync::broadcast::Sender<serde_json::Value>>>>,
    pub proctor_events: Arc<RwLock<HashMap<(Uuid, Uuid), Vec<ProctorEventRecord>>>>,
    pub candidate_proctor_counts: Arc<RwLock<HashMap<(Uuid, Uuid), ProctorEventCounts>>>,
    pub interview_rooms: Arc<RwLock<HashMap<String, InterviewRoomRecord>>>,
    pub in_memory_users:
        Arc<RwLock<HashMap<Uuid, (String, String, String, String, Option<String>)>>>,
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
        let default_pw_hash =
            crate::auth::hash_password("Campus@2026").unwrap_or_else(|_| "Campus@2026".to_string());

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
            (
                Uuid::parse_str("30000000-0000-0000-0000-000000000001").unwrap(),
                "student1",
                "student1@vitstudent.ac.in",
                "student",
                "DEMO-001",
            ),
            (
                Uuid::parse_str("30000000-0000-0000-0000-000000000002").unwrap(),
                "student2",
                "student2@vitstudent.ac.in",
                "student",
                "DEMO-002",
            ),
            (
                Uuid::parse_str("30000000-0000-0000-0000-000000000003").unwrap(),
                "student3",
                "student3@vitstudent.ac.in",
                "student",
                "DEMO-003",
            ),
            (
                Uuid::parse_str("30000000-0000-0000-0000-000000000004").unwrap(),
                "demofaculty",
                "demofaculty@vit.ac.in",
                "faculty",
                "FAC-VIT-01",
            ),
            (
                Uuid::parse_str("30000000-0000-0000-0000-000000000005").unwrap(),
                "demofaculty2",
                "demofaculty2@vit.ac.in",
                "faculty",
                "FAC-VIT-02",
            ),
            (
                Uuid::parse_str("30000000-0000-0000-0000-000000000006").unwrap(),
                "demoadmin",
                "demoadmin@vit.ac.in",
                "org_admin",
                "ADM-VIT-01",
            ),
        ];
        for (uid, uname, email, role, reg) in vit_members {
            users.insert(uid, (uname.to_string(), email.to_string()));
            in_memory_users.insert(
                uid,
                (
                    uname.to_string(),
                    email.to_string(),
                    default_pw_hash.clone(),
                    role.to_string(),
                    Some("VIT Chennai".to_string()),
                ),
            );
            memberships.insert(
                (vit_id, uid),
                OrgMembershipRecord {
                    id: Uuid::new_v4(),
                    org_id: vit_id,
                    user_id: uid,
                    cohort_id: Some(vit_cohort_id),
                    role: role.to_string(),
                    status: "active".to_string(),
                    created_at: now,
                },
            );
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
            (
                Uuid::parse_str("30000000-0000-0000-0000-000000000007").unwrap(),
                "student4",
                "student4@smail.iitm.ac.in",
                "student",
                "DEMO-004",
            ),
            (
                Uuid::parse_str("30000000-0000-0000-0000-000000000008").unwrap(),
                "demofaculty.iitm",
                "demofaculty@iitm.ac.in",
                "faculty",
                "FAC-IITM-01",
            ),
            (
                Uuid::parse_str("30000000-0000-0000-0000-000000000009").unwrap(),
                "demoadmin.iitm",
                "demoadmin@iitm.ac.in",
                "org_admin",
                "ADM-IITM-01",
            ),
        ];
        for (uid, uname, email, role, reg) in iitm_members {
            users.insert(uid, (uname.to_string(), email.to_string()));
            in_memory_users.insert(
                uid,
                (
                    uname.to_string(),
                    email.to_string(),
                    default_pw_hash.clone(),
                    role.to_string(),
                    Some("IIT Madras".to_string()),
                ),
            );
            memberships.insert(
                (iitm_id, uid),
                OrgMembershipRecord {
                    id: Uuid::new_v4(),
                    org_id: iitm_id,
                    user_id: uid,
                    cohort_id: Some(iitm_cohort_id),
                    role: role.to_string(),
                    status: "active".to_string(),
                    created_at: now,
                },
            );
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
            (
                Uuid::parse_str("30000000-0000-0000-0000-000000000010").unwrap(),
                "student5",
                "student5@pilani.bits-pilani.ac.in",
                "student",
                "DEMO-005",
            ),
            (
                Uuid::parse_str("30000000-0000-0000-0000-000000000011").unwrap(),
                "demofaculty.bits",
                "demofaculty@pilani.bits-pilani.ac.in",
                "faculty",
                "FAC-BITS-01",
            ),
            (
                Uuid::parse_str("30000000-0000-0000-0000-000000000012").unwrap(),
                "demoadmin.bits",
                "demoadmin@pilani.bits-pilani.ac.in",
                "org_admin",
                "ADM-BITS-01",
            ),
        ];
        for (uid, uname, email, role, reg) in bits_members {
            users.insert(uid, (uname.to_string(), email.to_string()));
            in_memory_users.insert(
                uid,
                (
                    uname.to_string(),
                    email.to_string(),
                    default_pw_hash.clone(),
                    role.to_string(),
                    Some("BITS Pilani".to_string()),
                ),
            );
            memberships.insert(
                (bits_id, uid),
                OrgMembershipRecord {
                    id: Uuid::new_v4(),
                    org_id: bits_id,
                    user_id: uid,
                    cohort_id: Some(bits_cohort_id),
                    role: role.to_string(),
                    status: "active".to_string(),
                    created_at: now,
                },
            );
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

        let student1_id = Uuid::parse_str("30000000-0000-0000-0000-000000000001").unwrap();
        let student1_email = "student1@vitstudent.ac.in".to_string();
        let student1_reg = "DEMO-001".to_string();

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
            description: "Bounded-buffer synchronization with counting semaphores, lock ordering and deadlock-free resource acquisition.".to_string(),
            lecture_notes: r#"# Week 10: Process Synchronization & Mutex Primitives

## 1. The Critical Section Problem
A critical section is any region that reads or writes shared mutable state. A correct solution must satisfy three conditions: mutual exclusion, progress, and bounded waiting.

## 2. Binary vs Counting Semaphores
A binary semaphore holds only 0 and 1 and behaves as a mutex. A counting semaphore holds any non-negative value and tracks how many units of a resource remain available.

```java
Semaphore slots = new Semaphore(5); // counting: five free buffers
Semaphore mutex = new Semaphore(1); // binary: guards the buffer index
```

## 3. Bounded Buffer
Producer/consumer coordination needs two counting semaphores (`empty`, `full`) plus one binary semaphore guarding the buffer index. A single mutex is not enough: the producer must block when the buffer is full without holding the lock, otherwise consumers can never make progress.

## 4. Deadlock and Lock Ordering
If every thread acquires its locks in one global order, circular wait is impossible. The Dining Philosophers problem is the standard illustration: acquire by resource index rather than by seating order.

## 5. Assessment Notes
The test harness drives `put` and `take` from concurrent threads and checks the final buffer contents and ordering invariants. Correctness matters more than throughput here."#.to_string(),
            worked_demo: WorkedDemoSpec {
                title: "Bounded Buffer with Counting Semaphores".to_string(),
                description: "Producer/consumer coordination where a counting semaphore tracks free slots and a binary semaphore guards the buffer index.".to_string(),
                language: "java".to_string(),
                code: r#"import java.util.concurrent.Semaphore;

class BoundedBuffer<T> {
    private final Object[] items;
    private int head = 0, tail = 0;
    private final Semaphore empty;
    private final Semaphore full = new Semaphore(0);
    private final Semaphore mutex = new Semaphore(1);

    public BoundedBuffer(int capacity) {
        items = new Object[capacity];
        empty = new Semaphore(capacity);
    }

    public void put(T item) throws InterruptedException {
        empty.acquire();   // wait until a slot is free
        mutex.acquire();   // enter the critical section
        try {
            items[tail] = item;
            tail = (tail + 1) % items.length;
        } finally {
            mutex.release();
        }
        full.release();    // announce the new item
    }

    @SuppressWarnings("unchecked")
    public T take() throws InterruptedException {
        full.acquire();    // wait until an item exists
        mutex.acquire();
        T item;
        try {
            item = (T) items[head];
            head = (head + 1) % items.length;
        } finally {
            mutex.release();
        }
        empty.release();   // announce the freed slot
        return item;
    }
}

public class Main {
    public static void main(String[] args) throws InterruptedException {
        BoundedBuffer<Integer> buffer = new BoundedBuffer<>(2);
        buffer.put(1);
        System.out.println("Produced: 1");
        System.out.println("Consumed: " + buffer.take());
        buffer.put(2);
        System.out.println("Produced: 2");
        System.out.println("Consumed: " + buffer.take());
    }
}"#.to_string(),
                expected_output: "Produced: 1\nConsumed: 1\nProduced: 2\nConsumed: 2".to_string(),
            },
            led_quiz: vec![],
            practice_problems: vec![],
            challenging_problem: ChallengingProblemSpec {
                id: 1,
                title: "Dining Philosophers without Deadlock".to_string(),
                difficulty: "Hard".to_string(),
                marks: 20.0,
                description: "Five philosophers share five forks. Acquire forks in a global order so that no circular wait can form, and print the order in which each philosopher eats.".to_string(),
                sample_input: "5".to_string(),
                sample_output: "Philosopher 0 eats\nPhilosopher 2 eats\nPhilosopher 4 eats\nPhilosopher 1 eats\nPhilosopher 3 eats".to_string(),
                starter_code: "// Acquire forks by index (lower index first) so circular wait is impossible.\nclass DiningTable {\n    private final Object[] forks;\n\n    public DiningTable(int n) {\n        forks = new Object[n];\n        for (int i = 0; i < n; i++) forks[i] = new Object();\n    }\n\n    // TODO: implement eat(int philosopher)\n}".to_string(),
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
            description:
                "JVM heap layout, generational collection, G1 compaction and the four reference strengths."
                    .to_string(),
            lecture_notes: r#"# Week 09: Java Memory Model & Garbage Collection Internals

## 1. Heap Layout
The heap is split into a young generation (Eden plus two survivor spaces) and an old generation. New objects are allocated in Eden; a minor collection copies survivors between the survivor spaces and promotes objects that outlive a threshold.

## 2. G1 and Compaction
G1 divides the heap into equal-sized regions and collects the regions with the most garbage first. Because it copies live objects between regions, G1 compacts incrementally rather than stopping the world for a full mark-sweep-compact.

## 3. Reference Strengths
Java defines four reference strengths, from strongest to weakest:

| Type | Collected when | Typical use |
|---|---|---|
| `StrongReference` | Never while reachable | Ordinary fields |
| `SoftReference` | Under memory pressure | Memory-sensitive caches |
| `WeakReference` | At the next GC | Canonicalising maps |
| `PhantomReference` | After finalisation | Cleanup notification |

## 4. Why SoftReferences Suit Caches
A cache built on `SoftReference` keeps entries while memory is available and lets the collector reclaim them when it is not. The trade-off is that cache hits are no longer guaranteed, so every lookup must be able to recompute its value.

## 5. Assessment Notes
The test harness allocates until pressure is applied, then checks that reclaimed entries were recomputed correctly rather than lost."#.to_string(),
            worked_demo: WorkedDemoSpec {
                title: "Memory-Sensitive Cache with SoftReference".to_string(),
                description: "A cache that holds values softly and transparently recomputes anything the collector has reclaimed.".to_string(),
                code: r#"import java.lang.ref.SoftReference;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

class SoftCache<K, V> {
    private final Map<K, SoftReference<V>> entries = new HashMap<>();
    private final Function<K, V> loader;

    public SoftCache(Function<K, V> loader) {
        this.loader = loader;
    }

    public V get(K key) {
        SoftReference<V> ref = entries.get(key);
        V value = (ref == null) ? null : ref.get();
        if (value == null) {
            value = loader.apply(key);      // recompute after collection
            entries.put(key, new SoftReference<>(value));
        }
        return value;
    }

    public int size() { return entries.size(); }
}

public class Main {
    public static void main(String[] args) {
        SoftCache<Integer, String> cache = new SoftCache<>(k -> "value-" + k);
        System.out.println("First lookup: " + cache.get(1));
        System.out.println("Cached lookup: " + cache.get(1));
        System.out.println("Entries: " + cache.size());
    }
}"#.to_string(),
                language: "java".to_string(),
                expected_output: "First lookup: value-1\nCached lookup: value-1\nEntries: 1".to_string(),
            },
            led_quiz: vec![],
            practice_problems: vec![],
            challenging_problem: ChallengingProblemSpec {
                id: 1,
                title: "Direct ByteBuffer Ring".to_string(),
                difficulty: "Hard".to_string(),
                marks: 20.0,
                description: "Build a fixed-capacity ring buffer over off-heap memory allocated with ByteBuffer.allocateDirect, reusing one buffer instead of allocating per operation.".to_string(),
                sample_input: "1024".to_string(),
                sample_output: "Allocated 1024 bytes\nWrote 16 ints\nRead 16 ints".to_string(),
                starter_code: "import java.nio.ByteBuffer;\n\nclass DirectRing {\n    private final ByteBuffer buffer;\n    private int count = 0;\n\n    public DirectRing(int capacityBytes) {\n        this.buffer = ByteBuffer.allocateDirect(capacityBytes);\n    }\n\n    // TODO: implement putInt(int) and getInt() with wraparound\n}".to_string(),
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
            description: "Generic binary search trees, traversal orders and the rotations that keep AVL and red-black trees balanced."
                .to_string(),
            lecture_notes: r#"# Week 08: Abstract Data Types & Generic Binary Search Trees

## 1. The Search Tree Invariant
For every node, all keys in the left subtree are smaller and all keys in the right subtree are larger. The invariant is what makes search, insert and delete cost O(height) rather than O(n) — provided the tree stays balanced.

## 2. Traversal Orders
Depth-first traversals differ only in when the node is visited relative to its subtrees. An in-order traversal of a binary search tree emits keys in sorted order, which makes it the usual correctness check:

```java
void inOrder(Node<T> node, List<T> out) {
    if (node == null) return;
    inOrder(node.left, out);
    out.add(node.key);
    inOrder(node.right, out);
}
```

## 3. Rotations
A rotation is a constant-time restructuring that preserves the in-order sequence of keys while changing the height of the subtrees involved. Both AVL and red-black trees are defined in terms of rotations applied after an insertion or deletion breaks their balance condition.

## 4. AVL vs Red-Black
AVL trees keep subtree heights within one of each other, so they are more rigidly balanced and faster to read. Red-black trees enforce a colour-based condition that allows more imbalance but needs fewer rotations per update, so they are preferred when inserts and deletes dominate. Java's `TreeMap` is a red-black tree.

## 5. Generics in Java
Bounded type parameters make the ordering requirement explicit at compile time:

```java
class Bst<T extends Comparable<T>> { /* ... */ }
```

## 6. Assessment Notes
The harness inserts a key sequence, then validates both the in-order traversal and the resulting tree height against the balance bound."#.to_string(),
            worked_demo: WorkedDemoSpec {
                title: "Generic BST Insertion and In-Order Traversal".to_string(),
                description: "Recursive insertion into a generic binary search tree, validated by printing the in-order traversal.".to_string(),
                code: r#"import java.util.ArrayList;
import java.util.List;

class Node<T> {
    T key;
    Node<T> left, right;
    Node(T key) { this.key = key; }
}

class Bst<T extends Comparable<T>> {
    private Node<T> root;

    public void insert(T key) { root = insert(root, key); }

    private Node<T> insert(Node<T> node, T key) {
        if (node == null) return new Node<>(key);
        int cmp = key.compareTo(node.key);
        if (cmp < 0)      node.left  = insert(node.left, key);
        else if (cmp > 0) node.right = insert(node.right, key);
        return node;   // equal keys are ignored
    }

    public List<T> inOrder() {
        List<T> out = new ArrayList<>();
        inOrder(root, out);
        return out;
    }

    private void inOrder(Node<T> node, List<T> out) {
        if (node == null) return;
        inOrder(node.left, out);
        out.add(node.key);
        inOrder(node.right, out);
    }
}

public class Main {
    public static void main(String[] args) {
        Bst<Integer> tree = new Bst<>();
        for (int key : new int[] { 50, 30, 70, 20, 40, 60, 80 }) tree.insert(key);
        System.out.println("In-order: " + tree.inOrder());
    }
}"#.to_string(),
                language: "java".to_string(),
                expected_output: "In-order: [20, 30, 40, 50, 60, 70, 80]".to_string(),
            },
            led_quiz: vec![],
            practice_problems: vec![],
            challenging_problem: ChallengingProblemSpec {
                id: 1,
                title: "Red-Black Tree Insertion with Fixup".to_string(),
                difficulty: "Hard".to_string(),
                marks: 20.0,
                description: "Insert into a red-black tree and restore the colour invariants with the standard recolour and rotation cases. Report the root colour and the black height of each path.".to_string(),
                sample_input: "10 20 30".to_string(),
                sample_output: "Root: 20 (black)\nBlack height: 2".to_string(),
                starter_code: "class RbNode {\n    int key;\n    boolean red = true;\n    RbNode left, right, parent;\n\n    RbNode(int key) { this.key = key; }\n}\n\n// TODO: implement insert(int) followed by the fixup cases\nclass RedBlackTree {\n    private RbNode root;\n\n    public void insert(int key) {\n        // 1. ordinary BST insert, new node coloured red\n        // 2. fix up: recolour, then rotate when the uncle is black\n    }\n}".to_string(),
                test_cases_count: 10,
            },
        };

        labs.insert(lab_11.id.clone(), lab_11);
        labs.insert(lab_10.id.clone(), lab_10);
        labs.insert(lab_09.id.clone(), lab_09);
        labs.insert(lab_08.id.clone(), lab_08);

        // Student Progress for Student 1
        student_progress.insert(
            ("bacs101-lab-08".to_string(), student1_id),
            StudentLabProgress {
                lab_id: "bacs101-lab-08".to_string(),
                student_id: student1_id,
                student_email: student1_email.clone(),
                student_reg_no: student1_reg.clone(),
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
                feedback: Some(
                    "Excellent BST rotation logic and asymptotic complexity bounds.".to_string(),
                ),
            },
        );

        student_progress.insert(
            ("bacs101-lab-09".to_string(), student1_id),
            StudentLabProgress {
                lab_id: "bacs101-lab-09".to_string(),
                student_id: student1_id,
                student_email: student1_email.clone(),
                student_reg_no: student1_reg.clone(),
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
                feedback: Some(
                    "Solid understanding of reference types and JVM escape analysis.".to_string(),
                ),
            },
        );

        student_progress.insert(
            ("bacs101-lab-10".to_string(), student1_id),
            StudentLabProgress {
                lab_id: "bacs101-lab-10".to_string(),
                student_id: student1_id,
                student_email: student1_email.clone(),
                student_reg_no: student1_reg.clone(),
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
            ("bacs101-lab-11".to_string(), student1_id),
            StudentLabProgress {
                lab_id: "bacs101-lab-11".to_string(),
                student_id: student1_id,
                student_email: student1_email.clone(),
                student_reg_no: student1_reg.clone(),
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
                lab_id: if days_ago > 6 {
                    "bacs101-lab-10".to_string()
                } else {
                    "bacs101-lab-11".to_string()
                },
                student_id: student1_id,
                event_type: evt.to_string(),
                stage: stg.to_string(),
                details: serde_json::json!({ "iteration": i, "status": "success" }),
                timestamp: now - chrono::Duration::days(days_ago as i64),
            });
        }

        // Pre-seeded evaluation audit log
        security_audit_logs.push(SecurityAuditItem {
            id: Uuid::new_v4(),
            timestamp: now - chrono::Duration::minutes(15),
            event: "NETWORK_ACCESS_BLOCKED: submission attempted an outbound connection"
                .to_string(),
            container_id: "eval-worker-node-01".to_string(),
            action: "Run terminated. Submissions execute without network access by design."
                .to_string(),
            severity: "HIGH".to_string(),
        });
        security_audit_logs.push(SecurityAuditItem {
            id: Uuid::new_v4(),
            timestamp: now - chrono::Duration::hours(2),
            event: "MEMORY_LIMIT_ENFORCED: run exceeded the per-submission memory allowance"
                .to_string(),
            container_id: "eval-worker-node-02".to_string(),
            action: "Run terminated and reported to the student as a resource-limit failure."
                .to_string(),
            severity: "MEDIUM".to_string(),
        });
        security_audit_logs.push(SecurityAuditItem {
            id: Uuid::new_v4(),
            timestamp: now - chrono::Duration::hours(5),
            event: "RUNTIME_ISOLATED: evaluation environment initialised".to_string(),
            container_id: "eval-worker-node-03".to_string(),
            action: "Execution began in an isolated environment with no host access.".to_string(),
            severity: "INFO".to_string(),
        });
        security_audit_logs.push(SecurityAuditItem {
            id: Uuid::new_v4(),
            timestamp: now - chrono::Duration::hours(12),
            event: "PROCESS_LIMIT_ENFORCED: run exceeded the per-submission process allowance"
                .to_string(),
            container_id: "eval-worker-node-04".to_string(),
            action: "Run terminated and reported as a resource-limit failure.".to_string(),
            severity: "INFO".to_string(),
        });

        // Pre-seeded Plagiarism reports
        plagiarism_reports.push(PlagiarismReportItem {
            lab_id: "bacs101-lab-10".to_string(),
            student_a: "DEMO-001 (Student 1)".to_string(),
            student_b: "DEMO-002 (Student 2)".to_string(),
            ast_similarity_score: 12.4,
            similarity_matches: 6,
            status: "PASSED (Clean)".to_string(),
        });
        plagiarism_reports.push(PlagiarismReportItem {
            lab_id: "bacs101-lab-09".to_string(),
            student_a: "DEMO-003 (Student 3)".to_string(),
            student_b: "DEMO-001 (Student 1)".to_string(),
            ast_similarity_score: 14.8,
            similarity_matches: 8,
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
    /// Per-user quota limiter guarding the model-backed AI debugging pipeline.
    pub ai_debug_limiter: AiDebugRateLimiter,
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
            ai_debug_limiter: AiDebugRateLimiter::new(redis_client.clone()),
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

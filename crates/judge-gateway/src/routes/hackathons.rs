//! Full-stack hackathon platform and campus provisioning routes for Milestone v4.3.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::GatewayError;
use crate::extractors::OptionalUser;
pub use crate::state::{
    AppState, HackathonMatchmakerItem, HackathonMilestoneItem, HackathonRegistrationItem,
    HackathonShowcaseItem, HackathonTeamItem, HackathonTrackItem,
};

/// Initializes hackathon tables in PostgreSQL if they do not already exist,
/// and seeds `devshouse-26`.
pub async fn init_hackathon_tables(pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS hackathons (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            slug VARCHAR(100) UNIQUE NOT NULL,
            title VARCHAR(255) NOT NULL,
            tagline TEXT NOT NULL,
            bounty_pool_inr INT NOT NULL,
            bounty_pool_usd INT NOT NULL,
            starts_at TIMESTAMPTZ NOT NULL,
            ends_at TIMESTAMPTZ NOT NULL,
            venue VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,
            tracks JSONB DEFAULT '[]'::jsonb NOT NULL,
            milestones JSONB DEFAULT '[]'::jsonb NOT NULL,
            rules JSONB DEFAULT '[]'::jsonb NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS hackathon_registrations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            registered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            CONSTRAINT uq_hackathon_user_reg UNIQUE(hackathon_id, user_id)
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS hackathon_teams (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            invite_code VARCHAR(12) UNIQUE NOT NULL,
            lead_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            track_key VARCHAR(100) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS hackathon_team_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            team_id UUID NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_title VARCHAR(100) DEFAULT 'Contributor' NOT NULL,
            joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            CONSTRAINT uq_team_user_member UNIQUE(team_id, user_id)
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS hackathon_submissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
            team_id UUID NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            tagline TEXT NOT NULL,
            track_key VARCHAR(100) NOT NULL,
            github_url VARCHAR(500) NOT NULL,
            demo_url VARCHAR(500),
            architecture_url VARCHAR(500),
            upvotes_count INT DEFAULT 0 NOT NULL,
            rubric_scores JSONB DEFAULT '{"architecture": 9.5, "performance": 9.8, "innovation": 9.6, "polish": 9.5}'::jsonb NOT NULL,
            submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await?;

    // Seed DevsHouse '26 with dynamic ISO timestamps and updated copy
    let tracks_json = serde_json::json!([
        {
            "id": "evaluation-pipeline",
            "title": "Assessment Evaluation Pipeline",
            "description": "Extend the grading pipeline with custom checkers, weighted test groups and per-language runtimes.",
            "prize": "₹1,50,000 First Prize",
            "problem_statement": "Build a custom checker plugin that awards partial credit across weighted test groups and reports the result back into an assessment rubric.",
            "sponsor": "AlgoCeleris Platform"
        },
        {
            "id": "integrity-signals",
            "title": "Integrity & Proctoring Signals",
            "description": "Session telemetry, anomaly scoring and faculty review workflows for supervised assessments.",
            "prize": "₹1,50,000 First Prize",
            "problem_statement": "Design an anomaly score over existing session telemetry (focus loss, clipboard bursts, submission timing) that produces explainable risk bands for faculty review.",
            "sponsor": "AlgoCeleris Sentinel"
        },
        {
            "id": "faculty-tooling",
            "title": "Faculty Assessment Tooling",
            "description": "Question authoring, cohort scheduling, rubric design and curriculum outcome reporting.",
            "prize": "₹1,00,000 First Prize",
            "problem_statement": "Build a rubric builder that maps each question to a course learning outcome and reports cohort attainment per outcome.",
            "sponsor": "VIT Chennai"
        },
        {
            "id": "student-experience",
            "title": "Student Learning Experience",
            "description": "Progressive lab stages, practice catalogs and feedback surfaces for students.",
            "prize": "₹1,00,000 First Prize",
            "problem_statement": "Design a progressive hint system for lab stages that guides students without revealing hidden test cases.",
            "sponsor": "AlgoCeleris Campus"
        }
    ]);

    let milestones_json = serde_json::json!([
        {
            "phase": 1,
            "title": "Registration & Team Formation",
            "date": "Oct 01 – Oct 15, 2026",
            "status": "",
            "description": "Solo registrations, team formation and matchmaking.",
            "start_iso": "2026-10-01T09:00:00+05:30",
            "end_iso": "2026-10-15T18:00:00+05:30"
        },
        {
            "phase": 2,
            "title": "Algorithmic Qualifier Round",
            "date": "Oct 15 (06:00 PM) – Oct 16 (06:00 PM)",
            "status": "",
            "description": "Timed three-problem set evaluated automatically against public and hidden test cases.",
            "start_iso": "2026-10-15T18:00:00+05:30",
            "end_iso": "2026-10-16T18:00:00+05:30"
        },
        {
            "phase": 3,
            "title": "Idea & Architecture Abstract Review",
            "date": "Oct 16 (06:00 PM) – Oct 17 (11:59 PM)",
            "status": "",
            "description": "Proposals reviewed by platform engineers for scope and feasibility.",
            "start_iso": "2026-10-16T18:00:00+05:30",
            "end_iso": "2026-10-17T23:59:59+05:30"
        },
        {
            "phase": 4,
            "title": "48-Hour Live Build Sprint",
            "date": "Oct 18 (09:00 AM) – Oct 20 (09:00 AM)",
            "status": "",
            "description": "Extended build window with scheduled mentor checkpoints.",
            "start_iso": "2026-10-18T09:00:00+05:30",
            "end_iso": "2026-10-20T09:00:00+05:30"
        },
        {
            "phase": 5,
            "title": "Live Rubric Demos & Award Ceremony",
            "date": "Oct 20, 2026 · 02:00 PM",
            "status": "",
            "description": "Top ten finalists demo to the review panel.",
            "start_iso": "2026-10-20T14:00:00+05:30",
            "end_iso": "2026-10-20T18:00:00+05:30"
        }
    ]);

    let rules_json = serde_json::json!([
        "Teams of 2 to 4 students or early-career engineers.",
        "All project code must be written during the 48-hour build sprint.",
        "Open-source libraries are permitted with attribution in the project README.",
        "Submissions are screened for code similarity before final scoring."
    ]);

    sqlx::query(
        r#"
        INSERT INTO hackathons (
            id, slug, title, tagline, bounty_pool_inr, bounty_pool_usd,
            starts_at, ends_at, venue, status, tracks, milestones, rules, created_at
        )
        VALUES (
            '11111111-1111-1111-1111-111111111111',
            'devshouse-26',
            'DevsHouse ''26',
            'Campus Assessment Engineering & Evaluation Platform Buildathon',
            500000,
            6000,
            '2026-10-18T09:00:00+05:30',
            '2026-10-20T18:00:00+05:30',
            'Netaji Subhash Chandra Bose Block, VIT Chennai',
            'ACTIVE',
            $1,
            $2,
            $3,
            NOW()
        )
        ON CONFLICT (slug) DO UPDATE
        SET tagline = EXCLUDED.tagline,
            milestones = EXCLUDED.milestones,
            tracks = EXCLUDED.tracks,
            rules = EXCLUDED.rules;
        "#,
    )
    .bind(tracks_json)
    .bind(milestones_json)
    .bind(rules_json)
    .execute(pool)
    .await?;

    Ok(())
}

/// Helper to ensure a user record exists in PostgreSQL users table so foreign keys never fail.
async fn ensure_user_exists(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    username: &str,
    email: &str,
) -> Result<Uuid, sqlx::Error> {
    let existing_by_id: Option<Uuid> = sqlx::query_scalar("SELECT id FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(pool)
        .await?;
    if let Some(uid) = existing_by_id {
        return Ok(uid);
    }

    let existing_by_email: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM users WHERE email = $1")
            .bind(email)
            .fetch_optional(pool)
            .await?;
    if let Some(uid) = existing_by_email {
        return Ok(uid);
    }

    let clean_username = if username.trim().is_empty() {
        format!("user_{}", &user_id.simple().to_string()[..8])
    } else {
        username.trim().to_string()
    };

    let _ = sqlx::query(
        r#"
        INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at)
        VALUES ($1, $2, $3, '$argon2id$mock', 'free', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(&clean_username)
    .bind(email)
    .execute(pool)
    .await;

    Ok(user_id)
}

/// Dynamic milestone status calculator based on current time vs ISO boundary timestamps.
pub fn calculate_milestone_status(
    start_iso: Option<&str>,
    end_iso: Option<&str>,
    now: DateTime<Utc>,
) -> String {
    if let (Some(start_str), Some(end_str)) = (start_iso, end_iso) {
        if let (Ok(start), Ok(end)) = (
            DateTime::parse_from_rfc3339(start_str),
            DateTime::parse_from_rfc3339(end_str),
        ) {
            let start_utc = start.with_timezone(&Utc);
            let end_utc = end.with_timezone(&Utc);
            if now > end_utc {
                return "COMPLETED".to_string();
            } else if now >= start_utc && now <= end_utc {
                return "ACTIVE".to_string();
            } else {
                return "UPCOMING".to_string();
            }
        }
    }
    "UPCOMING".to_string()
}

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
    pub teams: Vec<HackathonTeamItem>,
    pub matchmaking: Vec<HackathonMatchmakerItem>,
    pub showcase: Vec<HackathonShowcaseItem>,
    #[serde(default)]
    pub is_registered: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub my_team: Option<HackathonTeamItem>,
}

/// Inbound payload for registering to a hackathon.
#[derive(Debug, Clone, Deserialize)]
pub struct HackathonRegisterRequest {
    #[serde(default)]
    pub participant_name: String,
    #[serde(default)]
    pub email: String,
    pub university_or_org: Option<String>,
    pub track_preference: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HackathonRegisterResponse {
    pub registration_id: Uuid,
    pub hackathon_slug: String,
    pub status: String,
    pub registered_count: usize,
    pub message: String,
}

/// Inbound payload for team operations.
#[derive(Debug, Clone, Deserialize)]
pub struct HackathonTeamRequest {
    pub action: String, // "create" or "join"
    pub team_name: Option<String>,
    pub invite_code: Option<String>,
    #[serde(default)]
    pub member_name: String,
    #[serde(default)]
    pub member_email: String,
    pub track: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HackathonTeamResponse {
    pub team_id: Uuid,
    pub team_name: String,
    pub invite_code: String,
    pub members_count: usize,
    pub members: Vec<String>,
    pub message: String,
}

/// Inbound payload for submitting a hackathon project.
#[derive(Debug, Clone, Deserialize)]
pub struct HackathonSubmissionRequest {
    #[serde(alias = "title")]
    pub project_title: String,
    pub tagline: String,
    #[serde(alias = "track_key")]
    pub track: String,
    #[serde(default)]
    pub team_name: String,
    pub github_url: String,
    #[serde(alias = "demo_url")]
    pub live_url: Option<String>,
    pub demo_video_url: Option<String>,
    #[serde(alias = "architecture_url")]
    pub architecture_deck_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HackathonSubmissionResponse {
    pub submission_id: Uuid,
    pub project_id: String,
    pub project_title: String,
    pub status: String,
    pub submitted_at: DateTime<Utc>,
    pub rubric_score: f32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HackathonUpvoteResponse {
    pub id: String,
    pub upvotes: usize,
    pub message: String,
}

/// `GET /api/v1/hackathons`
/// Lists all live, upcoming, and featured hackathons with dynamically computed participant counts.
pub async fn list_hackathons_handler(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, GatewayError> {
    if let Some(ref pool) = state.db {
        let _ = init_hackathon_tables(pool.inner()).await;
    }
    let hackathons = state.hackathon_store.hackathons.read().await;

    let mut summaries: Vec<HackathonSummary> = Vec::new();

    for h in hackathons.values() {
        let mut db_regs: usize = 0;
        if let Some(ref pool) = state.db {
            if let Ok(count) = sqlx::query_scalar::<_, i64>(
                r#"
                SELECT COUNT(*) FROM hackathon_registrations hr
                JOIN hackathons h ON hr.hackathon_id = h.id
                WHERE LOWER(h.slug) = $1
                "#,
            )
            .bind(h.slug.to_lowercase())
            .fetch_one(pool.inner())
            .await
            {
                db_regs = count as usize;
            }
        }

        let in_mem_regs = state
            .hackathon_store
            .registrations
            .read()
            .await
            .get(&h.slug.to_lowercase())
            .map_or(0, |l| l.len());

        summaries.push(HackathonSummary {
            id: h.id,
            slug: h.slug.clone(),
            title: h.title.clone(),
            tagline: h.tagline.clone(),
            host: h.host.clone(),
            mode: h.mode.clone(),
            location: h.location.clone(),
            prize_pool: h.prize_pool.clone(),
            status: h.status.clone(),
            start_date: h.start_date.clone(),
            end_date: h.end_date.clone(),
            registered_count: h.base_registered_count + db_regs + in_mem_regs,
            tracks: h.tracks.iter().map(|t| t.title.clone()).collect(),
            is_flagship: h.is_flagship,
        });
    }

    // Sort flagship first, then by title
    summaries.sort_by(|a, b| {
        b.is_flagship
            .cmp(&a.is_flagship)
            .then_with(|| a.title.cmp(&b.title))
    });

    Ok(Json(summaries))
}

/// `GET /api/v1/hackathons/{slug}`
/// Returns complete hackathon specification including dynamic milestone lifecycle,
/// PostgreSQL user registration state, active squad, and real submissions.
pub async fn get_hackathon_detail_handler(
    Path(slug): Path<String>,
    opt_user: OptionalUser,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, GatewayError> {
    let clean_slug = slug.to_lowercase();
    let now = Utc::now();

    if let Some(ref pool) = state.db {
        let _ = init_hackathon_tables(pool.inner()).await;
    }

    let hackathons = state.hackathon_store.hackathons.read().await;
    let base_hackathon = match hackathons.get(&clean_slug) {
        Some(h) => h.clone(),
        None => {
            return Err(GatewayError::NotFound(format!(
                "Hackathon '{}' not found",
                slug
            )))
        }
    };
    drop(hackathons);

    // Compute dynamic milestone statuses based on current real time
    let mut milestones = base_hackathon.milestones.clone();
    for m in &mut milestones {
        m.status = calculate_milestone_status(m.start_iso.as_deref(), m.end_iso.as_deref(), now);
    }

    let mut is_registered = false;
    let mut my_team: Option<HackathonTeamItem> = None;
    let mut db_registered_count: usize = 0;
    let mut event_teams = state
        .hackathon_store
        .teams
        .read()
        .await
        .get(&clean_slug)
        .cloned()
        .unwrap_or_default();
    let mut event_showcase = state
        .hackathon_store
        .showcase
        .read()
        .await
        .get(&clean_slug)
        .cloned()
        .unwrap_or_default();

    if let Some(ref pool) = state.db {
        // 1. Registered count in PostgreSQL
        if let Ok(count) = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*) FROM hackathon_registrations hr
            JOIN hackathons h ON hr.hackathon_id = h.id
            WHERE LOWER(h.slug) = $1
            "#,
        )
        .bind(&clean_slug)
        .fetch_one(pool.inner())
        .await
        {
            db_registered_count = count as usize;
        }

        // 2. User registration & active squad check
        if let Some(ref auth) = opt_user.0 {
            if let Ok(reg_exists) = sqlx::query_scalar::<_, bool>(
                r#"
                SELECT EXISTS (
                    SELECT 1 FROM hackathon_registrations hr
                    JOIN hackathons h ON hr.hackathon_id = h.id
                    WHERE LOWER(h.slug) = $1 AND hr.user_id = $2
                )
                "#,
            )
            .bind(&clean_slug)
            .bind(auth.user_id)
            .fetch_one(pool.inner())
            .await
            {
                is_registered = reg_exists;
            }

            // Check if user is in a squad for this hackathon
            #[derive(sqlx::FromRow)]
            struct TeamRow {
                id: Uuid,
                name: String,
                invite_code: String,
                track_key: String,
            }

            if let Ok(Some(team_row)) = sqlx::query_as::<_, TeamRow>(
                r#"
                SELECT t.id, t.name, t.invite_code, t.track_key
                FROM hackathon_team_members tm
                JOIN hackathon_teams t ON tm.team_id = t.id
                JOIN hackathons h ON t.hackathon_id = h.id
                WHERE LOWER(h.slug) = $1 AND tm.user_id = $2
                LIMIT 1
                "#,
            )
            .bind(&clean_slug)
            .bind(auth.user_id)
            .fetch_optional(pool.inner())
            .await
            {
                // Fetch members for this squad
                let members: Vec<String> = sqlx::query_scalar::<_, String>(
                    r#"
                    SELECT COALESCE(u.username, u.email, tm.role_title) as display_name
                    FROM hackathon_team_members tm
                    LEFT JOIN users u ON tm.user_id = u.id
                    WHERE tm.team_id = $1
                    ORDER BY tm.joined_at ASC
                    "#,
                )
                .bind(team_row.id)
                .fetch_all(pool.inner())
                .await
                .unwrap_or_default();

                my_team = Some(HackathonTeamItem {
                    id: team_row.id,
                    team_name: team_row.name,
                    invite_code: team_row.invite_code,
                    members,
                    track: Some(team_row.track_key),
                });
            }
        }

        // 3. Fetch real teams registered in PostgreSQL
        #[derive(sqlx::FromRow)]
        struct AllTeamRow {
            id: Uuid,
            name: String,
            invite_code: String,
            track_key: String,
        }

        if let Ok(db_teams) = sqlx::query_as::<_, AllTeamRow>(
            r#"
            SELECT t.id, t.name, t.invite_code, t.track_key
            FROM hackathon_teams t
            JOIN hackathons h ON t.hackathon_id = h.id
            WHERE LOWER(h.slug) = $1
            ORDER BY t.created_at DESC
            "#,
        )
        .bind(&clean_slug)
        .fetch_all(pool.inner())
        .await
        {
            for dt in db_teams {
                if !event_teams.iter().any(|t| t.id == dt.id) {
                    let members: Vec<String> = sqlx::query_scalar::<_, String>(
                        r#"
                        SELECT COALESCE(u.username, u.email, tm.role_title) as display_name
                        FROM hackathon_team_members tm
                        LEFT JOIN users u ON tm.user_id = u.id
                        WHERE tm.team_id = $1
                        ORDER BY tm.joined_at ASC
                        "#,
                    )
                    .bind(dt.id)
                    .fetch_all(pool.inner())
                    .await
                    .unwrap_or_default();

                    event_teams.insert(
                        0,
                        HackathonTeamItem {
                            id: dt.id,
                            team_name: dt.name,
                            invite_code: dt.invite_code,
                            members,
                            track: Some(dt.track_key),
                        },
                    );
                }
            }
        }

        // 4. Fetch real submissions from hackathon_submissions
        #[derive(sqlx::FromRow)]
        struct SubRow {
            id: Uuid,
            title: String,
            tagline: String,
            track_key: String,
            github_url: String,
            demo_url: Option<String>,
            architecture_url: Option<String>,
            upvotes_count: i32,
            team_name: Option<String>,
        }

        if let Ok(db_subs) = sqlx::query_as::<_, SubRow>(
            r#"
            SELECT s.id, s.title, s.tagline, s.track_key,
                   s.github_url, s.demo_url, s.architecture_url,
                   s.upvotes_count, t.name as team_name
            FROM hackathon_submissions s
            JOIN hackathons h ON s.hackathon_id = h.id
            LEFT JOIN hackathon_teams t ON s.team_id = t.id
            WHERE LOWER(h.slug) = $1
            ORDER BY s.upvotes_count DESC, s.submitted_at DESC
            "#,
        )
        .bind(&clean_slug)
        .fetch_all(pool.inner())
        .await
        {
            for ds in db_subs {
                let id_str = ds.id.to_string();
                if let Some(existing) = event_showcase.iter_mut().find(|s| s.id == id_str) {
                    existing.upvotes = ds.upvotes_count as usize;
                } else {
                    let tech_stack = if ds.track_key.to_lowercase().contains("rust") {
                        vec![
                            "Rust".to_string(),
                            "Axum".to_string(),
                            "PostgreSQL".to_string(),
                        ]
                    } else if ds.track_key.to_lowercase().contains("ai") {
                        vec![
                            "TypeScript".to_string(),
                            "Gemini 2.5".to_string(),
                            "React".to_string(),
                        ]
                    } else {
                        vec![
                            "TypeScript".to_string(),
                            "Go".to_string(),
                            "Docker".to_string(),
                        ]
                    };

                    event_showcase.insert(
                        0,
                        HackathonShowcaseItem {
                            id: id_str,
                            team_name: ds
                                .team_name
                                .unwrap_or_else(|| "Engineering Squad".to_string()),
                            project_title: ds.title,
                            tagline: ds.tagline,
                            track: ds.track_key,
                            github_url: ds.github_url,
                            live_url: ds.demo_url,
                            demo_video_url: None,
                            architecture_deck_url: ds.architecture_url,
                            upvotes: ds.upvotes_count as usize,
                            rubric_score: 9.6,
                            tech_stack,
                        },
                    );
                }
            }
        }
    }

    let in_mem_regs = state
        .hackathon_store
        .registrations
        .read()
        .await
        .get(&clean_slug)
        .map_or(0, |l| l.len());

    if !is_registered {
        if let Some(ref auth) = opt_user.0 {
            let regs = state.hackathon_store.registrations.read().await;
            if let Some(list) = regs.get(&clean_slug) {
                is_registered = list
                    .iter()
                    .any(|r| r.email.eq_ignore_ascii_case(&auth.claims.email));
            }
        }
    }

    let detail = HackathonDetailResponse {
        id: base_hackathon.id,
        slug: base_hackathon.slug.clone(),
        title: base_hackathon.title.clone(),
        tagline: base_hackathon.tagline.clone(),
        host: base_hackathon.host.clone(),
        mode: base_hackathon.mode.clone(),
        location: base_hackathon.location.clone(),
        prize_pool: base_hackathon.prize_pool.clone(),
        status: base_hackathon.status.clone(),
        start_date: base_hackathon.start_date.clone(),
        end_date: base_hackathon.end_date.clone(),
        registered_count: base_hackathon.base_registered_count + db_registered_count + in_mem_regs,
        tracks: base_hackathon.tracks.clone(),
        milestones,
        rules: base_hackathon.rules.clone(),
        eligibility: base_hackathon.eligibility.clone(),
        teams: event_teams,
        matchmaking: state
            .hackathon_store
            .matchmaking
            .read()
            .await
            .get(&clean_slug)
            .cloned()
            .unwrap_or_default(),
        showcase: event_showcase,
        is_registered,
        my_team,
    };

    Ok(Json(detail))
}

/// `POST /api/v1/hackathons/{slug}/register`
/// Registers user for hackathon and persists record in PostgreSQL `hackathon_registrations`.
pub async fn register_hackathon_handler(
    Path(slug): Path<String>,
    opt_user: OptionalUser,
    State(state): State<AppState>,
    Json(req): Json<HackathonRegisterRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let clean_slug = slug.to_lowercase();
    let reg_id = Uuid::new_v4();

    if let Some(ref pool) = state.db {
        init_hackathon_tables(pool.inner())
            .await
            .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?;

        // 1. Resolve hackathon ID
        let hackathon_id: Uuid =
            sqlx::query_scalar("SELECT id FROM hackathons WHERE LOWER(slug) = $1")
                .bind(&clean_slug)
                .fetch_optional(pool.inner())
                .await
                .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?
                .unwrap_or_else(|| {
                    Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap()
                });

        // 2. Resolve user ID and ensure persistence in users table
        let p_name = if req.participant_name.trim().is_empty() {
            "Engineering Participant"
        } else {
            &req.participant_name
        };
        let p_email = if req.email.trim().is_empty() {
            "participant@cloudjudge.io"
        } else {
            &req.email
        };

        let user_id = if let Some(ref auth) = opt_user.0 {
            ensure_user_exists(pool.inner(), auth.user_id, p_name, p_email)
                .await
                .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?
        } else {
            ensure_user_exists(pool.inner(), Uuid::new_v4(), p_name, p_email)
                .await
                .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?
        };

        // 3. Insert registration record into PostgreSQL
        sqlx::query(
            r#"
            INSERT INTO hackathon_registrations (id, hackathon_id, user_id, registered_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (hackathon_id, user_id) DO NOTHING
            "#,
        )
        .bind(reg_id)
        .bind(hackathon_id)
        .bind(user_id)
        .execute(pool.inner())
        .await
        .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?;

        // 4. Query total count
        let total_db_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM hackathon_registrations WHERE hackathon_id = $1",
        )
        .bind(hackathon_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?;

        let base_count = {
            let hackathons = state.hackathon_store.hackathons.read().await;
            hackathons
                .get(&clean_slug)
                .map_or(1420, |h| h.base_registered_count)
        };

        let resp = HackathonRegisterResponse {
            registration_id: reg_id,
            hackathon_slug: clean_slug.clone(),
            status: "CONFIRMED".to_string(),
            registered_count: base_count + (total_db_count as usize),
            message: format!(
                "Registration confirmed for {} ({}). Team formation lobby is open.",
                req.participant_name, req.email
            ),
        };

        return Ok((StatusCode::CREATED, Json(resp)));
    }

    // In-memory fallback only if PostgreSQL is completely disabled
    let reg_item = HackathonRegistrationItem {
        id: reg_id,
        hackathon_slug: clean_slug.clone(),
        participant_name: req.participant_name.clone(),
        email: req.email.clone(),
        university_or_org: req.university_or_org.clone(),
        track_preference: req.track_preference.clone(),
        registered_at: Utc::now(),
    };

    let mut registrations = state.hackathon_store.registrations.write().await;
    let list = registrations.entry(clean_slug.clone()).or_default();
    list.push(reg_item);
    let new_registered_count = {
        let hackathons = state.hackathon_store.hackathons.read().await;
        hackathons
            .get(&clean_slug)
            .map_or(list.len(), |h| h.base_registered_count + list.len())
    };

    let resp = HackathonRegisterResponse {
        registration_id: reg_id,
        hackathon_slug: clean_slug.clone(),
        status: "CONFIRMED".to_string(),
        registered_count: new_registered_count,
        message: format!(
            "Registration confirmed for {} ({}). Team formation lobby is open.",
            req.participant_name, req.email
        ),
    };

    Ok((StatusCode::CREATED, Json(resp)))
}

/// `POST /api/v1/hackathons/{slug}/teams`
/// Creates a team (with generated 6-char code) or joins an existing team by invite code in PostgreSQL.
pub async fn create_or_join_team_handler(
    Path(slug): Path<String>,
    opt_user: OptionalUser,
    State(state): State<AppState>,
    Json(req): Json<HackathonTeamRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let clean_slug = slug.to_lowercase();

    if let Some(ref pool) = state.db {
        init_hackathon_tables(pool.inner())
            .await
            .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?;

        let hackathon_id: Uuid =
            sqlx::query_scalar("SELECT id FROM hackathons WHERE LOWER(slug) = $1")
                .bind(&clean_slug)
                .fetch_optional(pool.inner())
                .await
                .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?
                .unwrap_or_else(|| {
                    Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap()
                });

        let user_id = if let Some(ref auth) = opt_user.0 {
            ensure_user_exists(
                pool.inner(),
                auth.user_id,
                &req.member_name,
                &req.member_email,
            )
            .await
            .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?
        } else {
            ensure_user_exists(
                pool.inner(),
                Uuid::new_v4(),
                &req.member_name,
                &req.member_email,
            )
            .await
            .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?
        };

        if req.action == "join" {
            let code = req
                .invite_code
                .as_deref()
                .unwrap_or("")
                .trim()
                .to_uppercase();

            #[derive(sqlx::FromRow)]
            struct ExistingTeam {
                id: Uuid,
                name: String,
                invite_code: String,
            }

            let existing = sqlx::query_as::<_, ExistingTeam>(
                r#"
                SELECT id, name, invite_code
                FROM hackathon_teams
                WHERE hackathon_id = $1 AND UPPER(invite_code) = $2
                "#,
            )
            .bind(hackathon_id)
            .bind(&code)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?;

            if let Some(t) = existing {
                // Insert membership
                sqlx::query(
                    r#"
                    INSERT INTO hackathon_team_members (id, team_id, user_id, role_title, joined_at)
                    VALUES (gen_random_uuid(), $1, $2, 'Contributor', NOW())
                    ON CONFLICT (team_id, user_id) DO NOTHING
                    "#,
                )
                .bind(t.id)
                .bind(user_id)
                .execute(pool.inner())
                .await
                .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?;

                let members: Vec<String> = sqlx::query_scalar::<_, String>(
                    r#"
                    SELECT COALESCE(u.username, u.email, tm.role_title) as display_name
                    FROM hackathon_team_members tm
                    LEFT JOIN users u ON tm.user_id = u.id
                    WHERE tm.team_id = $1
                    ORDER BY tm.joined_at ASC
                    "#,
                )
                .bind(t.id)
                .fetch_all(pool.inner())
                .await
                .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?;

                let resp = HackathonTeamResponse {
                    team_id: t.id,
                    team_name: t.name.clone(),
                    invite_code: t.invite_code.clone(),
                    members_count: members.len(),
                    members,
                    message: format!(
                        "Successfully joined '{}' using invite code '{}'.",
                        t.name, t.invite_code
                    ),
                };
                return Ok((StatusCode::OK, Json(resp)));
            } else {
                return Err(GatewayError::NotFound(format!(
                    "Team with invite code '{}' not found in hackathon '{}'.",
                    code, clean_slug
                )));
            }
        }

        // Action: Create
        let team_name = req.team_name.unwrap_or_else(|| "Team Alpha".to_string());
        let team_id = Uuid::new_v4();

        let prefix: String = team_name
            .chars()
            .filter(|c| c.is_alphanumeric())
            .take(4)
            .collect::<String>()
            .to_uppercase();
        let padded_prefix = if prefix.len() < 4 {
            format!("{:X<4}", prefix)
        } else {
            prefix
        };
        let suffix = format!("{:02}", (team_id.as_u128() % 100));
        let invite_code = format!("{}{}", padded_prefix, suffix);

        sqlx::query(
            r#"
            INSERT INTO hackathon_teams (id, hackathon_id, name, invite_code, lead_user_id, track_key, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            "#,
        )
        .bind(team_id)
        .bind(hackathon_id)
        .bind(&team_name)
        .bind(&invite_code)
        .bind(user_id)
        .bind(req.track.as_deref().unwrap_or("General"))
        .execute(pool.inner())
        .await
        .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?;

        sqlx::query(
            r#"
            INSERT INTO hackathon_team_members (id, team_id, user_id, role_title, joined_at)
            VALUES (gen_random_uuid(), $1, $2, 'Team Lead', NOW())
            "#,
        )
        .bind(team_id)
        .bind(user_id)
        .execute(pool.inner())
        .await
        .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?;

        let member_display = if req.member_name.trim().is_empty() {
            req.member_email.clone()
        } else {
            format!("{} (Lead)", req.member_name.trim())
        };

        let resp = HackathonTeamResponse {
            team_id,
            team_name: team_name.clone(),
            invite_code: invite_code.clone(),
            members_count: 1,
            members: vec![member_display],
            message: format!(
                "New team created for {}. Share your 6-character code '{}' with teammates.",
                clean_slug, invite_code
            ),
        };

        return Ok((StatusCode::CREATED, Json(resp)));
    }

    // In-memory fallback
    let mut teams = state.hackathon_store.teams.write().await;
    let team_list = teams.entry(clean_slug.clone()).or_default();

    if req.action == "join" {
        let code = req
            .invite_code
            .as_deref()
            .unwrap_or("")
            .trim()
            .to_uppercase();

        if let Some(existing) = team_list
            .iter_mut()
            .find(|t| t.invite_code.to_uppercase() == code)
        {
            let member_display = if req.member_name.trim().is_empty() {
                req.member_email.clone()
            } else {
                req.member_name.clone()
            };
            if !existing.members.contains(&member_display) {
                existing.members.push(member_display);
            }
            let resp = HackathonTeamResponse {
                team_id: existing.id,
                team_name: existing.team_name.clone(),
                invite_code: existing.invite_code.clone(),
                members_count: existing.members.len(),
                members: existing.members.clone(),
                message: format!(
                    "Successfully joined '{}' using invite code '{}'.",
                    existing.team_name, existing.invite_code
                ),
            };
            return Ok((StatusCode::OK, Json(resp)));
        } else {
            return Err(GatewayError::NotFound(format!(
                "Team with invite code '{}' not found in hackathon '{}'.",
                code, clean_slug
            )));
        }
    }

    let team_name = req.team_name.unwrap_or_else(|| "Team Alpha".to_string());
    let team_id = Uuid::new_v4();

    let prefix: String = team_name
        .chars()
        .filter(|c| c.is_alphanumeric())
        .take(4)
        .collect::<String>()
        .to_uppercase();
    let padded_prefix = if prefix.len() < 4 {
        format!("{:X<4}", prefix)
    } else {
        prefix
    };
    let suffix = format!("{:02}", (team_id.as_u128() % 100));
    let invite_code = format!("{}{}", padded_prefix, suffix);

    let member_display = if req.member_name.trim().is_empty() {
        req.member_email.clone()
    } else {
        format!("{} (Lead)", req.member_name)
    };

    let new_team = HackathonTeamItem {
        id: team_id,
        team_name: team_name.clone(),
        invite_code: invite_code.clone(),
        members: vec![member_display.clone()],
        track: req.track.clone(),
    };
    team_list.push(new_team);

    let resp = HackathonTeamResponse {
        team_id,
        team_name: team_name.clone(),
        invite_code: invite_code.clone(),
        members_count: 1,
        members: vec![member_display],
        message: format!(
            "New team created for {}. Share your 6-character code '{}' with teammates.",
            clean_slug, invite_code
        ),
    };

    Ok((StatusCode::CREATED, Json(resp)))
}

/// `POST /api/v1/hackathons/{slug}/submissions`
/// Accepts and persists a final hackathon project artifact submission in PostgreSQL `hackathon_submissions`.
pub async fn submit_hackathon_project_handler(
    Path(slug): Path<String>,
    opt_user: OptionalUser,
    State(state): State<AppState>,
    Json(req): Json<HackathonSubmissionRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let clean_slug = slug.to_lowercase();
    let submission_uuid = Uuid::new_v4();
    let project_id_str = submission_uuid.to_string();

    let tech_stack = if req.track.to_lowercase().contains("rust") {
        vec![
            "Rust".to_string(),
            "Axum".to_string(),
            "PostgreSQL".to_string(),
            "WebSockets".to_string(),
        ]
    } else if req.track.to_lowercase().contains("ai") {
        vec![
            "TypeScript".to_string(),
            "Gemini 2.5".to_string(),
            "React".to_string(),
        ]
    } else if req.track.to_lowercase().contains("fintech")
        || req.track.to_lowercase().contains("quant")
    {
        vec![
            "C++20".to_string(),
            "Python".to_string(),
            "Order Books".to_string(),
            "TimescaleDB".to_string(),
        ]
    } else {
        vec![
            "TypeScript".to_string(),
            "Node.js".to_string(),
            "Docker".to_string(),
            "GraphQL".to_string(),
        ]
    };

    if let Some(ref pool) = state.db {
        init_hackathon_tables(pool.inner())
            .await
            .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?;

        let hackathon_id: Uuid =
            sqlx::query_scalar("SELECT id FROM hackathons WHERE LOWER(slug) = $1")
                .bind(&clean_slug)
                .fetch_optional(pool.inner())
                .await
                .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?
                .unwrap_or_else(|| {
                    Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap()
                });

        let team_name = if req.team_name.trim().is_empty() {
            "Squad Horizon".to_string()
        } else {
            req.team_name.clone()
        };

        let user_id = if let Some(ref auth) = opt_user.0 {
            ensure_user_exists(
                pool.inner(),
                auth.user_id,
                &team_name,
                "participant@cloudjudge.io",
            )
            .await
            .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?
        } else {
            ensure_user_exists(
                pool.inner(),
                Uuid::new_v4(),
                &team_name,
                "participant@cloudjudge.io",
            )
            .await
            .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?
        };

        // Find or create team for the project submission
        let team_id: Uuid = match sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM hackathon_teams WHERE hackathon_id = $1 AND (name = $2 OR lead_user_id = $3) LIMIT 1",
        )
        .bind(hackathon_id)
        .bind(&team_name)
        .bind(user_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?
        {
            Some(tid) => tid,
            None => {
                let new_tid = Uuid::new_v4();
                let invite = format!("SUB{:03}", (new_tid.as_u128() % 1000));
                sqlx::query(
                    r#"
                    INSERT INTO hackathon_teams (id, hackathon_id, name, invite_code, lead_user_id, track_key, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW())
                    ON CONFLICT (id) DO NOTHING
                    "#,
                )
                .bind(new_tid)
                .bind(hackathon_id)
                .bind(&team_name)
                .bind(&invite)
                .bind(user_id)
                .bind(&req.track)
                .execute(pool.inner())
                .await
                .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?;

                let _ = sqlx::query(
                    r#"
                    INSERT INTO hackathon_team_members (id, team_id, user_id, role_title, joined_at)
                    VALUES (gen_random_uuid(), $1, $2, 'Lead', NOW())
                    ON CONFLICT (team_id, user_id) DO NOTHING
                    "#,
                )
                .bind(new_tid)
                .bind(user_id)
                .execute(pool.inner())
                .await;

                new_tid
            }
        };

        // Insert submission record into PostgreSQL
        sqlx::query(
            r#"
            INSERT INTO hackathon_submissions (
                id, hackathon_id, team_id, title, tagline, track_key,
                github_url, demo_url, architecture_url, upvotes_count, rubric_scores, submitted_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, '{"architecture": 9.5, "performance": 9.8, "innovation": 9.6, "polish": 9.5}'::jsonb, NOW())
            "#,
        )
        .bind(submission_uuid)
        .bind(hackathon_id)
        .bind(team_id)
        .bind(&req.project_title)
        .bind(&req.tagline)
        .bind(&req.track)
        .bind(&req.github_url)
        .bind(&req.live_url)
        .bind(&req.architecture_deck_url)
        .execute(pool.inner())
        .await
        .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?;

        let resp = HackathonSubmissionResponse {
            submission_id: submission_uuid,
            project_id: project_id_str,
            project_title: req.project_title.clone(),
            status: "SUBMITTED_FOR_EVALUATION".to_string(),
            submitted_at: Utc::now(),
            rubric_score: 9.6,
            message: format!(
                "Project submission successfully recorded for {} in track '{}'. Mentors will review against the 4-part rubric.",
                clean_slug, req.track
            ),
        };

        return Ok((StatusCode::CREATED, Json(resp)));
    }

    // In-memory fallback
    let showcase_item = HackathonShowcaseItem {
        id: project_id_str.clone(),
        team_name: req.team_name.clone(),
        project_title: req.project_title.clone(),
        tagline: req.tagline.clone(),
        track: req.track.clone(),
        github_url: req.github_url.clone(),
        live_url: req.live_url.clone(),
        demo_video_url: req.demo_video_url.clone(),
        architecture_deck_url: req.architecture_deck_url.clone(),
        upvotes: 1,
        rubric_score: 9.6,
        tech_stack,
    };

    let mut showcase = state.hackathon_store.showcase.write().await;
    let list = showcase.entry(clean_slug.clone()).or_default();
    list.insert(0, showcase_item);

    let resp = HackathonSubmissionResponse {
        submission_id: submission_uuid,
        project_id: project_id_str,
        project_title: req.project_title.clone(),
        status: "SUBMITTED_FOR_EVALUATION".to_string(),
        submitted_at: Utc::now(),
        rubric_score: 9.6,
        message: format!(
            "Project submission successfully recorded for {} in track '{}'. Mentors will review against the 4-part rubric.",
            clean_slug, req.track
        ),
    };

    Ok((StatusCode::CREATED, Json(resp)))
}

/// `POST /api/v1/hackathons/{slug}/submissions/{id}/upvote`
/// Increments upvote count for a hackathon project submission in real time in PostgreSQL.
pub async fn upvote_hackathon_submission_handler(
    Path((slug, id)): Path<(String, String)>,
    _opt_user: OptionalUser,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, GatewayError> {
    let clean_slug = slug.to_lowercase();

    if let Some(ref pool) = state.db {
        init_hackathon_tables(pool.inner())
            .await
            .map_err(|e| GatewayError::Database(judge_db::DbError::from(e)))?;

        if let Ok(Some(new_count)) = sqlx::query_scalar::<_, i32>(
            r#"
            UPDATE hackathon_submissions
            SET upvotes_count = upvotes_count + 1
            WHERE (id::text = $1 OR title = $1)
            RETURNING upvotes_count
            "#,
        )
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        {
            let resp = HackathonUpvoteResponse {
                id: id.clone(),
                upvotes: new_count as usize,
                message: "Upvote recorded successfully.".to_string(),
            };
            return Ok((StatusCode::OK, Json(resp)));
        }
    }

    // In-memory fallback
    let mut showcase = state.hackathon_store.showcase.write().await;
    if let Some(list) = showcase.get_mut(&clean_slug) {
        if let Some(item) = list
            .iter_mut()
            .find(|item| item.id == id || item.project_title == id)
        {
            item.upvotes += 1;
            let upvotes = item.upvotes;
            let resp = HackathonUpvoteResponse {
                id: id.clone(),
                upvotes,
                message: "Upvote recorded successfully.".to_string(),
            };
            return Ok((StatusCode::OK, Json(resp)));
        }
    }

    Err(GatewayError::NotFound(format!(
        "Project submission '{}' not found in hackathon '{}'.",
        id, clean_slug
    )))
}

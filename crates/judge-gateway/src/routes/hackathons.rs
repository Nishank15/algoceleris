//! Full-stack hackathon platform and campus provisioning routes for Milestone v4.3.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::GatewayError;
pub use crate::state::{
    AppState, HackathonMatchmakerItem, HackathonMilestoneItem, HackathonRegistrationItem,
    HackathonShowcaseItem, HackathonTeamItem, HackathonTrackItem,
};

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
    pub registered_count: usize,
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
    let hackathons = state.hackathon_store.hackathons.read().await;
    let registrations = state.hackathon_store.registrations.read().await;

    let mut summaries: Vec<HackathonSummary> = hackathons
        .values()
        .map(|h| {
            let extra_regs = registrations.get(&h.slug).map_or(0, |v| v.len());
            HackathonSummary {
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
                registered_count: h.base_registered_count + extra_regs,
                tracks: h.tracks.iter().map(|t| t.title.clone()).collect(),
                is_flagship: h.is_flagship,
            }
        })
        .collect();

    // Sort flagship first, then by title
    summaries.sort_by(|a, b| {
        b.is_flagship
            .cmp(&a.is_flagship)
            .then_with(|| a.title.cmp(&b.title))
    });

    Ok(Json(summaries))
}

/// `GET /api/v1/hackathons/{slug}`
/// Returns complete hackathon specification including tracks, milestones, live teams, matchmaking, and showcase.
pub async fn get_hackathon_detail_handler(
    Path(slug): Path<String>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, GatewayError> {
    let clean_slug = slug.to_lowercase();
    let hackathons = state.hackathon_store.hackathons.read().await;
    let registrations = state.hackathon_store.registrations.read().await;
    let teams = state.hackathon_store.teams.read().await;
    let matchmaking = state.hackathon_store.matchmaking.read().await;
    let showcase = state.hackathon_store.showcase.read().await;

    if let Some(h) = hackathons.get(&clean_slug) {
        let extra_regs = registrations.get(&clean_slug).map_or(0, |v| v.len());
        let event_teams = teams.get(&clean_slug).cloned().unwrap_or_default();
        let event_matchmaking = matchmaking.get(&clean_slug).cloned().unwrap_or_default();
        let event_showcase = showcase.get(&clean_slug).cloned().unwrap_or_default();

        let detail = HackathonDetailResponse {
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
            registered_count: h.base_registered_count + extra_regs,
            tracks: h.tracks.clone(),
            milestones: h.milestones.clone(),
            rules: h.rules.clone(),
            eligibility: h.eligibility.clone(),
            teams: event_teams,
            matchmaking: event_matchmaking,
            showcase: event_showcase,
        };
        Ok(Json(detail))
    } else {
        Err(GatewayError::NotFound(format!("Hackathon '{}' not found", slug)))
    }
}

/// `POST /api/v1/hackathons/{slug}/register`
/// Registers user for hackathon and dynamically increments registered count in state.
pub async fn register_hackathon_handler(
    Path(slug): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<HackathonRegisterRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let clean_slug = slug.to_lowercase();
    let reg_id = Uuid::new_v4();

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
        hackathon_slug: clean_slug,
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
/// Creates a team (with generated 6-char code) or joins an existing team by invite code.
pub async fn create_or_join_team_handler(
    Path(slug): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<HackathonTeamRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let clean_slug = slug.to_lowercase();
    let mut teams = state.hackathon_store.teams.write().await;
    let team_list = teams.entry(clean_slug.clone()).or_default();

    if req.action == "join" {
        let code = req
            .invite_code
            .as_deref()
            .unwrap_or("")
            .trim()
            .to_uppercase();

        if let Some(existing) = team_list.iter_mut().find(|t| t.invite_code.to_uppercase() == code) {
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

    // Default: create team
    let team_name = req.team_name.unwrap_or_else(|| "Team Alpha".to_string());
    let team_id = Uuid::new_v4();

    // Generate strict 6-character uppercase alphanumeric code, e.g. "FLOW26"
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
        track: req.track,
    };
    team_list.push(new_team);

    let resp = HackathonTeamResponse {
        team_id,
        team_name,
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
/// Accepts and persists a final hackathon project artifact submission.
pub async fn submit_hackathon_project_handler(
    Path(slug): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<HackathonSubmissionRequest>,
) -> Result<impl IntoResponse, GatewayError> {
    let clean_slug = slug.to_lowercase();
    let submission_id = format!("proj-{}", &Uuid::new_v4().simple().to_string()[..6]);

    // Infer tech stack from track
    let tech_stack = if req.track.to_lowercase().contains("rust") {
        vec!["Rust".to_string(), "Axum".to_string(), "PostgreSQL".to_string(), "WebSockets".to_string()]
    } else if req.track.to_lowercase().contains("ai") {
        vec!["TypeScript".to_string(), "Gemini 2.5".to_string(), "React".to_string()]
    } else if req.track.to_lowercase().contains("fintech") || req.track.to_lowercase().contains("quant") {
        vec!["C++20".to_string(), "Python".to_string(), "Order Books".to_string(), "TimescaleDB".to_string()]
    } else {
        vec!["TypeScript".to_string(), "Node.js".to_string(), "Docker".to_string(), "GraphQL".to_string()]
    };

    let showcase_item = HackathonShowcaseItem {
        id: submission_id.clone(),
        team_name: req.team_name.clone(),
        project_title: req.project_title.clone(),
        tagline: req.tagline.clone(),
        track: req.track.clone(),
        github_url: req.github_url.clone(),
        live_url: req.live_url.clone(),
        demo_video_url: req.demo_video_url.clone(),
        architecture_deck_url: req.architecture_deck_url.clone(),
        upvotes: 1,
        rubric_score: 9.4,
        tech_stack,
    };

    let mut showcase = state.hackathon_store.showcase.write().await;
    let list = showcase.entry(clean_slug.clone()).or_default();
    list.insert(0, showcase_item);

    let resp = HackathonSubmissionResponse {
        submission_id: Uuid::new_v4(),
        project_id: submission_id,
        project_title: req.project_title,
        status: "SUBMITTED_FOR_EVALUATION".to_string(),
        submitted_at: Utc::now(),
        rubric_score: 9.4,
        message: format!(
            "Project submission successfully recorded for {} in track '{}'. Mentors will review against the 4-part rubric.",
            clean_slug, req.track
        ),
    };
    Ok((StatusCode::CREATED, Json(resp)))
}

/// `POST /api/v1/hackathons/{slug}/submissions/{id}/upvote`
/// Increments upvote count for a hackathon project submission in real time.
pub async fn upvote_hackathon_submission_handler(
    Path((slug, id)): Path<(String, String)>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, GatewayError> {
    let clean_slug = slug.to_lowercase();
    let mut showcase = state.hackathon_store.showcase.write().await;

    if let Some(list) = showcase.get_mut(&clean_slug) {
        if let Some(item) = list.iter_mut().find(|item| item.id == id) {
            item.upvotes += 1;
            let upvotes = item.upvotes;
            let resp = HackathonUpvoteResponse {
                id,
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


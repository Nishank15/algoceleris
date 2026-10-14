use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Cpp,
    Python,
    Java,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Verdict {
    Accepted,
    WrongAnswer,
    TimeLimitExceeded,
    MemoryLimitExceeded,
    CompilationError,
    RuntimeError,
    Pending,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum AssessmentMode {
    Exam,
    Homework,
    Viva,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum AssessmentStatus {
    Draft,
    Scheduled,
    Active,
    GracePeriod,
    Closed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum CampusRole {
    OrgAdmin,
    Instructor,
    Student,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum MembershipStatus {
    Active,
    Invited,
    Suspended,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RiskSeverity {
    Low,
    Elevated,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cohort {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub slug: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assessment {
    pub id: Uuid,
    pub org_id: Uuid,
    pub cohort_id: Uuid,
    pub title: String,
    pub mode: AssessmentMode,
    pub status: AssessmentStatus,
    pub publish_at: DateTime<Utc>,
    pub starts_at: DateTime<Utc>,
    pub due_at: DateTime<Utc>,
    pub cutoff_at: DateTime<Utc>,
    pub late_penalty_percent_per_hour: f64,
    pub max_late_penalty_percent: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RubricCriterion {
    pub id: Uuid,
    pub name: String,
    pub weight: f64,
    pub max_points: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RiskScore {
    pub score: u32,
    pub severity: RiskSeverity,
    pub tab_switches: u32,
    pub fullscreen_exits: u32,
    pub paste_bursts: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Submission {
    pub id: Uuid,
    pub user_id: Uuid,
    pub problem_id: Uuid,
    pub language: Language,
    pub source_code: String,
    pub verdict: Verdict,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssessmentSubmission {
    pub id: Uuid,
    pub assessment_id: Uuid,
    pub student_id: Uuid,
    pub raw_score: f64,
    pub late_penalty_deduction: f64,
    pub final_score: f64,
    pub submitted_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LatePenaltyResult {
    pub is_late: bool,
    pub hours_late: u32,
    pub seconds_late: f64,
    pub penalty_percent: f64,
    pub late_penalty_deduction: f64,
    pub final_score: f64,
}

use chrono::{DateTime, Utc};
use judge_core::errors::DomainError;
use judge_core::models::{
    Assessment, AssessmentMode, AssessmentStatus, AssessmentSubmission, Cohort, Language,
    Organization, RiskScore, RubricCriterion, Submission, Verdict,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct UserRecord {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub account_type: String,
    pub college_name: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct OrganizationRecord {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub domain_whitelist: serde_json::Value,
    pub branding_config: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl OrganizationRecord {
    /// Deserializes the domain whitelist from JSONB.
    ///
    /// # Errors
    /// Returns [`serde_json::Error`] if the JSON array cannot be parsed.
    pub fn parse_domain_whitelist(&self) -> Result<Vec<String>, serde_json::Error> {
        serde_json::from_value(self.domain_whitelist.clone())
    }
}

impl From<OrganizationRecord> for Organization {
    fn from(rec: OrganizationRecord) -> Self {
        Self {
            id: rec.id,
            name: rec.name,
            slug: rec.slug,
            created_at: rec.created_at,
        }
    }
}

impl From<&Organization> for OrganizationRecord {
    fn from(org: &Organization) -> Self {
        Self {
            id: org.id,
            name: org.name.clone(),
            slug: org.slug.clone(),
            domain_whitelist: serde_json::json!([]),
            branding_config: serde_json::json!({}),
            created_at: org.created_at,
            updated_at: org.created_at,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct CohortRecord {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub code: String,
    pub term: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

impl From<CohortRecord> for Cohort {
    fn from(rec: CohortRecord) -> Self {
        Self {
            id: rec.id,
            org_id: rec.org_id,
            name: rec.name,
            slug: rec.code,
            created_at: rec.created_at,
        }
    }
}

impl From<&Cohort> for CohortRecord {
    fn from(cohort: &Cohort) -> Self {
        Self {
            id: cohort.id,
            org_id: cohort.org_id,
            name: cohort.name.clone(),
            code: cohort.slug.clone(),
            term: "Active".to_string(),
            is_active: true,
            created_at: cohort.created_at,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct OrgMembershipRecord {
    pub id: Uuid,
    pub org_id: Uuid,
    pub user_id: Uuid,
    pub cohort_id: Option<Uuid>,
    pub role: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct AssessmentRecord {
    pub id: Uuid,
    pub org_id: Uuid,
    pub cohort_id: Uuid,
    pub title: String,
    pub description: String,
    pub mode: String,
    pub status: String,
    pub problem_slugs: serde_json::Value,
    pub scoring_rubric: serde_json::Value,
    pub publish_at: DateTime<Utc>,
    pub starts_at: DateTime<Utc>,
    pub due_at: DateTime<Utc>,
    pub cutoff_at: DateTime<Utc>,
    pub duration_minutes: Option<i32>,
    pub late_penalty_percent_per_hour: f64,
    pub max_late_penalty_percent: f64,
    pub proctoring_config: serde_json::Value,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl AssessmentRecord {
    /// Deserializes problem slugs array from JSONB.
    ///
    /// # Errors
    /// Returns [`serde_json::Error`] if the array format is invalid.
    pub fn parse_problem_slugs(&self) -> Result<Vec<String>, serde_json::Error> {
        serde_json::from_value(self.problem_slugs.clone())
    }

    /// Deserializes scoring rubric list from JSONB.
    ///
    /// # Errors
    /// Returns [`serde_json::Error`] if the scoring rubric schema does not match.
    pub fn parse_scoring_rubric(&self) -> Result<Vec<RubricCriterion>, serde_json::Error> {
        serde_json::from_value(self.scoring_rubric.clone())
    }
}

impl TryFrom<AssessmentRecord> for Assessment {
    type Error = DomainError;

    fn try_from(rec: AssessmentRecord) -> Result<Self, Self::Error> {
        let mode = match rec.mode.to_uppercase().as_str() {
            "EXAM" => AssessmentMode::Exam,
            "HOMEWORK" => AssessmentMode::Homework,
            "VIVA" => AssessmentMode::Viva,
            other => {
                return Err(DomainError::NotFound(format!(
                    "unrecognized assessment mode: {other}"
                )))
            }
        };

        let status = match rec.status.to_uppercase().as_str() {
            "DRAFT" => AssessmentStatus::Draft,
            "SCHEDULED" => AssessmentStatus::Scheduled,
            "ACTIVE" => AssessmentStatus::Active,
            "GRACE_PERIOD" => AssessmentStatus::GracePeriod,
            "CLOSED" => AssessmentStatus::Closed,
            other => {
                return Err(DomainError::NotFound(format!(
                    "unrecognized assessment status: {other}"
                )))
            }
        };

        Ok(Self {
            id: rec.id,
            org_id: rec.org_id,
            cohort_id: rec.cohort_id,
            title: rec.title,
            mode,
            status,
            publish_at: rec.publish_at,
            starts_at: rec.starts_at,
            due_at: rec.due_at,
            cutoff_at: rec.cutoff_at,
            late_penalty_percent_per_hour: rec.late_penalty_percent_per_hour,
            max_late_penalty_percent: rec.max_late_penalty_percent,
        })
    }
}

impl From<&Assessment> for AssessmentRecord {
    fn from(a: &Assessment) -> Self {
        let mode = match a.mode {
            AssessmentMode::Exam => "EXAM",
            AssessmentMode::Homework => "HOMEWORK",
            AssessmentMode::Viva => "VIVA",
        }
        .to_string();

        let status = match a.status {
            AssessmentStatus::Draft => "DRAFT",
            AssessmentStatus::Scheduled => "SCHEDULED",
            AssessmentStatus::Active => "ACTIVE",
            AssessmentStatus::GracePeriod => "GRACE_PERIOD",
            AssessmentStatus::Closed => "CLOSED",
        }
        .to_string();

        Self {
            id: a.id,
            org_id: a.org_id,
            cohort_id: a.cohort_id,
            title: a.title.clone(),
            description: String::new(),
            mode,
            status,
            problem_slugs: serde_json::json!([]),
            scoring_rubric: serde_json::json!([]),
            publish_at: a.publish_at,
            starts_at: a.starts_at,
            due_at: a.due_at,
            cutoff_at: a.cutoff_at,
            duration_minutes: None,
            late_penalty_percent_per_hour: a.late_penalty_percent_per_hour,
            max_late_penalty_percent: a.max_late_penalty_percent,
            proctoring_config: serde_json::json!({}),
            created_by: Uuid::nil(),
            created_at: a.publish_at,
            updated_at: a.publish_at,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct InterviewRoomRecord {
    pub id: Uuid,
    pub room_code: String,
    pub org_id: Option<Uuid>,
    pub assessment_id: Option<Uuid>,
    pub host_user_id: Uuid,
    pub candidate_user_id: Option<Uuid>,
    pub language: String,
    pub status: String,
    pub editor_code: String,
    pub interviewer_notes: String,
    pub rubric_scores: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct SubmissionRecord {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub problem_slug: String,
    pub language: String,
    pub code: String,
    pub verdict: String,
    pub runtime_ms: i32,
    pub memory_kb: i32,
    pub testcases_passed: i32,
    pub total_testcases: i32,
    pub created_at: DateTime<Utc>,
    pub assessment_id: Option<Uuid>,
    pub room_id: Option<Uuid>,
}

impl SubmissionRecord {
    /// Attempts to parse the record's language into [`Language`].
    ///
    /// # Errors
    /// Returns [`DomainError::NotFound`] if the language is unsupported.
    pub fn parse_language(&self) -> Result<Language, DomainError> {
        match self.language.to_lowercase().as_str() {
            "cpp" | "c++" => Ok(Language::Cpp),
            "python" | "py" => Ok(Language::Python),
            "java" => Ok(Language::Java),
            other => Err(DomainError::NotFound(format!("unsupported language: {other}"))),
        }
    }

    /// Attempts to parse the record's verdict into [`Verdict`].
    ///
    /// # Errors
    /// Returns [`DomainError::NotFound`] if the verdict string is unrecognized.
    pub fn parse_verdict(&self) -> Result<Verdict, DomainError> {
        match self.verdict.to_uppercase().as_str() {
            "ACCEPTED" | "AC" => Ok(Verdict::Accepted),
            "WRONG_ANSWER" | "WA" => Ok(Verdict::WrongAnswer),
            "TIME_LIMIT_EXCEEDED" | "TLE" => Ok(Verdict::TimeLimitExceeded),
            "MEMORY_LIMIT_EXCEEDED" | "MLE" => Ok(Verdict::MemoryLimitExceeded),
            "COMPILATION_ERROR" | "CE" => Ok(Verdict::CompilationError),
            "RUNTIME_ERROR" | "RE" => Ok(Verdict::RuntimeError),
            "PENDING" => Ok(Verdict::Pending),
            other => Err(DomainError::NotFound(format!("unrecognized verdict: {other}"))),
        }
    }
}

impl TryFrom<SubmissionRecord> for Submission {
    type Error = DomainError;

    fn try_from(rec: SubmissionRecord) -> Result<Self, Self::Error> {
        let language = rec.parse_language()?;
        let verdict = rec.parse_verdict()?;
        let user_id = rec.user_id.unwrap_or_default();

        Ok(Self {
            id: rec.id,
            user_id,
            problem_id: Uuid::nil(),
            language,
            source_code: rec.code,
            verdict,
        })
    }
}

impl From<&Submission> for SubmissionRecord {
    fn from(sub: &Submission) -> Self {
        let language = match sub.language {
            Language::Cpp => "cpp",
            Language::Python => "python",
            Language::Java => "java",
        }
        .to_string();

        let verdict = match sub.verdict {
            Verdict::Accepted => "ACCEPTED",
            Verdict::WrongAnswer => "WRONG_ANSWER",
            Verdict::TimeLimitExceeded => "TIME_LIMIT_EXCEEDED",
            Verdict::MemoryLimitExceeded => "MEMORY_LIMIT_EXCEEDED",
            Verdict::CompilationError => "COMPILATION_ERROR",
            Verdict::RuntimeError => "RUNTIME_ERROR",
            Verdict::Pending => "PENDING",
        }
        .to_string();

        Self {
            id: sub.id,
            user_id: Some(sub.user_id),
            problem_slug: sub.problem_id.to_string(),
            language,
            code: sub.source_code.clone(),
            verdict,
            runtime_ms: 0,
            memory_kb: 0,
            testcases_passed: 0,
            total_testcases: 0,
            created_at: Utc::now(),
            assessment_id: None,
            room_id: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct AssessmentSubmissionRecord {
    pub id: Uuid,
    pub assessment_id: Uuid,
    pub user_id: Uuid,
    pub submission_id: Uuid,
    pub raw_score: f64,
    pub late_penalty_deduction: f64,
    pub final_score: f64,
    pub submitted_at: DateTime<Utc>,
    pub is_late: bool,
    pub proctor_events_count: i32,
    pub eval_verdict: String,
    pub feedback_notes: Option<String>,
}

impl From<AssessmentSubmissionRecord> for AssessmentSubmission {
    fn from(rec: AssessmentSubmissionRecord) -> Self {
        Self {
            id: rec.id,
            assessment_id: rec.assessment_id,
            student_id: rec.user_id,
            raw_score: rec.raw_score,
            late_penalty_deduction: rec.late_penalty_deduction,
            final_score: rec.final_score,
            submitted_at: rec.submitted_at,
        }
    }
}

impl From<&AssessmentSubmission> for AssessmentSubmissionRecord {
    fn from(sub: &AssessmentSubmission) -> Self {
        Self {
            id: sub.id,
            assessment_id: sub.assessment_id,
            user_id: sub.student_id,
            submission_id: Uuid::nil(),
            raw_score: sub.raw_score,
            late_penalty_deduction: sub.late_penalty_deduction,
            final_score: sub.final_score,
            submitted_at: sub.submitted_at,
            is_late: sub.late_penalty_deduction > 0.0,
            proctor_events_count: 0,
            eval_verdict: "PENDING".to_string(),
            feedback_notes: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct ProctorEventRecord {
    pub id: Uuid,
    pub assessment_id: Uuid,
    pub user_id: Uuid,
    pub event_type: String,
    pub severity: String,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize, FromRow)]
pub struct ProctorEventCounts {
    pub total: i64,
    pub tab_switches: i64,
    pub fullscreen_exits: i64,
    pub paste_bursts: i64,
}

impl ProctorEventCounts {
    #[must_use]
    pub fn to_risk_score(&self) -> RiskScore {
        let tab = u32::try_from(self.tab_switches).unwrap_or(0);
        let fs = u32::try_from(self.fullscreen_exits).unwrap_or(0);
        let paste = u32::try_from(self.paste_bursts).unwrap_or(0);
        judge_core::calculate_risk_score(tab, fs, paste)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewMember {
    pub user_id: Uuid,
    pub role: String,
    pub status: String,
}

impl NewMember {
    #[must_use]
    pub fn student(user_id: Uuid) -> Self {
        Self {
            user_id,
            role: "student".to_string(),
            status: "active".to_string(),
        }
    }

    #[must_use]
    pub fn new(user_id: Uuid, role: impl Into<String>, status: impl Into<String>) -> Self {
        Self {
            user_id,
            role: role.into(),
            status: status.into(),
        }
    }
}

use chrono::Utc;
use judge_core::models::{
    Assessment, AssessmentMode, AssessmentStatus, Cohort, Organization, RubricCriterion,
};
use judge_db::errors::DbError;
use judge_db::models::{AssessmentRecord, CohortRecord, OrganizationRecord};
use uuid::Uuid;

#[test]
fn test_organization_round_trip_conversion() {
    let org_id = Uuid::new_v4();
    let now = Utc::now();
    let domain_whitelist = vec!["mit.edu".to_string(), "harvard.edu".to_string()];

    let record = OrganizationRecord {
        id: org_id,
        name: "MIT School of Engineering".to_string(),
        slug: "mit-engineering".to_string(),
        domain_whitelist: serde_json::to_value(&domain_whitelist).unwrap(),
        branding_config: serde_json::json!({ "primary_color": "#e4f222" }),
        created_at: now,
        updated_at: now,
    };

    // Test JSONB deserialization helper
    let parsed_whitelist = record.parse_domain_whitelist().unwrap();
    assert_eq!(parsed_whitelist, domain_whitelist);

    // Convert to domain model
    let domain: Organization = record.clone().into();
    assert_eq!(domain.id, org_id);
    assert_eq!(domain.name, "MIT School of Engineering");
    assert_eq!(domain.slug, "mit-engineering");

    // Convert back from domain model
    let back_to_record: OrganizationRecord = (&domain).into();
    assert_eq!(back_to_record.id, org_id);
    assert_eq!(back_to_record.name, domain.name);
    assert_eq!(back_to_record.slug, domain.slug);
}

#[test]
fn test_cohort_round_trip_conversion() {
    let cohort_id = Uuid::new_v4();
    let org_id = Uuid::new_v4();
    let now = Utc::now();

    let record = CohortRecord {
        id: cohort_id,
        org_id,
        name: "CS101 Fall 2026".to_string(),
        code: "CS101-F26".to_string(),
        term: "Fall 2026".to_string(),
        is_active: true,
        created_at: now,
    };

    let domain: Cohort = record.clone().into();
    assert_eq!(domain.id, cohort_id);
    assert_eq!(domain.org_id, org_id);
    assert_eq!(domain.name, "CS101 Fall 2026");
    assert_eq!(domain.slug, "CS101-F26");

    let back_to_record: CohortRecord = (&domain).into();
    assert_eq!(back_to_record.id, cohort_id);
    assert_eq!(back_to_record.org_id, org_id);
    assert_eq!(back_to_record.code, domain.slug);
}

#[test]
fn test_assessment_round_trip_and_jsonb_parsing() {
    let id = Uuid::new_v4();
    let org_id = Uuid::new_v4();
    let cohort_id = Uuid::new_v4();
    let now = Utc::now();

    let problem_slugs = vec!["two-sum".to_string(), "lru-cache".to_string()];
    let rubric = vec![
        RubricCriterion {
            id: Uuid::new_v4(),
            name: "Decomposition".to_string(),
            weight: 50.0,
            max_points: 100.0,
        },
        RubricCriterion {
            id: Uuid::new_v4(),
            name: "Implementation".to_string(),
            weight: 50.0,
            max_points: 100.0,
        },
    ];

    let record = AssessmentRecord {
        id,
        org_id,
        cohort_id,
        title: "Midterm Assessment".to_string(),
        description: "Comprehensive algorithms evaluation".to_string(),
        mode: "EXAM".to_string(),
        status: "ACTIVE".to_string(),
        problem_slugs: serde_json::to_value(&problem_slugs).unwrap(),
        scoring_rubric: serde_json::to_value(&rubric).unwrap(),
        publish_at: now,
        starts_at: now,
        due_at: now,
        cutoff_at: now,
        duration_minutes: Some(120),
        late_penalty_percent_per_hour: 15.0,
        max_late_penalty_percent: 60.0,
        proctoring_config: serde_json::json!({ "enforce_fullscreen": true }),
        created_by: Uuid::new_v4(),
        created_at: now,
        updated_at: now,
    };

    // Test JSONB deserialization methods
    assert_eq!(record.parse_problem_slugs().unwrap(), problem_slugs);
    assert_eq!(record.parse_scoring_rubric().unwrap(), rubric);

    // Convert to domain model
    let domain: Assessment = record.try_into().unwrap();
    assert_eq!(domain.id, id);
    assert_eq!(domain.title, "Midterm Assessment");
    assert_eq!(domain.mode, AssessmentMode::Exam);
    assert_eq!(domain.status, AssessmentStatus::Active);
    assert!((domain.late_penalty_percent_per_hour - 15.0).abs() < 1e-4);

    // Convert back from domain model
    let back: AssessmentRecord = (&domain).into();
    assert_eq!(back.id, id);
    assert_eq!(back.mode, "EXAM");
    assert_eq!(back.status, "ACTIVE");
}

#[test]
fn test_error_formatting_constraint_violations() {
    let unique_err = DbError::UniqueViolation("uq_org_cohort_code".to_string());
    assert_eq!(
        unique_err.to_string(),
        "unique constraint violation: uq_org_cohort_code"
    );

    let fk_err = DbError::ForeignKeyViolation("fk_cohort_org_id".to_string());
    assert_eq!(
        fk_err.to_string(),
        "foreign key constraint violation: fk_cohort_org_id"
    );

    let pool_err = DbError::PoolError("timeout acquiring connection".to_string());
    assert_eq!(
        pool_err.to_string(),
        "connection pool error: timeout acquiring connection"
    );

    let ser_err = DbError::SerializationError("invalid UTF-8".to_string());
    assert_eq!(ser_err.to_string(), "serialization error: invalid UTF-8");
}

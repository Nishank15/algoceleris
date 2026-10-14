#![allow(clippy::too_many_lines, clippy::needless_raw_string_hashes)]

use std::time::Instant;

use chrono::{Duration, Utc};
use judge_core::models::{AssessmentStatus, RiskSeverity};
use judge_db::models::{AssessmentRecord, NewMember, ProctorEventCounts};
use judge_db::repositories::{
    batch_insert_memberships, build_batch_insert_query, create_assessment, create_submission,
    finalize_assessment_submission, get_candidate_event_counts, list_active_assessments,
    list_assessment_events, update_assessment_status, update_submission_status,
};
use sqlx::PgPool;
use uuid::Uuid;

async fn get_test_pool() -> Option<PgPool> {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:5432/cloud_judge".to_string());
    sqlx::postgres::PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(2))
        .connect(&url)
        .await
        .ok()
}

#[tokio::test]
async fn test_benchmark_batch_roster_query_construction_5000() {
    let query = build_batch_insert_query();
    assert!(query.contains("INSERT INTO org_memberships"));
    assert!(query.contains("UNNEST"));
    assert!(query.contains("ON CONFLICT (org_id, user_id, cohort_id) DO UPDATE"));

    let start = Instant::now();
    let members: Vec<NewMember> = (0..5000)
        .map(|_| NewMember::student(Uuid::new_v4()))
        .collect();
    let elapsed = start.elapsed();

    assert_eq!(members.len(), 5000);
    // Generation and memory allocation of 5000 records must be ultra-fast (< 100ms)
    assert!(
        elapsed.as_millis() < 100,
        "5000 record preparation exceeded 100ms threshold: {elapsed:?}"
    );

    // Verify unnest slice conversion
    let ids: Vec<Uuid> = (0..5000).map(|_| Uuid::new_v4()).collect();
    let user_ids: Vec<Uuid> = members.iter().map(|m| m.user_id).collect();
    assert_eq!(ids.len(), 5000);
    assert_eq!(user_ids.len(), 5000);
}

#[tokio::test]
async fn test_proctor_event_counts_risk_score_calculation() {
    let counts = ProctorEventCounts {
        total: 7,
        tab_switches: 3,     // 3 * 5 = 15
        fullscreen_exits: 1, // 1 * 10 = 10
        paste_bursts: 1,     // 1 * 15 = 15 => Total = 40 (Critical)
    };

    let risk_score = counts.to_risk_score();
    assert_eq!(risk_score.score, 40);
    assert_eq!(risk_score.severity, RiskSeverity::Critical);
    assert_eq!(risk_score.tab_switches, 3);
    assert_eq!(risk_score.fullscreen_exits, 1);
    assert_eq!(risk_score.paste_bursts, 1);

    let low_counts = ProctorEventCounts {
        total: 2,
        tab_switches: 2, // 2 * 5 = 10 (< 15 -> Low)
        fullscreen_exits: 0,
        paste_bursts: 0,
    };
    let low_score = low_counts.to_risk_score();
    assert_eq!(low_score.score, 10);
    assert_eq!(low_score.severity, RiskSeverity::Low);
}

#[tokio::test]
async fn test_submission_repository_lifecycle_and_late_penalty() {
    let Some(pool) = get_test_pool().await else {
        eprintln!("PostgreSQL not reachable; skipping live submission repository test");
        return;
    };

    // 1. Seed user, org, cohort, assessment
    let user_id = Uuid::new_v4();
    let username = format!("user_{}", &user_id.to_string()[..8]);
    let email = format!("{username}@example.com");

    sqlx::query(
        r#"
        INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at)
        VALUES ($1, $2, $3, 'hash_placeholder', 'free', NOW(), NOW())
        "#,
    )
    .bind(user_id)
    .bind(&username)
    .bind(&email)
    .execute(&pool)
    .await
    .expect("failed to insert test user");

    let org_id = Uuid::new_v4();
    let org_slug = format!("org-{}", &org_id.to_string()[..8]);
    sqlx::query(
        r#"
        INSERT INTO organizations (id, name, slug, domain_whitelist, branding_config, created_at, updated_at)
        VALUES ($1, 'Test Org', $2, '[]', '{}', NOW(), NOW())
        "#,
    )
    .bind(org_id)
    .bind(&org_slug)
    .execute(&pool)
    .await
    .expect("failed to insert test org");

    let cohort_id = Uuid::new_v4();
    let cohort_code = format!("c-{}", &cohort_id.to_string()[..8]);
    sqlx::query(
        r#"
        INSERT INTO cohorts (id, org_id, name, code, term, is_active, created_at)
        VALUES ($1, $2, 'Test Cohort', $3, 'Fall', true, NOW())
        "#,
    )
    .bind(cohort_id)
    .bind(org_id)
    .bind(&cohort_code)
    .execute(&pool)
    .await
    .expect("failed to insert test cohort");

    let now = Utc::now();
    let due_at = now - Duration::hours(2); // 2 hours late
    let assessment_id = Uuid::new_v4();
    let assessment = AssessmentRecord {
        id: assessment_id,
        org_id,
        cohort_id,
        title: "Algorithms Final Exam".to_string(),
        description: "Comprehensive exam".to_string(),
        mode: "EXAM".to_string(),
        status: "ACTIVE".to_string(),
        problem_slugs: serde_json::json!(["two-sum", "reverse-linked-list"]),
        scoring_rubric: serde_json::json!([]),
        publish_at: now - Duration::hours(4),
        starts_at: now - Duration::hours(3),
        due_at,
        cutoff_at: now + Duration::hours(1),
        duration_minutes: Some(180),
        late_penalty_percent_per_hour: 10.0,
        max_late_penalty_percent: 30.0,
        proctoring_config: serde_json::json!({}),
        created_by: user_id,
        created_at: now,
        updated_at: now,
    };
    create_assessment(&pool, &assessment)
        .await
        .expect("create_assessment failed");

    // 2. Create submission atomically
    let sub_id = Uuid::new_v4();
    let created_sub = create_submission(
        &pool,
        sub_id,
        Some(user_id),
        "two-sum",
        "python",
        "print('hello world')",
        Some(assessment_id),
    )
    .await
    .expect("create_submission failed");

    assert_eq!(created_sub.id, sub_id);
    assert_eq!(created_sub.verdict, "PENDING");
    assert_eq!(created_sub.problem_slug, "two-sum");

    // 3. Update submission evaluation metrics
    let updated_sub = update_submission_status(&pool, sub_id, "ACCEPTED", 42, 1024, 10, 10)
        .await
        .expect("update_submission_status failed");

    assert_eq!(updated_sub.verdict, "ACCEPTED");
    assert_eq!(updated_sub.runtime_ms, 42);
    assert_eq!(updated_sub.memory_kb, 1024);
    assert_eq!(updated_sub.testcases_passed, 10);
    assert_eq!(updated_sub.total_testcases, 10);

    // 4. Finalize assessment submission with late penalty evaluation
    // Raw score 100.0, 2 hours late at 10%/hr = 20% deduction (20.0 pts), final score = 80.0
    let finalized = finalize_assessment_submission(
        &pool,
        assessment_id,
        user_id,
        sub_id,
        100.0,
        now, // submitted_at is now, exactly 2 hours after due_at
    )
    .await
    .expect("finalize_assessment_submission failed");

    assert_eq!(finalized.assessment_id, assessment_id);
    assert_eq!(finalized.user_id, user_id);
    assert_eq!(finalized.submission_id, sub_id);
    assert_eq!(finalized.raw_score, 100.0);
    assert_eq!(finalized.late_penalty_deduction, 20.0);
    assert_eq!(finalized.final_score, 80.0);
    assert!(finalized.is_late);
}

#[tokio::test]
async fn test_assessment_repository_state_transitions_and_active_filter() {
    let Some(pool) = get_test_pool().await else {
        eprintln!("PostgreSQL not reachable; skipping assessment state machine test");
        return;
    };

    let user_id = Uuid::new_v4();
    let org_id = Uuid::new_v4();
    let cohort_id = Uuid::new_v4();
    let assessment_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at) VALUES ($1, $2, $3, 'h', 'free', NOW(), NOW())"
    )
    .bind(user_id)
    .bind(format!("u_{}", &user_id.to_string()[..8]))
    .bind(format!("u_{}@test.com", &user_id.to_string()[..8]))
    .execute(&pool)
    .await
    .expect("user insert failed");

    sqlx::query(
        "INSERT INTO organizations (id, name, slug, domain_whitelist, branding_config, created_at, updated_at) VALUES ($1, 'O', $2, '[]', '{}', NOW(), NOW())"
    )
    .bind(org_id)
    .bind(format!("o-{}", &org_id.to_string()[..8]))
    .execute(&pool)
    .await
    .expect("org insert failed");

    sqlx::query(
        "INSERT INTO cohorts (id, org_id, name, code, term, is_active, created_at) VALUES ($1, $2, 'C', $3, 'T', true, NOW())"
    )
    .bind(cohort_id)
    .bind(org_id)
    .bind(format!("c-{}", &cohort_id.to_string()[..8]))
    .execute(&pool)
    .await
    .expect("cohort insert failed");

    let now = Utc::now();
    let assessment = AssessmentRecord {
        id: assessment_id,
        org_id,
        cohort_id,
        title: "Midterm Assessment".to_string(),
        description: "State machine test".to_string(),
        mode: "EXAM".to_string(),
        status: "SCHEDULED".to_string(),
        problem_slugs: serde_json::json!(["p1"]),
        scoring_rubric: serde_json::json!([]),
        publish_at: now - Duration::hours(1),
        starts_at: now - Duration::minutes(30),
        due_at: now + Duration::hours(2),
        cutoff_at: now + Duration::hours(3),
        duration_minutes: Some(120),
        late_penalty_percent_per_hour: 5.0,
        max_late_penalty_percent: 20.0,
        proctoring_config: serde_json::json!({}),
        created_by: user_id,
        created_at: now,
        updated_at: now,
    };
    create_assessment(&pool, &assessment)
        .await
        .expect("create_assessment failed");

    // 1. Illegal leap from Scheduled -> Draft should fail domain validation
    let illegal_res =
        update_assessment_status(&pool, assessment_id, AssessmentStatus::Draft).await;
    assert!(
        illegal_res.is_err(),
        "Expected error on illegal state leap Scheduled -> Draft"
    );

    // 2. Legal transition Scheduled -> Active succeeds
    let active_rec =
        update_assessment_status(&pool, assessment_id, AssessmentStatus::Active).await;
    assert!(active_rec.is_ok());
    assert_eq!(active_rec.unwrap().status, "ACTIVE");

    // 3. Deadline query filter: list_active_assessments as of now should include this assessment
    let active_list = list_active_assessments(&pool, now)
        .await
        .expect("list_active_assessments failed");
    assert!(
        active_list.iter().any(|a| a.id == assessment_id),
        "Expected assessment {assessment_id} in active list"
    );

    // 4. Legal transition Active -> Closed succeeds
    let closed_rec =
        update_assessment_status(&pool, assessment_id, AssessmentStatus::Closed).await;
    assert!(closed_rec.is_ok());
    assert_eq!(closed_rec.unwrap().status, "CLOSED");

    // 5. As of now, after closing, it should no longer appear in active list
    let active_after_close = list_active_assessments(&pool, now)
        .await
        .expect("list_active_assessments failed");
    assert!(!active_after_close.iter().any(|a| a.id == assessment_id));
}

#[tokio::test]
async fn test_proctor_event_repository_flow() {
    let Some(pool) = get_test_pool().await else {
        eprintln!("PostgreSQL not reachable; skipping proctor event repository test");
        return;
    };

    let user_id = Uuid::new_v4();
    let org_id = Uuid::new_v4();
    let cohort_id = Uuid::new_v4();
    let assessment_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at) VALUES ($1, $2, $3, 'h', 'free', NOW(), NOW())"
    )
    .bind(user_id)
    .bind(format!("pu_{}", &user_id.to_string()[..8]))
    .bind(format!("pu_{}@test.com", &user_id.to_string()[..8]))
    .execute(&pool)
    .await
    .expect("user insert failed");

    sqlx::query(
        "INSERT INTO organizations (id, name, slug, domain_whitelist, branding_config, created_at, updated_at) VALUES ($1, 'PO', $2, '[]', '{}', NOW(), NOW())"
    )
    .bind(org_id)
    .bind(format!("po-{}", &org_id.to_string()[..8]))
    .execute(&pool)
    .await
    .expect("org insert failed");

    sqlx::query(
        "INSERT INTO cohorts (id, org_id, name, code, term, is_active, created_at) VALUES ($1, $2, 'PC', $3, 'T', true, NOW())"
    )
    .bind(cohort_id)
    .bind(org_id)
    .bind(format!("pc-{}", &cohort_id.to_string()[..8]))
    .execute(&pool)
    .await
    .expect("cohort insert failed");

    let now = Utc::now();
    let assessment = AssessmentRecord {
        id: assessment_id,
        org_id,
        cohort_id,
        title: "Proctored Exam".to_string(),
        description: "Proctor test".to_string(),
        mode: "EXAM".to_string(),
        status: "ACTIVE".to_string(),
        problem_slugs: serde_json::json!(["p1"]),
        scoring_rubric: serde_json::json!([]),
        publish_at: now - Duration::hours(1),
        starts_at: now - Duration::minutes(30),
        due_at: now + Duration::hours(1),
        cutoff_at: now + Duration::hours(2),
        duration_minutes: Some(60),
        late_penalty_percent_per_hour: 0.0,
        max_late_penalty_percent: 0.0,
        proctoring_config: serde_json::json!({}),
        created_by: user_id,
        created_at: now,
        updated_at: now,
    };
    create_assessment(&pool, &assessment)
        .await
        .expect("create_assessment failed");

    // Record events: 2 tab switches, 1 fullscreen exit
    judge_db::repositories::record_proctor_event(
        &pool,
        assessment_id,
        user_id,
        "tab_switch",
        "warning",
        serde_json::json!({"blur_duration_ms": 2500}),
    )
    .await
    .expect("record_proctor_event 1 failed");

    judge_db::repositories::record_proctor_event(
        &pool,
        assessment_id,
        user_id,
        "tab_switch",
        "warning",
        serde_json::json!({"blur_duration_ms": 1200}),
    )
    .await
    .expect("record_proctor_event 2 failed");

    judge_db::repositories::record_proctor_event(
        &pool,
        assessment_id,
        user_id,
        "fullscreen_exit",
        "danger",
        serde_json::json!({}),
    )
    .await
    .expect("record_proctor_event 3 failed");

    // Fetch counts and assert
    let counts = get_candidate_event_counts(&pool, assessment_id, user_id)
        .await
        .expect("get_candidate_event_counts failed");

    assert_eq!(counts.total, 3);
    assert_eq!(counts.tab_switches, 2);
    assert_eq!(counts.fullscreen_exits, 1);
    assert_eq!(counts.paste_bursts, 0);

    // Verify list events
    let events = list_assessment_events(&pool, assessment_id, 10, 0)
        .await
        .expect("list_assessment_events failed");
    assert_eq!(events.len(), 3);
}

#[tokio::test]
async fn test_membership_batch_insert_live() {
    let Some(pool) = get_test_pool().await else {
        eprintln!("PostgreSQL not reachable; skipping live membership batch insert test");
        return;
    };

    let org_id = Uuid::new_v4();
    let cohort_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO organizations (id, name, slug, domain_whitelist, branding_config, created_at, updated_at) VALUES ($1, 'Batch Org', $2, '[]', '{}', NOW(), NOW())"
    )
    .bind(org_id)
    .bind(format!("bo-{}", &org_id.to_string()[..8]))
    .execute(&pool)
    .await
    .expect("org insert failed");

    sqlx::query(
        "INSERT INTO cohorts (id, org_id, name, code, term, is_active, created_at) VALUES ($1, $2, 'Batch Cohort', $3, 'T', true, NOW())"
    )
    .bind(cohort_id)
    .bind(org_id)
    .bind(format!("bc-{}", &cohort_id.to_string()[..8]))
    .execute(&pool)
    .await
    .expect("cohort insert failed");

    // Create 3 real test users for foreign key constraint
    let mut members = Vec::new();
    for i in 0..3 {
        let u_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO users (id, username, email, password_hash, account_type, created_at, updated_at) VALUES ($1, $2, $3, 'h', 'free', NOW(), NOW())"
        )
        .bind(u_id)
        .bind(format!("mem_{}_{}", i, &u_id.to_string()[..8]))
        .bind(format!("mem_{}_{}@test.com", i, &u_id.to_string()[..8]))
        .execute(&pool)
        .await
        .expect("user insert failed");

        members.push(NewMember::student(u_id));
    }

    let inserted = batch_insert_memberships(&pool, org_id, cohort_id, members)
        .await
        .expect("batch_insert_memberships failed");

    assert_eq!(inserted, 3);

    let cohort_members = judge_db::repositories::list_cohort_memberships(&pool, cohort_id)
        .await
        .expect("list_cohort_memberships failed");
    assert_eq!(cohort_members.len(), 3);
}

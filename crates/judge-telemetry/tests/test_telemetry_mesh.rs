use chrono::Utc;
use judge_core::models::RiskSeverity;
use judge_telemetry::{
    format_telemetry_channel, CandidateProctorState, TelemetryError, TelemetryEvent,
    TelemetryEventType, TelemetryRelay, TokenBucket,
};
use uuid::Uuid;

#[test]
fn test_telemetry_frame_parsing() -> Result<(), TelemetryError> {
    let assessment_id = Uuid::new_v4();
    let candidate_id = Uuid::new_v4();

    // 1. Tab switch frame
    let json_tab = format!(
        r#"{{
            "assessment_id": "{assessment_id}",
            "candidate_id": "{candidate_id}",
            "event_type": "tab_switch",
            "timestamp": "2026-10-13T10:00:00Z",
            "metadata": {{ "blurred_duration_ms": 1450 }}
        }}"#
    );
    let event_tab: TelemetryEvent = serde_json::from_str(&json_tab)?;
    assert_eq!(event_tab.event_type, TelemetryEventType::TabSwitch);
    assert_eq!(event_tab.assessment_id, assessment_id);
    assert_eq!(event_tab.candidate_id, candidate_id);
    assert_eq!(
        event_tab.metadata["blurred_duration_ms"],
        serde_json::json!(1450)
    );

    // 2. Fullscreen exit frame
    let json_fullscreen = format!(
        r#"{{
            "assessment_id": "{assessment_id}",
            "candidate_id": "{candidate_id}",
            "event_type": "fullscreen_exit",
            "timestamp": "2026-10-13T10:01:00Z",
            "metadata": {{ "reason": "esc_key" }}
        }}"#
    );
    let event_fs: TelemetryEvent = serde_json::from_str(&json_fullscreen)?;
    assert_eq!(event_fs.event_type, TelemetryEventType::FullscreenExit);

    // 3. Paste burst frame
    let json_paste = format!(
        r#"{{
            "assessment_id": "{assessment_id}",
            "candidate_id": "{candidate_id}",
            "event_type": "paste_burst",
            "timestamp": "2026-10-13T10:02:00Z",
            "metadata": {{ "char_count": 350 }}
        }}"#
    );
    let event_paste: TelemetryEvent = serde_json::from_str(&json_paste)?;
    assert_eq!(event_paste.event_type, TelemetryEventType::PasteBurst);

    Ok(())
}

#[tokio::test]
async fn test_rate_limiter_throttling() {
    // Capacity of 3 tokens, refill rate of 50 tokens/sec
    let mut bucket = TokenBucket::new(3.0, 50.0);

    // Initial 3 bursts must succeed
    assert!(bucket.try_acquire().is_ok());
    assert!(bucket.try_acquire().is_ok());
    assert!(bucket.try_acquire().is_ok());

    // 4th immediate burst must be rejected with RateLimitExceeded
    let err = bucket.try_acquire();
    assert!(
        matches!(err, Err(TelemetryError::RateLimitExceeded(_))),
        "expected RateLimitExceeded, got {err:?}"
    );

    // Wait 30ms for token replenishment (30ms * 50 tokens/sec = 1.5 tokens)
    tokio::time::sleep(tokio::time::Duration::from_millis(30)).await;

    // Next token should succeed
    assert!(bucket.try_acquire().is_ok());
}

#[test]
fn test_candidate_anomaly_counts_and_risk_escalation() {
    let assessment_id = Uuid::new_v4();
    let candidate_id = Uuid::new_v4();
    let mut state = CandidateProctorState::new(assessment_id, candidate_id);

    assert_eq!(state.risk_score.score, 0);
    assert_eq!(state.risk_score.severity, RiskSeverity::Low);

    // Event 1: Tab switch (+5 pts -> 5 pts, Low)
    let ev1 = TelemetryEvent::new(
        assessment_id,
        candidate_id,
        TelemetryEventType::TabSwitch,
        Utc::now(),
        serde_json::Value::Null,
    );
    let alert1 = state.record_event(&ev1);
    assert_eq!(state.tab_switches, 1);
    assert_eq!(state.risk_score.score, 5);
    assert_eq!(state.risk_score.severity, RiskSeverity::Low);
    assert!(alert1.is_none());

    // Event 2: Tab switch (+5 pts -> 10 pts, Low)
    let ev2 = TelemetryEvent::new(
        assessment_id,
        candidate_id,
        TelemetryEventType::TabSwitch,
        Utc::now(),
        serde_json::Value::Null,
    );
    let alert2 = state.record_event(&ev2);
    assert_eq!(state.tab_switches, 2);
    assert_eq!(state.risk_score.score, 10);
    assert_eq!(state.risk_score.severity, RiskSeverity::Low);
    assert!(alert2.is_none());

    // Event 3: Tab switch (+5 pts -> 15 pts, Elevated! Escalation triggered)
    let ev3 = TelemetryEvent::new(
        assessment_id,
        candidate_id,
        TelemetryEventType::TabSwitch,
        Utc::now(),
        serde_json::Value::Null,
    );
    let alert3 = state.record_event(&ev3);
    assert_eq!(state.tab_switches, 3);
    assert_eq!(state.risk_score.score, 15);
    assert_eq!(state.risk_score.severity, RiskSeverity::Elevated);
    assert!(alert3.is_some());
    let alert_frame = alert3.unwrap();
    assert_eq!(alert_frame.risk_score.severity, RiskSeverity::Elevated);

    // Event 4: Fullscreen exit (+10 pts -> 25 pts, Elevated)
    let ev4 = TelemetryEvent::new(
        assessment_id,
        candidate_id,
        TelemetryEventType::FullscreenExit,
        Utc::now(),
        serde_json::Value::Null,
    );
    let alert4 = state.record_event(&ev4);
    assert_eq!(state.fullscreen_exits, 1);
    assert_eq!(state.risk_score.score, 25);
    assert_eq!(state.risk_score.severity, RiskSeverity::Elevated);
    assert!(alert4.is_some());

    // Event 5: Paste burst (+15 pts -> 40 pts, Critical! Escalation triggered)
    let ev5 = TelemetryEvent::new(
        assessment_id,
        candidate_id,
        TelemetryEventType::PasteBurst,
        Utc::now(),
        serde_json::Value::Null,
    );
    let alert5 = state.record_event(&ev5);
    assert_eq!(state.paste_bursts, 1);
    assert_eq!(state.risk_score.score, 40);
    assert_eq!(state.risk_score.severity, RiskSeverity::Critical);
    assert!(alert5.is_some());
    assert_eq!(alert5.unwrap().risk_score.severity, RiskSeverity::Critical);
}

#[tokio::test]
async fn test_pubsub_channel_naming_and_serialization() -> Result<(), TelemetryError> {
    let assessment_id = Uuid::new_v4();
    let candidate_id = Uuid::new_v4();

    // 1. Channel naming validation
    let channel = format_telemetry_channel(assessment_id);
    assert_eq!(channel, format!("campus:proctor:{assessment_id}:telemetry"));

    let relay = TelemetryRelay::new_in_memory();
    assert_eq!(relay.channel_name(assessment_id), channel);

    // 2. Serialization & Local Broadcast validation
    let mut rx = relay.subscribe_local();

    let event = TelemetryEvent::new(
        assessment_id,
        candidate_id,
        TelemetryEventType::TabSwitch,
        Utc::now(),
        serde_json::json!({ "active_tab": "External Documentation" }),
    );

    // Round-trip serialization
    let json_bytes = serde_json::to_vec(&event)?;
    let deserialized: TelemetryEvent = serde_json::from_slice(&json_bytes)?;
    assert_eq!(deserialized, event);

    // Publish event
    relay.publish(&event).await?;

    // Receive locally
    let received = rx
        .recv()
        .await
        .map_err(|e| TelemetryError::ChannelClosed(e.to_string()))?;
    assert_eq!(received.assessment_id, assessment_id);
    assert_eq!(received.candidate_id, candidate_id);
    assert_eq!(received.event_type, TelemetryEventType::TabSwitch);

    Ok(())
}

#[tokio::test]
async fn test_live_redis_publish_if_available() {
    let redis_url = "redis://127.0.0.1:6379";
    if let Ok(relay) = TelemetryRelay::new(redis_url) {
        let assessment_id = Uuid::new_v4();
        let candidate_id = Uuid::new_v4();
        let event = TelemetryEvent::new(
            assessment_id,
            candidate_id,
            TelemetryEventType::Heartbeat,
            Utc::now(),
            serde_json::Value::Null,
        );

        // Attempt publishing to live Redis cluster
        let res = relay.publish(&event).await;
        if let Err(e) = res {
            println!("Redis publish skipped/failed in current environment: {e}");
        } else {
            println!("Live Redis publish verified successfully!");
        }
    }
}

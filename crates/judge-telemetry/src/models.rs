//! Proctoring telemetry event models, candidate state aggregation, and alert frames.

use chrono::{DateTime, Utc};
use judge_core::models::{RiskScore, RiskSeverity};
use judge_core::proctor::calculate_risk_score;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Behavioral anomaly event category emitted by candidate telemetry watchdogs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TelemetryEventType {
    /// Candidate switched focus or navigated away from browser tab.
    TabSwitch,
    /// Candidate exited full-screen lock mode.
    FullscreenExit,
    /// Candidate pasted anomalous block of code or text.
    PasteBurst,
    /// Periodic heartbeat ping keeping WebSocket connection active.
    Heartbeat,
}

/// Raw telemetry event frame transmitted over WebSocket.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TelemetryEvent {
    /// Target assessment UUID.
    pub assessment_id: Uuid,
    /// Submitting candidate user UUID.
    pub candidate_id: Uuid,
    /// Type of telemetry anomaly or signal.
    pub event_type: TelemetryEventType,
    /// Timestamp when event occurred on client.
    pub timestamp: DateTime<Utc>,
    /// Additional context payload (e.g. pasted characters, active window title).
    #[serde(default)]
    pub metadata: serde_json::Value,
}

impl TelemetryEvent {
    /// Creates a new telemetry event.
    #[must_use]
    pub fn new(
        assessment_id: Uuid,
        candidate_id: Uuid,
        event_type: TelemetryEventType,
        timestamp: DateTime<Utc>,
        metadata: serde_json::Value,
    ) -> Self {
        Self {
            assessment_id,
            candidate_id,
            event_type,
            timestamp,
            metadata,
        }
    }
}

/// Alert broadcast frame dispatched to instructor cockpit on risk escalation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProctorAlertFrame {
    /// Target assessment UUID.
    pub assessment_id: Uuid,
    /// Submitting candidate user UUID.
    pub candidate_id: Uuid,
    /// Telemetry event triggering or accompanying this alert.
    pub event_type: TelemetryEventType,
    /// Updated aggregate risk score and severity level.
    pub risk_score: RiskScore,
    /// Timestamp when alert was generated.
    pub timestamp: DateTime<Utc>,
    /// Human-readable diagnostic message.
    pub message: String,
}

/// In-memory aggregated proctoring state for a candidate in an active assessment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CandidateProctorState {
    /// Target assessment UUID.
    pub assessment_id: Uuid,
    /// Submitting candidate user UUID.
    pub candidate_id: Uuid,
    /// Total count of tab switch anomalies.
    pub tab_switches: u32,
    /// Total count of full-screen drop/exit anomalies.
    pub fullscreen_exits: u32,
    /// Total count of rapid paste bursts.
    pub paste_bursts: u32,
    /// Current evaluated risk score.
    pub risk_score: RiskScore,
    /// Timestamp of most recently processed event.
    pub last_event_at: DateTime<Utc>,
}

impl CandidateProctorState {
    /// Initializes baseline state with zero violations and Low severity.
    #[must_use]
    pub fn new(assessment_id: Uuid, candidate_id: Uuid) -> Self {
        let risk_score = calculate_risk_score(0, 0, 0);
        Self {
            assessment_id,
            candidate_id,
            tab_switches: 0,
            fullscreen_exits: 0,
            paste_bursts: 0,
            risk_score,
            last_event_at: Utc::now(),
        }
    }

    /// Records an incoming telemetry event, re-evaluates risk score,
    /// and returns a [`ProctorAlertFrame`] if risk escalated or is elevated.
    pub fn record_event(&mut self, event: &TelemetryEvent) -> Option<ProctorAlertFrame> {
        self.last_event_at = event.timestamp;

        match event.event_type {
            TelemetryEventType::TabSwitch => {
                self.tab_switches = self.tab_switches.saturating_add(1);
            }
            TelemetryEventType::FullscreenExit => {
                self.fullscreen_exits = self.fullscreen_exits.saturating_add(1);
            }
            TelemetryEventType::PasteBurst => {
                self.paste_bursts = self.paste_bursts.saturating_add(1);
            }
            TelemetryEventType::Heartbeat => {
                return None;
            }
        }

        let previous_severity = self.risk_score.severity;
        self.risk_score = calculate_risk_score(
            self.tab_switches,
            self.fullscreen_exits,
            self.paste_bursts,
        );

        let escalated = self.risk_score.severity != previous_severity;
        let is_concerning = self.risk_score.severity != RiskSeverity::Low;

        if escalated || is_concerning {
            Some(ProctorAlertFrame {
                assessment_id: self.assessment_id,
                candidate_id: self.candidate_id,
                event_type: event.event_type,
                risk_score: self.risk_score.clone(),
                timestamp: event.timestamp,
                message: format!(
                    "Candidate {} anomaly triggered: {:?} (Score: {}, Severity: {:?})",
                    self.candidate_id, event.event_type, self.risk_score.score, self.risk_score.severity
                ),
            })
        } else {
            None
        }
    }
}

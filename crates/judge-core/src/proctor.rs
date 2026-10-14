use crate::models::{RiskScore, RiskSeverity};

/// Calculates proctoring risk score based on behavioral anomaly counters:
/// - Tab switches: 5 points each
/// - Fullscreen drops/exits: 10 points each
/// - Paste bursts: 15 points each
///
/// Severity thresholds:
/// - `< 15`: Low (Acid Lime)
/// - `15..=34`: Elevated (Amber)
/// - `>= 35`: Critical (Crimson)
#[must_use]
pub fn calculate_risk_score(
    tab_switches: u32,
    fullscreen_exits: u32,
    paste_bursts: u32,
) -> RiskScore {
    let score = tab_switches * 5 + fullscreen_exits * 10 + paste_bursts * 15;
    let severity = if score < 15 {
        RiskSeverity::Low
    } else if score <= 34 {
        RiskSeverity::Elevated
    } else {
        RiskSeverity::Critical
    };

    RiskScore {
        score,
        severity,
        tab_switches,
        fullscreen_exits,
        paste_bursts,
    }
}

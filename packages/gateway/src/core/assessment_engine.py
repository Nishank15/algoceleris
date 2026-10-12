from datetime import datetime, timezone
import math
from typing import Any, Dict, Optional
import uuid

from fastapi import HTTPException, status

from ..models.campus import Assessment, AssessmentStatus


def _ensure_tz_aware(dt: datetime) -> datetime:
    """Ensure datetime object is timezone-aware in UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def resolve_assessment_status(
    manual_status: str,
    publish_at: datetime,
    starts_at: datetime,
    due_at: datetime,
    cutoff_at: datetime,
    current_time: Optional[datetime] = None,
) -> str:
    """Evaluate current assessment status dynamically based on UTC timestamps and manual state overrides."""
    # Manual DRAFT and CLOSED states override dynamic clock transitions
    if manual_status == AssessmentStatus.DRAFT.value:
        return AssessmentStatus.DRAFT.value
    if manual_status == AssessmentStatus.CLOSED.value:
        return AssessmentStatus.CLOSED.value

    now = _ensure_tz_aware(current_time or datetime.now(timezone.utc))
    t_start = _ensure_tz_aware(starts_at)
    t_due = _ensure_tz_aware(due_at)
    t_cutoff = _ensure_tz_aware(cutoff_at)

    if now < t_start:
        return AssessmentStatus.SCHEDULED.value
    if t_start <= now <= t_due:
        return AssessmentStatus.ACTIVE.value
    if t_due < now <= t_cutoff:
        return AssessmentStatus.GRACE_PERIOD.value
    return AssessmentStatus.CLOSED.value


def compute_late_penalty(
    raw_score: float,
    due_at: datetime,
    submitted_at: Optional[datetime] = None,
    late_penalty_percent_per_hour: float = 0.0,
    max_late_penalty_percent: float = 100.0,
) -> Dict[str, Any]:
    """Calculate late penalty deduction using the formula:
    
    Delta_t_hours = max(0, ceil((t_submission - t_due) / 3600))
    PenaltyPercent = min(MaxPenalty, Delta_t_hours * LatePenaltyPerHour)
    FinalScore = max(0.0, RawScore * (1.0 - PenaltyPercent / 100.0))
    """
    sub_time = _ensure_tz_aware(submitted_at or datetime.now(timezone.utc))
    t_due = _ensure_tz_aware(due_at)

    if sub_time <= t_due:
        return {
            "is_late": False,
            "hours_late": 0,
            "seconds_late": 0.0,
            "penalty_percent": 0.0,
            "late_penalty_deduction": 0.0,
            "final_score": float(raw_score),
        }

    seconds_late = (sub_time - t_due).total_seconds()
    hours_late = max(0, math.ceil(seconds_late / 3600.0))

    penalty_pct = min(
        float(max_late_penalty_percent),
        hours_late * float(late_penalty_percent_per_hour),
    )
    penalty_pct = max(0.0, min(100.0, penalty_pct))

    deduction = round(raw_score * (penalty_pct / 100.0), 2)
    final_score = max(0.0, round(raw_score - deduction, 2))

    return {
        "is_late": True,
        "hours_late": hours_late,
        "seconds_late": seconds_late,
        "penalty_percent": penalty_pct,
        "late_penalty_deduction": deduction,
        "final_score": final_score,
    }


def validate_submission_gatekeeper(
    assessment: Assessment,
    submitted_at: Optional[datetime] = None,
) -> str:
    """Validate that submission timestamp falls within valid execution windows.
    
    Raises 403 Forbidden on premature attempts or post-cutoff expirations.
    """
    now = _ensure_tz_aware(submitted_at or datetime.now(timezone.utc))
    t_start = _ensure_tz_aware(assessment.starts_at)
    t_cutoff = _ensure_tz_aware(assessment.cutoff_at)

    if now < t_start:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "assessment_not_started",
                "message": "Assessment has not started yet",
                "starts_at": assessment.starts_at.isoformat(),
                "current_time": now.isoformat(),
            },
        )

    if now > t_cutoff or assessment.status == AssessmentStatus.CLOSED.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "assessment_cutoff_passed",
                "message": "Assessment cutoff deadline has passed",
                "cutoff_at": assessment.cutoff_at.isoformat(),
                "current_time": now.isoformat(),
            },
        )

    # Return active state ('ACTIVE' or 'GRACE_PERIOD')
    return resolve_assessment_status(
        manual_status=assessment.status,
        publish_at=assessment.publish_at,
        starts_at=assessment.starts_at,
        due_at=assessment.due_at,
        cutoff_at=assessment.cutoff_at,
        current_time=now,
    )


def mask_test_case_results(
    test_case_results: list,
    is_instructor: bool = False,
    is_grades_released: bool = False,
) -> list:
    """Mask secret test case diagnostic details (stdout, stderr, diff, input, output).
    
    If requester is instructor or grades have been released, return full unmasked breakdown.
    If student query during ACTIVE or GRACE_PERIOD, mask all secret test case details.
    """
    if is_instructor or is_grades_released:
        return [dict(tc) if isinstance(tc, dict) else tc for tc in test_case_results]

    masked = []
    for tc in test_case_results:
        tc_dict = dict(tc) if isinstance(tc, dict) else vars(tc)
        is_secret = tc_dict.get("is_secret", False) or not tc_dict.get("is_sample", True)
        if is_secret:
            tc_copy = dict(tc_dict)
            tc_copy["stdout"] = "[MASKED - Secret Institutional Test Case]"
            tc_copy["stderr"] = "[MASKED]"
            tc_copy["diff"] = None
            if "input_data" in tc_copy:
                tc_copy["input_data"] = "[MASKED]"
            if "expected_output" in tc_copy:
                tc_copy["expected_output"] = "[MASKED]"
            masked.append(tc_copy)
        else:
            masked.append(dict(tc_dict))
    return masked


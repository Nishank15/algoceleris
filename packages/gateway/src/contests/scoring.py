from typing import Tuple
from .models import ParticipantScore, ProblemScore


class ICPCScoringEngine:
    """Automated ICPC scoring engine calculating solved problems and penalty minutes."""

    REJECTED_ATTEMPT_PENALTY_MINUTES = 20

    @classmethod
    def process_submission(
        cls,
        participant: ParticipantScore,
        problem_id: str,
        verdict: str,
        submission_time: float,
        contest_start_time: float,
    ) -> Tuple[ParticipantScore, int]:
        """
        Process a submission verdict against the participant score state according to ICPC rules.
        Returns (updated_participant_score, penalty_delta).
        """
        # Ensure ProblemScore entry exists
        if problem_id not in participant.problem_scores:
            participant.problem_scores[problem_id] = ProblemScore(problem_id=problem_id)

        prob_score = participant.problem_scores[problem_id]
        initial_penalty = prob_score.penalty_minutes

        # Submissions after AC are ignored
        if prob_score.solved:
            return participant, 0

        normalized_verdict = verdict.upper().strip()

        if normalized_verdict == "ACCEPTED":
            prob_score.solved = True
            minute_of_submission = max(1, int((submission_time - contest_start_time) // 60))
            prob_score.solved_at_minute = minute_of_submission
            prob_score.penalty_minutes = minute_of_submission + (
                prob_score.rejected_attempts * cls.REJECTED_ATTEMPT_PENALTY_MINUTES
            )
        else:
            # Non-accepted verdict increments rejected attempts counter
            # In ICPC, penalty is only assessed if the problem is eventually solved
            prob_score.rejected_attempts += 1

        # Recompute participant totals
        participant.solved_count = sum(
            1 for p in participant.problem_scores.values() if p.solved
        )
        participant.total_penalty_minutes = sum(
            p.penalty_minutes for p in participant.problem_scores.values() if p.solved
        )

        penalty_delta = prob_score.penalty_minutes - initial_penalty
        return participant, penalty_delta

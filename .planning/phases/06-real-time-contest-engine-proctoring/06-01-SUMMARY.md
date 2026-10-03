---
phase: 06-real-time-contest-engine-proctoring
plan: "01"
subsystem: contests/lifecycle-scoring
tags: [contests, icpc-scoring, problem-bundling, penalty-calculation]
key_files:
  - packages/gateway/src/contests/__init__.py
  - packages/gateway/src/contests/models.py
  - packages/gateway/src/contests/store.py
  - packages/gateway/src/contests/scoring.py
  - packages/gateway/src/contests/router.py
  - packages/gateway/src/api.py
  - packages/gateway/tests/test_contest_engine.py
verification:
  - python3 -m unittest packages/gateway/tests/test_contest_engine.py
  - python3 -m unittest discover -s packages/gateway/tests
  - python3 -m unittest discover -s packages/engine/tests && python3 -m unittest discover -s packages/worker/tests
---

# Plan 06-01 Summary: Contest Lifecycle & ICPC Automated Scoring

## Objective
Implemented the contest lifecycle manager, problem bundling, and automated ICPC penalty scoring engine (`CONT-01`).

## Key Implementations

### 1. Contest Models & Bundling (`packages/gateway/src/contests/models.py`)
- **`Contest`**: Tracks contest metadata (`id`, `title`, `description`, `start_time`, `end_time`, `duration_minutes`, `status: UPCOMING | ACTIVE | ENDED`, `problems: List[ContestProblem]`).
- **`ContestProblem`**: Bundled problem entity with letter codes (e.g. A, B, C), title, difficulty, and point allocations.
- **`ProblemScore` & `ParticipantScore`**: Tracks per-participant solve status, rejected attempt count, minute of solve, and penalty minutes.

### 2. ICPC Scoring Engine (`packages/gateway/src/contests/scoring.py`)
- Implements competitive programming ICPC penalty rules:
  - Single AC without prior rejections: `penalty = minute_of_solve`.
  - Rejection attempts before AC: Each adds 20 penalty minutes once AC is achieved (`minute_of_solve + 20 * rejected_attempts`).
  - Rejected attempts on unsolved problems: `0` penalty contribution (penalty only assessed on solved problems).
  - Submissions after first AC: Ignored without penalty delta.
  - Computes `solved_count` and `total_penalty_minutes`.

### 3. Contest Store & REST API (`packages/gateway/src/contests/store.py`, `router.py`)
- **`ContestStore`**: Thread-safe in-memory store and Redis store pre-seeded with "weekly-contest-1" bundling 3 problems (Two Sum, Valid Parentheses, LRU Cache).
- **REST Endpoints**:
  - `GET /api/v1/contests`: List all contests.
  - `GET /api/v1/contests/{contest_id}`: Retrieve details and bundled problem set.
  - `POST /api/v1/contests/{contest_id}/register`: Participant registration.
  - `POST /api/v1/contests/{contest_id}/submit`: Solution submission with automated ICPC scoring and score update.
  - `GET /api/v1/contests/{contest_id}/participant/{user_id}`: Retrieve participant score state.

## Verification
- `test_contest_engine.py`: 6/6 tests passed.
- Gateway test suite: 44/44 tests passed.
- Full repository regression suite: 80/80 tests passed with 0 failures.

## Self-Check: PASSED
All artifacts exist on disk, tests passing cleanly.

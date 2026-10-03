export type Language = 'cpp' | 'python' | 'java';

export type LayoutMode = 'normal' | 'zen';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface ProblemTestCase {
  id: number;
  input_data: string;
  expected_output: string;
  is_sample: boolean;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  constraints: string[];
  sampleCases: ProblemTestCase[];
  hiddenCases?: ProblemTestCase[];
  timeLimitMs: number;
  memoryLimitBytes: number;
  acceptanceRate: number;
  tags: string[];
  solvedStatus?: 'solved' | 'attempted' | 'unsolved';
}

export type SubmissionStatus =
  | 'QUEUED'
  | 'COMPILING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

export type ExecutionVerdict =
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'RUNTIME_ERROR'
  | 'COMPILATION_ERROR'
  | 'INTERNAL_ERROR';

export interface TestCaseResult {
  test_case_id: number;
  verdict: ExecutionVerdict;
  execution_time_ms: number;
  memory_used_bytes: number;
  stdout: string;
  stderr: string;
  diff?: string | null;
}

export interface SubmissionReport {
  submission_id: string;
  verdict: ExecutionVerdict;
  test_cases_passed: number;
  total_test_cases: number;
  max_time_ms: number;
  max_memory_bytes: number;
  test_case_results: TestCaseResult[];
  compile_output?: string | null;
}

export interface StreamEvent {
  event_type: string;
  submission_id: string;
  data: Record<string, any>;
  timestamp?: number;
}

export interface SubmissionRequest {
  language: string;
  source_code: string;
  time_limit_ms?: number;
  memory_limit_bytes?: number;
  test_cases: {
    id: number;
    input_data: string;
    expected_output: string;
    is_sample?: boolean;
  }[];
}

export interface SubmissionResponse {
  submission_id: string;
  status: SubmissionStatus;
  message: string;
}

export type SubscriptionTier = 'free' | 'pro';

export type Currency = 'USD' | 'INR';

export interface EntitlementState {
  user_id: string;
  tier: SubscriptionTier;
  can_use_ai_assistant: boolean;
  has_priority_queue: boolean;
  can_view_plagiarism_audit: boolean;
  rate_limit_per_minute: number;
}

export interface AIDebugRequest {
  user_id: string;
  language: string;
  source_code: string;
  problem_title: string;
  problem_description: string;
  failing_test_cases?: Array<{
    id?: number;
    input?: string;
    expected?: string;
    actual?: string;
  }>;
  error_diagnostics?: string | null;
}

export interface AIDebugResponse {
  root_cause: string;
  complexity_analysis: string;
  fix_explanation: string;
  fixed_code: string;
  code_diff: string;
}

export interface ProblemScoreInfo {
  problem_id: string;
  solved: boolean;
  rejected_attempts: number;
  penalty_minutes: number;
  solved_at?: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  solved_count: number;
  total_penalty_minutes: number;
  problem_scores: Record<string, ProblemScoreInfo>;
  score_composite: number;
}

export interface ContestProblem {
  id: string;
  letter_code: string;
  title: string;
  difficulty: string;
  points: number;
}

export interface ContestDetails {
  id: string;
  title: string;
  description: string;
  start_time: number;
  end_time: number;
  duration_minutes: number;
  status: 'UPCOMING' | 'ACTIVE' | 'ENDED';
  problems: ContestProblem[];
}

export type ProctoringEventType =
  | 'FULLSCREEN_EXIT'
  | 'TAB_BLUR'
  | 'CLIPBOARD_COPY'
  | 'CLIPBOARD_PASTE'
  | 'CONTEXT_MENU';

export interface ProctoringEvent {
  event_id?: string;
  contest_id: string;
  user_id: string;
  event_type: ProctoringEventType;
  timestamp?: number;
  strike_count?: number;
  details?: string | null;
}

export interface ProctoringAuditReport {
  contest_id: string;
  user_id: string;
  strike_count: number;
  is_flagged: boolean;
  events: ProctoringEvent[];
}

export interface ActivityDay {
  date: string;
  count: number;
  accepted: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface UserAnalytics {
  total_submissions: number;
  accepted_count: number;
  acceptance_rate: number;
  streak_days: number;
  solved_easy: number;
  solved_medium: number;
  solved_hard: number;
  total_easy: number;
  total_medium: number;
  total_hard: number;
  history: ActivityDay[];
}



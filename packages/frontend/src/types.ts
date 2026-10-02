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

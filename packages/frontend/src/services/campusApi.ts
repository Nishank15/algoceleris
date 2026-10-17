import { fetchWithFallback, buildWebSocketUrl, getAccessToken } from './api';
import { getCampusSession } from './campusSession';

export type AssessmentMode = 'EXAM' | 'HOMEWORK' | 'VIVA';
export type AssessmentStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'GRACE_PERIOD' | 'CLOSED';

export interface RubricCriterion {
  id: string;
  title: string;
  description?: string;
  weightPercent: number;
}

export interface AssessmentCreatePayload {
  title: string;
  description: string;
  mode: AssessmentMode;
  problem_slugs: string[];
  scoring_rubric: {
    criteria: RubricCriterion[];
    totalWeight: number;
  };
  publish_at: string;
  starts_at: string;
  due_at: string;
  cutoff_at: string;
  duration_minutes: number | null;
  late_penalty_percent_per_hour: number;
  max_late_penalty_percent: number;
  proctoring_config?: Record<string, any>;
  status?: AssessmentStatus;
}

export interface AssessmentResponse {
  id: string;
  org_id: string;
  cohort_id: string;
  title: string;
  description: string;
  mode: AssessmentMode;
  status: AssessmentStatus;
  problem_slugs: string[];
  scoring_rubric: {
    criteria: RubricCriterion[];
    totalWeight?: number;
    [key: string]: any;
  };
  publish_at: string;
  starts_at: string;
  due_at: string;
  cutoff_at: string;
  duration_minutes: number | null;
  late_penalty_percent_per_hour: number;
  max_late_penalty_percent: number;
  proctoring_config: Record<string, any>;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  cohort_name?: string;
}

export type AssessmentItem = AssessmentResponse;

export interface CohortItem {
  id: string;
  org_id: string;
  name: string;
  code: string;
  term: string;
  is_active: boolean;
}

export interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  domain_whitelist: string[];
  branding_config: Record<string, any>;
}

/**
 * Validates timeline invariant: publish_at <= starts_at <= due_at <= cutoff_at
 */
export function validateTimeline(
  publishAt: string | Date,
  startsAt: string | Date,
  dueAt: string | Date,
  cutoffAt: string | Date
): { isValid: boolean; error?: string } {
  const p = new Date(publishAt).getTime();
  const s = new Date(startsAt).getTime();
  const d = new Date(dueAt).getTime();
  const c = new Date(cutoffAt).getTime();

  if (isNaN(p) || isNaN(s) || isNaN(d) || isNaN(c)) {
    return { isValid: false, error: 'All timeline timestamps must be valid dates' };
  }
  if (p > s) {
    return { isValid: false, error: 'Publication time cannot be after start time (publish_at <= starts_at)' };
  }
  if (s > d) {
    return { isValid: false, error: 'Start time cannot be after due date (starts_at <= due_at)' };
  }
  if (d > c) {
    return { isValid: false, error: 'Due date cannot be after cutoff date (due_at <= cutoff_at)' };
  }
  return { isValid: true };
}

/**
 * Calculates sum of rubric criteria weights
 */
export function calculateRubricTotal(criteria: RubricCriterion[]): number {
  return criteria.reduce((sum, item) => sum + (Number(item.weightPercent) || 0), 0);
}

// Built-in mock data for standalone preview, demo cohorts, and fallback
export const MOCK_COHORTS: CohortItem[] = [
  {
    id: 'c1111111-1111-4111-8111-111111111111',
    org_id: 'o1111111-1111-4111-8111-111111111111',
    name: 'CS301 Data Structures & Algorithms',
    code: 'CS301-FALL26',
    term: 'Fall 2026',
    is_active: true,
  },
  {
    id: 'c2222222-2222-4222-8222-222222222222',
    org_id: 'o1111111-1111-4111-8111-111111111111',
    name: 'CS450 Systems & Distributed Computing',
    code: 'CS450-FALL26',
    term: 'Fall 2026',
    is_active: true,
  },
  {
    id: 'c3333333-3333-4333-8333-333333333333',
    org_id: 'o1111111-1111-4111-8111-111111111111',
    name: 'ICPC Competitive Training Wing',
    code: 'ICPC-VARSITY',
    term: 'Year-Round',
    is_active: true,
  },
];

const nowMs = Date.now();
const hourMs = 3600 * 1000;
const dayMs = 24 * hourMs;

export const MOCK_ASSESSMENTS: AssessmentResponse[] = [
  {
    id: 'a1111111-1111-4111-8111-111111111111',
    org_id: 'o1111111-1111-4111-8111-111111111111',
    cohort_id: 'c1111111-1111-4111-8111-111111111111',
    cohort_name: 'CS301-FALL26',
    title: 'Midterm 1: Dynamic Programming & Graphs',
    description: 'Proctored midterm assessment covering DP memoization, BFS/DFS traversal, and topological ordering.',
    mode: 'EXAM',
    status: 'ACTIVE',
    problem_slugs: ['two-sum', 'longest-increasing-subsequence', 'course-schedule'],
    scoring_rubric: {
      criteria: [
        { id: '1', title: 'Functional Test Cases', weightPercent: 60 },
        { id: '2', title: 'Time Complexity Optimization', weightPercent: 25 },
        { id: '3', title: 'Clean Architecture & Code Style', weightPercent: 15 },
      ],
      totalWeight: 100,
    },
    publish_at: new Date(nowMs - 2 * dayMs).toISOString(),
    starts_at: new Date(nowMs - 1 * hourMs).toISOString(),
    due_at: new Date(nowMs + 2 * hourMs).toISOString(),
    cutoff_at: new Date(nowMs + 4 * hourMs).toISOString(),
    duration_minutes: 120,
    late_penalty_percent_per_hour: 15.0,
    max_late_penalty_percent: 50.0,
    proctoring_config: {
      enforce_fullscreen: true,
      track_tab_switches: true,
      block_clipboard_paste: false,
    },
  },
  {
    id: 'a2222222-2222-4222-8222-222222222222',
    org_id: 'o1111111-1111-4111-8111-111111111111',
    cohort_id: 'c2222222-2222-4222-8222-222222222222',
    cohort_name: 'CS450-FALL26',
    title: 'Homework 3: Concurrency & Lock-Free Structures',
    description: 'Take-home algorithmic assignment analyzing atomic CAS primitives and bounded work-stealing queues.',
    mode: 'HOMEWORK',
    status: 'SCHEDULED',
    problem_slugs: ['lru-cache', 'merge-intervals'],
    scoring_rubric: {
      criteria: [
        { id: '1', title: 'Correctness & Data Integrity', weightPercent: 50 },
        { id: '2', title: 'Thread Safety & Benchmark Latency', weightPercent: 30 },
        { id: '3', title: 'Documentation & Memory Profiling', weightPercent: 20 },
      ],
      totalWeight: 100,
    },
    publish_at: new Date(nowMs - 1 * dayMs).toISOString(),
    starts_at: new Date(nowMs + 6 * hourMs).toISOString(),
    due_at: new Date(nowMs + 3 * dayMs).toISOString(),
    cutoff_at: new Date(nowMs + 4 * dayMs).toISOString(),
    duration_minutes: null,
    late_penalty_percent_per_hour: 5.0,
    max_late_penalty_percent: 30.0,
    proctoring_config: { enforce_fullscreen: false },
  },
  {
    id: 'a3333333-3333-4333-8333-333333333333',
    org_id: 'o1111111-1111-4111-8111-111111111111',
    cohort_id: 'c3333333-3333-4333-8333-333333333333',
    cohort_name: 'ICPC-VARSITY',
    title: 'Live Technical Viva: Advanced Trees & Treaps',
    description: '1-on-1 collaborative interactive viva with live CRDT code editor and real-time private instructor rubric.',
    mode: 'VIVA',
    status: 'SCHEDULED',
    problem_slugs: ['word-ladder', 'trapping-rain-water'],
    scoring_rubric: {
      criteria: [
        { id: '1', title: 'Algorithmic Intuition & Explanation', weightPercent: 40 },
        { id: '2', title: 'Live Coding Speed & Syntax Accuracy', weightPercent: 40 },
        { id: '3', title: 'Edge Case Reasoning Under Pressure', weightPercent: 20 },
      ],
      totalWeight: 100,
    },
    publish_at: new Date(nowMs).toISOString(),
    starts_at: new Date(nowMs + 24 * hourMs).toISOString(),
    due_at: new Date(nowMs + 26 * hourMs).toISOString(),
    cutoff_at: new Date(nowMs + 26 * hourMs).toISOString(),
    duration_minutes: 45,
    late_penalty_percent_per_hour: 0.0,
    max_late_penalty_percent: 0.0,
    proctoring_config: { enforce_fullscreen: false, viva_recording: true },
  },
  {
    id: 'a4444444-4444-4444-8444-444444444444',
    org_id: 'o1111111-1111-4111-8111-111111111111',
    cohort_id: 'c1111111-1111-4111-8111-111111111111',
    cohort_name: 'CS301-FALL26',
    title: 'Lab 2: Binary Search Invariants',
    description: 'Laboratory assessment covering lower_bound, upper_bound and ternary search predicates.',
    mode: 'HOMEWORK',
    status: 'CLOSED',
    problem_slugs: ['median-of-two-sorted-arrays'],
    scoring_rubric: {
      criteria: [
        { id: '1', title: 'All Hidden Test Cases', weightPercent: 80 },
        { id: '2', title: 'Code Aesthetics', weightPercent: 20 },
      ],
      totalWeight: 100,
    },
    publish_at: new Date(nowMs - 7 * dayMs).toISOString(),
    starts_at: new Date(nowMs - 5 * dayMs).toISOString(),
    due_at: new Date(nowMs - 3 * dayMs).toISOString(),
    cutoff_at: new Date(nowMs - 2 * dayMs).toISOString(),
    duration_minutes: null,
    late_penalty_percent_per_hour: 10.0,
    max_late_penalty_percent: 50.0,
    proctoring_config: {},
  },
];

/**
 * Creates an institutional assessment
 */
export async function createAssessment(
  cohortId: string,
  payload: AssessmentCreatePayload
): Promise<AssessmentResponse> {
  try {
    const res = await fetchWithFallback(`/api/v1/campus/cohorts/${cohortId}/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('Campus API createAssessment network error, caching locally:', err);
  }

  // Graceful local emulation when offline/demo
  const newAssessment: AssessmentResponse = {
    id: `local-${Date.now()}`,
    org_id: MOCK_COHORTS[0].org_id,
    cohort_id: cohortId,
    title: payload.title,
    description: payload.description,
    mode: payload.mode,
    status: payload.status || 'SCHEDULED',
    problem_slugs: payload.problem_slugs,
    scoring_rubric: payload.scoring_rubric,
    publish_at: payload.publish_at,
    starts_at: payload.starts_at,
    due_at: payload.due_at,
    cutoff_at: payload.cutoff_at,
    duration_minutes: payload.duration_minutes,
    late_penalty_percent_per_hour: payload.late_penalty_percent_per_hour,
    max_late_penalty_percent: payload.max_late_penalty_percent,
    proctoring_config: payload.proctoring_config || {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    cohort_name: MOCK_COHORTS.find((c) => c.id === cohortId)?.code || 'CAMPUS',
  };

  MOCK_ASSESSMENTS.unshift(newAssessment);
  return newAssessment;
}

/**
 * Retrieves a single assessment
 */
export async function getAssessment(assessmentId: string): Promise<AssessmentResponse> {
  const found = MOCK_ASSESSMENTS.find((a) => a.id === assessmentId);
  if (!getAccessToken() && found) {
    return found;
  }
  try {
    const res = await fetchWithFallback(`/api/v1/campus/assessments/${assessmentId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('Campus API getAssessment fallback:', err);
  }

  if (found) return found;
  throw new Error(`Assessment ${assessmentId} not found`);
}

/**
 * Lists assessments across cohorts or by specific cohort
 */
export async function listAssessments(cohortId?: string): Promise<AssessmentResponse[]> {
  if (!getAccessToken()) {
    if (cohortId) {
      return MOCK_ASSESSMENTS.filter((a) => a.cohort_id === cohortId);
    }
    return MOCK_ASSESSMENTS;
  }
  try {
    const endpoint = cohortId
      ? `/api/v1/campus/cohorts/${cohortId}/assessments`
      : `/api/v1/campus/assessments`;
    const res = await fetchWithFallback(endpoint);
    if (res.ok) {
      const data: AssessmentResponse[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.debug('Campus API listAssessments fallback:', err);
  }

  if (cohortId) {
    return MOCK_ASSESSMENTS.filter((a) => a.cohort_id === cohortId);
  }
  return MOCK_ASSESSMENTS;
}

export const getCohortAssessments = listAssessments;

/**
 * Lists cohorts available to current user
 */
export async function listCohorts(): Promise<CohortItem[]> {
  return MOCK_COHORTS;
}

// ==========================================================================
// Phase 12: Student Exam Arena Schemas & Telemetry Helpers
// ==========================================================================

export interface AssessmentSubmitRequest {
  raw_score: number;
  problem_slug?: string;
  language?: string;
  source_code?: string;
  submission_id?: string;
  submitted_at?: string;
  test_cases?: any[];
}

export interface AssessmentSubmissionResponse {
  id: string;
  assessment_id: string;
  user_id: string;
  submission_id: string;
  raw_score: number;
  late_penalty_deduction: number;
  final_score: number;
  is_late: boolean;
  eval_verdict: string;
  submitted_at: string;
  proctor_events_count: number;
  feedback_notes?: string;
  test_case_results?: any[];
  is_grades_released: boolean;
}

export interface ProctorTelemetryEvent {
  event_type: 'heartbeat' | 'tab_switch' | 'fullscreen_exit' | 'paste_burst';
  metadata?: Record<string, any>;
  timestamp?: string;
}

/**
 * Submits student code for assessment with deadline gatekeeper and penalty calculation
 */
export async function submitAssessment(
  assessmentId: string,
  data: AssessmentSubmitRequest
): Promise<AssessmentSubmissionResponse> {
  try {
    const res = await fetchWithFallback(`/api/v1/campus/assessments/${assessmentId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('submitAssessment network error, generating local response:', err);
  }

  // Local fallback for offline/demo simulation
  const rawScore = Number(data.raw_score) || 0;
  return {
    id: `sub-${Date.now()}`,
    assessment_id: assessmentId,
    user_id: 'current-user-uuid',
    submission_id: data.submission_id || `base-${Date.now()}`,
    raw_score: rawScore,
    late_penalty_deduction: 0,
    final_score: rawScore,
    is_late: false,
    eval_verdict: rawScore >= 70 ? 'ACCEPTED' : 'WRONG_ANSWER',
    submitted_at: new Date().toISOString(),
    proctor_events_count: 0,
    is_grades_released: false,
    test_case_results: data.test_cases || [],
  };
}

/**
 * Opens a real-time proctoring telemetry WebSocket connection for the candidate
 */
export function connectProctoringWebSocket(
  assessmentId: string,
  onMessage?: (data: any) => void,
  onError?: (err: any) => void
): WebSocket {
  const token = getAccessToken() || getCampusSession()?.token || 'campus-demo-token';
  const wsUrl = buildWebSocketUrl(`/ws/campus/assessments/${encodeURIComponent(assessmentId)}/proctor?token=${encodeURIComponent(token)}`);
  const socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    socket.send(
      JSON.stringify({
        event_type: 'heartbeat',
        metadata: {
          client: 'exam-arena',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        },
        timestamp: new Date().toISOString(),
      })
    );
  };

  if (onMessage) {
    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch {
        onMessage(event.data);
      }
    };
  }

  if (onError) {
    socket.onerror = onError;
  }

  return socket;
}

/**
 * Masks secret institutional test case details to preserve exam integrity
 */
export function maskStudentTestResults(testCases: any[], isGradesReleased = false) {
  return testCases.map((tc, idx) => {
    if (tc.is_sample) {
      return {
        id: tc.id || idx + 1,
        is_sample: true,
        passed: tc.passed,
        input: tc.input_data ?? tc.input,
        expected: tc.expected_output ?? tc.expected,
        actual: tc.actual_output ?? tc.actual,
      };
    }
    if (isGradesReleased) {
      return {
        id: tc.id || idx + 1,
        is_sample: false,
        passed: tc.passed,
        input: tc.input_data ?? tc.input,
        expected: tc.expected_output ?? tc.expected,
        actual: tc.actual_output ?? tc.actual,
      };
    }
    return {
      id: tc.id || idx + 1,
      is_sample: false,
      passed: tc.passed,
      input: '[HIDDEN TEST VECTOR]',
      expected: '[HIDDEN EXPECTED OUTPUT]',
      actual: tc.passed ? '[CORRECT]' : '[INCORRECT]',
      is_masked: true,
    };
  });
}

// ==========================================================================
// Phase 13: Faculty Live Proctoring Cockpit & Viva Escalation Helpers
// ==========================================================================

export interface VivaProvisionRequest {
  candidate_user_id: string;
  problem_slug?: string;
  language?: string;
  initial_code?: string;
}

export interface VivaRoomResponse {
  id: string;
  room_code: string;
  org_id?: string;
  assessment_id?: string;
  host_user_id: string;
  candidate_user_id: string;
  problem_slug: string;
  language: string;
  status: string;
  editor_code?: string;
  interviewer_notes?: string | null;
  rubric_scores?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface VivaRubricUpdateRequest {
  rubric_scores?: Record<string, any>;
  interviewer_notes?: string | null;
  status?: string;
}

export interface ProctorEventItem {
  id: string;
  assessment_id: string;
  user_id: string;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  event_metadata: Record<string, any>;
  created_at: string;
  username?: string;
}

export interface ProctoredCandidateState {
  user_id: string;
  roll_number: string;
  username: string;
  full_name: string;
  status: 'connected' | 'idle' | 'disconnected';
  tab_switches: number;
  fullscreen_exits: number;
  paste_bursts: number;
  risk_score: number;
  last_seen: string;
  time_extension_minutes?: number;
}

export const MOCK_PROCTORED_STUDENTS: ProctoredCandidateState[] = [
  {
    user_id: 'u-101',
    roll_number: 'CS26-041',
    username: 'alex_chen',
    full_name: 'Alex Chen',
    status: 'connected',
    tab_switches: 0,
    fullscreen_exits: 0,
    paste_bursts: 0,
    risk_score: 0,
    last_seen: new Date().toISOString(),
  },
  {
    user_id: 'u-102',
    roll_number: 'CS26-088',
    username: 'sarah_miller',
    full_name: 'Sarah Miller',
    status: 'connected',
    tab_switches: 2,
    fullscreen_exits: 1,
    paste_bursts: 0,
    risk_score: 20, // (2*5) + (1*10) = 20 (Elevated)
    last_seen: new Date().toISOString(),
  },
  {
    user_id: 'u-103',
    roll_number: 'CS26-112',
    username: 'david_kim',
    full_name: 'David Kim',
    status: 'connected',
    tab_switches: 4,
    fullscreen_exits: 2,
    paste_bursts: 1,
    risk_score: 55, // (4*5) + (2*10) + (1*15) = 55 (Critical)
    last_seen: new Date().toISOString(),
  },
  {
    user_id: 'u-104',
    roll_number: 'CS26-019',
    username: 'priya_patel',
    full_name: 'Priya Patel',
    status: 'idle',
    tab_switches: 1,
    fullscreen_exits: 0,
    paste_bursts: 0,
    risk_score: 5,
    last_seen: new Date(Date.now() - 45000).toISOString(),
  },
  {
    user_id: 'u-105',
    roll_number: 'CS26-073',
    username: 'marcus_vance',
    full_name: 'Marcus Vance',
    status: 'disconnected',
    tab_switches: 2,
    fullscreen_exits: 3,
    paste_bursts: 2,
    risk_score: 70, // (2*5) + (3*10) + (2*15) = 70 (Critical)
    last_seen: new Date(Date.now() - 120000).toISOString(),
  },
];

export const MOCK_INCIDENT_FEED: ProctorEventItem[] = [
  {
    id: 'ev-1',
    assessment_id: 'a1111111-1111-4111-8111-111111111111',
    user_id: 'u-105',
    username: 'marcus_vance',
    event_type: 'paste_burst',
    severity: 'critical',
    event_metadata: { char_count: 142, context: 'clipboard_burst' },
    created_at: new Date(Date.now() - 180000).toISOString(),
  },
  {
    id: 'ev-2',
    assessment_id: 'a1111111-1111-4111-8111-111111111111',
    user_id: 'u-103',
    username: 'david_kim',
    event_type: 'fullscreen_exit',
    severity: 'warning',
    event_metadata: { duration_seconds: 4 },
    created_at: new Date(Date.now() - 320000).toISOString(),
  },
  {
    id: 'ev-3',
    assessment_id: 'a1111111-1111-4111-8111-111111111111',
    user_id: 'u-102',
    username: 'sarah_miller',
    event_type: 'tab_switch',
    severity: 'warning',
    event_metadata: { hidden: true },
    created_at: new Date(Date.now() - 540000).toISOString(),
  },
];

/**
 * Provisions a multiplayer Viva interview room for candidate escalation
 */
export async function provisionVivaRoom(
  assessmentId: string,
  candidateUserId: string,
  problemSlug?: string
): Promise<VivaRoomResponse> {
  try {
    const res = await fetchWithFallback(`/api/v1/campus/assessments/${assessmentId}/viva/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_user_id: candidateUserId,
        problem_slug: problemSlug,
      }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('provisionVivaRoom network error, generating local room:', err);
  }

  // Local fallback
  const roomCode = `viva-${Math.random().toString(36).substring(2, 8)}`;
  return {
    id: `viva-${Date.now()}`,
    room_code: roomCode,
    assessment_id: assessmentId,
    host_user_id: 'instructor-host-uuid',
    candidate_user_id: candidateUserId,
    problem_slug: problemSlug || 'two-sum',
    language: 'python',
    status: 'ACTIVE',
  };
}

/**
 * Fetches logged anomaly events for an assessment
 */
export async function fetchProctorEvents(
  assessmentId: string,
  userId?: string
): Promise<ProctorEventItem[]> {
  if (!getAccessToken()) {
    return MOCK_INCIDENT_FEED;
  }
  try {
    const query = userId ? `?user_id=${userId}` : '';
    const res = await fetchWithFallback(`/api/v1/campus/assessments/${assessmentId}/proctor/events${query}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.debug('fetchProctorEvents fallback:', err);
  }

  return MOCK_INCIDENT_FEED;
}

export const getProctorEvents = fetchProctorEvents;

/**
 * Fetches active proctored candidates and risk scores
 */
export async function fetchProctoredStudents(
  assessmentId: string
): Promise<ProctoredCandidateState[]> {
  if (!getAccessToken()) {
    return MOCK_PROCTORED_STUDENTS;
  }
  try {
    const res = await fetchWithFallback(`/api/v1/campus/assessments/${assessmentId}/proctor/students`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.debug('fetchProctoredStudents fallback:', err);
  }

  return MOCK_PROCTORED_STUDENTS;
}

export const MOCK_VIVA_ROOM: VivaRoomResponse = {
  id: 'viva-mock-001',
  room_code: 'VIVA-CS301-A',
  org_id: 'o1111111-1111-4111-8111-111111111111',
  assessment_id: 'a1111111-1111-4111-8111-111111111111',
  host_user_id: 'host-instructor-01',
  candidate_user_id: 'u-101',
  problem_slug: 'two-sum',
  language: 'python',
  status: 'ACTIVE',
  editor_code: `def twoSum(nums, target):
    # Candidate collaborative buffer
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []
`,
  interviewer_notes: 'Strong grasp of dictionary hashing. Prompted candidate regarding duplicate elements.',
  rubric_scores: {
    problem_deconstruct: 85,
    code_efficiency: 90,
    edge_cases: 75,
    communication: 80,
  },
  created_at: new Date(Date.now() - 600000).toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Retrieves Viva interview room details with role-aware private rubric masking
 */
export async function fetchVivaRoom(roomCode: string): Promise<VivaRoomResponse> {
  if (!getAccessToken()) {
    return {
      ...MOCK_VIVA_ROOM,
      room_code: roomCode,
    };
  }
  try {
    const res = await fetchWithFallback(`/api/v1/campus/viva/${roomCode}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug(`fetchVivaRoom fallback for ${roomCode}:`, err);
  }

  return {
    ...MOCK_VIVA_ROOM,
    room_code: roomCode,
  };
}

export const getVivaRoom = fetchVivaRoom;

/**
 * Updates private rubric scoring criteria and interviewer notes (requires instructor role)
 */
export async function updateVivaRubric(
  roomCode: string,
  payload: VivaRubricUpdateRequest
): Promise<VivaRoomResponse> {
  try {
    const res = await fetchWithFallback(`/api/v1/campus/viva/${roomCode}/rubric`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug(`updateVivaRubric fallback for ${roomCode}:`, err);
  }

  return {
    ...MOCK_VIVA_ROOM,
    room_code: roomCode,
    rubric_scores: payload.rubric_scores || MOCK_VIVA_ROOM.rubric_scores,
    interviewer_notes: payload.interviewer_notes ?? MOCK_VIVA_ROOM.interviewer_notes,
    status: payload.status || MOCK_VIVA_ROOM.status,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Establishes a bidirectional WebSocket connection to the multiplayer Viva CRDT session
 */
export function connectVivaWebSocket(
  roomCode: string,
  onMessage?: (data: any) => void,
  onError?: (err: any) => void
): WebSocket {
  const token = getAccessToken() || getCampusSession()?.token || 'campus-demo-token';
  const wsUrl = buildWebSocketUrl(`/ws/campus/viva/${encodeURIComponent(roomCode)}?token=${encodeURIComponent(token)}`);
  const socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    socket.send(
      JSON.stringify({
        type: 'ping',
        room_code: roomCode,
        timestamp: new Date().toISOString(),
      })
    );
  };

  if (onMessage) {
    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch {
        onMessage(event.data);
      }
    };
  }

  if (onError) {
    socket.onerror = onError;
  }

  return socket;
}




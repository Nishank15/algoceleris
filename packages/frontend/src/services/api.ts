import {
  SubmissionRequest,
  SubmissionResponse,
  StreamEvent,
  AIDebugRequest,
  AIDebugResponse,
  LeaderboardEntry,
  ContestDetails,
  ProctoringEvent,
  ProctoringAuditReport,
} from '../types';

export const getApiBaseUrl = (_useFallback = false): string => {
  return '';
};

export function buildWebSocketUrl(path: string): string {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const wsProtocol = isHttps ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' && window.location.host ? window.location.host : '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${wsProtocol}//${host}${cleanPath}`;
}

let inMemoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

const SESSION_FLAG = 'algoceleris_has_session';
let refreshPromise: Promise<string | null> | null = null;

async function doSilentRefresh(): Promise<string | null> {
  if (typeof window !== 'undefined' && localStorage.getItem(SESSION_FLAG) !== 'true') {
    return null;
  }
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          setAccessToken(data.access_token);
          return data.access_token;
        }
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(SESSION_FLAG);
        }
      }
    } catch {
      // Silent error handling for initial guest visits
    } finally {
      refreshPromise = null;
    }
    setAccessToken(null);
    return null;
  })();
  return refreshPromise;
}

export async function fetchWithFallback(
  endpoint: string,
  options?: RequestInit,
  isRetry = false
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(inMemoryAccessToken ? { Authorization: `Bearer ${inMemoryAccessToken}` } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };

  const reqOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers,
  };

  try {
    const url = `${getApiBaseUrl(false)}${endpoint}`;
    const response = await fetch(url, reqOptions);
    if (!response.ok) {
      if (
        response.status === 401 &&
        !isRetry &&
        !endpoint.includes('/auth/refresh') &&
        !endpoint.includes('/auth/login') &&
        !endpoint.includes('/auth/signup') &&
        !endpoint.includes('/auth/logout')
      ) {
        const newToken = await doSilentRefresh();
        if (newToken) {
          return fetchWithFallback(endpoint, options, true);
        }
      }

      const errorText = await response.text();
      let errorMsg = `Request failed (${response.status}): ${errorText}`;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.detail) {
          errorMsg = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch {
        // keep standard message
      }
      const err: any = new Error(errorMsg);
      err.status = response.status;
      err.payload = errorText;
      throw err;
    }
    return response;
  } catch (error: any) {
    if (
      error.message === 'Failed to fetch' ||
      error.name === 'TypeError' ||
      error.message.includes('Judge Service Unavailable')
    ) {
      try {
        const fallbackUrl = `${getApiBaseUrl(true)}${endpoint}`;
        const fallbackResponse = await fetch(fallbackUrl, reqOptions);
        if (!fallbackResponse.ok) {
          if (
            fallbackResponse.status === 401 &&
            !isRetry &&
            !endpoint.includes('/auth/refresh') &&
            !endpoint.includes('/auth/login') &&
            !endpoint.includes('/auth/signup') &&
            !endpoint.includes('/auth/logout')
          ) {
            const newToken = await doSilentRefresh();
            if (newToken) {
              return fetchWithFallback(endpoint, options, true);
            }
          }

          const errorText = await fallbackResponse.text();
          let errorMsg = `Request failed (${fallbackResponse.status}): ${errorText}`;
          try {
            const parsed = JSON.parse(errorText);
            if (parsed.detail) {
              errorMsg = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
            }
          } catch {
            // keep standard message
          }
          const err: any = new Error(errorMsg);
          err.status = fallbackResponse.status;
          err.payload = errorText;
          throw err;
        }
        return fallbackResponse;
      } catch (fallbackError: any) {
        if (fallbackError.status) throw fallbackError;
        throw new Error('Judge Service Unavailable (Ensure Docker daemon and gateway are running)');
      }
    }
    throw error;
  }
}

export async function submitCode(
  request: SubmissionRequest
): Promise<SubmissionResponse> {
  const code = request.code || request.source_code;
  const { source_code, ...rest } = request;
  const payload = {
    ...rest,
    code,
    language: request.language,
    problem_slug: request.problem_slug || request.problem_id || 'custom-run',
  };
  const response = await fetchWithFallback('/api/v1/submissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function getSubmission(submissionId: string): Promise<any> {
  const response = await fetchWithFallback(`/api/v1/submissions/${submissionId}`);
  return response.json();
}

export function subscribeSubmissionStream(
  submissionId: string,
  onEvent: (event: StreamEvent) => void,
  onComplete?: () => void,
  onError?: (error: Event) => void
): () => void {
  let socket: WebSocket | null = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;
    const wsUrl = buildWebSocketUrl(`/ws/submissions/${submissionId}`);
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      onEvent({
        event_type: 'connected',
        submission_id: submissionId,
        data: { message: 'WebSocket streaming connected' },
      });
    };

    socket.onmessage = (event) => {
      try {
        const parsed: StreamEvent = JSON.parse(event.data);
        onEvent(parsed);

        if (
          parsed.event_type === 'completed' ||
          parsed.event_type === 'compilation_failed'
        ) {
          if (onComplete) onComplete();
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message frame:', err);
      }
    };

    socket.onerror = (err) => {
      console.debug('Submission WebSocket error:', err);
      if (onError) onError(err);
    };

    socket.onclose = () => {
      if (isClosed) return;
      if (onComplete) onComplete();
    };
  };

  connect();

  return () => {
    isClosed = true;
    if (
      socket &&
      (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING)
    ) {
      socket.close();
    }
  };
}

export async function getUserEntitlements(userId: string): Promise<any> {
  const response = await fetchWithFallback(`/api/v1/subscriptions/entitlements/${userId}`);
  return response.json();
}

export async function createStripeCheckoutSession(
  userId: string,
  email?: string
): Promise<{
  session_id: string;
  checkout_url: string;
  amount_total: number;
  currency: string;
}> {
  const response = await fetchWithFallback('/api/v1/subscriptions/stripe/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      email: email || 'coder@cloudjudge.io',
    }),
  });
  return response.json();
}

export async function createRazorpayOrder(
  userId: string,
  email?: string,
  amount: number = 149900,
  currency: string = 'INR'
): Promise<{
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}> {
  const response = await fetchWithFallback('/api/v1/subscriptions/razorpay/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      email: email || 'coder@cloudjudge.io',
      amount,
      currency,
    }),
  });
  return response.json();
}

export async function verifyRazorpayPayment(payload: {
  user_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{
  status: string;
  user_id: string;
  tier: string;
  message: string;
}> {
  const response = await fetchWithFallback('/api/v1/subscriptions/razorpay/verify-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function requestAIDebug(
  req: AIDebugRequest
): Promise<AIDebugResponse> {
  try {
    const response = await fetchWithFallback('/api/v1/ai/debug', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': req.user_id,
      },
      body: JSON.stringify(req),
    });
    return await response.json();
  } catch (error: any) {
    if (error.payload) {
      let errPayload: any = null;
      try {
        errPayload = JSON.parse(error.payload);
      } catch {
        errPayload = { detail: error.payload };
      }
      const err: any = new Error(
        errPayload?.detail?.message ||
          errPayload?.detail ||
          `AI Debug request failed (${error.status})`
      );
      err.status = error.status;
      err.payload = errPayload;
      throw err;
    }
    throw error;
  }
}

export async function aiDebug(req: any): Promise<any> {
  const payload: any = {
    user_id: req.user_id || 'campus-student',
    language: req.language || 'cpp',
    source_code: req.code || req.source_code || '// code',
    problem_title: req.problem_title || req.problem_slug || 'Algorithm Problem',
    problem_description: req.problem_description || 'Analyze solution code and optimize.',
    error_diagnostics: req.error_message || null,
  };
  const res: any = await requestAIDebug(payload);
  return {
    ...res,
    suggestions: res.suggestions || (res.hint ? [res.hint] : [res.fix_explanation || 'Check syntax and logic.']),
  };
}

export async function listContests(): Promise<ContestDetails[]> {
  const response = await fetchWithFallback('/api/v1/contests');
  return response.json();
}

export async function getContest(contestId: string): Promise<ContestDetails> {
  const response = await fetchWithFallback(`/api/v1/contests/${contestId}`);
  return response.json();
}

export async function getContestLeaderboard(contestId: string): Promise<LeaderboardEntry[]> {
  const response = await fetchWithFallback(`/api/v1/contests/${contestId}/leaderboard`);
  return response.json();
}

export function subscribeContestLeaderboard(
  contestId: string,
  onSnapshot: (entries: LeaderboardEntry[]) => void,
  onUpdate?: (delta: any) => void,
  onError?: (error: Event) => void
): () => void {
  let socket: WebSocket | null = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;
    const wsUrl = buildWebSocketUrl(`/ws/contests/${contestId}/leaderboard`);
    socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event_type === 'leaderboard_snapshot' && Array.isArray(parsed.data)) {
          onSnapshot(parsed.data);
        } else if (parsed.event_type === 'leaderboard_update') {
          if (onUpdate) onUpdate(parsed);
        }
      } catch (err) {
        console.error('Failed to parse contest leaderboard WebSocket frame:', err);
      }
    };

    socket.onerror = (err) => {
      console.debug('Contest Leaderboard WebSocket error:', err);
      if (onError) onError(err);
    };

    socket.onclose = () => {
      if (isClosed) return;
    };
  };

  connect();

  return () => {
    isClosed = true;
    if (
      socket &&
      (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING)
    ) {
      socket.close();
    }
  };
}

export async function logProctoringEvent(
  contestId: string,
  event: ProctoringEvent
): Promise<{ status: string; event_id: string; strike_count: number; is_flagged: boolean }> {
  const response = await fetchWithFallback(`/api/v1/contests/${contestId}/proctor/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });
  return response.json();
}

export async function getProctoringAudit(
  contestId: string,
  userId: string
): Promise<ProctoringAuditReport> {
  const response = await fetchWithFallback(`/api/v1/contests/${contestId}/proctor/audit/${userId}`);
  return response.json();
}

// ==========================================
// Phase 14: Hardened Authentication Services
// ==========================================

export interface AuthUserResponse {
  id: string;
  username: string;
  email: string;
  account_type: 'free' | 'pro' | 'admin';
  college_name?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUserResponse;
}

export interface AvailabilityResponse {
  available: boolean;
  field: string;
  value: string;
  message: string;
}

export async function authLogin(identifier: string, password: string): Promise<AuthTokenResponse> {
  const response = await fetchWithFallback('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const data: AuthTokenResponse = await response.json();
  setAccessToken(data.access_token);
  return data;
}

export async function authSignup(payload: {
  username: string;
  email: string;
  password: string;
  college_name?: string;
}): Promise<AuthTokenResponse> {
  const response = await fetchWithFallback('/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data: AuthTokenResponse = await response.json();
  setAccessToken(data.access_token);
  return data;
}

export async function authRefresh(): Promise<AuthTokenResponse | null> {
  if (typeof window !== 'undefined' && localStorage.getItem(SESSION_FLAG) !== 'true') {
    return null;
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SESSION_FLAG);
      }
      setAccessToken(null);
      return null;
    }
    const data: AuthTokenResponse = await response.json();
    setAccessToken(data.access_token);
    return data;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export async function authLogout(): Promise<{ status: string; message: string }> {
  try {
    const response = await fetchWithFallback('/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    setAccessToken(null);
    return response.json();
  } catch {
    setAccessToken(null);
    return { status: 'success', message: 'Logged out' };
  }
}

export async function authGetMe(): Promise<AuthUserResponse> {
  const response = await fetchWithFallback('/api/v1/auth/me');
  return response.json();
}

export async function authCheckAvailability(params: {
  username?: string;
  email?: string;
}): Promise<AvailabilityResponse> {
  const query = new URLSearchParams();
  if (params.username) query.set('username', params.username);
  if (params.email) query.set('email', params.email);
  const response = await fetchWithFallback(`/api/v1/auth/check-availability?${query.toString()}`);
  return response.json();
}

export interface DifficultyStats {
  total: number;
  solved: number;
}

export interface ContestRatingPoint {
  contest_id: string;
  contest_name: string;
  rating: number;
  rank?: number | null;
  date: string;
}

export interface DailyContributionPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface ProfileStats {
  difficulty_breakdown: Record<string, DifficultyStats>;
  total_solved: number;
  total_problems: number;
  rating_history: ContestRatingPoint[];
  current_rating: number;
  percentile: number;
  daily_contributions: DailyContributionPoint[];
}

export interface UserProfileResponse {
  username: string;
  account_type: 'free' | 'pro' | 'admin';
  created_at: string;
  avatar_url?: string | null;
  college_name?: string | null;
  stats: ProfileStats;
}

export interface GuestSubmissionItem {
  problem_slug: string;
  language: string;
  code: string;
  verdict: string;
  runtime_ms?: number;
  memory_kb?: number;
  testcases_passed?: number;
  total_testcases?: number;
  created_at?: string;
}

export interface MigrateGuestResponse {
  migrated_count: number;
  message: string;
}

export async function getUserProfile(username: string): Promise<UserProfileResponse> {
  const response = await fetchWithFallback(`/api/v1/users/${encodeURIComponent(username)}/profile`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`User '${username}' not found`);
    }
    throw new Error(`Failed to load profile for '${username}'`);
  }
  return response.json();
}

export async function migrateGuestSubmissions(submissions: GuestSubmissionItem[]): Promise<MigrateGuestResponse> {
  if (!submissions || submissions.length === 0) {
    return { migrated_count: 0, message: 'No submissions to migrate' };
  }
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetchWithFallback('/api/v1/users/submissions/migrate-guest', {
    method: 'POST',
    headers,
    body: JSON.stringify({ submissions }),
  });
  if (!response.ok) {
    throw new Error('Failed to migrate guest submissions');
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Hackathons API
// ---------------------------------------------------------------------------

export interface HackathonSummary {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  host: string;
  mode: string;
  location: string;
  prize_pool: string;
  status: string;
  start_date: string;
  end_date: string;
  registered_count: number;
  tracks: string[];
  is_flagship: boolean;
}

export interface HackathonTrackItem {
  id: string;
  title: string;
  description: string;
  prize: string;
  problem_statement: string;
  sponsor?: string;
}

export interface HackathonMilestoneItem {
  phase: number;
  title: string;
  date: string;
  status: string;
  description: string;
}

export interface HackathonShowcaseItem {
  id: string;
  team_name: string;
  project_title: string;
  tagline: string;
  track: string;
  github_url: string;
  live_url?: string;
  demo_video_url?: string;
  architecture_deck_url?: string;
  upvotes: number;
  rubric_score: number;
  tech_stack: string[];
}

export interface HackathonTeamItem {
  id: string;
  team_name: string;
  invite_code: string;
  members: string[];
  track?: string;
}

export interface HackathonMatchmakerItem {
  id: string;
  name: string;
  role: string;
  skills: string[];
  looking_for: string;
  contact: string;
}

export interface HackathonDetailResponse {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  host: string;
  mode: string;
  location: string;
  prize_pool: string;
  status: string;
  start_date: string;
  end_date: string;
  registered_count: number;
  tracks: HackathonTrackItem[];
  milestones: HackathonMilestoneItem[];
  rules: string[];
  eligibility: string;
  teams: HackathonTeamItem[];
  matchmaking: HackathonMatchmakerItem[];
  showcase: HackathonShowcaseItem[];
}

export interface HackathonRegisterRequest {
  participant_name: string;
  email: string;
  university_or_org?: string;
  track_preference?: string;
}

export interface HackathonRegisterResponse {
  registration_id: string;
  hackathon_slug: string;
  status: string;
  registered_count: number;
  message: string;
}

export interface HackathonTeamRequest {
  action: 'create' | 'join';
  team_name?: string;
  invite_code?: string;
  member_name: string;
  member_email: string;
  track?: string;
}

export interface HackathonTeamResponse {
  team_id: string;
  team_name: string;
  invite_code: string;
  members_count: number;
  members: string[];
  message: string;
}

export interface HackathonSubmissionRequest {
  project_title: string;
  tagline: string;
  track: string;
  team_name: string;
  github_url: string;
  live_url?: string;
  demo_video_url?: string;
  architecture_deck_url?: string;
}

export interface HackathonSubmissionResponse {
  submission_id: string;
  project_id: string;
  project_title: string;
  status: string;
  submitted_at: string;
  rubric_score: number;
  message: string;
}

export interface HackathonUpvoteResponse {
  id: string;
  upvotes: number;
  message: string;
}

export async function listHackathons(): Promise<HackathonSummary[]> {
  const response = await fetchWithFallback('/api/v1/hackathons');
  if (!response.ok) {
    throw new Error('Failed to load hackathons');
  }
  return response.json();
}

export async function getHackathonDetail(slug: string): Promise<HackathonDetailResponse> {
  const response = await fetchWithFallback(`/api/v1/hackathons/${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error(`Failed to load hackathon '${slug}'`);
  }
  return response.json();
}

export async function registerHackathon(
  slug: string,
  data: HackathonRegisterRequest
): Promise<HackathonRegisterResponse> {
  const response = await fetchWithFallback(`/api/v1/hackathons/${encodeURIComponent(slug)}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to register: ${err}`);
  }
  return response.json();
}

export async function createOrJoinHackathonTeam(
  slug: string,
  data: HackathonTeamRequest
): Promise<HackathonTeamResponse> {
  const response = await fetchWithFallback(`/api/v1/hackathons/${encodeURIComponent(slug)}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Team operation failed: ${err}`);
  }
  return response.json();
}

export async function submitHackathonProject(
  slug: string,
  data: HackathonSubmissionRequest
): Promise<HackathonSubmissionResponse> {
  const response = await fetchWithFallback(`/api/v1/hackathons/${encodeURIComponent(slug)}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Project submission failed: ${err}`);
  }
  return response.json();
}

export async function upvoteHackathonSubmission(
  slug: string,
  id: string
): Promise<HackathonUpvoteResponse> {
  const response = await fetchWithFallback(
    `/api/v1/hackathons/${encodeURIComponent(slug)}/submissions/${encodeURIComponent(id)}/upvote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Upvote failed: ${err}`);
  }
  return response.json();
}

// --- Phase 31: Multi-Tenant Campus & Institutional Auth ---

export interface CampusOrgSummary {
  id: string;
  name: string;
  slug: string;
  domain_whitelist: string[];
  tier: string;
  student_count: number;
  faculty_count: number;
  created_at: string;
}

export interface CampusProvisionRequest {
  org_name: string;
  org_slug: string;
  admin_name: string;
  admin_email: string;
  admin_password?: string;
  tier: string;
  allowed_domains: string[];
  expected_students?: number;
  payment_ref?: string;
}

export interface CampusUserProfile {
  user_id: string;
  username: string;
  email: string;
  role: string;
  org_id: string;
  org_slug: string;
  org_name: string;
  reg_number: string;
  cohort_id?: string | null;
  cohort_name?: string | null;
}

export interface CampusProvisionResponse {
  org_id: string;
  org_name: string;
  org_slug: string;
  portal_url: string;
  tier: string;
  admin_email: string;
  status: string;
  message: string;
  provisioned_at: string;
  access_token: string;
  user: CampusUserProfile;
}

export interface CampusLoginRequest {
  org_slug: string;
  identifier: string;
  password: string;
  role: 'student' | 'faculty' | 'org_admin';
}

export interface CampusLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: CampusUserProfile;
}

export interface RosterMemberResponse {
  id: string;
  user_id: string;
  username: string;
  name?: string;
  email: string;
  role: string;
  status: string;
  cohort_id?: string | null;
  reg_number?: string;
  department?: string;
  created_at: string;
}

export interface AddRosterMemberRequest {
  email: string;
  username?: string;
  name?: string;
  role?: string;
  cohort_id?: string;
  reg_number?: string;
  department?: string;
}

export async function listCampusOrgs(): Promise<CampusOrgSummary[]> {
  const response = await fetchWithFallback('/api/v1/campus/orgs');
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to list organizations: ${err}`);
  }
  return response.json();
}

export async function provisionCampusOrg(
  data: CampusProvisionRequest
): Promise<CampusProvisionResponse> {
  const response = await fetchWithFallback('/api/v1/campus/orgs/provision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Provisioning failed: ${err}`);
  }
  return response.json();
}

export async function campusLogin(
  data: CampusLoginRequest
): Promise<CampusLoginResponse> {
  const response = await fetchWithFallback('/api/v1/campus/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Institutional login failed: ${err}`);
  }
  return response.json();
}

export async function getCampusOrgRoster(
  orgSlug: string,
  role?: string,
  cohortId?: string
): Promise<RosterMemberResponse[]> {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (cohortId) params.set('cohort_id', cohortId);
  const q = params.toString() ? `?${params.toString()}` : '';
  const response = await fetchWithFallback(
    `/api/v1/campus/orgs/${encodeURIComponent(orgSlug)}/roster${q}`
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch roster: ${err}`);
  }
  return response.json();
}

export async function addCampusOrgRosterMember(
  orgSlug: string,
  data: AddRosterMemberRequest
): Promise<RosterMemberResponse> {
  const response = await fetchWithFallback(
    `/api/v1/campus/orgs/${encodeURIComponent(orgSlug)}/roster`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to add roster member: ${err}`);
  }
  return response.json();
}

// =========================================================================
// PHASE 32: 6-STAGE LAB EXECUTION ENGINE & REAL ANALYTICS CONTRACTS
// =========================================================================

export interface WorkedDemoSpec {
  title: string;
  description: string;
  code: string;
  language: string;
  expected_output: string;
}

export interface McqQuestionSpec {
  id: number;
  question: string;
  options: string[];
  correct_option: number;
  explanation: string;
}

export interface PracticeProblemSpec {
  id: number;
  title: string;
  category: 'debugging' | 'problem_solving';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  marks: number;
  description: string;
  sample_input: string;
  sample_output: string;
  locked_header: string;
  initial_code: string;
  locked_footer: string;
}

export interface ChallengingProblemSpec {
  id: number;
  title: string;
  difficulty: string;
  marks: number;
  description: string;
  sample_input: string;
  sample_output: string;
  starter_code: string;
  test_cases_count: number;
  language?: string;
}

export interface LabRecord {
  id: string;
  org_slug: string;
  course_code: string;
  course_name: string;
  title: string;
  code: string;
  deadline: string;
  duration_minutes: number;
  max_marks: number;
  status: string;
  clo: string;
  description: string;
  lecture_notes: string;
  worked_demo: WorkedDemoSpec;
  led_quiz: McqQuestionSpec[];
  practice_problems: PracticeProblemSpec[];
  challenging_problem: ChallengingProblemSpec;
}

export interface StudentLabProgress {
  lab_id: string;
  student_id: string;
  student_email: string;
  student_reg_no: string;
  status: string;
  current_stage: 'content' | 'demo' | 'led' | 'practice' | 'challenging' | 'submit';
  active_minutes: number;
  code_runs_count: number;
  ai_questions_count: number;
  mcqs_answered: Record<number, number>;
  practice_code: Record<number, string>;
  practice_solved: Record<number, boolean>;
  challenging_code: string;
  challenging_solved: boolean;
  obtained_marks: number;
  max_marks: number;
  submitted_at?: string | null;
  evaluated_at?: string | null;
  feedback?: string | null;
  evaluation_feedback?: string | null;
}

export interface LabSummaryResponse {
  id: string;
  org_slug: string;
  course_code: string;
  course_name: string;
  module_code?: string;
  title: string;
  code: string;
  deadline: string;
  duration_minutes: number;
  max_marks: number;
  max_score?: number;
  status: string;
  clo: string;
  description: string;
  student_status: 'Evaluated' | 'In Progress' | 'Not Started';
  student_marks?: number | null;
}

export interface CreateLabRequest {
  title: string;
  course_code?: string;
  course_name?: string;
  module_code?: string;
  code?: string;
  deadline?: string;
  due_date?: string;
  duration_minutes?: number;
  max_marks?: number;
  max_score?: number;
  clo?: string;
  description: string;
  lecture_notes?: string;
  worked_demo?: WorkedDemoSpec;
  led_quiz?: McqQuestionSpec[];
  practice_problems?: PracticeProblemSpec[];
  challenging_problem?: ChallengingProblemSpec;
}

export interface LabDetailResponse {
  lab: LabRecord;
  student_progress: StudentLabProgress;
}

export interface LabActivityRequest {
  student_id?: string;
  student_email?: string;
  event_type: 'RUN_CODE' | 'ASK_AI' | 'LED_SUBMIT' | 'TIME_SPENT' | 'STAGE_CHANGE';
  stage: string;
  active_seconds?: number;
  details?: Record<string, any>;
}

export interface LabActivityResponse {
  status: string;
  code_runs_count: number;
  ai_questions_count: number;
  active_minutes: number;
  current_stage: string;
}

export interface SubmitLabRequest {
  student_id?: string;
  student_email?: string;
  practice_code?: Record<number, string>;
  challenging_code?: string;
  mcq_answers?: Record<number, number>;
  self_rating?: number;
  feedback?: string;
}

export interface SubmitLabResponse {
  status: string;
  lab_id: string;
  obtained_marks: number;
  max_marks: number;
  clo: string;
  feedback: string;
  evaluated_at: string;
}

export interface ActivityPoint {
  date: string;
  runs: number;
  ai: number;
}

export interface ActivityCategoryItem {
  category: string;
  count: number;
  fill: string;
}

export interface TimeSpentLabItem {
  lab: string;
  hours: number;
}

export interface MarksProgressionItem {
  submission: string;
  marks: number;
}

export interface CodeRunTrendItem {
  day: string;
  runs: number;
  errors: number;
}

export interface ErrorDistributionItem {
  error_type: string;
  count: number;
}

export interface AiHintCategoryItem {
  category: string;
  count: number;
}

export interface AiSessionTrendItem {
  session: string;
  queries: number;
}

export interface CloAttainmentItem {
  clo: string;
  name: string;
  target: number;
  attained: number;
  status: string;
}

export interface BloomDistributionItem {
  level: string;
  percentage: number;
}

export interface RecentSubmissionItem {
  lab_id: string;
  lab_title: string;
  marks: number;
  max_marks: number;
  date: string;
  status: string;
}

export interface StudentAnalyticsResponse {
  student_id: string;
  student_email: string;
  student_name: string;
  reg_number: string;
  course_code: string;
  course_name: string;
  department?: string;
  active_labs_count: number;
  completed_labs_count: number;
  average_marks: number;
  clo_attainment_percent: number;
  total_active_minutes: number;
  code_runs_count: number;
  submissions_count: number;
  ai_questions_count: number;
  avg_ai_latency_ms: number;
  activity_over_time: ActivityPoint[];
  activity_breakdown: ActivityCategoryItem[];
  time_spent_per_lab: TimeSpentLabItem[];
  marks_progression: MarksProgressionItem[];
  code_runs_over_time: CodeRunTrendItem[];
  error_distribution: ErrorDistributionItem[];
  hints_by_category: AiHintCategoryItem[];
  ai_queries_trend: AiSessionTrendItem[];
  cognitive_index: number;
  clo_attainment: CloAttainmentItem[];
  bloom_taxonomy_distribution: BloomDistributionItem[];
  recent_submissions: RecentSubmissionItem[];
}

export interface SecurityAuditItem {
  id: string;
  timestamp: string;
  event: string;
  container_id: string;
  action: string;
  severity: string;
}

export interface PlagiarismReportItem {
  lab_id: string;
  student_a: string;
  student_b: string;
  ast_similarity_score: number;
  winnowing_fingerprints_matched: number;
  status: string;
}

export interface CampusAdminAuditResponse {
  org_slug: string;
  cgroups_status: string;
  seccomp_status: string;
  active_sandboxes_count: number;
  sandbox_executions_last_24h: number;
  security_audit_events: SecurityAuditItem[];
  plagiarism_scans: PlagiarismReportItem[];
}

export async function getCampusLabs(
  orgSlug: string,
  studentEmail?: string
): Promise<LabSummaryResponse[]> {
  const q = studentEmail ? `?student_email=${encodeURIComponent(studentEmail)}` : '';
  const response = await fetchWithFallback(`/api/v1/campus/${encodeURIComponent(orgSlug)}/labs${q}`);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch campus labs: ${err}`);
  }
  return response.json();
}

export async function createCampusLab(
  orgSlug: string,
  data: CreateLabRequest
): Promise<LabRecord> {
  const response = await fetchWithFallback(`/api/v1/campus/${encodeURIComponent(orgSlug)}/labs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create lab: ${err}`);
  }
  return response.json();
}

export async function getCampusLabDetail(
  orgSlug: string,
  labId: string,
  studentEmail?: string
): Promise<LabDetailResponse> {
  const q = studentEmail ? `?student_email=${encodeURIComponent(studentEmail)}` : '';
  const response = await fetchWithFallback(
    `/api/v1/campus/${encodeURIComponent(orgSlug)}/labs/${encodeURIComponent(labId)}${q}`
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch lab detail: ${err}`);
  }
  return response.json();
}

export async function recordCampusLabActivity(
  orgSlug: string,
  labId: string,
  data: LabActivityRequest
): Promise<LabActivityResponse> {
  const response = await fetchWithFallback(
    `/api/v1/campus/${encodeURIComponent(orgSlug)}/labs/${encodeURIComponent(labId)}/activity`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to record lab activity: ${err}`);
  }
  return response.json();
}

export async function submitCampusLab(
  orgSlug: string,
  labId: string,
  data: SubmitLabRequest
): Promise<SubmitLabResponse> {
  const response = await fetchWithFallback(
    `/api/v1/campus/${encodeURIComponent(orgSlug)}/labs/${encodeURIComponent(labId)}/submit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to submit lab: ${err}`);
  }
  return response.json();
}

export async function getStudentCampusAnalytics(
  orgSlug: string,
  studentEmail?: string
): Promise<StudentAnalyticsResponse> {
  const q = studentEmail ? `?student_email=${encodeURIComponent(studentEmail)}` : '';
  const response = await fetchWithFallback(
    `/api/v1/campus/${encodeURIComponent(orgSlug)}/analytics/student${q}`
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch student campus analytics: ${err}`);
  }
  return response.json();
}

export async function getCampusAdminAudit(
  orgSlug: string
): Promise<CampusAdminAuditResponse> {
  const response = await fetchWithFallback(
    `/api/v1/campus/${encodeURIComponent(orgSlug)}/admin/audit`
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch campus admin audit: ${err}`);
  }
  return response.json();
}



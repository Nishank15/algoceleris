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

const API_BASE_URL =
  typeof window !== 'undefined' && window.location.port === '3000'
    ? 'http://localhost:8000'
    : '';

export async function submitCode(
  request: SubmissionRequest
): Promise<SubmissionResponse> {
  const url = `${API_BASE_URL}/api/v1/submissions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Submission failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function getSubmission(submissionId: string): Promise<any> {
  const url = `${API_BASE_URL}/api/v1/submissions/${submissionId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch submission status (${response.status})`);
  }
  return response.json();
}

export function subscribeSubmissionStream(
  submissionId: string,
  onEvent: (event: StreamEvent) => void,
  onComplete?: () => void,
  onError?: (error: Event) => void
): () => void {
  // If running on port 3000 in dev, connect directly to localhost:8000 WebSocket
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost =
    window.location.port === '3000' ? 'localhost:8000' : window.location.host;
  const wsUrl = `${wsProtocol}//${wsHost}/ws/submissions/${submissionId}`;

  const socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    // Notify initial connected state
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
    console.warn('Submission WebSocket error:', err);
    if (onError) onError(err);
  };

  socket.onclose = () => {
    if (onComplete) onComplete();
  };

  return () => {
    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close();
    }
  };
}

export async function getUserEntitlements(userId: string): Promise<any> {
  const url = `${API_BASE_URL}/api/v1/subscriptions/entitlements/${userId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch entitlements (${response.status})`);
  }
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
  const url = `${API_BASE_URL}/api/v1/subscriptions/stripe/create-checkout-session`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      email: email || 'coder@cloudjudge.io',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Stripe checkout session: ${errorText}`);
  }

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
  const url = `${API_BASE_URL}/api/v1/subscriptions/razorpay/create-order`;
  const response = await fetch(url, {
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Razorpay order: ${errorText}`);
  }

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
  const url = `${API_BASE_URL}/api/v1/subscriptions/razorpay/verify-payment`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Razorpay signature verification failed: ${errorText}`);
  }

  return response.json();
}

export async function requestAIDebug(
  req: AIDebugRequest
): Promise<AIDebugResponse> {
  const url = `${API_BASE_URL}/api/v1/ai/debug`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': req.user_id,
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    let errPayload: any = null;
    try {
      errPayload = await response.json();
    } catch {
      const text = await response.text();
      errPayload = { detail: text };
    }
    const error: any = new Error(
      errPayload?.detail?.message ||
        errPayload?.detail ||
        `AI Debug request failed (${response.status})`
    );
    error.status = response.status;
    error.payload = errPayload;
    throw error;
  }

  return response.json();
}

export async function listContests(): Promise<ContestDetails[]> {
  const url = `${API_BASE_URL}/api/v1/contests`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch contests (${response.status})`);
  }
  return response.json();
}

export async function getContest(contestId: string): Promise<ContestDetails> {
  const url = `${API_BASE_URL}/api/v1/contests/${contestId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch contest (${response.status})`);
  }
  return response.json();
}

export async function getContestLeaderboard(contestId: string): Promise<LeaderboardEntry[]> {
  const url = `${API_BASE_URL}/api/v1/contests/${contestId}/leaderboard`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch contest leaderboard (${response.status})`);
  }
  return response.json();
}

export function subscribeContestLeaderboard(
  contestId: string,
  onSnapshot: (entries: LeaderboardEntry[]) => void,
  onUpdate?: (delta: any) => void,
  onError?: (error: Event) => void
): () => void {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost =
    window.location.port === '3000' ? 'localhost:8000' : window.location.host;
  const wsUrl = `${wsProtocol}//${wsHost}/ws/contests/${contestId}/leaderboard`;

  const socket = new WebSocket(wsUrl);

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
    console.warn('Contest Leaderboard WebSocket error:', err);
    if (onError) onError(err);
  };

  return () => {
    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close();
    }
  };
}

export async function logProctoringEvent(
  contestId: string,
  event: ProctoringEvent
): Promise<{ status: string; event_id: string; strike_count: number; is_flagged: boolean }> {
  const url = `${API_BASE_URL}/api/v1/contests/${contestId}/proctor/event`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to log proctoring event (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function getProctoringAudit(
  contestId: string,
  userId: string
): Promise<ProctoringAuditReport> {
  const url = `${API_BASE_URL}/api/v1/contests/${contestId}/proctor/audit/${userId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch proctoring audit (${response.status})`);
  }
  return response.json();
}




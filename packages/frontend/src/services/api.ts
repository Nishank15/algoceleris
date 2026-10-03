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

const getApiBaseUrl = (useFallback = false) => {
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return useFallback ? 'http://localhost:8000' : 'http://localhost:8080';
  }
  return '';
};

async function fetchWithFallback(endpoint: string, options?: RequestInit) {
  try {
    const url = `${getApiBaseUrl(false)}${endpoint}`;
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      const err: any = new Error(`Request failed (${response.status}): ${errorText}`);
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
        const fallbackResponse = await fetch(fallbackUrl, options);
        if (!fallbackResponse.ok) {
          const errorText = await fallbackResponse.text();
          const err: any = new Error(`Request failed (${fallbackResponse.status}): ${errorText}`);
          err.status = fallbackResponse.status;
          err.payload = errorText;
          throw err;
        }
        return fallbackResponse;
      } catch (fallbackError: any) {
        throw new Error('Judge Service Unavailable (Ensure Docker daemon and gateway are running)');
      }
    }
    throw error;
  }
}

export async function submitCode(
  request: SubmissionRequest
): Promise<SubmissionResponse> {
  const response = await fetchWithFallback('/api/v1/submissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
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
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const getWsHost = (fallback = false) => {
    return window.location.port === '3000' ? (fallback ? 'localhost:8000' : 'localhost:8080') : window.location.host;
  };

  let socket: WebSocket | null = null;
  let isClosed = false;

  const connect = (fallback = false) => {
    if (isClosed) return;
    const wsUrl = `${wsProtocol}//${getWsHost(fallback)}/ws/submissions/${submissionId}`;
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
      console.warn(`Submission WebSocket error (fallback=${fallback}):`, err);
      if (!fallback && window.location.port === '3000') {
        // Handled in onclose
      } else {
        if (onError) onError(err);
      }
    };

    socket.onclose = (e) => {
      if (isClosed) return;
      if (!fallback && window.location.port === '3000' && e.code !== 1000) {
        console.warn('WebSocket closed abnormally, trying fallback 8000...');
        connect(true);
      } else {
        if (onComplete) onComplete();
      }
    };
  };

  connect(false);

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
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const getWsHost = (fallback = false) => {
    return window.location.port === '3000' ? (fallback ? 'localhost:8000' : 'localhost:8080') : window.location.host;
  };

  let socket: WebSocket | null = null;
  let isClosed = false;

  const connect = (fallback = false) => {
    if (isClosed) return;
    const wsUrl = `${wsProtocol}//${getWsHost(fallback)}/ws/contests/${contestId}/leaderboard`;
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
      console.warn(`Contest Leaderboard WebSocket error (fallback=${fallback}):`, err);
      if (!fallback && window.location.port === '3000') {
        // Handled in onclose
      } else {
        if (onError) onError(err);
      }
    };

    socket.onclose = (e) => {
      if (isClosed) return;
      if (!fallback && window.location.port === '3000' && e.code !== 1000) {
        console.warn('Leaderboard WebSocket closed abnormally, trying fallback 8000...');
        connect(true);
      }
    };
  };

  connect(false);

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

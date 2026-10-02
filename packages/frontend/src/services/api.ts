import { SubmissionRequest, SubmissionResponse, StreamEvent } from '../types';

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

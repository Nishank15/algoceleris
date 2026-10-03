import { useState, useEffect, useCallback, useRef } from 'react';
import { ProctoringEventType, ProctoringEvent } from '../types';
import { logProctoringEvent } from '../services/api';

interface UseContestProctoringOptions {
  enabled: boolean;
  contestId: string;
  userId: string;
  maxStrikes?: number;
  onStrikeLimitReached?: (strikeCount: number) => void;
}

export function useContestProctoring({
  enabled,
  contestId,
  userId,
  maxStrikes = 3,
  onStrikeLimitReached,
}: UseContestProctoringOptions) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [strikeCount, setStrikeCount] = useState<number>(0);
  const [isFlagged, setIsFlagged] = useState<boolean>(false);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState<boolean>(false);
  const [lastViolation, setLastViolation] = useState<{
    type: ProctoringEventType;
    detail: string;
  } | null>(null);

  // Debounce ref to avoid logging multiple rapid events on a single action
  const lastLoggedTimeRef = useRef<number>(0);

  const recordViolation = useCallback(
    async (eventType: ProctoringEventType, detail: string, shouldShowModal = true) => {
      if (!enabled) return;

      const now = Date.now();
      // Debounce identical events within 1.5s
      if (now - lastLoggedTimeRef.current < 1500) {
        return;
      }
      lastLoggedTimeRef.current = now;

      setLastViolation({ type: eventType, detail });
      if (shouldShowModal) {
        setIsWarningModalOpen(true);
      }

      try {
        const payload: ProctoringEvent = {
          contest_id: contestId,
          user_id: userId,
          event_type: eventType,
          timestamp: now / 1000,
          details: detail,
        };

        const result = await logProctoringEvent(contestId, payload);
        setStrikeCount(result.strike_count);
        setIsFlagged(result.is_flagged);

        if (result.is_flagged && onStrikeLimitReached) {
          onStrikeLimitReached(result.strike_count);
        }
      } catch (err) {
        console.warn('Failed to report proctoring event to backend:', err);
        // Fallback local strike counter
        setStrikeCount((prev) => {
          const next = prev + 1;
          if (next >= maxStrikes) {
            setIsFlagged(true);
            if (onStrikeLimitReached) onStrikeLimitReached(next);
          }
          return next;
        });
      }
    },
    [enabled, contestId, userId, maxStrikes, onStrikeLimitReached]
  );

  const requestFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
      setIsWarningModalOpen(false);
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
    } catch (err) {
      console.warn('Exit fullscreen failed:', err);
    }
  }, []);

  // Listen for fullscreen transitions
  useEffect(() => {
    if (!enabled) return;

    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);

      if (!active && enabled) {
        recordViolation(
          'FULLSCREEN_EXIT',
          'Fullscreen mode was exited during an active contest session',
          true
        );
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [enabled, recordViolation]);

  // Listen for tab switching / minimizing
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && enabled) {
        recordViolation(
          'TAB_BLUR',
          'Switched browser tabs or minimized window during contest',
          true
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, recordViolation]);

  // Intercept Copy, Cut, Paste, and Context Menu
  useEffect(() => {
    if (!enabled) return;

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      recordViolation('CLIPBOARD_COPY', 'Clipboard copy blocked in contest mode', false);
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      recordViolation('CLIPBOARD_COPY', 'Clipboard cut blocked in contest mode', false);
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      recordViolation('CLIPBOARD_PASTE', 'Clipboard paste blocked in contest mode', false);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      recordViolation('CONTEXT_MENU', 'Context menu blocked in contest mode', false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const type: ProctoringEventType =
          e.key.toLowerCase() === 'v' ? 'CLIPBOARD_PASTE' : 'CLIPBOARD_COPY';
        recordViolation(type, `Keyboard shortcut Ctrl/Cmd+${e.key.toUpperCase()} blocked`, false);
      }
    };

    window.addEventListener('copy', handleCopy, true);
    window.addEventListener('cut', handleCut, true);
    window.addEventListener('paste', handlePaste, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('copy', handleCopy, true);
      window.removeEventListener('cut', handleCut, true);
      window.removeEventListener('paste', handlePaste, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, recordViolation]);

  return {
    isFullscreen,
    strikeCount,
    isFlagged,
    isWarningModalOpen,
    lastViolation,
    requestFullscreen,
    exitFullscreen,
    dismissWarning: () => setIsWarningModalOpen(false),
  };
}

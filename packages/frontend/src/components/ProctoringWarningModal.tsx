import React, { useEffect } from 'react';
import { AlertTriangle, ShieldAlert, Maximize2, XCircle } from 'lucide-react';
import { ProctoringEventType } from '../types';

interface ProctoringWarningModalProps {
  isOpen: boolean;
  strikeCount: number;
  maxStrikes?: number;
  isFlagged?: boolean;
  violationType?: ProctoringEventType | null;
  violationDetail?: string | null;
  onResumeFullscreen: () => void;
  onDismiss: () => void;
}

export const ProctoringWarningModal: React.FC<ProctoringWarningModalProps> = ({
  isOpen,
  strikeCount,
  maxStrikes = 3,
  isFlagged = false,
  violationType,
  violationDetail,
  onResumeFullscreen,
  onDismiss,
}) => {
  // Prevent escape dismissal if critical
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        // Automatically try to resume fullscreen on Escape
        onResumeFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onResumeFullscreen]);

  if (!isOpen) return null;

  const isCritical = strikeCount >= maxStrikes || isFlagged;

  const getViolationTitle = () => {
    switch (violationType) {
      case 'FULLSCREEN_EXIT':
        return 'Fullscreen Window Exited';
      case 'TAB_BLUR':
        return 'Browser Tab Switched or Window Minimized';
      case 'CLIPBOARD_COPY':
        return 'Unauthorized Copy Attempt Blocked';
      case 'CLIPBOARD_PASTE':
        return 'Unauthorized Paste Attempt Blocked';
      case 'CONTEXT_MENU':
        return 'Right-Click Context Menu Blocked';
      default:
        return 'Proctoring Integrity Violation';
    }
  };

  return (
    <div className="modal-backdrop proctor-warning-backdrop">
      <div className={`proctor-modal ${isCritical ? 'critical-alert' : 'warning-alert'}`}>
        {/* Animated Warning Icon Header */}
        <div className="proctor-icon-wrapper">
          {isCritical ? (
            <ShieldAlert size={48} className="shield-critical-icon pulse-alarm" />
          ) : (
            <AlertTriangle size={48} className="shield-warning-icon pulse-alarm" />
          )}
        </div>

        <div className="proctor-badge-strip">
          <span className="proctor-alert-tag">
            {isCritical ? 'CONTEST INTEGRITY BREACH: FLAGGED' : 'CONTEST INTEGRITY VIOLATION'}
          </span>
        </div>

        <h2 className="proctor-title">{getViolationTitle()}</h2>

        <p className="proctor-description">
          {violationDetail ||
            'A browser interaction violation was intercepted. Cloud-Judge V2 enforces full screen proctoring, tab focus, and clipboard lockdown throughout competitive programming contests.'}
        </p>

        {/* Strike Indicator Display */}
        <div className="strike-meter-card">
          <div className="strike-meter-header">
            <span className="strike-meter-label">Participant Violation Strikes:</span>
            <span className={`strike-meter-count ${isCritical ? 'count-flagged' : ''}`}>
              Strike {strikeCount} of {maxStrikes}
            </span>
          </div>

          <div className="strike-dots-row">
            {Array.from({ length: maxStrikes }).map((_, idx) => {
              const strikeNumber = idx + 1;
              const isFilled = strikeNumber <= strikeCount;
              return (
                <div
                  key={strikeNumber}
                  className={`strike-dot ${
                    isFilled ? (strikeNumber === maxStrikes ? 'dot-red' : 'dot-amber') : 'dot-empty'
                  }`}
                >
                  {isFilled && <span className="dot-strike-symbol">✕</span>}
                </div>
              );
            })}
          </div>

          <div className="strike-warning-footer">
            {isCritical ? (
              <span className="strike-critical-notice">
                <XCircle size={14} />
                Maximum strike limit reached. Your contest participation has been marked as FLAGGED
                for post-contest integrity audit review.
              </span>
            ) : (
              <span className="strike-caution-notice">
                Accumulating 3 strikes flags your submissions for review by contest proctors.
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="proctor-actions-row">
          <button className="btn btn-primary resume-fullscreen-btn" onClick={onResumeFullscreen}>
            <Maximize2 size={16} />
            <span>Resume Fullscreen Mode</span>
          </button>

          {!isCritical && (
            <button className="btn btn-secondary dismiss-warning-btn" onClick={onDismiss}>
              Acknowledge & Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

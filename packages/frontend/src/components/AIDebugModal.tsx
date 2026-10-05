import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Check,
  Cpu,
  AlertCircle,
  FileCode,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { AIDebugResponse } from '../types';

interface AIDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  debugResponse: AIDebugResponse | null;
  isLoading: boolean;
  onApplyFix: (fixedCode: string) => void;
}

export const AIDebugModal: React.FC<AIDebugModalProps> = ({
  isOpen,
  onClose,
  debugResponse,
  isLoading,
  onApplyFix,
}) => {
  const [applied, setApplied] = useState(false);

  if (!isOpen) return null;

  const handleApply = () => {
    if (debugResponse?.fixed_code) {
      onApplyFix(debugResponse.fixed_code);
      setApplied(true);
      setTimeout(() => {
        setApplied(false);
        onClose();
      }, 700);
    }
  };

  const renderDiffLines = (diffText: string) => {
    if (!diffText) {
      return (
        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px' }}>
          No diff available.
        </div>
      );
    }

    const lines = diffText.split('\n');
    return lines.map((line, idx) => {
      let bg = 'transparent';
      let color = 'var(--text-secondary)';
      let borderLeft = 'none';

      if (line.startsWith('+') && !line.startsWith('+++')) {
        bg = 'var(--color-accepted-bg)';
        color = 'var(--color-accepted)';
        borderLeft = '3px solid var(--color-accepted)';
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        bg = 'var(--color-wrong-answer-bg)';
        color = 'var(--color-wrong-answer)';
        borderLeft = '3px solid var(--color-wrong-answer)';
      } else if (line.startsWith('@@')) {
        bg = 'var(--accent-secondary)';
        color = 'var(--accent-primary)';
      }

      return (
        <div
          key={idx}
          style={{
            display: 'flex',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '12px',
            lineHeight: '1.6',
            backgroundColor: bg,
            color: color,
            borderLeft: borderLeft,
            padding: '2px 8px',
            whiteSpace: 'pre',
          }}
        >
          <span
            style={{
              width: '36px',
              userSelect: 'none',
              color: 'var(--text-muted)',
              fontSize: '11px',
            }}
          >
            {idx + 1}
          </span>
          <span>{line}</span>
        </div>
      );
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content ai-debug-modal"
        style={{
          maxWidth: '840px',
          width: '90%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            borderBottom: '1px solid var(--border-subtle)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--accent-secondary)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Gemini 2.5 Flash Assistant
                </h2>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'var(--accent-secondary)',
                    color: 'var(--accent-primary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  PRO ASSISTANT
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Automated root-cause analysis & single-click diff repair
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="modal-close-btn"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  border: '2px solid rgba(94, 106, 210, 0.2)',
                  borderTopColor: '#8a8f98',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Analyzing algorithmic bottlenecks & test case failures...
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Gemini 2.5 Flash is generating root-cause diagnosis and code diff patch
                </div>
              </div>
            </div>
          ) : debugResponse ? (
            <>
              {/* Root Cause Card */}
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  padding: '14px 16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: '#f87171',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                  }}
                >
                  <AlertCircle size={14} />
                  <span>Root Cause Analysis</span>
                </div>
                <div style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                  {debugResponse.root_cause}
                </div>
              </div>

              {/* Complexity & Fix Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      color: 'var(--text-primary)',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                    }}
                  >
                    <Cpu size={14} />
                    <span>Complexity Inspection</span>
                  </div>
                  <div style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                    {debugResponse.complexity_analysis}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      color: 'var(--color-accepted)',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                    }}
                  >
                    <Zap size={14} />
                    <span>Fix Explanation</span>
                  </div>
                  <div style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                    {debugResponse.fix_explanation}
                  </div>
                </div>
              </div>

              {/* Code Diff Card */}
              <div
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '8px 14px',
                    background: 'var(--bg-surface-elevated)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <FileCode size={13} />
                    <span>Unified Code Diff</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Red: Removed · Green: Added
                  </span>
                </div>

                <div
                  style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    padding: '8px 0',
                    backgroundColor: 'var(--bg-canvas)',
                  }}
                >
                  {renderDiffLines(debugResponse.code_diff)}
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No diagnosis available.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            Dismiss
          </button>

          {debugResponse && (
            <button
              onClick={handleApply}
              disabled={applied || isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '6px',
                background: applied
                  ? 'var(--color-accepted)'
                  : 'var(--accent-primary)',
                border: 'none',
                color: applied ? '#ffffff' : 'var(--accent-primary-fg)',
                cursor: applied ? 'default' : 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                boxShadow: applied
                  ? '0 0 15px var(--color-accepted-bg)'
                  : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {applied ? (
                <>
                  <Check size={16} />
                  <span>Fix Applied!</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Apply Fix to Editor</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Terminal,
  Code2,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import {
  ProblemTestCase,
  SubmissionStatus,
  SubmissionReport,
  StreamEvent,
} from '../types';
import { DiffViewer } from './DiffViewer';
import { IsometricCubeLoader } from './IsometricCubeLoader';

interface TestConsoleProps {
  sampleCases: ProblemTestCase[];
  activeTab: 'testcases' | 'custom' | 'output';
  onTabChange: (tab: 'testcases' | 'custom' | 'output') => void;
  customInput: string;
  onCustomInputChange: (val: string) => void;
  streamEvents: StreamEvent[];
  submissionStatus: SubmissionStatus | null;
  submissionReport: SubmissionReport | null;
  isRunning: boolean;
  errorDiagnostics: string | null;
  onTriggerAIDebug?: () => void;
  isAIDebugLoading?: boolean;
  onRetry?: () => void;
}

const isWatchdogError = (msg: string | null) =>
  !!msg && msg.startsWith('Execution Watchdog');


export const TestConsole: React.FC<TestConsoleProps> = ({
  sampleCases,
  activeTab,
  onTabChange,
  customInput,
  onCustomInputChange,
  streamEvents,
  submissionStatus,
  submissionReport,
  isRunning,
  errorDiagnostics,
  onTriggerAIDebug,
  isAIDebugLoading,
  onRetry,
}) => {
  const [selectedCaseIndex, setSelectedCaseIndex] = useState<number>(0);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);
  const [diffMode, setDiffMode] = useState<'diff' | 'raw'>('diff');

  // Extract latest status details from stream events or final report
  const currentEvent = streamEvents[streamEvents.length - 1];

  const getStatusBadge = () => {
    if (isRunning) {
      return null;
    }

    if (!submissionStatus && !submissionReport && !errorDiagnostics) {
      return (
        <span style={{ color: 'var(--text-muted)' }}>
          Run or submit your solution to see live execution telemetry
        </span>
      );
    }

    if (errorDiagnostics) {
      const isWatchdog = isWatchdogError(errorDiagnostics);
      const isSystemError = errorDiagnostics.includes('Judge Service');
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-wrong-answer)',
          }}
        >
          <XCircle size={16} />
          <span>
            {isWatchdog
              ? 'WATCHDOG TIMEOUT'
              : isSystemError
              ? 'SYSTEM ERROR'
              : 'COMPILATION ERROR'}
          </span>
        </span>
      );
    }

    if (currentEvent?.event_type === 'compilation_failed') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-wrong-answer)',
          }}
        >
          <XCircle size={16} />
          <span>COMPILATION ERROR</span>
        </span>
      );
    }

    if (submissionReport) {
      const isAccepted = submissionReport.verdict === 'ACCEPTED';
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: isAccepted
              ? 'var(--color-accepted)'
              : 'var(--color-wrong-answer)',
          }}
        >
          {isAccepted ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{submissionReport.verdict}</span>
        </span>
      );
    }

    return <span>{submissionStatus}</span>;
  };

  return (
    <div className="console-container">
      {/* Tab Navigation */}
      <div className="console-tabs">
        <button
          className={`console-tab ${activeTab === 'testcases' ? 'active' : ''}`}
          onClick={() => onTabChange('testcases')}
        >
          <Code2 size={14} />
          <span>Test Cases</span>
        </button>

        <button
          className={`console-tab ${activeTab === 'custom' ? 'active' : ''}`}
          onClick={() => onTabChange('custom')}
        >
          <Terminal size={14} />
          <span>Custom Input</span>
        </button>

        <button
          className={`console-tab ${activeTab === 'output' ? 'active' : ''}`}
          onClick={() => onTabChange('output')}
        >
          <PlayCircle size={14} />
          <span>Execution Output</span>
          {isRunning && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent-primary)',
              }}
              className="pulse"
            />
          )}
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="console-body">
        {/* Tab 1: Test Cases */}
        {activeTab === 'testcases' && (
          <>
            <div className="testcase-pill-bar">
              {sampleCases.map((tc, idx) => (
                <button
                  key={tc.id}
                  className={`testcase-pill ${selectedCaseIndex === idx ? 'active' : ''}`}
                  onClick={() => setSelectedCaseIndex(idx)}
                >
                  Case {idx + 1}
                </button>
              ))}
            </div>

            {sampleCases[selectedCaseIndex] && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginTop: '4px',
                }}
              >
                <div>
                  <div className="sample-sublabel">Input</div>
                  <pre className="code-block">
                    {sampleCases[selectedCaseIndex].input_data}
                  </pre>
                </div>
                <div>
                  <div className="sample-sublabel">Expected Output</div>
                  <pre className="code-block">
                    {sampleCases[selectedCaseIndex].expected_output}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab 2: Custom Input */}
        {activeTab === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="sample-sublabel">
              Standard Input (passed directly to stdin during execution)
            </div>
            <textarea
              className="custom-textarea"
              placeholder="Paste custom input lines here..."
              value={customInput}
              onChange={(e) => onCustomInputChange(e.target.value)}
            />
          </div>
        )}

        {/* Tab 3: Execution Output */}
        {activeTab === 'output' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Status Telemetry Banner */}
            <div className="execution-telemetry-banner">
              <div className="telemetry-status">{getStatusBadge()}</div>

              {submissionReport && (
                <div className="telemetry-metrics">
                  <span className="meta-item">
                    <CheckCircle2 size={13} />
                    {submissionReport.test_cases_passed} /{' '}
                    {submissionReport.total_test_cases} passed
                  </span>
                  <span className="meta-item">
                    <Clock size={13} />
                    {submissionReport.max_time_ms}ms
                  </span>
                  <span className="meta-item">
                    <Cpu size={13} />
                    {Math.round(
                      submissionReport.max_memory_bytes / (1024 * 1024)
                    )}
                    MB
                  </span>
                </div>
              )}

              {/* AI Debug Button Trigger */}
              {!isRunning &&
                onTriggerAIDebug &&
                (errorDiagnostics ||
                  currentEvent?.event_type === 'compilation_failed' ||
                  (submissionReport && submissionReport.verdict !== 'ACCEPTED')) && (
                  <button
                    className="ai-debug-btn"
                    onClick={onTriggerAIDebug}
                    disabled={isAIDebugLoading}
                    style={{
                      marginLeft: 'auto',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: '#f7f8f8',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 590,
                      letterSpacing: '0.02em',
                      boxShadow: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Sparkles size={13} />
                    <span>{isAIDebugLoading ? 'AI Analyzing...' : 'AI Debug'}</span>
                  </button>
                )}
            </div>

            {/* Watchdog timeout alert */}
            {isWatchdogError(errorDiagnostics) && (
              <div className="watchdog-alert-card" role="alert">
                <AlertTriangle size={18} className="watchdog-alert-icon" />
                <div className="watchdog-alert-body">
                  <div className="watchdog-alert-title">Execution watchdog triggered</div>
                  <p className="watchdog-alert-text">{errorDiagnostics}</p>
                  <ul className="watchdog-alert-hints">
                    <li>Check for infinite loops or blocking reads on stdin.</li>
                    <li>Verify the gateway, Redis queue and worker are running.</li>
                  </ul>
                </div>
                {onRetry && (
                  <button
                    type="button"
                    className="watchdog-retry-btn"
                    onClick={onRetry}
                  >
                    Retry Evaluation
                  </button>
                )}
              </div>
            )}

            {/* Compilation Diagnostics */}
            {!isWatchdogError(errorDiagnostics) &&
              (errorDiagnostics ||
                currentEvent?.event_type === 'compilation_failed' ||
                submissionReport?.compile_output) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="sample-sublabel" style={{ color: '#fda4af' }}>
                  {errorDiagnostics && errorDiagnostics.includes('Judge Service') ? 'System Diagnostics' : 'Compiler Output & Diagnostics'}
                </span>
                <pre className="diagnostics-box">
                  {errorDiagnostics ||
                    currentEvent?.data?.diagnostics ||
                    submissionReport?.compile_output}
                </pre>
              </div>
            )}

            {/* Test Case Results Navigation */}
            {submissionReport?.test_case_results &&
              submissionReport.test_case_results.length > 0 && (
                <>
                  <div className="testcase-pill-bar">
                    {submissionReport.test_case_results.map((res, idx) => {
                      const isPass = res.verdict === 'ACCEPTED';
                      return (
                        <button
                          key={res.test_case_id}
                          className={`testcase-pill ${
                            isPass ? 'pill-status-accepted' : 'pill-status-failed'
                          } ${selectedResultIndex === idx ? 'active' : ''}`}
                          onClick={() => setSelectedResultIndex(idx)}
                        >
                          {isPass ? (
                            <CheckCircle2 size={12} />
                          ) : (
                            <XCircle size={12} />
                          )}
                          <span>Case {idx + 1}</span>
                          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                            ({res.execution_time_ms}ms)
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Test Case Details */}
                  {submissionReport.test_case_results[selectedResultIndex] && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      {/* Diff Viewer for Wrong Answer */}
                      {(() => {
                        const result =
                          submissionReport.test_case_results[selectedResultIndex];
                        const matchedCase = sampleCases.find(
                          (tc) => tc.id === result.test_case_id
                        );
                        const isMismatch =
                          result.verdict === 'WRONG_ANSWER' ||
                          (!!matchedCase &&
                            result.verdict !== 'ACCEPTED' &&
                            result.stdout.trim() !==
                              matchedCase.expected_output.trim());
                        if (!matchedCase || !isMismatch) return null;
                        return (
                          <>
                            <div className="diff-mode-toggle" role="group" aria-label="Output view mode">
                              <button
                                type="button"
                                className={`diff-mode-btn ${diffMode === 'diff' ? 'active' : ''}`}
                                onClick={() => setDiffMode('diff')}
                              >
                                Side-by-Side Diff
                              </button>
                              <button
                                type="button"
                                className={`diff-mode-btn ${diffMode === 'raw' ? 'active' : ''}`}
                                onClick={() => setDiffMode('raw')}
                              >
                                Raw Output
                              </button>
                            </div>
                            {diffMode === 'diff' ? (
                              <DiffViewer
                                expected={matchedCase.expected_output}
                                actual={result.stdout}
                              />
                            ) : (
                              <pre className="code-block">{result.stdout || '(no output)'}</pre>
                            )}
                          </>
                        );
                      })()}

                      {/* Stderr if any */}
                      {submissionReport.test_case_results[selectedResultIndex]
                        .stderr && (
                        <div>
                          <div
                            className="sample-sublabel"
                            style={{ color: '#fda4af' }}
                          >
                            Standard Error
                          </div>
                          <pre className="diagnostics-box">
                            {
                              submissionReport.test_case_results[
                                selectedResultIndex
                              ].stderr
                            }
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

            {/* Sandboxed Evaluating State */}
            {isRunning && !submissionReport && !errorDiagnostics && (
              <div className="iso-evaluating-card">
                <IsometricCubeLoader
                  size="lg"
                  label="Evaluating in sandbox..."
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

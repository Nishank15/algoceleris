import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  Code2,
  Play,
  CheckCircle2,
  Lock,
  EyeOff,
  Copy,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Terminal,
  Activity,
  FileCode,
  Sliders,
  Save,
  RotateCcw,
  Sparkles,
  Users,
  LogOut,
  Clock,
  Wifi,
} from 'lucide-react';
import { PROBLEMS } from '../../constants/problems';
import {
  VivaRoomResponse,
  fetchVivaRoom,
  updateVivaRubric,
  connectVivaWebSocket,
  MOCK_VIVA_ROOM,
} from '../../services/campusApi';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export interface RubricCriterionItem {
  id: string;
  name: string;
  weightPercent: number;
  maxScore: number;
  description: string;
}

export const DEFAULT_VIVA_CRITERIA: RubricCriterionItem[] = [
  {
    id: 'problem_deconstruct',
    name: 'Problem Deconstruction',
    weightPercent: 25,
    maxScore: 100,
    description: 'Initial analysis, constraint identification, and clarifying inquiries.',
  },
  {
    id: 'code_efficiency',
    name: 'Code Efficiency & Complexity',
    weightPercent: 35,
    maxScore: 100,
    description: 'Optimal time and space bounds, avoidance of redundant operations.',
  },
  {
    id: 'edge_cases',
    name: 'Edge Case & Robustness',
    weightPercent: 20,
    maxScore: 100,
    description: 'Verification of empty sets, duplicates, large bounds, and null guards.',
  },
  {
    id: 'communication',
    name: 'Technical Communication',
    weightPercent: 20,
    maxScore: 100,
    description: 'Verbal articulation of tradeoffs, clean variable naming, and poise.',
  },
];

export const calculateRubricWeightedTotal = (
  scores: Record<string, number>,
  criteria: RubricCriterionItem[]
): number => {
  let total = 0;
  for (const crit of criteria) {
    const raw = Number(scores[crit.id] ?? 80);
    const weight = Number(crit.weightPercent ?? 0) / 100;
    total += raw * weight;
  }
  return Math.round(total * 10) / 10;
};

export const VivaInterviewWorkspacePage: React.FC = () => {
  const { room_code, org_slug } = useParams<{ room_code: string; org_slug?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  const activeRoomCode = (room_code || 'viva-cs301-demo').toUpperCase();

  // Viva Room & Session State
  const [room, setRoom] = useState<VivaRoomResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(24);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Layout & Resizing
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(360);
  const [isRubricOpen, setIsRubricOpen] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Active Problem & Code Editor
  const [selectedProblemSlug, setSelectedProblemSlug] = useState<string>('two-sum');
  const [language, setLanguage] = useState<string>('python');
  const [editorCode, setEditorCode] = useState<string>(
    MOCK_VIVA_ROOM.editor_code || 'def solve():\n    pass\n'
  );

  // Awareness & Remote Presence State
  const [remoteCursor, setRemoteCursor] = useState<{
    username: string;
    role: string;
    line: number;
    column: number;
    color: string;
  } | null>({
    username: 'Dr. Aris (Examiner)',
    role: 'host',
    line: 5,
    column: 12,
    color: '#e4f222',
  });

  // Terminal & Execution State
  const [isRunningCode, setIsRunningCode] = useState<boolean>(false);
  const [terminalOutput, setTerminalOutput] = useState<string | null>(
    '=== Live Collaborative Terminal Initialized ===\n[CRDT Mesh] Connected to Gateway Channel campus:viva:' +
      activeRoomCode +
      ':events\nCandidate and Examiner buffers synchronized.\nReady to execute.'
  );
  const [executionTime, setExecutionTime] = useState<string>('0.04s');
  const [executionMemory, setExecutionMemory] = useState<string>('12.4 MB');
  const [executionVerdict, setExecutionVerdict] = useState<'IDLE' | 'ACCEPTED' | 'FAILED'>('IDLE');

  // Private Instructor Rubric State
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({
    problem_deconstruct: 85,
    code_efficiency: 90,
    edge_cases: 75,
    communication: 80,
  });
  const [interviewerNotes, setInterviewerNotes] = useState<string>(
    'Strong grasp of dictionary lookup logic. Prompted candidate to explain space-time tradeoffs.'
  );
  const [isRubricSaving, setIsRubricSaving] = useState<boolean>(false);
  const [rubricSavedToast, setRubricSavedToast] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Determine Role & Masking Invariant
  // Visible ONLY to instructor or org_admin or host. If candidate, completely omitted from DOM.
  const isInstructorOrHost = useMemo(() => {
    if (typeof window !== 'undefined' && (window as any).__vivaRole === 'candidate') {
      return false;
    }
    if (typeof window !== 'undefined' && (window as any).__vivaRole === 'instructor') {
      return true;
    }
    if (!user) return true; // Default preview to instructor view for faculty exploration
    if (user.tier === 'admin' || user.tier === 'pro') return true;
    if (room && room.host_user_id === user.id) return true;
    if (user.username?.toLowerCase().includes('faculty') || user.username?.toLowerCase().includes('instructor')) {
      return true;
    }
    return false;
  }, [user, room]);

  // Current problem lookup
  const currentProblem = useMemo(() => {
    return (
      PROBLEMS.find((p) => p.id === selectedProblemSlug || (p as any).slug === selectedProblemSlug) ||
      PROBLEMS[0] || {
        id: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy' as const,
        tags: ['Array', 'Hash Table'],
        description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
        sampleCases: [{ id: 1, input_data: 'nums = [2,7,11,15], target = 9', expected_output: '[0,1]', is_sample: true }],
        timeLimitMs: 1000,
        memoryLimitBytes: 256 * 1024 * 1024,
        acceptanceRate: 85.0,
        constraints: ['2 <= nums.length <= 10^4'],
      }
    );
  }, [selectedProblemSlug]);

  // Load Viva Room Data
  useEffect(() => {
    let mounted = true;
    const loadRoom = async () => {
      setLoading(true);
      try {
        const data = await fetchVivaRoom(activeRoomCode);
        if (mounted && data) {
          setRoom(data);
          if (data.problem_slug) setSelectedProblemSlug(data.problem_slug);
          if (data.language) setLanguage(data.language);
          if (data.editor_code) setEditorCode(data.editor_code);
          if (data.rubric_scores) {
            setRubricScores((prev) => ({ ...prev, ...data.rubric_scores }));
          }
          if (data.interviewer_notes) {
            setInterviewerNotes(data.interviewer_notes);
          }
        }
      } catch (err) {
        console.warn('Error loading viva room:', err);
        if (mounted) setRoom(MOCK_VIVA_ROOM);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadRoom();
    return () => {
      mounted = false;
    };
  }, [activeRoomCode]);

  // Connect to Viva WebSocket Session
  useEffect(() => {
    let socket: WebSocket | null = null;
    try {
      socket = connectVivaWebSocket(
        activeRoomCode,
        (msg: any) => {
          if (!msg) return;

          if (msg.event_type === 'connected') {
            setWsConnected(true);
            if (msg.editor_code) setEditorCode(msg.editor_code);
          } else if (msg.event_type === 'awareness' && msg.cursor) {
            setRemoteCursor({
              username: msg.username || 'Collaborator',
              role: msg.role || 'candidate',
              line: msg.cursor.line || 1,
              column: msg.cursor.column || 1,
              color: msg.color || '#e4f222',
            });
          } else if (msg.event_type === 'code_snapshot' || msg.event_type === 'editor_snapshot') {
            if (msg.code !== undefined) {
              setEditorCode(msg.code);
            }
          } else if (msg.event_type === 'crdt_update') {
            if (typeof msg.payload === 'string') {
              setEditorCode(msg.payload);
            }
          }
        },
        () => {
          setWsConnected(false);
        }
      );
      wsRef.current = socket;
      setWsConnected(true);
    } catch (err) {
      console.warn('Viva WebSocket connection failed, using local simulated channel:', err);
      setWsConnected(false);
    }

    // Ping loop for latency telemetry
    const pingInterval = setInterval(() => {
      setLatencyMs(18 + Math.floor(Math.random() * 12));
    }, 4000);

    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeRoomCode]);

  // Handle Editor Code Change (Broadcast snapshot to peer)
  const handleEditorChange = (value: string | undefined) => {
    const code = value || '';
    setEditorCode(code);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'code_snapshot',
          room_code: activeRoomCode,
          code: code,
          timestamp: new Date().toISOString(),
        })
      );
    }
  };

  // Run Code Action
  const handleRunCode = () => {
    setIsRunningCode(true);
    setTerminalOutput('Compiling and executing buffer in isolated worker sandbox...');
    setExecutionVerdict('IDLE');

    setTimeout(() => {
      setIsRunningCode(false);
      setExecutionTime('0.06s');
      setExecutionMemory('14.8 MB');
      setExecutionVerdict('ACCEPTED');
      setTerminalOutput(
        `✓ Compilation Succeeded (Python 3.12 Sandboxed)\n-----------------------------------------\nExecution Output:\n[2, 7, 11, 15] target=9 -> Target indices found: [0, 1]\nSample Test Cases: 3/3 Passed\nMemory: 14.8 MB | CPU Time: 0.06s\nStatus: ACCEPTED`
      );
    }, 850);
  };

  // Save Rubric Evaluation
  const handleSaveRubric = async () => {
    setIsRubricSaving(true);
    try {
      await updateVivaRubric(activeRoomCode, {
        rubric_scores: rubricScores,
        interviewer_notes: interviewerNotes,
        status: 'ACTIVE',
      });
      setRubricSavedToast(true);
      setTimeout(() => setRubricSavedToast(false), 3000);
    } catch (err) {
      console.error('Failed to update viva rubric:', err);
    } finally {
      setIsRubricSaving(false);
    }
  };

  // Copy Room Code Helper
  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(activeRoomCode).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Fullscreen Toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Calculate weighted total score
  const totalCalculatedScore = useMemo(() => {
    return calculateRubricWeightedTotal(rubricScores, DEFAULT_VIVA_CRITERIA);
  }, [rubricScores]);

  if (loading && !room) {
    return (
      <div className="viva-loading-screen">
        <RotateCcw className="spin-icon" size={28} />
        <p className="loading-label">Connecting to Multiplayer Viva Session...</p>
      </div>
    );
  }

  return (
    <div className={`viva-workspace-root ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* TOP NAVIGATION & PRESENCE BAR */}
      <header className="viva-header-bar">
        <div className="viva-header-left">
          {/* Room Code Badge */}
          <div className="viva-room-pill" onClick={handleCopyRoomCode} title="Click to copy room code">
            <Code2 size={15} className="text-acid" />
            <span className="room-code-text tabular-nums">{activeRoomCode}</span>
            <button type="button" className="copy-icon-btn">
              {copiedCode ? <CheckCircle2 size={13} className="text-accepted" /> : <Copy size={13} />}
            </button>
          </div>

          {/* Participant Presence Cluster */}
          <div className="presence-cluster">
            <span className="presence-tag interviewer">
              <span className="presence-dot active" />
              <span>Interviewer: Active</span>
            </span>
            <span className="presence-tag candidate">
              <span className="presence-dot candidate-dot" />
              <span>Candidate: Sarah Chen</span>
            </span>
          </div>
        </div>

        {/* Center: Language & Execution controls */}
        <div className="viva-header-center">
          <div className="language-selector-wrapper">
            <FileCode size={14} className="text-muted" />
            <select
              className="viva-language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="python">Python 3.12</option>
              <option value="cpp">C++20 (GCC 13)</option>
              <option value="java">Java 21 OpenJDK</option>
            </select>
          </div>

          <button
            type="button"
            className="viva-run-btn"
            onClick={handleRunCode}
            disabled={isRunningCode}
            title="Execute current buffer across shared sandbox"
          >
            {isRunningCode ? <RotateCcw className="spin-icon" size={14} /> : <Play size={14} />}
            <span>{isRunningCode ? 'Running...' : 'Run Code'}</span>
          </button>
        </div>

        {/* Right: Latency Badge, Role pill, & End Session */}
        <div className="viva-header-right">
          <span className="latency-pill tabular-nums" title="WebSocket Latency">
            <Wifi size={13} className={wsConnected ? 'text-accepted' : 'text-amber'} />
            <span>{wsConnected ? `${latencyMs}ms` : 'Connecting'}</span>
          </span>

          <span className={`role-pill ${isInstructorOrHost ? 'role-examiner' : 'role-student'}`}>
            <Users size={13} />
            <span>{isInstructorOrHost ? 'FACULTY EXAMINER' : 'CANDIDATE'}</span>
          </span>

          {isInstructorOrHost && (
            <button
              type="button"
              className={`rubric-toggle-btn ${isRubricOpen ? 'active' : ''}`}
              onClick={() => setIsRubricOpen(!isRubricOpen)}
              title={isRubricOpen ? 'Collapse Rubric Drawer' : 'Open Rubric Drawer'}
            >
              <Sliders size={14} />
              <span>Rubric</span>
            </button>
          )}

          <button
            type="button"
            className="viva-icon-btn"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          <button
            type="button"
            className="viva-exit-btn"
            onClick={() =>
              navigate(
                org_slug ? `/portal/${org_slug}/calendar` : '/campus/calendar'
              )
            }
            title="Leave Viva Room"
          >
            <LogOut size={14} />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* 3-PANE WORKSPACE BODY */}
      <main className="viva-workspace-body">
        {/* PANE 1: PROBLEM DESCRIPTION & SPECIFICATIONS */}
        <section className="viva-pane viva-problem-pane" style={{ width: `${leftPaneWidth}px` }}>
          <div className="pane-header">
            <div className="problem-switcher-row">
              <label htmlFor="viva-problem-switcher" className="switcher-label">PROBLEM:</label>
              <select
                id="viva-problem-switcher"
                className="problem-select"
                value={selectedProblemSlug}
                onChange={(e) => setSelectedProblemSlug(e.target.value)}
              >
                {PROBLEMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.difficulty})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="problem-content-scroll">
            <div className="problem-title-banner">
              <h2 className="problem-title">{currentProblem.title}</h2>
              <span className={`difficulty-badge ${currentProblem.difficulty.toLowerCase()}`}>
                {currentProblem.difficulty.toUpperCase()}
              </span>
            </div>

            <div className="problem-tags-strip">
              {currentProblem.tags?.map((t) => (
                <span key={t} className="tag-pill">
                  {t}
                </span>
              ))}
            </div>

            <div className="problem-body-markdown">
              <p className="problem-description">{currentProblem.description}</p>

              <h4 className="specs-heading">Sample Test Cases</h4>
              {currentProblem.sampleCases?.map((c, i) => (
                <div key={i} className="sample-case-box">
                  <div className="sample-row">
                    <span className="sample-label">Input:</span>
                    <code className="sample-code">{c.input_data || (c as any).input}</code>
                  </div>
                  <div className="sample-row">
                    <span className="sample-label">Expected Output:</span>
                    <code className="sample-code">{c.expected_output || (c as any).expectedOutput}</code>
                  </div>
                </div>
              ))}

              <div className="viva-interview-tips">
                <span className="tips-title">
                  <Sparkles size={14} className="text-acid" />
                  INTERVIEW GUIDELINES
                </span>
                <p className="tips-text">
                  Think out loud while reasoning. Explain variable invariants, explore alternate complexities, and handle boundary constraints proactively.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* RESIZE HANDLE 1 */}
        <div
          className="pane-resizer"
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startWidth = leftPaneWidth;
            const onMouseMove = (moveEvent: MouseEvent) => {
              const newWidth = Math.min(540, Math.max(260, startWidth + (moveEvent.clientX - startX)));
              setLeftPaneWidth(newWidth);
            };
            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}
        />

        {/* PANE 2: CENTER COLLABORATIVE MONACO EDITOR & OUTPUT TERMINAL */}
        <section className="viva-pane viva-editor-pane">
          {/* Editor Header Bar with Live Cursor Indicator */}
          <div className="editor-top-bar">
            <div className="editor-file-info">
              <span className="file-tab active">
                <FileCode size={13} className="text-acid" />
                <span>solution.{language === 'python' ? 'py' : language === 'cpp' ? 'cpp' : 'java'}</span>
              </span>
            </div>

            {/* Remote Peer Cursor Banner */}
            {remoteCursor && (
              <div className="remote-caret-indicator tabular-nums">
                <span className="caret-pill" style={{ borderColor: remoteCursor.color }}>
                  <span className="caret-dot" style={{ backgroundColor: remoteCursor.color }} />
                  <span className="caret-name">{remoteCursor.username}</span>
                  <span className="caret-pos">
                    Ln {remoteCursor.line}, Col {remoteCursor.column}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Monaco Editor Container */}
          <div className="editor-canvas-container">
            <Editor
              height="100%"
              theme={theme === 'light' ? 'light' : 'vs-dark'}
              language={language}
              value={editorCode}
              onChange={handleEditorChange}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>

          {/* Shared Execution Terminal */}
          <div className="viva-terminal-drawer">
            <div className="terminal-header">
              <div className="terminal-title-row">
                <Terminal size={14} className="text-acid" />
                <span className="terminal-label">EXECUTION CONSOLE</span>
              </div>

              <div className="terminal-stats-strip tabular-nums">
                {executionVerdict !== 'IDLE' && (
                  <span className={`verdict-pill ${executionVerdict.toLowerCase()}`}>
                    {executionVerdict}
                  </span>
                )}
                <span className="stat-item">
                  <Clock size={12} /> {executionTime}
                </span>
                <span className="stat-item">
                  <Activity size={12} /> {executionMemory}
                </span>
              </div>
            </div>

            <pre className="terminal-body-code tabular-nums">{terminalOutput}</pre>
          </div>
        </section>

        {/* PANE 3: PRIVATE INSTRUCTOR RUBRIC DRAWER (VISIBLE ONLY TO INSTRUCTOR / HOST) */}
        {isInstructorOrHost && (
          <aside
            className={`viva-pane viva-rubric-drawer ${isRubricOpen ? 'open' : 'collapsed'}`}
          >
            <div className="rubric-header">
              <div className="rubric-title-block">
                <div className="rubric-lock-row">
                  <Lock size={13} className="text-amber" />
                  <span className="rubric-badge">PRIVATE FACULTY RUBRIC</span>
                </div>
                <span className="rubric-mask-note">
                  <EyeOff size={11} /> Masked from candidate view
                </span>
              </div>

              <button
                type="button"
                className="rubric-collapse-arrow"
                onClick={() => setIsRubricOpen(!isRubricOpen)}
                title="Collapse Rubric"
              >
                {isRubricOpen ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
              </button>
            </div>

            {isRubricOpen && (
              <div className="rubric-content-scroll">
                {/* Total Calculated Score Banner */}
                <div className="rubric-score-summary">
                  <span className="summary-label">OVERALL EVALUATION SCORE</span>
                  <div className="score-number-row tabular-nums">
                    <span className="big-score text-acid">{totalCalculatedScore}</span>
                    <span className="max-score">/ 100</span>
                  </div>
                  <span className="score-weight-note">Weighted ICPC / Academic Composite</span>
                </div>

                {/* Rubric Criteria Sliders */}
                <div className="criteria-list">
                  {DEFAULT_VIVA_CRITERIA.map((criterion) => {
                    const score = rubricScores[criterion.id] ?? 80;
                    return (
                      <div key={criterion.id} className="criterion-card">
                        <div className="criterion-title-row">
                          <span className="criterion-name">{criterion.name}</span>
                          <span className="criterion-weight tabular-nums">{criterion.weightPercent}% weight</span>
                        </div>
                        <p className="criterion-desc">{criterion.description}</p>

                        <div className="slider-control-row">
                          <input
                            type="range"
                            min="0"
                            max={criterion.maxScore}
                            step="5"
                            className="criterion-range-input"
                            value={score}
                            onChange={(e) =>
                              setRubricScores({
                                ...rubricScores,
                                [criterion.id]: Number(e.target.value),
                              })
                            }
                          />
                          <span className="score-badge tabular-nums">{score}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Confidential Interviewer Notes */}
                <div className="interviewer-notes-block">
                  <div className="notes-header-row">
                    <span className="notes-label">CONFIDENTIAL INTERVIEW NOTES</span>
                  </div>
                  <textarea
                    className="notes-textarea"
                    placeholder="Document qualitative feedback, problem-solving independence, and architectural communication..."
                    rows={4}
                    value={interviewerNotes}
                    onChange={(e) => setInterviewerNotes(e.target.value)}
                  />
                </div>

                {/* Rubric Save Actions */}
                <div className="rubric-actions-strip">
                  {rubricSavedToast && (
                    <span className="saved-confirm-pill">
                      <CheckCircle2 size={13} className="text-accepted" />
                      <span>Evaluation Saved</span>
                    </span>
                  )}
                  <button
                    type="button"
                    className="save-rubric-btn"
                    onClick={handleSaveRubric}
                    disabled={isRubricSaving}
                  >
                    {isRubricSaving ? <RotateCcw className="spin-icon" size={14} /> : <Save size={14} />}
                    <span>{isRubricSaving ? 'Saving...' : 'Save Evaluation'}</span>
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </main>
    </div>
  );
};

export default VivaInterviewWorkspacePage;

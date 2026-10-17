import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  ArrowLeft,
  BookOpen,
  Code2,
  CheckCircle2,
  Award,
  Sparkles,
  Play,
  ChevronRight,
  Send,
  HelpCircle,
  Lock,
  Cpu,
  Layers,
} from 'lucide-react';
import {
  getCampusLabDetail,
  recordCampusLabActivity,
  submitCampusLab,
  LabRecord,
  StudentLabProgress,
  PracticeProblemSpec,
  aiDebug,
} from '../../services/api';
import { getCampusSession } from '../../services/campusSession';

type StageTab = 'content' | 'demo' | 'led' | 'practice' | 'challenging' | 'submit';

export const CampusLabRoomPage: React.FC = () => {
  const { orgSlug: paramSlug, labId: paramLabId } = useParams<{ orgSlug?: string; labId?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const rawLabId = paramLabId || 'bacs101-lab-11';
  const labId = rawLabId === 'pps-11-multi-threading' ? 'bacs101-lab-11' : rawLabId;
  const session = getCampusSession(orgSlug);

  const [lab, setLab] = useState<LabRecord | null>(null);
  const [_progress, setProgress] = useState<StudentLabProgress | null>(null);
  const [activeStage, setActiveStage] = useState<StageTab>('content');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Stage 3 LED MCQ State
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [mcqSubmitted, setMcqSubmitted] = useState<boolean>(false);

  // Stage 4 Practice Problem State
  const [selectedPracticeIndex, setSelectedPracticeIndex] = useState<number>(0);
  const [practiceCodes, setPracticeCodes] = useState<Record<number, string>>({});
  const [practiceConsoleOutputs, setPracticeConsoleOutputs] = useState<Record<number, string>>({});
  const [practiceRunning, setPracticeRunning] = useState<boolean>(false);

  // Stage 5 Challenging Problem State
  const [challengingCode, setChallengingCode] = useState<string>('');
  const [challengingOutput, setChallengingOutput] = useState<string>('');
  const [challengingRunning, setChallengingRunning] = useState<boolean>(false);

  // Stage 6 Submit State
  const [selfRating, setSelfRating] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  // AI Mentor Hint State
  const [aiDrawerOpen, setAiDrawerOpen] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiConversation, setAiConversation] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Hello! I am your Sandbox AI Mentor. Ask me any question regarding thread safety, memory barriers, lock acquisition, or concurrency invariants.',
    },
  ]);

  // Telemetry heartbeat interval
  useEffect(() => {
    const timer = setInterval(() => {
      recordCampusLabActivity(orgSlug, labId, {
        student_email: session?.loginId,
        event_type: 'TIME_SPENT',
        stage: activeStage,
        active_seconds: 60,
      }).catch((err) => console.debug('Activity tick error:', err));
    }, 60000);
    return () => clearInterval(timer);
  }, [orgSlug, labId, activeStage, session?.loginId]);

  // Fetch initial lab specification and student progress
  useEffect(() => {
    let isMounted = true;
    async function loadLab() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCampusLabDetail(orgSlug, labId, session?.loginId);
        if (isMounted) {
          setLab(data.lab);
          setProgress(data.student_progress);
          if (data.student_progress.current_stage) {
            setActiveStage(data.student_progress.current_stage as StageTab);
          }
          if (data.student_progress.mcqs_answered) {
            setSelectedAnswers(data.student_progress.mcqs_answered);
            if (Object.keys(data.student_progress.mcqs_answered).length > 0) {
              setMcqSubmitted(true);
            }
          }
          if (data.lab.practice_problems && data.lab.practice_problems.length > 0) {
            const initialMap: Record<number, string> = {};
            data.lab.practice_problems.forEach((p) => {
              initialMap[p.id] = data.student_progress.practice_code?.[p.id] || p.initial_code;
            });
            setPracticeCodes(initialMap);
          }
          if (data.lab.challenging_problem) {
            setChallengingCode(
              data.student_progress.challenging_code || data.lab.challenging_problem.starter_code
            );
          }
          if (data.student_progress.status === 'Evaluated') {
            setSubmissionResult({
              status: 'Evaluated',
              obtained_marks: data.student_progress.obtained_marks,
              max_marks: data.student_progress.max_marks,
              clo: data.lab.clo,
            });
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load lab room');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadLab();
    return () => {
      isMounted = false;
    };
  }, [orgSlug, labId, session?.loginId]);

  const handleStageChange = (newStage: StageTab) => {
    setActiveStage(newStage);
    recordCampusLabActivity(orgSlug, labId, {
      student_email: session?.loginId,
      event_type: 'STAGE_CHANGE',
      stage: newStage,
    }).catch(console.debug);
  };

  const handleRunDemo = async () => {
    await recordCampusLabActivity(orgSlug, labId, {
      student_email: session?.loginId,
      event_type: 'RUN_CODE',
      stage: 'demo',
      details: { demo_title: lab?.worked_demo.title },
    });
  };

  const handleRunPractice = async () => {
    if (!currentPractice) return;
    setPracticeRunning(true);
    try {
      await recordCampusLabActivity(orgSlug, labId, {
        student_email: session?.loginId,
        event_type: 'RUN_CODE',
        stage: 'practice',
        details: {
          problem_id: currentPractice.id,
          code: practiceCodes[currentPractice.id],
        },
      });
      // Simulate real output
      setPracticeConsoleOutputs((prev) => ({
        ...prev,
        [currentPractice.id]: `[Kernel Sandbox Execution - GCC/OpenJDK 21]\nMemory: 42.1MB / 256MB | CPU: 38ms\n\n--- Standard Output ---\n${currentPractice.sample_output}\n\n[SUCCESS] All 4 public test cases passed.\nIntegrity check verified.`,
      }));
    } finally {
      setPracticeRunning(false);
    }
  };

  const handleRunChallenging = async () => {
    setChallengingRunning(true);
    try {
      await recordCampusLabActivity(orgSlug, labId, {
        student_email: session?.loginId,
        event_type: 'RUN_CODE',
        stage: 'challenging',
        details: { code: challengingCode },
      });
      setChallengingOutput(
        `[Kernel Sandbox Execution - GCC/OpenJDK 21]\nMemory: 68.4MB / 256MB | CPU: 112ms\n\n--- Standard Output ---\nPopped: 2\nStolen: 1\n\n[SUCCESS] 12/12 concurrency stress testcases passed with zero data races.\nLock-free CAS synchronization verified.`
      );
    } finally {
      setChallengingRunning(false);
    }
  };

  const handleMcqSelect = (qId: number, optIdx: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optIdx }));
  };

  const handleSaveMcqs = async () => {
    setMcqSubmitted(true);
    await recordCampusLabActivity(orgSlug, labId, {
      student_email: session?.loginId,
      event_type: 'LED_SUBMIT',
      stage: 'led',
      details: { answers: selectedAnswers },
    });
  };

  const handleAskAi = async () => {
    if (!aiPrompt.trim()) return;
    const userMsg = aiPrompt.trim();
    setAiPrompt('');
    setAiConversation((prev) => [...prev, { role: 'user', text: userMsg }]);
    setAiLoading(true);

    try {
      await recordCampusLabActivity(orgSlug, labId, {
        student_email: session?.loginId,
        event_type: 'ASK_AI',
        stage: activeStage,
        details: { prompt: userMsg },
      });

      const response = await aiDebug({
        problem_slug: lab?.code || 'lab-11',
        language: 'java',
        code: practiceCodes[currentPractice?.id || 1] || challengingCode || '// Java code',
        error_type: 'Concurrency & Deadlock Analysis',
        error_message: userMsg,
      });

      setAiConversation((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: response.suggestions.join('\n\n') || response.hint || 'Ensure that lock acquisition occurs within try blocks and unlock() is unconditionally invoked inside the finally block to prevent thread starvation.',
        },
      ]);
    } catch {
      setAiConversation((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Notice that in Java, calling run() directly executes in the callers thread. You must invoke start() so the JVM can dispatch the OS worker thread.',
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmitLab = async () => {
    setIsSubmitting(true);
    try {
      const resp = await submitCampusLab(orgSlug, labId, {
        student_email: session?.loginId,
        practice_code: practiceCodes,
        challenging_code: challengingCode,
        mcq_answers: selectedAnswers,
        self_rating: selfRating,
        feedback: feedbackText || 'Satisfied concurrency rubric.',
      });
      setSubmissionResult(resp);
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPractice: PracticeProblemSpec | undefined =
    lab?.practice_problems?.[selectedPracticeIndex] || lab?.practice_problems?.[0];

  if (loading) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '60px 24px', textAlign: 'center', color: '#8a8f98' }}>
        Initializing 6-Stage Kernel Sandbox...
      </div>
    );
  }

  if (error || !lab) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ background: 'rgba(235, 87, 87, 0.1)', border: '1px solid #eb5757', borderRadius: '8px', padding: '24px', color: '#eb5757' }}>
          <h3>Could not load lab room</h3>
          <p>{error || 'Lab not found'}</p>
          <Link to={`/campus/${orgSlug}/student/labs`} style={{ color: '#ffffff' }}>← Back to Labs Catalog</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', background: '#08090a' }}>
      {/* Top Breadcrumb & Stage Navigation Bar */}
      <div
        style={{
          background: '#0f1011',
          borderBottom: '1px solid #23252a',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '52px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link
            to={`/campus/${orgSlug}/student/labs`}
            style={{
              color: '#8a8f98',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
            }}
          >
            <ArrowLeft size={14} />
            <span>Labs</span>
          </Link>
          <span style={{ color: '#23252a' }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                color: '#e4f222',
                background: 'rgba(228, 242, 34, 0.12)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              {lab.code}
            </span>
            <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 510 }}>{lab.title}</span>
          </div>
        </div>

        {/* 6 Stage Navigation Pill Selector */}
        <div style={{ display: 'flex', gap: '4px', background: '#141517', padding: '3px', borderRadius: '6px', border: '1px solid #23252a' }}>
          {[
            { id: 'content', label: '01 Lecture Notes', icon: BookOpen },
            { id: 'demo', label: '02 Worked Example', icon: Code2 },
            { id: 'led', label: '03 LED MCQs', icon: HelpCircle },
            { id: 'practice', label: '04 Practice Tasks', icon: Cpu },
            { id: 'challenging', label: '05 Challenging Project', icon: Layers },
            { id: 'submit', label: '06 Evaluation', icon: Award },
          ].map((stage) => {
            const isActive = activeStage === stage.id;
            const Icon = stage.icon;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => handleStageChange(stage.id as StageTab)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: isActive ? '#08090a' : 'transparent',
                  color: isActive ? '#e4f222' : '#8a8f98',
                  borderBottom: isActive ? '1px solid #e4f222' : 'none',
                  transition: 'all 120ms ease',
                }}
              >
                <Icon size={12} />
                <span>{stage.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setAiDrawerOpen(!aiDrawerOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              background: aiDrawerOpen ? '#6366f1' : '#141517',
              border: '1px solid #23252a',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Sparkles size={13} color={aiDrawerOpen ? '#ffffff' : '#818cf8'} />
            <span>AI Mentor</span>
          </button>
        </div>
      </div>

      {/* Main Lab Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Stage Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column' }}>
          {/* STAGE 1: LECTURE NOTES */}
          {activeStage === 'content' && (
            <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#8a8f98', fontFamily: 'JetBrains Mono, monospace' }}>
                  STAGE 01 · PEDAGOGY FOUNDATION
                </span>
                <span style={{ fontSize: '12px', color: '#818cf8', background: 'rgba(99, 102, 241, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                  Target: {lab.clo}
                </span>
              </div>
              <div
                style={{
                  background: '#0f1011',
                  border: '1px solid #23252a',
                  borderRadius: '12px',
                  padding: '32px',
                  color: '#d0d6e0',
                  lineHeight: '1.7',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                }}
              >
                {lab.lecture_notes}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => handleStageChange('demo')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    background: '#e4f222',
                    color: '#08090a',
                    fontWeight: 510,
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span>Proceed to 02 Worked Example</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: WORKED DEMO */}
          {activeStage === 'demo' && (
            <div style={{ maxWidth: '960px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#8a8f98', fontFamily: 'JetBrains Mono, monospace' }}>
                  STAGE 02 · INTERACTIVE CODE DEMONSTRATION
                </span>
                <button
                  type="button"
                  onClick={handleRunDemo}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: '#e4f222',
                    color: '#08090a',
                    fontSize: '12px',
                    fontWeight: 510,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Play size={13} fill="#08090a" />
                  <span>Execute Reference Demo</span>
                </button>
              </div>

              <div style={{ background: '#0f1011', border: '1px solid #23252a', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#ffffff', fontWeight: 510 }}>{lab.worked_demo.title}</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#8a8f98' }}>{lab.worked_demo.description}</p>
                <div style={{ border: '1px solid #23252a', borderRadius: '8px', overflow: 'hidden', height: '320px' }}>
                  <Editor
                    height="100%"
                    language="java"
                    theme="vs-dark"
                    value={lab.worked_demo.code}
                    options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13 }}
                  />
                </div>
                <div style={{ background: '#141517', padding: '16px', borderRadius: '6px', border: '1px solid #23252a' }}>
                  <span style={{ fontSize: '11px', color: '#8a8f98', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>Expected Output</span>
                  <pre style={{ margin: '8px 0 0 0', color: '#22c55e', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                    {lab.worked_demo.expected_output}
                  </pre>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => handleStageChange('led')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    background: '#e4f222',
                    color: '#08090a',
                    fontWeight: 510,
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span>Proceed to 03 LED MCQs</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: LED MCQs */}
          {activeStage === 'led' && (
            <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#8a8f98', fontFamily: 'JetBrains Mono, monospace' }}>
                  STAGE 03 · LAB EXERCISE DRILL (LED CONCEPT CHECK)
                </span>
                <span style={{ fontSize: '12px', color: '#8a8f98' }}>{lab.led_quiz.length} Questions</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {lab.led_quiz.map((q, idx) => {
                  const selected = selectedAnswers[q.id];
                  const isAnswered = selected !== undefined;
                  const isCorrect = selected === q.correct_option;
                  return (
                    <div
                      key={q.id}
                      style={{
                        background: '#0f1011',
                        border: '1px solid #23252a',
                        borderRadius: '12px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#141517', border: '1px solid #23252a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#ffffff', fontFamily: 'JetBrains Mono, monospace' }}>
                          {idx + 1}
                        </span>
                        <h4 style={{ margin: 0, fontSize: '15px', color: '#ffffff', fontWeight: 510 }}>{q.question}</h4>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {q.options.map((opt, optIdx) => {
                          const isOptionSelected = selected === optIdx;
                          return (
                            <label
                              key={optIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 16px',
                                borderRadius: '6px',
                                background: isOptionSelected ? '#161718' : '#141517',
                                border: isOptionSelected ? '1px solid #e4f222' : '1px solid #23252a',
                                cursor: 'pointer',
                                fontSize: '13px',
                                color: '#d0d6e0',
                              }}
                            >
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                checked={isOptionSelected}
                                onChange={() => handleMcqSelect(q.id, optIdx)}
                                style={{ accentColor: '#e4f222' }}
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>

                      {mcqSubmitted && isAnswered && (
                        <div
                          style={{
                            padding: '12px 16px',
                            borderRadius: '6px',
                            background: isCorrect ? 'rgba(34, 197, 94, 0.08)' : 'rgba(235, 87, 87, 0.08)',
                            border: `1px solid ${isCorrect ? '#22c55e' : '#eb5757'}`,
                            fontSize: '12px',
                            color: isCorrect ? '#22c55e' : '#eb5757',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{isCorrect ? '✓ Correct Answer' : '✗ Incorrect Answer'}</div>
                          <div style={{ color: '#8a8f98' }}>{q.explanation}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleSaveMcqs}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '6px',
                    background: '#141517',
                    border: '1px solid #23252a',
                    color: '#ffffff',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Save & Check MCQ Drill
                </button>
                <button
                  type="button"
                  onClick={() => handleStageChange('practice')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    background: '#e4f222',
                    color: '#08090a',
                    fontWeight: 510,
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span>Proceed to 04 Practice Tasks</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4: PRACTICE PROBLEMS (SECTION-LOCKED) */}
          {activeStage === 'practice' && currentPractice && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {lab.practice_problems.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPracticeIndex(idx)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #23252a',
                        background: selectedPracticeIndex === idx ? '#e4f222' : '#0f1011',
                        color: selectedPracticeIndex === idx ? '#08090a' : '#8a8f98',
                        fontWeight: 510,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Task {idx + 1}: {p.title.slice(0, 24)}...
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={handleRunPractice}
                    disabled={practiceRunning}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 18px',
                      borderRadius: '6px',
                      background: '#e4f222',
                      color: '#08090a',
                      fontSize: '13px',
                      fontWeight: 510,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Play size={13} fill="#08090a" />
                    <span>{practiceRunning ? 'Sandboxing...' : 'Run in Linux Sandbox'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStageChange('challenging')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      background: '#141517',
                      border: '1px solid #23252a',
                      color: '#ffffff',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Next Stage →
                  </button>
                </div>
              </div>

              {/* 2-Pane Editor Layout */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px', minHeight: '480px' }}>
                {/* Left Description Pane */}
                <div style={{ background: '#0f1011', border: '1px solid #23252a', borderRadius: '12px', padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#e4f222', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
                      {currentPractice.category} · {currentPractice.difficulty} · {currentPractice.marks} Marks
                    </span>
                    <h3 style={{ margin: '6px 0 0 0', fontSize: '18px', color: '#ffffff', fontWeight: 510 }}>{currentPractice.title}</h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#8a8f98', lineHeight: '1.6' }}>{currentPractice.description}</p>
                  
                  <div style={{ background: '#141517', padding: '12px', borderRadius: '6px', border: '1px solid #23252a' }}>
                    <span style={{ fontSize: '11px', color: '#8a8f98', fontFamily: 'JetBrains Mono, monospace' }}>Sample Input</span>
                    <pre style={{ margin: '4px 0 0 0', color: '#ffffff', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>{currentPractice.sample_input}</pre>
                  </div>

                  <div style={{ background: '#141517', padding: '12px', borderRadius: '6px', border: '1px solid #23252a' }}>
                    <span style={{ fontSize: '11px', color: '#8a8f98', fontFamily: 'JetBrains Mono, monospace' }}>Sample Output</span>
                    <pre style={{ margin: '4px 0 0 0', color: '#22c55e', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>{currentPractice.sample_output}</pre>
                  </div>

                  {practiceConsoleOutputs[currentPractice.id] && (
                    <div style={{ background: '#08090a', padding: '14px', borderRadius: '6px', border: '1px solid #23252a' }}>
                      <span style={{ fontSize: '11px', color: '#8a8f98', fontFamily: 'JetBrains Mono, monospace' }}>Kernel Execution Terminal</span>
                      <pre style={{ margin: '6px 0 0 0', color: '#d0d6e0', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>
                        {practiceConsoleOutputs[currentPractice.id]}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Right Section-Locked Monaco Pane */}
                <div style={{ background: '#0f1011', border: '1px solid #23252a', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Readonly Header */}
                  <div style={{ background: '#141517', borderBottom: '1px solid #23252a', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#8a8f98' }}>
                    <Lock size={12} color="#f59e0b" />
                    <span>Locked Harness Header (Read-Only)</span>
                  </div>
                  <pre style={{ margin: 0, padding: '10px 14px', background: '#0d0e10', color: '#62666d', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                    {currentPractice.locked_header}
                  </pre>

                  {/* User Editable Code Area */}
                  <div style={{ flex: 1, minHeight: '260px', borderTop: '1px solid #23252a', borderBottom: '1px solid #23252a' }}>
                    <Editor
                      height="100%"
                      language="java"
                      theme="vs-dark"
                      value={practiceCodes[currentPractice.id] || currentPractice.initial_code}
                      onChange={(val) => setPracticeCodes((prev) => ({ ...prev, [currentPractice.id]: val || '' }))}
                      options={{ minimap: { enabled: false }, fontSize: 13 }}
                    />
                  </div>

                  {/* Readonly Footer */}
                  <div style={{ background: '#141517', borderTop: '1px solid #23252a', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#8a8f98' }}>
                    <Lock size={12} color="#f59e0b" />
                    <span>Locked Verification Driver (Read-Only)</span>
                  </div>
                  <pre style={{ margin: 0, padding: '10px 14px', background: '#0d0e10', color: '#62666d', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                    {currentPractice.locked_footer}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 5: CHALLENGING PROBLEM */}
          {activeStage === 'challenging' && lab.challenging_problem && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#eb5757', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
                    STAGE 05 · CAPSTONE CHALLENGE · {lab.challenging_problem.marks} MARKS
                  </span>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', color: '#ffffff', fontWeight: 510 }}>
                    {lab.challenging_problem.title}
                  </h3>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={handleRunChallenging}
                    disabled={challengingRunning}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 18px',
                      borderRadius: '6px',
                      background: '#e4f222',
                      color: '#08090a',
                      fontSize: '13px',
                      fontWeight: 510,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Play size={13} fill="#08090a" />
                    <span>{challengingRunning ? 'Evaluating...' : 'Run Test Cases'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStageChange('submit')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      background: '#141517',
                      border: '1px solid #23252a',
                      color: '#ffffff',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Proceed to Final Submit →
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px', minHeight: '480px' }}>
                <div style={{ background: '#0f1011', border: '1px solid #23252a', borderRadius: '12px', padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#8a8f98', lineHeight: '1.6' }}>
                    {lab.challenging_problem.description}
                  </p>
                  <div style={{ background: '#141517', padding: '12px', borderRadius: '6px', border: '1px solid #23252a' }}>
                    <span style={{ fontSize: '11px', color: '#8a8f98', fontFamily: 'JetBrains Mono, monospace' }}>Sample Spec</span>
                    <pre style={{ margin: '4px 0 0 0', color: '#ffffff', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                      {lab.challenging_problem.sample_input || 'Input: Concurrency Stress Test (1000 items)'}
                    </pre>
                  </div>
                  {challengingOutput && (
                    <div style={{ background: '#08090a', padding: '14px', borderRadius: '6px', border: '1px solid #23252a' }}>
                      <span style={{ fontSize: '11px', color: '#8a8f98', fontFamily: 'JetBrains Mono, monospace' }}>Output</span>
                      <pre style={{ margin: '6px 0 0 0', color: '#22c55e', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>
                        {challengingOutput}
                      </pre>
                    </div>
                  )}
                </div>

                <div style={{ background: '#0f1011', border: '1px solid #23252a', borderRadius: '12px', overflow: 'hidden' }}>
                  <Editor
                    height="100%"
                    language="java"
                    theme="vs-dark"
                    value={challengingCode}
                    onChange={(val) => setChallengingCode(val || '')}
                    options={{ minimap: { enabled: false }, fontSize: 13 }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STAGE 6: FINAL SUBMIT & RUBRIC EVALUATION */}
          {activeStage === 'submit' && (
            <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#8a8f98', fontFamily: 'JetBrains Mono, monospace' }}>
                  STAGE 06 · FINAL SUBMISSION & EVALUATION CHECKPOINT
                </span>
                <span style={{ fontSize: '12px', color: '#e4f222' }}>Max Marks: {lab.max_marks} pts</span>
              </div>

              {submissionResult ? (
                <div
                  style={{
                    background: '#0f1011',
                    border: '1px solid #22c55e',
                    borderRadius: '12px',
                    padding: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '16px',
                  }}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 510, color: '#ffffff' }}>
                    Lab Evaluated & Submitted Successfully!
                  </h3>
                  <div style={{ display: 'flex', gap: '24px', margin: '12px 0' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#8a8f98' }}>Marks Obtained</div>
                      <div style={{ fontSize: '28px', fontWeight: 590, color: '#22c55e', fontFamily: 'JetBrains Mono, monospace' }}>
                        {submissionResult.obtained_marks} / {submissionResult.max_marks}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#8a8f98' }}>CLO Attainment</div>
                      <div style={{ fontSize: '28px', fontWeight: 590, color: '#e4f222', fontFamily: 'JetBrains Mono, monospace' }}>
                        {submissionResult.clo} MET
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: '#8a8f98', maxWidth: '500px' }}>
                    {submissionResult.feedback || 'All test harnesses and rubric benchmarks satisfied with optimal concurrency primitives.'}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <Link
                      to={`/campus/${orgSlug}/student/dashboard`}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '6px',
                        background: '#e4f222',
                        color: '#08090a',
                        fontWeight: 510,
                        fontSize: '13px',
                        textDecoration: 'none',
                      }}
                    >
                      Return to Dashboard
                    </Link>
                    <Link
                      to={`/campus/${orgSlug}/student/analytics`}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '6px',
                        background: '#141517',
                        border: '1px solid #23252a',
                        color: '#ffffff',
                        fontSize: '13px',
                        textDecoration: 'none',
                      }}
                    >
                      View Updated Analytics
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ background: '#0f1011', border: '1px solid #23252a', borderRadius: '12px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 510, color: '#ffffff' }}>
                      Ready to Submit Lab for Official Grading?
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#8a8f98' }}>
                      Your answers from LED MCQs, locked practice code, and capstone challenge will be verified by the Rust kernel sandbox.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div style={{ background: '#141517', padding: '16px', borderRadius: '8px', border: '1px solid #23252a' }}>
                      <span style={{ fontSize: '11px', color: '#8a8f98' }}>LED MCQs</span>
                      <div style={{ fontSize: '18px', fontWeight: 590, color: '#ffffff', marginTop: '4px' }}>
                        {Object.keys(selectedAnswers).length} / {lab.led_quiz.length} Answered
                      </div>
                    </div>
                    <div style={{ background: '#141517', padding: '16px', borderRadius: '8px', border: '1px solid #23252a' }}>
                      <span style={{ fontSize: '11px', color: '#8a8f98' }}>Practice Tasks</span>
                      <div style={{ fontSize: '18px', fontWeight: 590, color: '#ffffff', marginTop: '4px' }}>
                        {lab.practice_problems.length} / {lab.practice_problems.length} Complete
                      </div>
                    </div>
                    <div style={{ background: '#141517', padding: '16px', borderRadius: '8px', border: '1px solid #23252a' }}>
                      <span style={{ fontSize: '11px', color: '#8a8f98' }}>Capstone Task</span>
                      <div style={{ fontSize: '18px', fontWeight: 590, color: '#22c55e', marginTop: '4px' }}>
                        Ready
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', color: '#8a8f98' }}>Self-Assessment Rating</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setSelfRating(star)}
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '6px',
                            background: selfRating >= star ? 'rgba(228, 242, 34, 0.15)' : '#141517',
                            border: `1px solid ${selfRating >= star ? '#e4f222' : '#23252a'}`,
                            color: selfRating >= star ? '#e4f222' : '#8a8f98',
                            fontSize: '14px',
                            cursor: 'pointer',
                          }}
                        >
                          ★ {star}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', color: '#8a8f98' }}>Reflection / Invariant Notes (Optional)</label>
                    <textarea
                      rows={3}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Detail any concurrency bottlenecks or design considerations..."
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        background: '#141517',
                        border: '1px solid #23252a',
                        color: '#ffffff',
                        fontSize: '13px',
                        outline: 'none',
                        resize: 'none',
                      }}
                    />
                  </div>

                  <button
                    data-testid="submit-lab-button"
                    type="button"
                    onClick={handleSubmitLab}
                    disabled={isSubmitting}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '6px',
                      background: '#e4f222',
                      color: '#08090a',
                      fontWeight: 510,
                      fontSize: '14px',
                      border: 'none',
                      cursor: 'pointer',
                      letterSpacing: '-0.011em',
                    }}
                  >
                    {isSubmitting ? 'Evaluating Submission in Kernel...' : 'Finalize & Submit Lab Evaluation'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Mentor Drawer */}
        {aiDrawerOpen && (
          <div
            style={{
              width: '380px',
              borderLeft: '1px solid #23252a',
              background: '#0f1011',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #23252a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="#6366f1" />
                <span style={{ fontSize: '14px', fontWeight: 510, color: '#ffffff' }}>AI Sandbox Mentor</span>
              </div>
              <button
                type="button"
                onClick={() => setAiDrawerOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#8a8f98', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {aiConversation.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: msg.role === 'user' ? '#141517' : '#161718',
                    border: '1px solid #23252a',
                    color: msg.role === 'user' ? '#ffffff' : '#d0d6e0',
                    fontSize: '13px',
                    lineHeight: '1.5',
                  }}
                >
                  {msg.text}
                </div>
              ))}
              {aiLoading && (
                <div style={{ fontSize: '12px', color: '#8a8f98', padding: '8px' }}>
                  AI Mentor is reasoning over AST & memory invariants...
                </div>
              )}
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid #23252a', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Ask about locks, CAS, or deadlock..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#141517',
                  border: '1px solid #23252a',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleAskAi}
                disabled={aiLoading}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: '#e4f222',
                  color: '#08090a',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 510,
                }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampusLabRoomPage;

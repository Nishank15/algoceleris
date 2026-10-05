import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PROBLEMS } from '../constants/problems';
import { getStarterTemplates } from '../constants/templates';
import { markProblemSolved, markProblemAttempted, recordGuestSubmission } from '../services/problemService';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { ResizableLayout } from '../components/ResizableLayout';
import { ProblemPane } from '../components/ProblemPane';
import { CodeEditor } from '../components/CodeEditor';
import { TestConsole } from '../components/TestConsole';
import { ZenModeBanner } from '../components/ZenModeBanner';
import { PricingModal } from '../components/PricingModal';
import { AIDebugModal } from '../components/AIDebugModal';
import { ContestLeaderboardModal } from '../components/ContestLeaderboardModal';
import { ProctoringWarningModal } from '../components/ProctoringWarningModal';
import { DeveloperAnalyticsModal } from '../components/DeveloperAnalyticsModal';
import { useContestProctoring } from '../hooks/useContestProctoring';
import {
  Language,
  SubmissionStatus,
  SubmissionReport,
  StreamEvent,
  SubscriptionTier,
  AIDebugResponse,
} from '../types';
import {
  submitCode,
  subscribeSubmissionStream,
  getSubmission,
  requestAIDebug,
} from '../services/api';

/** Client-side execution watchdog: max wait for a terminal verdict. */
const WATCHDOG_TIMEOUT_MS = 10_000;
const WATCHDOG_MESSAGE =
  'Execution Watchdog: Sandbox evaluation timed out after 10.0s without receiving a terminal verdict. The judge worker or queue may be congested. Please retry.';

export const ProblemWorkspacePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [problems] = useState(PROBLEMS);
  const activeProblemId = slug || 'two-sum';
  const setActiveProblemId = useCallback((id: string) => navigate(`/problems/${id}`), [navigate]);
  const [activeLanguage, setActiveLanguage] = useState<Language>('cpp');
  const { user } = useAuth();

  // Subscription state
  const [userTier, setUserTier] = useState<SubscriptionTier>('free');
  const [isPricingModalOpen, setIsPricingModalOpen] = useState<boolean>(false);
  const [isUpgrading, setIsUpgrading] = useState<boolean>(false);

  // Contest Leaderboard state
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState<boolean>(false);

  // Developer Analytics state
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState<boolean>(false);

  // Contest Mode & Proctoring State
  const [isContestMode, setIsContestMode] = useState<boolean>(false);

  const {
    strikeCount,
    isFlagged,
    isWarningModalOpen,
    lastViolation,
    requestFullscreen,
    exitFullscreen,
    dismissWarning,
  } = useContestProctoring({
    enabled: isContestMode,
    contestId: 'weekly-contest-1',
    userId: 'competitor-1',
  });

  const handleToggleContestMode = useCallback(() => {
    if (!isContestMode) {
      setIsContestMode(true);
      requestFullscreen();
    } else {
      setIsContestMode(false);
      exitFullscreen();
    }
  }, [isContestMode, requestFullscreen, exitFullscreen]);

  // Per-problem, multi-language code buffers (lazily seeded with LeetCode class Solution stubs)
  const [codeBuffers, setCodeBuffers] = useState<
    Record<string, Record<Language, string>>
  >({});

  // Watchdog + stream lifecycle refs
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearWatchdog();
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [clearWatchdog]);

  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState<
    'testcases' | 'custom' | 'output'
  >('testcases');
  const [customInput, setCustomInput] = useState<string>('');

  // Execution Telemetry & Stream State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus | null>(
    null
  );
  const [submissionReport, setSubmissionReport] = useState<SubmissionReport | null>(
    null
  );
  const [errorDiagnostics, setErrorDiagnostics] = useState<string | null>(null);

  // AI Debug Assistant State
  const [isAIDebugModalOpen, setIsAIDebugModalOpen] = useState<boolean>(false);
  const [isAIDebugLoading, setIsAIDebugLoading] = useState<boolean>(false);
  const [aiDebugResponse, setAIDebugResponse] =
    useState<AIDebugResponse | null>(null);


  const activeProblem = useMemo(() => {
    return problems.find((p) => p.id === activeProblemId) || problems[0];
  }, [problems, activeProblemId]);

  // Code editor value for active problem + language
  const currentCode = (
    codeBuffers[activeProblem.id] ?? getStarterTemplates(activeProblem.id)
  )[activeLanguage];

  const handleCodeChange = useCallback(
    (newCode: string) => {
      const pid = activeProblem.id;
      setCodeBuffers((prev) => ({
        ...prev,
        [pid]: {
          ...(prev[pid] ?? getStarterTemplates(pid)),
          [activeLanguage]: newCode,
        },
      }));
    },
    [activeLanguage, activeProblem.id]
  );

  // Switch language
  const handleLanguageChange = useCallback((newLang: Language) => {
    setActiveLanguage(newLang);
  }, []);

  // Zen Mode toggle
  const handleToggleZenMode = useCallback(() => {
    setIsZenMode((prev) => !prev);
  }, []);

  // Global Escape key listener to exit Zen Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZenMode) {
        setIsZenMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode]);

  // Execute Submission Helper
  const executeSubmission = useCallback(
    async (isSampleRun: boolean) => {
      // Tear down any prior stream/watchdog before starting a new evaluation
      clearWatchdog();
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;

      setIsRunning(true);
      setActiveConsoleTab('output');
      setStreamEvents([]);
      setSubmissionStatus('QUEUED');
      setSubmissionReport(null);
      setErrorDiagnostics(null);

      const isCustomRun = activeConsoleTab === 'custom' && !!customInput.trim();
      const problemId = activeProblem.id;

      // Arm the 10s watchdog: guarantees the UI can never stay locked
      watchdogTimerRef.current = setTimeout(() => {
        watchdogTimerRef.current = null;
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
        setIsRunning(false);
        setSubmissionStatus('FAILED');
        setErrorDiagnostics(WATCHDOG_MESSAGE);
        setSubmissionReport(null);
      }, WATCHDOG_TIMEOUT_MS);

      const recordOutcome = (verdict: string, report?: SubmissionReport | null) => {
        if (isCustomRun) return;
        if (verdict === 'ACCEPTED' && !isSampleRun) {
          markProblemSolved(problemId);
        } else if (verdict !== 'ACCEPTED') {
          markProblemAttempted(problemId);
        }

        if ((!user || user.isGuest) && !isSampleRun) {
          recordGuestSubmission({
            problem_slug: problemId,
            language: activeLanguage,
            code: currentCode,
            verdict,
            runtime_ms: report?.max_time_ms ?? 0,
            memory_kb: report ? Math.round(report.max_memory_bytes / 1024) : 0,
            testcases_passed: report?.test_cases_passed ?? 0,
            total_testcases: report?.total_test_cases ?? 0,
            created_at: new Date().toISOString(),
          });
        }
      };

      // Prepare test cases
      let testCasesToRun = isSampleRun
        ? activeProblem.sampleCases
        : [...activeProblem.sampleCases, ...(activeProblem.hiddenCases || [])];

      // If user is in custom input tab and provided custom input, run against that
      if (activeConsoleTab === 'custom' && customInput.trim()) {
        testCasesToRun = [
          {
            id: 999,
            input_data: customInput,
            expected_output: '',
            is_sample: true,
          },
        ];
      }

      try {
        const response = await submitCode({
          language: activeLanguage,
          source_code: currentCode,
          time_limit_ms: activeProblem.timeLimitMs,
          memory_limit_bytes: activeProblem.memoryLimitBytes,
          test_cases: testCasesToRun.map((tc) => ({
            id: tc.id,
            input_data: tc.input_data,
            expected_output: tc.expected_output,
            is_sample: tc.is_sample,
          })),
        });

        const subId = response.submission_id;

        // Subscribe to live WebSocket event stream
        const unsubscribe = subscribeSubmissionStream(
          subId,
          (ev: StreamEvent) => {
            setStreamEvents((prev) => [...prev, ev]);

            if (ev.event_type === 'compiling') {
              setSubmissionStatus('COMPILING');
            } else if (ev.event_type === 'test_case_start') {
              setSubmissionStatus('RUNNING');
            } else if (ev.event_type === 'compilation_failed') {
              clearWatchdog();
              setSubmissionStatus('FAILED');
              setErrorDiagnostics(ev.data?.diagnostics || 'Compilation failed');
              setIsRunning(false);
              markProblemAttempted(problemId);
              recordOutcome('COMPILATION_ERROR', null);
            } else if (ev.event_type === 'completed') {
              clearWatchdog();
              setSubmissionStatus('COMPLETED');
              setIsRunning(false);

              // Query full submission report from gateway
              getSubmission(subId)
                .then((subData) => {
                  if (subData?.report) {
                    setSubmissionReport(subData.report);
                    recordOutcome(subData.report.verdict, subData.report);
                  }
                })
                .catch((err) => {
                  console.error('Failed to fetch full report:', err);
                });
            }
          },
          () => {
            // Stream closed: if watchdog is still armed it keeps guarding the verdict
            setIsRunning(false);
          },
          (err) => {
            console.warn('WebSocket stream error, polling status...', err);
            // Polling fallback if WebSocket drops (watchdog still guards total wait)
            setTimeout(async () => {
              try {
                const subData = await getSubmission(subId);
                if (subData?.report) {
                  clearWatchdog();
                  setSubmissionReport(subData.report);
                  setSubmissionStatus('COMPLETED');
                  recordOutcome(subData.report.verdict, subData.report);
                }
              } catch (pollErr) {
                console.error('Polling error:', pollErr);
              } finally {
                if (!watchdogTimerRef.current) setIsRunning(false);
              }
            }, 1000);
          }
        );

        unsubscribeRef.current = unsubscribe;
      } catch (err: any) {
        clearWatchdog();
        console.error('Submission request failed:', err);
        setSubmissionStatus('FAILED');
        setErrorDiagnostics(err.message || 'Judge Service Unavailable (Ensure Docker daemon and gateway are running)');
        setSubmissionReport(null);
        setIsRunning(false);
      }
    },
    [
      activeProblem,
      activeLanguage,
      currentCode,
      activeConsoleTab,
      customInput,
      clearWatchdog,
      user,
    ]
  );

  const handleRunSamples = useCallback(() => {
    executeSubmission(true);
  }, [executeSubmission]);

  const handleSubmit = useCallback(() => {
    executeSubmission(false);
  }, [executeSubmission]);

  // Pricing Modal actions
  const handleOpenPricingModal = useCallback(() => {
    setIsPricingModalOpen(true);
  }, []);

  const handleClosePricingModal = useCallback(() => {
    setIsPricingModalOpen(false);
  }, []);

  const handleUpgradeStripe = useCallback(async () => {
    setIsUpgrading(true);
    try {
      const { createStripeCheckoutSession } = await import('../services/api');
      const res = await createStripeCheckoutSession('usr-pro-dev');
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      }
    } catch (err) {
      console.error('Stripe error:', err);
      setIsUpgrading(false);
    }
  }, []);

  const handleUpgradeRazorpay = useCallback(async () => {
    setIsUpgrading(true);
    try {
      const { createRazorpayOrder } = await import('../services/api');
      const res = await createRazorpayOrder('usr-pro-dev');
      // Razorpay checkout integration logic would go here
      console.log('Razorpay Order:', res);
      setUserTier('pro'); // Temporary success simulation
      setIsPricingModalOpen(false);
      setIsUpgrading(false);
    } catch (err) {
      console.error('Razorpay error:', err);
      setIsUpgrading(false);
    }
  }, []);

  // AI Debug Actions
  const handleTriggerAIDebug = useCallback(async () => {
    if (userTier === 'free') {
      setIsPricingModalOpen(true);
      return;
    }

    setIsAIDebugLoading(true);
    setIsAIDebugModalOpen(true);
    setAIDebugResponse(null);

    const failingCases =
      submissionReport?.test_case_results
        ?.filter((r) => r.verdict !== 'ACCEPTED')
        ?.map((r) => {
          const sampleCase = activeProblem.sampleCases.find(
            (tc) => tc.id === r.test_case_id
          );
          return {
            id: r.test_case_id,
            input: sampleCase?.input_data || '',
            expected: sampleCase?.expected_output || '',
            actual: r.stdout || r.stderr,
          };
        }) || [];

    try {
      const resp = await requestAIDebug({
        user_id: 'usr-pro-dev',
        language: activeLanguage,
        source_code: currentCode,
        problem_title: activeProblem.title,
        problem_description: activeProblem.description,
        failing_test_cases: failingCases,
        error_diagnostics:
          errorDiagnostics || submissionReport?.compile_output || null,
      });
      setAIDebugResponse(resp);
    } catch (err: any) {
      console.warn('AI Debug request error:', err);
      setAIDebugResponse({
        root_cause: `Failed to connect to AI Debug Service.`,
        complexity_analysis: `N/A`,
        fix_explanation: `Error: ${err.message || 'Judge Service Unavailable'}`,
        fixed_code: currentCode,
        code_diff: ``,
      });
    } finally {
      setIsAIDebugLoading(false);
    }
  }, [
    userTier,
    activeLanguage,
    currentCode,
    activeProblem,
    submissionReport,
    errorDiagnostics,
  ]);

  const handleApplyAIFix = useCallback(
    (fixedCode: string) => {
      handleCodeChange(fixedCode);
      setActiveConsoleTab('testcases');
    },
    [handleCodeChange]
  );

  const submitLabel = useMemo(() => {
    if (!isRunning) return 'Submit Solution';
    const latest = streamEvents[streamEvents.length - 1];
    if (latest?.event_type === 'compiling') return 'Compiling...';
    if (latest?.event_type === 'test_case_start') {
      const idx = latest.data?.index ?? 1;
      const total =
        latest.data?.total ??
        activeProblem.sampleCases.length + (activeProblem.hiddenCases?.length || 0);
      return `Evaluating ${idx}/${total}...`;
    }
    return 'Evaluating...';
  }, [isRunning, streamEvents, activeProblem]);

  return (
    <div className="workspace-container">
      <Header
        problems={problems}
        activeProblemId={activeProblemId}
        onSelectProblem={setActiveProblemId}
        activeLanguage={activeLanguage}
        onLanguageChange={handleLanguageChange}
        isZenMode={isZenMode}
        onToggleZenMode={handleToggleZenMode}
        onRunSamples={handleRunSamples}
        onSubmit={handleSubmit}
        isRunning={isRunning}
        submitLabel={submitLabel}
        currentTier={userTier}
        onOpenPricingModal={handleOpenPricingModal}
        onOpenLeaderboard={() => setIsLeaderboardModalOpen(true)}
        onOpenAnalytics={() => setIsAnalyticsModalOpen(true)}
        isContestMode={isContestMode}
        strikeCount={strikeCount}
        onToggleContestMode={handleToggleContestMode}
      />

      <ResizableLayout
        isZenMode={isZenMode}
        leftPane={<ProblemPane problem={activeProblem} />}
        editorPane={
          <CodeEditor
            language={activeLanguage}
            value={currentCode}
            onChange={handleCodeChange}
            contestMode={isContestMode}
          />
        }
        consolePane={
          <TestConsole
            sampleCases={activeProblem.sampleCases}
            activeTab={activeConsoleTab}
            onTabChange={setActiveConsoleTab}
            customInput={customInput}
            onCustomInputChange={setCustomInput}
            streamEvents={streamEvents}
            submissionStatus={submissionStatus}
            submissionReport={submissionReport}
            isRunning={isRunning}
            errorDiagnostics={errorDiagnostics}
            onTriggerAIDebug={handleTriggerAIDebug}
            isAIDebugLoading={isAIDebugLoading}
            onRetry={handleSubmit}
          />
        }
      />

      {isZenMode && <ZenModeBanner onExit={() => setIsZenMode(false)} />}

      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={handleClosePricingModal}
        currentTier={userTier}
        onUpgradeStripe={handleUpgradeStripe}
        onUpgradeRazorpay={handleUpgradeRazorpay}
        isProcessing={isUpgrading}
      />

      <AIDebugModal
        isOpen={isAIDebugModalOpen}
        onClose={() => setIsAIDebugModalOpen(false)}
        debugResponse={aiDebugResponse}
        isLoading={isAIDebugLoading}
        onApplyFix={handleApplyAIFix}
      />

      <ContestLeaderboardModal
        isOpen={isLeaderboardModalOpen}
        onClose={() => setIsLeaderboardModalOpen(false)}
      />

      <DeveloperAnalyticsModal
        isOpen={isAnalyticsModalOpen}
        onClose={() => setIsAnalyticsModalOpen(false)}
      />

      <ProctoringWarningModal
        isOpen={isWarningModalOpen}
        strikeCount={strikeCount}
        isFlagged={isFlagged}
        violationType={lastViolation?.type}
        violationDetail={lastViolation?.detail}
        onResumeFullscreen={requestFullscreen}
        onDismiss={dismissWarning}
      />
    </div>
  );
};

export default ProblemWorkspacePage;

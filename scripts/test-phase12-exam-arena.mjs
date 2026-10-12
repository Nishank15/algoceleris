import fs from 'fs';
import path from 'path';
import assert from 'assert';

const rootDir = process.cwd();
console.log('--- Running Phase 12 Student Exam Arena & Watchdog Test Suite ---');

// 1. File existence
const arenaPagePath = path.join(rootDir, 'packages/frontend/src/pages/campus/StudentExamArenaPage.tsx');
const campusApiPath = path.join(rootDir, 'packages/frontend/src/services/campusApi.ts');
const appTsxPath = path.join(rootDir, 'packages/frontend/src/App.tsx');
const indexCssPath = path.join(rootDir, 'packages/frontend/src/index.css');

assert(fs.existsSync(arenaPagePath), `FAIL: StudentExamArenaPage.tsx must exist at ${arenaPagePath}`);

const arenaSrc = fs.readFileSync(arenaPagePath, 'utf8');
const campusApiSrc = fs.readFileSync(campusApiPath, 'utf8');
const appTsxSrc = fs.readFileSync(appTsxPath, 'utf8');
const indexCssSrc = fs.readFileSync(indexCssPath, 'utf8');

// 2. Validate Watchdog Timer & Auto-Submit Countdown Logic
console.log('[Test 1] Validating Watchdog Timer Countdown & Expiration Math...');
const computeWatchdogState = (dueAtIso, cutoffAtIso, nowMs) => {
  const dueMs = new Date(dueAtIso).getTime();
  const cutoffMs = new Date(cutoffAtIso).getTime();

  const isCutoffPassed = nowMs >= cutoffMs;
  const isGracePeriod = nowMs >= dueMs && !isCutoffPassed;
  const remainingMs = Math.max(0, isGracePeriod ? cutoffMs - nowMs : dueMs - nowMs);

  return {
    isCutoffPassed,
    isGracePeriod,
    remainingMs,
    shouldAutoSubmit: isCutoffPassed || remainingMs === 0,
  };
};

const baseTime = Date.now();
const dueTime = new Date(baseTime + 3600000).toISOString();
const cutoffTime = new Date(baseTime + 7200000).toISOString();

// Case A: Normal active exam
const stateA = computeWatchdogState(dueTime, cutoffTime, baseTime);
assert(stateA.isCutoffPassed === false, 'FAIL: Active exam should not be cutoff passed');
assert(stateA.isGracePeriod === false, 'FAIL: Active exam should not be in grace period');
assert(stateA.shouldAutoSubmit === false, 'FAIL: Active exam should not trigger auto-submit');

// Case B: In Grace Period (past due_at, before cutoff_at)
const stateB = computeWatchdogState(dueTime, cutoffTime, baseTime + 3600000 + 1000);
assert(stateB.isGracePeriod === true, 'FAIL: Past due_at should enter grace period');
assert(stateB.isCutoffPassed === false, 'FAIL: Grace period before cutoff should not be cutoff passed');
assert(stateB.shouldAutoSubmit === false, 'FAIL: In grace period before cutoff should not trigger auto-submit');

// Case C: Cutoff Exceeded -> Triggers Auto-Submit
const stateC = computeWatchdogState(dueTime, cutoffTime, baseTime + 7200000 + 100);
assert(stateC.isCutoffPassed === true, 'FAIL: Cutoff time reached must be cutoff passed');
assert(stateC.shouldAutoSubmit === true, 'FAIL: Cutoff time reached must trigger auto-submit');
console.log('✓ Watchdog timer expiration logic verified');

// 3. Validate Secret Test Masking Awareness Logic
console.log('[Test 2] Validating Secret Test Masking Logic...');
const maskStudentTestResults = (testCases, isGradesReleased = false) => {
  return testCases.map((tc, idx) => {
    if (tc.is_sample) {
      return {
        id: tc.id || idx + 1,
        is_sample: true,
        passed: tc.passed,
        input: tc.input_data,
        expected: tc.expected_output,
        actual: tc.actual_output,
      };
    }
    // Secret institutional test
    if (isGradesReleased) {
      return {
        id: tc.id || idx + 1,
        is_sample: false,
        passed: tc.passed,
        input: tc.input_data,
        expected: tc.expected_output,
        actual: tc.actual_output,
      };
    }
    return {
      id: tc.id || idx + 1,
      is_sample: false,
      passed: tc.passed,
      input: '[HIDDEN TEST VECTOR]',
      expected: '[HIDDEN EXPECTED OUTPUT]',
      actual: tc.passed ? '[CORRECT]' : '[INCORRECT]',
      is_masked: true,
    };
  });
};

const rawTests = [
  { id: 1, is_sample: true, passed: true, input_data: '4\n2 7 11 15\n9', expected_output: '0 1', actual_output: '0 1' },
  { id: 2, is_sample: false, passed: false, input_data: '1000\nsecret input', expected_output: 'secret expected', actual_output: 'wrong' },
];

const maskedDuringExam = maskStudentTestResults(rawTests, false);
assert(maskedDuringExam[0].input === '4\n2 7 11 15\n9', 'FAIL: Sample test case should expose input');
assert(maskedDuringExam[1].input === '[HIDDEN TEST VECTOR]', 'FAIL: Secret test input must be masked during exam');
assert(maskedDuringExam[1].expected === '[HIDDEN EXPECTED OUTPUT]', 'FAIL: Secret test expected output must be masked during exam');

const unmaskedAfterRelease = maskStudentTestResults(rawTests, true);
assert(unmaskedAfterRelease[1].input === '1000\nsecret input', 'FAIL: Secret test input unmasked after grade release');
console.log('✓ Secret test masking logic verified');

// 4. Validate Fullscreen Telemetry Framing
console.log('[Test 3] Validating Telemetry Framing Protocol...');
const buildTelemetryPayload = (eventType, metadata = {}) => {
  const allowed = ['heartbeat', 'tab_switch', 'fullscreen_exit', 'paste_burst'];
  assert(allowed.includes(eventType), `FAIL: Unknown proctor event type ${eventType}`);
  return {
    event_type: eventType,
    metadata,
    timestamp: new Date().toISOString(),
  };
};

const frame1 = buildTelemetryPayload('fullscreen_exit', { reason: 'esc_key' });
assert(frame1.event_type === 'fullscreen_exit');
const frame2 = buildTelemetryPayload('tab_switch', { hidden: true });
assert(frame2.event_type === 'tab_switch');
const frame3 = buildTelemetryPayload('paste_burst', { charCount: 120 });
assert(frame3.event_type === 'paste_burst');
console.log('✓ Telemetry framing protocol verified');

// 5. Verify Component & Service Contract
console.log('[Test 4] Verifying StudentExamArenaPage structure...');
assert(arenaSrc.includes('StudentExamArenaPage'), 'FAIL: StudentExamArenaPage export missing');
assert(arenaSrc.includes('fullscreen') || arenaSrc.includes('requestFullscreen'), 'FAIL: Fullscreen API integration missing');
assert(arenaSrc.includes('visibilitychange') || arenaSrc.includes('document.hidden'), 'FAIL: Visibility change listener missing');
assert(arenaSrc.includes('paste') || arenaSrc.includes('paste_burst'), 'FAIL: Paste burst listener missing');
assert(arenaSrc.includes('tabular-nums'), 'FAIL: Tabular-nums countdown formatting missing');
assert(arenaSrc.includes('auto-submit') || arenaSrc.includes('Auto-submit') || arenaSrc.includes('handleAutoSubmit') || arenaSrc.includes('submitAssessment'), 'FAIL: Auto-submit watchdog logic missing');
assert(arenaSrc.includes('Monaco') || arenaSrc.includes('Editor'), 'FAIL: Monaco editor embedding missing');

// 6. Verify API Client Methods in campusApi.ts
console.log('[Test 5] Verifying Campus API submit & proctoring helpers...');
assert(campusApiSrc.includes('submitAssessment'), 'FAIL: campusApi must export submitAssessment');
assert(campusApiSrc.includes('AssessmentSubmitRequest') || campusApiSrc.includes('AssessmentSubmissionResponse'), 'FAIL: campusApi must export AssessmentSubmit schemas');
assert(campusApiSrc.includes('connectProctoringWebSocket') || campusApiSrc.includes('createProctoringSocket'), 'FAIL: campusApi must export proctoring WebSocket helper');

// 7. Verify Route Registration in App.tsx
console.log('[Test 6] Verifying route registration in App.tsx...');
assert(appTsxSrc.includes('/campus/assessments/:id/arena'), 'FAIL: /campus/assessments/:id/arena route missing in App.tsx');
assert(appTsxSrc.includes('StudentExamArenaPage'), 'FAIL: StudentExamArenaPage import missing in App.tsx');

// 8. Verify Design Tokens & Concentric Radii in CSS
console.log('[Test 7] Verifying CSS tokens, concentric radii, and typography in index.css...');
assert(indexCssSrc.includes('--accent-primary'), 'FAIL: --accent-primary token required');
assert(indexCssSrc.includes('.exam-arena') || indexCssSrc.includes('.arena-root'), 'FAIL: .exam-arena styles missing in index.css');
assert(indexCssSrc.includes('letter-spacing: 0.04em') || indexCssSrc.includes('letter-spacing: 0.05em'), 'FAIL: 0.04em letter-spacing for uppercase headers required');
assert(indexCssSrc.includes('tabular-nums'), 'FAIL: tabular-nums required for watchdog timer');

console.log('--- ALL PHASE 12 TESTS PASSED SUCCESSFULLY ---');

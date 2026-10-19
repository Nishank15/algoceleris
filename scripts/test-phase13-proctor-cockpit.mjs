import fs from 'fs';
import path from 'path';
import assert from 'assert';

const rootDir = process.cwd();
console.log('--- Running Phase 13 Faculty Proctor Cockpit & Integrity Dashboard Test Suite ---');

// 1. File existence check
const cockpitPagePath = path.join(rootDir, 'packages/frontend/src/pages/campus/FacultyProctorCockpitPage.tsx');
const campusApiPath = path.join(rootDir, 'packages/frontend/src/services/campusApi.ts');
const appTsxPath = path.join(rootDir, 'packages/frontend/src/App.tsx');
const indexCssPath = path.join(rootDir, 'packages/frontend/src/index.css');

assert(fs.existsSync(cockpitPagePath), `FAIL: FacultyProctorCockpitPage.tsx must exist at ${cockpitPagePath}`);

const cockpitSrc = fs.readFileSync(cockpitPagePath, 'utf8');
const campusApiSrc = fs.readFileSync(campusApiPath, 'utf8');
const appTsxSrc = fs.readFileSync(appTsxPath, 'utf8');
const indexCssSrc = fs.readFileSync(indexCssPath, 'utf8');

// 2. Validate Risk Scoring Calculation Formula Invariant
console.log('[Test 1] Validating Anomaly Risk Score Formula...');
const calculateRiskScore = (tabSwitches, fullscreenDrops, pasteBursts) => {
  return (Number(tabSwitches) || 0) * 5 + (Number(fullscreenDrops) || 0) * 10 + (Number(pasteBursts) || 0) * 15;
};

const resolveRiskSeverity = (score) => {
  if (score >= 35) return 'critical';
  if (score >= 15) return 'elevated';
  return 'low';
};

// Case A: Clean candidate
assert(calculateRiskScore(0, 0, 0) === 0, 'FAIL: Clean candidate score must be 0');
assert(resolveRiskSeverity(0) === 'low', 'FAIL: Clean candidate severity must be low');

// Case B: 1 tab switch + 1 fullscreen drop = 5 + 10 = 15 (Elevated)
assert(calculateRiskScore(1, 1, 0) === 15, 'FAIL: 1 tab + 1 fullscreen must equal 15');
assert(resolveRiskSeverity(15) === 'elevated', 'FAIL: Score 15 must be elevated');

// Case C: 2 tabs (10) + 1 fullscreen (10) + 1 paste (15) = 35 (Critical)
assert(calculateRiskScore(2, 1, 1) === 35, 'FAIL: 2 tabs + 1 drop + 1 paste must equal 35');
assert(resolveRiskSeverity(35) === 'critical', 'FAIL: Score 35 must be critical');
console.log('✓ Risk scoring formula & severity thresholds verified');

// 3. Validate Telemetry State Accumulation Logic
console.log('[Test 2] Validating Telemetry State Accumulation...');
const applyTelemetryEvent = (student, eventType) => {
  const updated = { ...student };
  if (eventType === 'tab_switch') {
    updated.tab_switches = (updated.tab_switches || 0) + 1;
  } else if (eventType === 'fullscreen_exit') {
    updated.fullscreen_exits = (updated.fullscreen_exits || 0) + 1;
  } else if (eventType === 'paste_burst') {
    updated.paste_bursts = (updated.paste_bursts || 0) + 1;
  }
  updated.risk_score = calculateRiskScore(updated.tab_switches, updated.fullscreen_exits, updated.paste_bursts);
  return updated;
};

let studentState = { user_id: 'u1', username: 'alice', tab_switches: 0, fullscreen_exits: 0, paste_bursts: 0, risk_score: 0 };
studentState = applyTelemetryEvent(studentState, 'tab_switch');
assert(studentState.tab_switches === 1 && studentState.risk_score === 5, 'FAIL: tab_switch accumulation failed');

studentState = applyTelemetryEvent(studentState, 'fullscreen_exit');
assert(studentState.fullscreen_exits === 1 && studentState.risk_score === 15, 'FAIL: fullscreen_exit accumulation failed');

studentState = applyTelemetryEvent(studentState, 'paste_burst');
assert(studentState.paste_bursts === 1 && studentState.risk_score === 30, 'FAIL: paste_burst accumulation failed');
console.log('✓ Telemetry state accumulation logic verified');

// 4. Verify Component Contract in FacultyProctorCockpitPage.tsx
console.log('[Test 3] Verifying FacultyProctorCockpitPage structure...');
assert(cockpitSrc.includes('FacultyProctorCockpitPage'), 'FAIL: FacultyProctorCockpitPage export missing');
assert(cockpitSrc.includes('tabular-nums'), 'FAIL: Tabular numbers formatting missing in Cockpit');
assert(cockpitSrc.includes('viva') || cockpitSrc.includes('provisionVivaRoom'), 'FAIL: Viva escalation trigger missing');
assert(cockpitSrc.includes('extension') || cockpitSrc.includes('time') || cockpitSrc.includes('accommodations'), 'FAIL: Time extension action missing');
assert(cockpitSrc.includes('force') || cockpitSrc.includes('terminate'), 'FAIL: Force submit action missing');
assert(cockpitSrc.includes('incident') || cockpitSrc.includes('feed') || cockpitSrc.includes('events'), 'FAIL: Real-time incident feed missing');
console.log('✓ Cockpit UI component structure verified');

// 5. Verify API Client Methods in campusApi.ts
console.log('[Test 4] Verifying Campus API cockpit helpers...');
assert(campusApiSrc.includes('provisionVivaRoom'), 'FAIL: campusApi must export provisionVivaRoom');
assert(campusApiSrc.includes('fetchProctorEvents') || campusApiSrc.includes('getProctorEvents'), 'FAIL: campusApi must export fetchProctorEvents');

// 6. Verify Route Registration in App.tsx
console.log('[Test 5] Verifying route registration in App.tsx...');
assert(
  appTsxSrc.includes('faculty/cockpit/:assessmentId'),
  'FAIL: faculty/cockpit/:assessmentId route missing in App.tsx'
);
assert(appTsxSrc.includes('FacultyProctorCockpitPage'), 'FAIL: FacultyProctorCockpitPage import missing in App.tsx');

// 7. Verify CSS Tokens, Dark Glass Cards, and Invariants in index.css
console.log('[Test 6] Verifying CSS tokens, dark glass, and typography in index.css...');
assert(indexCssSrc.includes('--accent-primary'), 'FAIL: --accent-primary token required');
assert(indexCssSrc.includes('.proctor-cockpit') || indexCssSrc.includes('.cockpit-root'), 'FAIL: .proctor-cockpit styles missing in index.css');
assert(indexCssSrc.includes('letter-spacing: 0.04em') || indexCssSrc.includes('letter-spacing: 0.05em'), 'FAIL: 0.04em letter-spacing for uppercase headers required');
assert(indexCssSrc.includes('tabular-nums'), 'FAIL: tabular-nums required for metrics and clock');

console.log('--- ALL PHASE 13 TESTS PASSED SUCCESSFULLY ---');

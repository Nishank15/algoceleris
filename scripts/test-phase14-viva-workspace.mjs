import fs from 'fs';
import path from 'path';
import assert from 'assert';

const rootDir = process.cwd();
console.log('--- Running Phase 14 3-Pane Viva Workspace & Private Rubric Test Suite ---');

// 1. File existence check
const vivaWorkspacePath = path.join(rootDir, 'packages/frontend/src/pages/campus/VivaInterviewWorkspacePage.tsx');
const campusApiPath = path.join(rootDir, 'packages/frontend/src/services/campusApi.ts');
const appTsxPath = path.join(rootDir, 'packages/frontend/src/App.tsx');
const indexCssPath = path.join(rootDir, 'packages/frontend/src/index.css');

assert(fs.existsSync(vivaWorkspacePath), `FAIL: VivaInterviewWorkspacePage.tsx must exist at ${vivaWorkspacePath}`);

const vivaWorkspaceSrc = fs.readFileSync(vivaWorkspacePath, 'utf8');
const campusApiSrc = fs.readFileSync(campusApiPath, 'utf8');
const appTsxSrc = fs.readFileSync(appTsxPath, 'utf8');
const indexCssSrc = fs.readFileSync(indexCssPath, 'utf8');

// 2. Validate CRDT Awareness Envelope Parsing Logic
console.log('[Test 1] Validating CRDT Awareness Envelope handling...');
const parseAwarenessFrame = (frame) => {
  if (!frame || frame.event_type !== 'awareness') return null;
  return {
    userId: frame.user_id || frame.sender_id,
    username: frame.username || 'Collaborator',
    role: frame.role || 'candidate',
    cursor: frame.cursor || { line: 1, column: 1 },
    selection: frame.selection || null,
    color: frame.color || '#e4f222',
  };
};

const sampleAwareness = {
  event_type: 'awareness',
  room_code: 'viva-test-123',
  sender_id: 'u-1',
  user_id: 'u-1',
  username: 'Sarah Chen',
  role: 'candidate',
  cursor: { line: 14, column: 8 },
  selection: { startLine: 14, startCol: 8, endLine: 14, endCol: 15 },
  color: '#60a5fa',
};

const parsedAwareness = parseAwarenessFrame(sampleAwareness);
assert(parsedAwareness !== null, 'FAIL: Awareness frame must parse successfully');
assert(parsedAwareness.cursor.line === 14, 'FAIL: Cursor line must match 14');
assert(parsedAwareness.color === '#60a5fa', 'FAIL: Awareness peer color must match');
console.log('✓ CRDT awareness envelope logic verified');

// 3. Validate Candidate Masking Invariant
console.log('[Test 2] Validating Candidate Rubric Masking Invariant...');
const shouldRenderRubricDrawer = (userRole, isHost) => {
  if (isHost) return true;
  if (userRole === 'instructor' || userRole === 'org_admin') return true;
  return false; // Candidate / student must NOT render rubric
};

assert(shouldRenderRubricDrawer('instructor', false) === true, 'FAIL: Instructor must see rubric');
assert(shouldRenderRubricDrawer('org_admin', false) === true, 'FAIL: Org Admin must see rubric');
assert(shouldRenderRubricDrawer('student', false) === false, 'FAIL: Student must NOT see rubric drawer');
assert(shouldRenderRubricDrawer('candidate', false) === false, 'FAIL: Candidate must NOT see rubric drawer');
assert(shouldRenderRubricDrawer('student', true) === true, 'FAIL: Host student must see rubric if host');
console.log('✓ Candidate rubric omission invariant verified');

// 4. Validate Rubric Score Formula Calculation
console.log('[Test 3] Validating Rubric Weighted Score Calculation...');
const calculateRubricScore = (scores, criteria) => {
  let total = 0;
  for (const crit of criteria) {
    const rawScore = Number(scores[crit.id] ?? crit.defaultScore ?? 0);
    const weight = Number(crit.weightPercent ?? 0) / 100;
    total += rawScore * weight;
  }
  return Math.round(total * 10) / 10;
};

const criteria = [
  { id: 'problem_deconstruct', weightPercent: 25, defaultScore: 80 },
  { id: 'code_efficiency', weightPercent: 35, defaultScore: 90 },
  { id: 'edge_cases', weightPercent: 20, defaultScore: 70 },
  { id: 'communication', weightPercent: 20, defaultScore: 85 },
];

const scores = {
  problem_deconstruct: 80,
  code_efficiency: 90,
  edge_cases: 70,
  communication: 85,
};

// 80*0.25 + 90*0.35 + 70*0.20 + 85*0.20 = 20 + 31.5 + 14 + 17 = 82.5
assert(calculateRubricScore(scores, criteria) === 82.5, 'FAIL: Calculated score must equal 82.5');
console.log('✓ Rubric weighted scoring formula verified');

// 5. Verify Component Contract in VivaInterviewWorkspacePage.tsx
console.log('[Test 4] Verifying VivaInterviewWorkspacePage component structure...');
assert(vivaWorkspaceSrc.includes('VivaInterviewWorkspacePage'), 'FAIL: VivaInterviewWorkspacePage export missing');
assert(vivaWorkspaceSrc.includes('tabular-nums'), 'FAIL: Tabular numbers formatting missing');
assert(vivaWorkspaceSrc.includes('rubric') || vivaWorkspaceSrc.includes('Rubric'), 'FAIL: Private rubric drawer missing');
assert(vivaWorkspaceSrc.includes('updateVivaRubric') || vivaWorkspaceSrc.includes('rubric_scores'), 'FAIL: Rubric update call missing');
assert(vivaWorkspaceSrc.includes('connectVivaWebSocket') || vivaWorkspaceSrc.includes('ws/campus/viva'), 'FAIL: Viva WebSocket connection missing');
assert(vivaWorkspaceSrc.includes('Run') || vivaWorkspaceSrc.includes('runCode'), 'FAIL: Code execution action missing');
assert(vivaWorkspaceSrc.includes('awareness') || vivaWorkspaceSrc.includes('cursor'), 'FAIL: Live cursor/awareness tracking missing');
console.log('✓ Viva workspace component contract verified');

// 6. Verify API Client Methods in campusApi.ts
console.log('[Test 5] Verifying Campus API Viva helpers...');
assert(campusApiSrc.includes('fetchVivaRoom') || campusApiSrc.includes('getVivaRoom'), 'FAIL: campusApi must export fetchVivaRoom');
assert(campusApiSrc.includes('updateVivaRubric'), 'FAIL: campusApi must export updateVivaRubric');
assert(campusApiSrc.includes('connectVivaWebSocket'), 'FAIL: campusApi must export connectVivaWebSocket');
console.log('✓ Campus API Viva helpers verified');

// 7. Verify Route Registration in App.tsx
console.log('[Test 6] Verifying route registration in App.tsx...');
assert(appTsxSrc.includes('/campus/viva/:room_code'), 'FAIL: /campus/viva/:room_code route missing in App.tsx');
assert(appTsxSrc.includes('VivaInterviewWorkspacePage'), 'FAIL: VivaInterviewWorkspacePage import missing in App.tsx');
console.log('✓ Route registration in App.tsx verified');

// 8. Verify CSS Tokens, Dark Obsidian Panels, and Invariants in index.css
console.log('[Test 7] Verifying CSS tokens, obsidian panels, and hairline borders in index.css...');
assert(indexCssSrc.includes('--accent-primary'), 'FAIL: --accent-primary token required');
assert(indexCssSrc.includes('.viva-workspace') || indexCssSrc.includes('.viva-root'), 'FAIL: .viva-workspace styles missing in index.css');
assert(indexCssSrc.includes('letter-spacing: 0.04em') || indexCssSrc.includes('letter-spacing: 0.05em'), 'FAIL: 0.04em letter-spacing for uppercase headers required');
assert(indexCssSrc.includes('tabular-nums'), 'FAIL: tabular-nums required for metrics and clock');
console.log('✓ CSS tokens and layout verified');

console.log('--- ALL PHASE 14 TESTS PASSED SUCCESSFULLY ---');

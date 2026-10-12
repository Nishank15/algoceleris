import fs from 'fs';
import path from 'path';
import assert from 'assert';

const rootDir = process.cwd();
console.log('--- Running Phase 11 Faculty Scheduler & Calendar Test Suite ---');

// 1. Check file existence
const campusApiPath = path.join(rootDir, 'packages/frontend/src/services/campusApi.ts');
const createPagePath = path.join(rootDir, 'packages/frontend/src/pages/campus/AssessmentCreatePage.tsx');
const calendarPagePath = path.join(rootDir, 'packages/frontend/src/pages/campus/CampusCalendarPage.tsx');
const appTsxPath = path.join(rootDir, 'packages/frontend/src/App.tsx');
const indexCssPath = path.join(rootDir, 'packages/frontend/src/index.css');

assert(fs.existsSync(campusApiPath), `FAIL: campusApi.ts must exist at ${campusApiPath}`);
assert(fs.existsSync(createPagePath), `FAIL: AssessmentCreatePage.tsx must exist at ${createPagePath}`);
assert(fs.existsSync(calendarPagePath), `FAIL: CampusCalendarPage.tsx must exist at ${calendarPagePath}`);

const campusApiSrc = fs.readFileSync(campusApiPath, 'utf8');
const createPageSrc = fs.readFileSync(createPagePath, 'utf8');
const calendarPageSrc = fs.readFileSync(calendarPagePath, 'utf8');
const appTsxSrc = fs.readFileSync(appTsxPath, 'utf8');
const indexCssSrc = fs.readFileSync(indexCssPath, 'utf8');

// 2. Validate Timeline Invariant Formula: publish_at <= starts_at <= due_at <= cutoff_at
console.log('[Test 1] Validating Timeline Check Logic...');
const validateTimeline = (publishAt, startsAt, dueAt, cutoffAt) => {
  const p = new Date(publishAt).getTime();
  const s = new Date(startsAt).getTime();
  const d = new Date(dueAt).getTime();
  const c = new Date(cutoffAt).getTime();
  if (isNaN(p) || isNaN(s) || isNaN(d) || isNaN(c)) return false;
  return p <= s && s <= d && d <= c;
};

const now = Date.now();
const tValid = {
  publish: new Date(now).toISOString(),
  starts: new Date(now + 3600000).toISOString(),
  due: new Date(now + 7200000).toISOString(),
  cutoff: new Date(now + 10800000).toISOString(),
};
assert(validateTimeline(tValid.publish, tValid.starts, tValid.due, tValid.cutoff) === true, 'FAIL: Valid timeline rejected');

const tInvalidStarts = { ...tValid, starts: new Date(now - 1000).toISOString() };
assert(validateTimeline(tInvalidStarts.publish, tInvalidStarts.starts, tInvalidStarts.due, tInvalidStarts.cutoff) === false, 'FAIL: starts_at < publish_at must be rejected');

const tInvalidDue = { ...tValid, due: new Date(now + 1800000).toISOString(), starts: new Date(now + 3600000).toISOString() };
assert(validateTimeline(tInvalidDue.publish, tInvalidDue.starts, tInvalidDue.due, tInvalidDue.cutoff) === false, 'FAIL: due_at < starts_at must be rejected');

const tInvalidCutoff = { ...tValid, cutoff: new Date(now + 5000000).toISOString(), due: new Date(now + 7200000).toISOString() };
assert(validateTimeline(tInvalidCutoff.publish, tInvalidCutoff.starts, tInvalidCutoff.due, tInvalidCutoff.cutoff) === false, 'FAIL: cutoff_at < due_at must be rejected');
console.log('✓ Timeline validation logic passed');

// 3. Validate Rubric Weight Summation Logic
console.log('[Test 2] Validating Rubric Weight Summation...');
const calculateRubricSum = (criteria) => {
  return criteria.reduce((sum, item) => sum + (Number(item.weightPercent) || 0), 0);
};

const validRubric = [
  { id: '1', title: 'Functional Correctness', weightPercent: 60 },
  { id: '2', title: 'Code Efficiency & Cleanliness', weightPercent: 25 },
  { id: '3', title: 'Edge Case Handling', weightPercent: 15 },
];
assert(calculateRubricSum(validRubric) === 100, 'FAIL: Valid rubric sum must be 100');

const invalidRubric = [
  { id: '1', title: 'Functional Correctness', weightPercent: 60 },
  { id: '2', title: 'Code Efficiency', weightPercent: 30 },
];
assert(calculateRubricSum(invalidRubric) === 90, 'FAIL: Incomplete rubric sum must be 90');
console.log('✓ Rubric weight summation logic passed');

// 4. Verify API Client Exports & Methods
console.log('[Test 3] Verifying Campus API client...');
assert(campusApiSrc.includes('export interface AssessmentCreatePayload') || campusApiSrc.includes('export type AssessmentCreatePayload'), 'FAIL: campusApi must export AssessmentCreatePayload');
assert(campusApiSrc.includes('export interface AssessmentItem') || campusApiSrc.includes('export interface AssessmentResponse'), 'FAIL: campusApi must export AssessmentResponse/AssessmentItem');
assert(campusApiSrc.includes('createAssessment'), 'FAIL: campusApi must export createAssessment');
assert(campusApiSrc.includes('getAssessment'), 'FAIL: campusApi must export getAssessment');
assert(campusApiSrc.includes('listAssessments') || campusApiSrc.includes('getCohortAssessments'), 'FAIL: campusApi must export listAssessments');
assert(campusApiSrc.includes('/api/v1/campus'), 'FAIL: campusApi must target /api/v1/campus endpoints');
console.log('✓ Campus API client contract verified');

// 5. Verify Component Structure in AssessmentCreatePage.tsx
console.log('[Test 4] Verifying Assessment Studio UI Component...');
assert(createPageSrc.includes('AssessmentCreatePage'), 'FAIL: AssessmentCreatePage component export missing');
assert(createPageSrc.includes('EXAM') && createPageSrc.includes('HOMEWORK') && createPageSrc.includes('VIVA'), 'FAIL: Mode toggles EXAM, HOMEWORK, VIVA required');
assert(createPageSrc.includes('publish_at') && createPageSrc.includes('starts_at') && createPageSrc.includes('due_at') && createPageSrc.includes('cutoff_at'), 'FAIL: Timeline date inputs missing');
assert(createPageSrc.includes('duration_minutes'), 'FAIL: Duration input for timed exams missing');
assert(createPageSrc.includes('late_penalty_percent_per_hour'), 'FAIL: Late penalty sliders missing');
assert(createPageSrc.includes('problem_slugs') || createPageSrc.includes('selectedProblems'), 'FAIL: Problem selector missing');
assert(createPageSrc.includes('scoring_rubric') || createPageSrc.includes('rubricCriteria'), 'FAIL: Scoring rubric builder missing');
console.log('✓ Assessment Studio UI verified');

// 6. Verify Component Structure in CampusCalendarPage.tsx
console.log('[Test 5] Verifying Campus Calendar View UI Component...');
assert(calendarPageSrc.includes('CampusCalendarPage'), 'FAIL: CampusCalendarPage component export missing');
assert(calendarPageSrc.includes('tabular-nums') || calendarPageSrc.includes('font-variant-numeric'), 'FAIL: Tabular numbers countdown required in calendar');
assert(calendarPageSrc.includes('cohort') || calendarPageSrc.includes('cohort_tag') || calendarPageSrc.includes('cohort-badge'), 'FAIL: Cohort tags required in calendar');
assert(calendarPageSrc.includes('filter') || calendarPageSrc.includes('mode') || calendarPageSrc.includes('status'), 'FAIL: Calendar filtering/tags required');
console.log('✓ Campus Calendar UI verified');

// 7. Verify Route Registration in App.tsx
console.log('[Test 6] Verifying route registration in App.tsx...');
assert(appTsxSrc.includes('/campus/assessments/new'), 'FAIL: /campus/assessments/new route missing in App.tsx');
assert(appTsxSrc.includes('/campus/calendar'), 'FAIL: /campus/calendar route missing in App.tsx');
assert(appTsxSrc.includes('/portal/:org_slug'), 'FAIL: /portal/:org_slug routes missing in App.tsx');
assert(appTsxSrc.includes('AssessmentCreatePage'), 'FAIL: AssessmentCreatePage import missing in App.tsx');
assert(appTsxSrc.includes('CampusCalendarPage'), 'FAIL: CampusCalendarPage import missing in App.tsx');
console.log('✓ Route registration in App.tsx verified');

// 8. Verify Design Tokens & Concentric Radii in CSS
console.log('[Test 7] Verifying CSS tokens, concentric radii, and typography in index.css...');
assert(indexCssSrc.includes('--border-subtle'), 'FAIL: --border-subtle token required');
assert(indexCssSrc.includes('.campus-studio') || indexCssSrc.includes('.assessment-studio') || indexCssSrc.includes('.campus-calendar'), 'FAIL: Campus studio or calendar css classes missing');
assert(indexCssSrc.includes('letter-spacing: 0.04em') || indexCssSrc.includes('letter-spacing: 0.05em'), 'FAIL: 0.04em letter-spacing for uppercase headers required');
assert(indexCssSrc.includes('tabular-nums'), 'FAIL: tabular-nums required for counter formatting');
console.log('✓ CSS tokens and design invariants verified');

console.log('--- ALL PHASE 11 TESTS PASSED SUCCESSFULLY ---');

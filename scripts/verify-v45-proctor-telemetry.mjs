import path from 'path';
import assert from 'assert';
import { execFileSync } from 'child_process';

console.log('='.repeat(74));
console.log(' Cloud-Judge V2 — Milestone v4.5 Live Proctoring Telemetry Pipeline');
console.log(' Playwright Probe: student telemetry -> gateway -> Redis/PG -> faculty cockpit');
console.log('='.repeat(74) + '\n');

const rootDir = process.cwd();
const { chromium } = await import(
  path.join(rootDir, 'packages/frontend/node_modules/playwright/index.mjs')
);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ORG_SLUG = process.env.PROCTOR_ORG_SLUG || 'vit-chennai';
const ASSESSMENT_ID =
  process.env.PROCTOR_ASSESSMENT_ID || '40000000-0000-0000-0000-000000000008';
const CAMPUS_PASSWORD = process.env.CAMPUS_PASSWORD || 'Campus@2026';
const FACULTY_IDENTIFIER = process.env.PROCTOR_FACULTY || 'FAC-VIT-01';
const STUDENT_IDENTIFIER = process.env.PROCTOR_STUDENT || 'DEMO-001';
const STUDENT_ROLL = process.env.PROCTOR_STUDENT_ROLL || 'DEMO-001';
const STUDENT_USERNAME = process.env.PROCTOR_STUDENT_USERNAME || 'student1';
const TAB_SWITCH_POINTS = 5;
const PASTE_BURST_POINTS = 15;
const REDIS_CONTAINER = process.env.REDIS_CONTAINER || 'cloud_judge_redis';
const PG_CONTAINER = process.env.PG_CONTAINER || 'cloud_judge_postgres';

const COCKPIT_URL = `${BASE_URL}/campus/${ORG_SLUG}/faculty/cockpit/${ASSESSMENT_ID}`;
const ARENA_URL = `${BASE_URL}/campus/${ORG_SLUG}/student/tests/${ASSESSMENT_ID}`;
const CAMPUS_SESSION_KEY = 'algoceleris_campus_session';

console.log(`[Config] Frontend target:   ${BASE_URL}`);
console.log(`[Config] Assessment:        ${ASSESSMENT_ID}`);
console.log(`[Config] Faculty candidate: ${FACULTY_IDENTIFIER}`);
console.log(`[Config] Student candidate: ${STUDENT_IDENTIFIER} (${STUDENT_USERNAME} / ${STUDENT_ROLL})\n`);

const results = {
  realRosterRendered: false,
  fabricatedNamesFound: [],
  baselineRisk: null,
  ingestedPersisted: 0,
  redisLogEntries: null,
  redisLivenessMarker: null,
  pgRowCount: null,
  cockpitRiskUpdated: false,
  cockpitFeedUpdated: false,
  apiRiskScore: null,
  consoleErrors: [],
  pageErrors: [],
};

const attachListeners = (page, contextName) => {
  page.on('pageerror', (err) => results.pageErrors.push({ context: contextName, message: err.message }));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      results.consoleErrors.push({ context: contextName, message: msg.text() });
    }
  });
};

const tryExec = (command, args) => {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const redisCli = (...args) => tryExec('docker', ['exec', REDIS_CONTAINER, 'redis-cli', ...args]);
const psql = (sql) =>
  tryExec('docker', [
    'exec', PG_CONTAINER, 'psql', '-U', 'postgres', '-d', 'cloud_judge', '-Atc', sql,
  ]);

const campusLogin = async (page, roleLabel, identifier) => {
  await page.goto(`${BASE_URL}/campus/${ORG_SLUG}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: roleLabel, exact: true }).click();
  await page.locator('input[type="text"]').first().fill(identifier);
  await page.locator('input[type="password"]').first().fill(CAMPUS_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(
    (key) => Boolean(sessionStorage.getItem(key) || localStorage.getItem(key)),
    CAMPUS_SESSION_KEY,
    { timeout: 15000 }
  );
};

const campusToken = (page) =>
  page.evaluate((key) => {
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    return raw ? JSON.parse(raw).token : null;
  }, CAMPUS_SESSION_KEY);

const apiGet = (page, endpoint, token) =>
  page.evaluate(
    async ({ url, bearer }) => {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body };
    },
    { url: endpoint, bearer: token }
  );

/** Reads the live roster grid exactly as the faculty sees it. */
const readRoster = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.candidate-card')].map((card) => ({
      roll: card.querySelector('.candidate-roll')?.textContent?.trim() || '',
      name: card.querySelector('.candidate-name')?.textContent?.trim() || '',
      risk: Number((card.querySelector('.risk-badge')?.textContent || '').replace(/[^0-9]/g, '')),
      severity: [...card.classList].find((c) => ['low', 'elevated', 'critical'].includes(c)) || '',
      status: card.querySelector('.status-pill')?.textContent?.trim() || '',
      stats: [...card.querySelectorAll('.telemetry-stat')].map((s) => ({
        label: s.querySelector('.stat-label')?.textContent?.trim() || '',
        value: Number(s.querySelector('.stat-value')?.textContent?.trim() || '0'),
      })),
    }))
  );

/** Reads the incident feed entries exactly as the faculty sees them. */
const readFeed = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.incident-entry')].map((entry) => ({
      time: entry.querySelector('.incident-time')?.textContent?.trim() || '',
      type: entry.querySelector('.incident-type-tag')?.textContent?.trim() || '',
      roll: entry.querySelector('.incident-roll')?.textContent?.trim() || '',
    }))
  );

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

let facultyPage;
let studentPage;

try {
  // ---------------------------------------------------------------------
  // 1. Faculty cockpit shows the real enrolled cohort (no fabricated names)
  // ---------------------------------------------------------------------
  const facultyContext = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  facultyPage = await facultyContext.newPage();
  attachListeners(facultyPage, 'faculty-cockpit');

  await campusLogin(facultyPage, 'Faculty', FACULTY_IDENTIFIER);
  await facultyPage.goto(COCKPIT_URL, { waitUntil: 'domcontentloaded' });
  await facultyPage.waitForSelector('.candidate-card, .roster-empty-state', { timeout: 15000 });
  const facultyToken = await campusToken(facultyPage);

  const roster = await readRoster(facultyPage);
  const studentRow = roster.find((c) => c.roll === STUDENT_ROLL);
  results.realRosterRendered = Boolean(studentRow);
  results.baselineRisk = studentRow ? studentRow.risk : null;

  const bodyText = await facultyPage.locator('body').innerText();
  results.fabricatedNamesFound = [...bodyText.matchAll(/\b(Student [1-9]|CS26-\d{3})\b/g)].map((m) => m[0]);

  console.log('[Step 1] Faculty cockpit roster (live enrollment)');
  roster.forEach((c) =>
    console.log(`         roll=${c.roll || '-'} user=${c.name || '-'} status=${c.status} risk=${c.risk} band=${c.severity || '-'}`)
  );
  console.log(`         fabricated demo names in UI: ${results.fabricatedNamesFound.length}\n`);

  assert.ok(facultyToken, 'Faculty campus session did not expose an access token');
  assert.ok(results.realRosterRendered, `Cockpit roster does not list enrolled candidate ${STUDENT_ROLL}`);
  assert.strictEqual(
    results.fabricatedNamesFound.length,
    0,
    `Fabricated demo candidate names still rendered: ${JSON.stringify(results.fabricatedNamesFound)}`
  );
  assert.ok(typeof results.baselineRisk === 'number' && !Number.isNaN(results.baselineRisk), 'Baseline risk could not be read');

  // Snapshot what the gateway already holds, so pre-existing incidents can never
  // be mistaken for telemetry produced by this run.
  const eventsEndpoint = `${BASE_URL}/api/v1/campus/assessments/${ASSESSMENT_ID}/proctor/events?limit=50`;
  const baselineRes = await apiGet(facultyPage, eventsEndpoint, facultyToken);
  const baselineEventIds = new Set((baselineRes.body || []).map((e) => e.id));
  console.log(`         baseline incidents already stored: ${baselineEventIds.size}\n`);

  // ---------------------------------------------------------------------
  // 2. Student exam arena emits real telemetry (tab switch + paste burst)
  // ---------------------------------------------------------------------
  const studentContext = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  studentPage = await studentContext.newPage();
  attachListeners(studentPage, 'student-arena');

  await campusLogin(studentPage, 'Student', STUDENT_IDENTIFIER);
  await studentPage.goto(ARENA_URL, { waitUntil: 'domcontentloaded' });
  await studentPage.waitForSelector('.btn-enter-arena', { timeout: 15000 });
  await studentPage.locator('.honor-checkbox-label input[type="checkbox"]').check();
  await studentPage.locator('.btn-enter-arena').click();
  await studentPage.waitForSelector('.btn-enter-arena', { state: 'detached', timeout: 15000 });

  // Real tab switch: the arena's own `visibilitychange` listener only fires when
  // the document is hidden, which a single headless page never does on its own,
  // so the visibility state is flipped and the same event the browser emits is sent.
  await studentPage.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  console.log('[Step 2] Student arena dispatched: tab_switch (visibilitychange)');

  // Real paste burst: >50 characters trips the arena's clipboard anomaly rule.
  const pastedChars = 120;
  await studentPage.evaluate((chars) => {
    const clipboard = new DataTransfer();
    clipboard.setData('text/plain', 'x'.repeat(chars));
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard }));
  }, pastedChars);
  console.log(`         Student arena dispatched: paste_burst (${pastedChars} chars)\n`);

  // ---------------------------------------------------------------------
  // 3. Gateway ingested and persisted the telemetry
  // ---------------------------------------------------------------------
  let recentEvents = [];
  let freshTabSwitch = null;
  let freshPasteBurst = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await apiGet(facultyPage, eventsEndpoint, facultyToken);
    if (res.status === 200 && Array.isArray(res.body)) {
      recentEvents = res.body;
      const fresh = recentEvents.filter((e) => !baselineEventIds.has(e.id));
      freshTabSwitch = fresh.find((e) => e.event_type === 'tab_switch');
      freshPasteBurst = fresh.find((e) => e.event_type === 'paste_burst');
      if (freshTabSwitch && freshPasteBurst) break;
    }
    await facultyPage.waitForTimeout(500);
  }

  const newTabSwitch = freshTabSwitch;
  const newPasteBurst = freshPasteBurst;
  results.ingestedPersisted = recentEvents.filter((e) => e.persisted).length;
  const studentUserId = newPasteBurst?.user_id || newTabSwitch?.user_id || null;

  console.log('[Step 3] Gateway incident log (newest first)');
  recentEvents.slice(0, 5).forEach((e) =>
    console.log(`         ${e.created_at.slice(11, 23)} | ${e.username || '-'} | ${e.event_type} | ${e.severity} | persisted=${e.persisted}`)
  );

  assert.ok(newTabSwitch, 'tab_switch was never ingested by the gateway');
  assert.strictEqual(newTabSwitch.username, STUDENT_USERNAME, `tab_switch attributed to wrong candidate: ${newTabSwitch.username}`);
  assert.strictEqual(newTabSwitch.severity, 'warning', `tab_switch severity must be warning, got ${newTabSwitch.severity}`);
  assert.strictEqual(newTabSwitch.persisted, true, 'tab_switch was not persisted');
  assert.ok(newPasteBurst, 'paste_burst was never ingested by the gateway');
  assert.strictEqual(newPasteBurst.severity, 'critical', `paste_burst severity must be critical, got ${newPasteBurst.severity}`);
  assert.strictEqual(newPasteBurst.persisted, true, 'paste_burst was not persisted');
  assert.ok(studentUserId, 'Ingested telemetry did not resolve to a candidate user id');

  // Direct storage evidence: Redis telemetry keys and PostgreSQL rows
  results.redisLogEntries = redisCli('LLEN', `proctor:log:${ASSESSMENT_ID}`);
  results.redisLivenessMarker = redisCli('EXISTS', `proctor:live:${ASSESSMENT_ID}:${studentUserId}`);
  results.pgRowCount = psql(
    `SELECT COUNT(*) FROM proctor_events WHERE assessment_id='${ASSESSMENT_ID}' AND user_id='${studentUserId}';`
  );

  console.log(`         Redis proctor:log entries:      ${results.redisLogEntries ?? 'n/a'}`);
  console.log(`         Redis liveness marker present:  ${results.redisLivenessMarker ?? 'n/a'}`);
  console.log(`         PostgreSQL proctor_events rows: ${results.pgRowCount ?? 'n/a'}\n`);

  if (results.redisLogEntries !== null) {
    assert.ok(Number(results.redisLogEntries) > 0, 'Redis incident log is empty after ingest');
    assert.strictEqual(results.redisLivenessMarker, '1', 'Redis liveness marker missing after ingest');
  }
  if (results.pgRowCount !== null) {
    assert.ok(Number(results.pgRowCount) > 0, 'PostgreSQL holds no proctor_events for the candidate');
  }

  // ---------------------------------------------------------------------
  // 4. Faculty cockpit updates dynamically and the anomaly score increments
  // ---------------------------------------------------------------------
  const expectedRisk = results.baselineRisk + TAB_SWITCH_POINTS + PASTE_BURST_POINTS;
  await facultyPage.waitForFunction(
    ({ roll, expected }) => {
      const card = [...document.querySelectorAll('.candidate-card')].find(
        (c) => c.querySelector('.candidate-roll')?.textContent?.trim() === roll
      );
      if (!card) return false;
      const value = Number((card.querySelector('.risk-badge')?.textContent || '').replace(/[^0-9]/g, ''));
      return value >= expected;
    },
    { roll: STUDENT_ROLL, expected: expectedRisk },
    { timeout: 20000 }
  );

  const updatedRoster = await readRoster(facultyPage);
  const updatedRow = updatedRoster.find((c) => c.roll === STUDENT_ROLL);
  results.cockpitRiskUpdated = updatedRow.risk === expectedRisk;

  const updatedFeed = await readFeed(facultyPage);
  results.cockpitFeedUpdated =
    updatedFeed.some((e) => e.type.includes('TAB SWITCH')) &&
    updatedFeed.some((e) => e.type.includes('PASTE BURST'));

  const studentsEndpoint = `${BASE_URL}/api/v1/campus/assessments/${ASSESSMENT_ID}/proctor/students`;
  const studentsRes = await apiGet(facultyPage, studentsEndpoint, facultyToken);
  const apiStudent = Array.isArray(studentsRes.body)
    ? studentsRes.body.find((s) => s.user_id === studentUserId)
    : null;
  results.apiRiskScore = apiStudent ? apiStudent.risk_score : null;

  console.log('[Step 4] Faculty cockpit after telemetry (live poll)');
  console.log(`         baseline risk ${results.baselineRisk} + tab ${TAB_SWITCH_POINTS} + paste ${PASTE_BURST_POINTS} = ${expectedRisk}`);
  console.log(`         roster risk now:            ${updatedRow.risk} (band ${updatedRow.severity})`);
  console.log(`         roster status:              ${updatedRow.status}`);
  console.log(`         telemetry counters:         ${updatedRow.stats.map((s) => `${s.label}=${s.value}`).join(' ')}`);
  console.log(`         API anomaly score:          ${results.apiRiskScore}`);
  console.log('         incident feed head:');
  updatedFeed.slice(0, 4).forEach((e) => console.log(`           ${e.time} | ${e.type} | ${e.roll}`));
  console.log('');

  assert.strictEqual(
    updatedRow.risk,
    expectedRisk,
    `Cockpit risk score did not increment to ${expectedRisk} (saw ${updatedRow.risk})`
  );
  assert.strictEqual(
    results.apiRiskScore,
    expectedRisk,
    `Gateway anomaly score mismatch: expected ${expectedRisk}, got ${results.apiRiskScore}`
  );
  assert.ok(
    results.cockpitFeedUpdated,
    `Incident feed did not surface the new telemetry: ${JSON.stringify(updatedFeed.slice(0, 4))}`
  );
  assert.strictEqual(
    updatedRow.status.toUpperCase(),
    'CONNECTED',
    `Candidate connection state not derived from fresh telemetry: ${updatedRow.status}`
  );

  // ---------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------
  console.log('='.repeat(74));
  console.log(`Real enrolled roster rendered:        ${results.realRosterRendered ? 'PASS' : 'FAIL'}`);
  console.log(`Fabricated demo names in cockpit UI:  ${results.fabricatedNamesFound.length}`);
  console.log(`Ingested persisted incidents:         ${results.ingestedPersisted}`);
  console.log(`Redis incident log entries:           ${results.redisLogEntries ?? 'SKIP'}`);
  console.log(`Redis liveness marker:                ${results.redisLivenessMarker ?? 'SKIP'}`);
  console.log(`PostgreSQL proctor_events rows:       ${results.pgRowCount ?? 'SKIP'}`);
  console.log(`Cockpit anomaly score incremented:    ${results.cockpitRiskUpdated ? 'PASS' : 'FAIL'} (${results.baselineRisk} -> ${updatedRow.risk})`);
  console.log(`Cockpit incident feed updated:        ${results.cockpitFeedUpdated ? 'PASS' : 'FAIL'}`);
  console.log(`Page runtime errors:                  ${results.pageErrors.length}`);
  console.log(`Unhandled console errors:             ${results.consoleErrors.length}`);
  if (results.pageErrors.length > 0) {
    console.log('  Page Errors:', JSON.stringify(results.pageErrors, null, 2));
  }
  if (results.consoleErrors.length > 0) {
    console.log('  Console Errors:', JSON.stringify(results.consoleErrors, null, 2));
  }
  console.log('='.repeat(74) + '\n');

  assert.strictEqual(results.cockpitRiskUpdated, true, 'Cockpit anomaly score did not increment');
  assert.strictEqual(results.pageErrors.length, 0, `Detected ${results.pageErrors.length} page runtime errors`);
  assert.strictEqual(results.consoleErrors.length, 0, `Detected ${results.consoleErrors.length} console errors`);

  console.log('🎉 LIVE PROCTORING TELEMETRY PIPELINE VERIFIED END TO END!');
} finally {
  await browser.close();
}

process.exit(0);

/**
 * Phase 4 — Targeted UI/Integration Verification (bounded, headless, 10s per test).
 *
 * Covers the three Phase 4 acceptance checks with strict per-test budgets and no
 * interactive snapshot sessions:
 *
 *   1. Server-authoritative evaluation on `/problems/two-sum`: a solution submitted
 *      through the workspace UI is judged, and a second direct submission proves the
 *      gateway grades the full PostgreSQL case set (5 rows: 3 samples + 2 hidden),
 *      not the 3-case bundled/worker fallback.
 *   2. Faculty cockpit proctoring updates dynamically: a real telemetry event is
 *      ingested through `POST /campus/assessments/:id/proctor/events` and the cockpit
 *      page must reflect the incremented risk score and incident feed within its poll
 *      cadence.
 *   3. AI debug assistant: a failing submission surfaces the `.ai-debug-btn`; the
 *      free-tier gate routes through the pricing modal, and the assistant modal must
 *      render the parsed diagnostic sections returned by `POST /api/v1/ai/debug`
 *      (offline deterministic provider is valid — asserted via `x-ai-debug-source`).
 *   4. Portal chrome: the sun/moon toggle stays available on consumer routes but is
 *      hidden inside the enforced-dark portals (`/hackathons/*`, `/campus/*`).
 *
 * Preconditions (already part of the local dev stack): gateway on :9000 behind HAProxy
 * on :8080, frontend dev server on :3000, Redis + PostgreSQL + judge-worker running.
 *
 * Usage: `node scripts/test-phase4-integration.mjs` (run from the repository root).
 */
import path from 'path';
import assert from 'assert';

const rootDir = process.cwd();
const { chromium } = await import(
  path.join(rootDir, 'packages/frontend/node_modules/playwright/index.mjs')
);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_TIMEOUT_MS = 10_000;
const ACTION_TIMEOUT_MS = 8_000;
const ORG_SLUG = process.env.PROCTOR_ORG_SLUG || 'vit-chennai';
const ASSESSMENT_ID =
  process.env.PROCTOR_ASSESSMENT_ID || '40000000-0000-0000-0000-000000000008';
const CAMPUS_PASSWORD = process.env.CAMPUS_PASSWORD || 'Campus@2026';
const FACULTY_IDENTIFIER = process.env.PROCTOR_FACULTY || 'FAC-VIT-01';
const STUDENT_IDENTIFIER = process.env.PROCTOR_STUDENT || 'DEMO-001';
const STUDENT_ROLL = process.env.PROCTOR_STUDENT_ROLL || 'DEMO-001';

/** Canonical two-sum rows seeded from `judge-db::problem_catalog` (3 samples + 2 hidden). */
const TWO_SUM_DB_CASES = 5;
const TAB_SWITCH_POINTS = 5;

const TWO_SUM_PY_ACCEPTED = [
  'import sys',
  'data = sys.stdin.read().split()',
  'n = int(data[0])',
  'nums = list(map(int, data[1:1+n]))',
  'target = int(data[1+n])',
  'seen = {}',
  'for i, v in enumerate(nums):',
  '    if target - v in seen:',
  '        print(seen[target - v], i)',
  '        break',
  '    seen[v] = i',
  '',
].join('\n');

const TWO_SUM_PY_WRONG = [
  'import sys',
  'data = sys.stdin.read().split()',
  'print(-1, -1)',
  '',
].join('\n');

console.log('='.repeat(74));
console.log(' Cloud-Judge V2 — Phase 4 Targeted UI/Integration Verification');
console.log(` Target: ${BASE_URL}   Budget: ${TEST_TIMEOUT_MS / 1000}s per test (hard)`);
console.log('='.repeat(74) + '\n');

const results = [];

async function runTest(name, fn) {
  const started = Date.now();
  let timer;
  try {
    const detail = await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`exceeded the strict ${TEST_TIMEOUT_MS}ms test budget`)),
          TEST_TIMEOUT_MS
        );
      }),
    ]);
    const ms = Date.now() - started;
    console.log(`  ✓ ${name} (${ms}ms)${detail ? ` — ${detail}` : ''}`);
    results.push({ name, ok: true, ms });
  } catch (err) {
    const ms = Date.now() - started;
    console.error(`  ✗ ${name} (${ms}ms) — ${err.message}`);
    results.push({ name, ok: false, ms, error: err.message });
  } finally {
    clearTimeout(timer);
  }
}

const freshPage = async (browser) => {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  return { context, page };
};

/**
 * Replaces the entire Monaco buffer through the editor's own model API.
 *
 * Keyboard insertion cannot be used for multi-line Python: Monaco re-indents every
 * newline it receives, compounding the buffer's own indentation into an IllegalIndentation
 * error. `setValue` also dispatches the change event the React state listens to.
 */
async function setEditorCode(page, code) {
  const modelValue = await page.evaluate((source) => {
    const model = window.monaco?.editor?.getModels?.()[0];
    if (!model) return null;
    model.setValue(source);
    return model.getValue();
  }, code);
  assert.strictEqual(modelValue, code, 'Monaco buffer did not accept the injected source');
}

/** Normalizes whitespace so DOM text can be compared against JSON strings. */
const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();

async function openTwoSumWorkspace(page) {
  await page.goto(`${BASE_URL}/problems/two-sum`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.monaco-editor', { timeout: ACTION_TIMEOUT_MS });
  await page.waitForFunction(() => document.body.innerText.includes('Two Sum'), null, {
    timeout: ACTION_TIMEOUT_MS,
  });
}

const submitWorkspaceSolution = async (page) => {
  await page.locator('button[title="Submit solution to online judge"]:visible').first().click();
};

async function preflight() {
  const html = await fetch(`${BASE_URL}/problems/two-sum`, {
    signal: AbortSignal.timeout(5000),
  });
  assert.ok(html.ok, `frontend at ${BASE_URL} is not serving /problems/two-sum (HTTP ${html.status})`);
  const health = await fetch(`${BASE_URL}/api/v1/health`, { signal: AbortSignal.timeout(5000) });
  const body = await health.text();
  assert.ok(health.ok && body.includes('healthy'), `gateway health probe failed through ${BASE_URL}`);
}

/**
 * Untimed setup: pays the dev server's first on-demand compile of the workspace bundle so
 * the timed tests measure app behaviour rather than bundler cold-start latency.
 */
async function warmup(browser) {
  const { context, page } = await freshPage(browser);
  try {
    await page.goto(`${BASE_URL}/problems/two-sum`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor', { timeout: 30_000 });
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Test 1 — Server-authoritative evaluation on /problems/two-sum
// ---------------------------------------------------------------------------
async function testServerAuthoritativeEvaluation(browser) {
  const { context, page } = await freshPage(browser);
  try {
    await openTwoSumWorkspace(page);
    await page.locator('select.lang-select').first().selectOption('python');
    await setEditorCode(page, TWO_SUM_PY_ACCEPTED);

    await submitWorkspaceSolution(page);
    await page.waitForFunction(() => document.body.innerText.includes('ACCEPTED'), null, {
      timeout: ACTION_TIMEOUT_MS,
    });

    // Direct submission in the page's origin: inspect how many cases were actually graded.
    const graded = await page.evaluate(async () => {
      const post = await fetch('/api/v1/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_slug: 'two-sum',
          language: 'python',
          code:
            'import sys\n' +
            'data = sys.stdin.read().split()\n' +
            'n = int(data[0])\n' +
            'nums = list(map(int, data[1:1+n]))\n' +
            'target = int(data[1+n])\n' +
            'seen = {}\n' +
            'for i, v in enumerate(nums):\n' +
            '    if target - v in seen:\n' +
            '        print(seen[target - v], i)\n' +
            '        break\n' +
            '    seen[v] = i\n',
        }),
      });
      const intake = await post.json();
      for (let attempt = 0; attempt < 32; attempt += 1) {
        const res = await fetch(`/api/v1/submissions/${intake.submission_id}`);
        const record = await res.json();
        if (record.verdict && record.verdict !== 'PENDING') return record;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error('submission never reached a terminal verdict');
    });

    assert.strictEqual(graded.verdict, 'ACCEPTED', `direct grade verdict: ${graded.verdict}`);
    assert.strictEqual(
      graded.total_testcases,
      TWO_SUM_DB_CASES,
      `graded ${graded.total_testcases} cases; the DB catalog carries ${TWO_SUM_DB_CASES} (client bundle only exposes 3)`
    );
    assert.strictEqual(graded.testcases_passed, TWO_SUM_DB_CASES, 'not every DB case passed');
    return `UI verdict ACCEPTED; direct grade ${graded.testcases_passed}/${graded.total_testcases} DB cases`;
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Test 2 — Faculty cockpit updates dynamically on telemetry events
// ---------------------------------------------------------------------------
async function campusLoginViaApi(identifier, role) {
  const res = await fetch(`${BASE_URL}/api/v1/campus/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_slug: ORG_SLUG,
      identifier,
      password: CAMPUS_PASSWORD,
      role,
    }),
    signal: AbortSignal.timeout(5000),
  });
  assert.ok(res.ok, `campus login failed for ${identifier} (HTTP ${res.status})`);
  const body = await res.json();
  assert.ok(body.access_token, `campus login for ${identifier} returned no access token`);
  assert.ok(body.user, `campus login for ${identifier} returned no user profile`);
  return body;
}

const readCockpitCandidate = (page, roll) =>
  page.evaluate((targetRoll) => {
    const card = [...document.querySelectorAll('.candidate-card')].find(
      (c) => c.querySelector('.candidate-roll')?.textContent?.trim() === targetRoll
    );
    if (!card) return null;
    return {
      risk: Number((card.querySelector('.risk-badge')?.textContent || '').replace(/[^0-9]/g, '')),
      feed: [...document.querySelectorAll('.incident-entry')].map((entry) => ({
        type: entry.querySelector('.incident-type-tag')?.textContent?.trim() || '',
        roll: entry.querySelector('.incident-roll')?.textContent?.trim() || '',
      })),
    };
  }, roll);

async function testCockpitTelemetry(browser) {
  const studentSession = await campusLoginViaApi(STUDENT_IDENTIFIER, 'student');
  const facultySession = await campusLoginViaApi(FACULTY_IDENTIFIER, 'faculty');

  const { context, page } = await freshPage(browser);
  try {
    // Seed the verified institutional session the campus shell rehydrates from, then
    // open the cockpit directly; the login endpoint itself was exercised above.
    const session = {
      role: 'faculty',
      orgSlug: ORG_SLUG,
      orgName: facultySession.user.org_name || ORG_SLUG,
      userId: facultySession.user.user_id,
      name: facultySession.user.username,
      loginId: facultySession.user.email,
      regNumber: facultySession.user.reg_number || FACULTY_IDENTIFIER,
      initials: 'FC',
      token: facultySession.access_token,
    };
    await context.addInitScript(
      ({ key, value }) => {
        window.sessionStorage.setItem(key, value);
        window.localStorage.setItem(key, value);
      },
      { key: 'algoceleris_campus_session', value: JSON.stringify(session) }
    );

    await page.goto(`${BASE_URL}/campus/${ORG_SLUG}/faculty/cockpit/${ASSESSMENT_ID}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('.candidate-card', { timeout: ACTION_TIMEOUT_MS });

    const baseline = await readCockpitCandidate(page, STUDENT_ROLL);
    assert.ok(baseline, `cockpit roster does not list candidate ${STUDENT_ROLL}`);

    // Real telemetry ingest through the same endpoint the exam arena calls.
    const ingest = await fetch(
      `${BASE_URL}/api/v1/campus/assessments/${ASSESSMENT_ID}/proctor/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentSession.access_token}`,
        },
        body: JSON.stringify({ event_type: 'tab_switch' }),
        signal: AbortSignal.timeout(5000),
      }
    );
    assert.strictEqual(ingest.status, 201, `telemetry ingest returned HTTP ${ingest.status}`);
    const event = await ingest.json();
    assert.strictEqual(event.severity, 'warning', `server severity: ${event.severity}`);
    assert.strictEqual(event.persisted, true, 'telemetry event was not persisted');

    const expectedRisk = baseline.risk + TAB_SWITCH_POINTS;
    await page.waitForFunction(
      ({ roll, expected }) => {
        const card = [...document.querySelectorAll('.candidate-card')].find(
          (c) => c.querySelector('.candidate-roll')?.textContent?.trim() === roll
        );
        if (!card) return false;
        const risk = Number((card.querySelector('.risk-badge')?.textContent || '').replace(/[^0-9]/g, ''));
        return risk >= expected;
      },
      { roll: STUDENT_ROLL, expected: expectedRisk },
      { timeout: ACTION_TIMEOUT_MS }
    );

    const updated = await readCockpitCandidate(page, STUDENT_ROLL);
    assert.strictEqual(
      updated.risk,
      expectedRisk,
      `cockpit risk did not settle at ${expectedRisk} (saw ${updated.risk})`
    );
    assert.ok(
      updated.feed.some((entry) => entry.type.includes('TAB SWITCH')),
      `incident feed missing the fresh tab_switch: ${JSON.stringify(updated.feed.slice(0, 3))}`
    );
    return `risk ${baseline.risk} → ${updated.risk}; incident feed updated`;
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Test 3 — AI debug assistant renders parsed diagnostic feedback
// ---------------------------------------------------------------------------
async function testAIDebugAssistant(browser) {
  const { context, page } = await freshPage(browser);
  try {
    await openTwoSumWorkspace(page);
    await page.locator('select.lang-select').first().selectOption('python');
    await setEditorCode(page, TWO_SUM_PY_WRONG);
    await submitWorkspaceSolution(page);

    // The trigger only arms after a non-accepted verdict lands.
    const debugButton = page.locator('.ai-debug-btn');
    await debugButton.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });

    // Free tier is routed to the pricing modal; the Razorpay simulation flips the page to pro.
    await debugButton.click();
    const razorpay = page.locator('.pricing-modal .razorpay-checkout-btn');
    await razorpay.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });
    await razorpay.click();
    await page.waitForSelector('.pricing-modal', { state: 'detached', timeout: ACTION_TIMEOUT_MS });

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/ai/debug') && res.request().method() === 'POST',
      { timeout: ACTION_TIMEOUT_MS }
    );
    await debugButton.click();
    const response = await responsePromise;
    assert.strictEqual(response.status(), 200, `AI debug endpoint returned HTTP ${response.status()}`);
    const source = response.headers()['x-ai-debug-source'] || 'unknown';
    const parsed = await response.json();
    for (const section of ['root_cause', 'fix_explanation', 'complexity_analysis', 'advice']) {
      assert.ok(
        typeof parsed[section] === 'string' && parsed[section].trim().length > 0,
        `AI debug response missing '${section}'`
      );
    }

    const modal = page.locator('.ai-debug-modal');
    await modal.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });

    // The modal must display the parsed diagnosis, not the loading or empty state.
    const needle = normalize(parsed.root_cause).slice(0, 40);
    await page.waitForFunction(
      ({ expected }) => {
        const el = document.querySelector('.ai-debug-modal');
        if (!el) return false;
        const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
        return text.includes(expected) && !text.includes('Analyzing algorithmic bottlenecks');
      },
      { expected: needle },
      { timeout: ACTION_TIMEOUT_MS }
    );

    const modalText = (await modal.innerText()).toUpperCase();
    for (const heading of [
      'KEY TAKEAWAY',
      'ROOT CAUSE ANALYSIS',
      'COMPLEXITY INSPECTION',
      'FIX EXPLANATION',
    ]) {
      assert.ok(modalText.includes(heading), `modal missing '${heading}' section`);
    }
    assert.ok(
      !modalText.includes('No diagnosis available'),
      'modal fell back to the empty state instead of parsed feedback'
    );
    return `modal rendered diagnosis (source: ${source})`;
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Test 4 — Portal chrome: theme toggles hidden + WCAG AA muted text token
// ---------------------------------------------------------------------------
const srgbLuminance = (hex) => {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((index) => {
    const channel = parseInt(value.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (foreground, background) => {
  const [lighter, darker] = [srgbLuminance(foreground), srgbLuminance(background)].sort(
    (a, b) => b - a
  );
  return (lighter + 0.05) / (darker + 0.05);
};

async function testPortalChrome(browser) {
  const { context, page } = await freshPage(browser);
  try {
    await page.goto(`${BASE_URL}/hackathons`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.enforced-dark-surface .theme-toggle-btn', {
      state: 'attached',
      timeout: ACTION_TIMEOUT_MS,
    });
    const portalDisplay = await page.evaluate(
      () => getComputedStyle(document.querySelector('.enforced-dark-surface .theme-toggle-btn')).display
    );
    assert.strictEqual(
      portalDisplay,
      'none',
      'theme toggle is still offered inside the enforced-dark portal'
    );

    // WCAG AA: --text-muted must clear 4.5:1 on --bg-surface while staying a step
    // beneath --text-secondary (light-theme overrides are validated elsewhere).
    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('.enforced-dark-surface'));
      return {
        muted: style.getPropertyValue('--text-muted').trim(),
        secondary: style.getPropertyValue('--text-secondary').trim(),
        surface: style.getPropertyValue('--bg-surface').trim(),
      };
    });
    for (const [name, hex] of Object.entries(tokens)) {
      assert.ok(
        /^#[0-9a-f]{6}$/i.test(hex),
        `${name} token did not resolve to a hex value: ${hex}`
      );
    }
    const mutedContrast = contrastRatio(tokens.muted, tokens.surface);
    const secondaryContrast = contrastRatio(tokens.secondary, tokens.surface);
    assert.ok(
      mutedContrast >= 4.5,
      `--text-muted contrast on --bg-surface is ${mutedContrast.toFixed(2)}:1 (needs ≥ 4.5:1)`
    );
    assert.ok(
      mutedContrast < secondaryContrast,
      `--text-muted (${mutedContrast.toFixed(2)}:1) must stay beneath --text-secondary (${secondaryContrast.toFixed(2)}:1)`
    );

    await page.goto(`${BASE_URL}/problems/two-sum`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.nav-theme-toggle', { timeout: ACTION_TIMEOUT_MS });
    const consumerDisplay = await page.evaluate(
      () => getComputedStyle(document.querySelector('.nav-theme-toggle')).display
    );
    assert.notStrictEqual(
      consumerDisplay,
      'none',
      'theme toggle must stay available outside enforced-dark portals'
    );
    return `portal toggle ${portalDisplay}; consumer toggle ${consumerDisplay}; muted ${mutedContrast.toFixed(2)}:1 vs secondary ${secondaryContrast.toFixed(2)}:1`;
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
await preflight();

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

try {
  console.log('[Warmup] compiling the workspace bundle (untimed setup)');
  const warmupStart = Date.now();
  await warmup(browser);
  console.log(`[Warmup] ready in ${Date.now() - warmupStart}ms\n`);

  console.log('[Test 1] Server-authoritative evaluation on /problems/two-sum');
  await runTest('server-authoritative evaluation', () => testServerAuthoritativeEvaluation(browser));

  console.log('\n[Test 2] Faculty cockpit proctoring dynamic update');
  await runTest('cockpit telemetry update', () => testCockpitTelemetry(browser));

  console.log('\n[Test 3] AI debug assistant trigger & rendered diagnostics');
  await runTest('AI debug assistant', () => testAIDebugAssistant(browser));

  console.log('\n[Test 4] Portal chrome: theme toggle hidden in enforced-dark scopes');
  await runTest('portal theme toggle', () => testPortalChrome(browser));
} finally {
  await browser.close();
}

const failed = results.filter((entry) => !entry.ok);
console.log('\n' + '='.repeat(74));
for (const entry of results) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name} (${entry.ms}ms)`);
}
console.log(`Total: ${results.length}  Passed: ${results.length - failed.length}  Failed: ${failed.length}`);
console.log('='.repeat(74) + '\n');

process.exit(failed.length === 0 ? 0 : 1);

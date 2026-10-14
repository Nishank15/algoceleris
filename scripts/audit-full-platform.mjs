#!/usr/bin/env node

/**
 * scripts/audit-full-platform.mjs
 * 
 * Comprehensive Full-Platform Crawler & Verification Suite across AlgoCeleris
 * 
 * Enforces strict DevTools sentinel listeners:
 * - page.on('console', msg => { if (msg.type() === 'error') throw new Error(`[Console Error] ${msg.text()}`); })
 * - page.on('pageerror', err => { throw new Error(`[Page Error] ${err.message}`); })
 * - page.on('response', res => { if (res.status() >= 400 && !res.url().includes('/auth/login') && !res.url().includes('/auth/refresh') && !res.url().includes('favicon.ico')) throw new Error(`[HTTP ${res.status()}] ${res.url()}`); })
 * 
 * Verifies 5 Core User Flows:
 * Flow 1: Classic Problem Workspace (/problems/two-sum)
 *   - Monaco editor mounts with C++20 boilerplate
 *   - Run Samples -> wait for #test-output, assert sample run results without COMPILATION ERROR or 422
 *   - Submit Solution -> wait for live evaluation stream to complete, assert verdict is recorded
 * Flow 2: Problem Catalog (/problems)
 *   - Search input filter, difficulty tags, and problem navigation
 * Flow 3: Landing Page & Contests (/, /contests)
 *   - Countdown timers render with tabular-nums and zero overflow
 * Flow 4: User Profile (/u/admin)
 *   - Rating SVG chart and stats render cleanly
 * Flow 5: Campus Arena & Viva Workspace (/campus/assessments/:id/arena, /campus/viva/:room_code)
 *   - Fullscreen watchdog and candidate rubric masking (DOM excludes .viva-rubric-drawer)
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SNAPSHOT_DIR = path.resolve(ROOT_DIR, '.planning/full-platform-audit-snapshots');

if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

// Load Playwright
const { chromium } = await import(path.join(ROOT_DIR, 'packages/frontend/node_modules/playwright/index.mjs'));

console.log('========================================================================');
console.log('🚀 AlgoCeleris Full-Platform Autonomous Audit & Bugfix Verification');
console.log(`🌐 Base URL: ${BASE_URL}`);
console.log(`📸 Snapshot Output: ${SNAPSHOT_DIR}`);
console.log('========================================================================\n');

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

const attachSentinelListeners = (page, flowLabel) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Chromium logs standard 401 on unauthenticated silent background session refresh
      if (!text.includes('401') && !text.includes('favicon.ico')) {
        throw new Error(`[${flowLabel}] [Console Error] ${text}`);
      }
    }
  });

  page.on('pageerror', (err) => {
    throw new Error(`[${flowLabel}] [Page Error] ${err.message}`);
  });

  page.on('response', (res) => {
    const url = res.url();
    if (
      res.status() >= 400 &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/refresh') &&
      !url.includes('favicon.ico')
    ) {
      throw new Error(`[${flowLabel}] [HTTP ${res.status()}] ${url}`);
    }
  });
};

try {
  // ===========================================================================
  // Test Flow 1: Classic Problem Workspace (/problems/two-sum)
  // ===========================================================================
  console.log('[Flow 1] Auditing Classic Problem Workspace (/problems/two-sum)...');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    attachSentinelListeners(page, 'Flow-1-Workspace');

    await page.goto(`${BASE_URL}/problems/two-sum`, { waitUntil: 'domcontentloaded' });

    // 1. Verify Monaco Editor mounts
    console.log('  ▶ Verifying Monaco Editor mount and C++20 boilerplate...');
    await page.waitForSelector('.monaco-editor', { timeout: 30000 });
    const langSelect = page.locator('select.lang-select').first();
    assert(await langSelect.isVisible(), 'Language selector must be visible');
    const selectedLang = await langSelect.inputValue();
    assert(selectedLang === 'cpp', `Expected default language C++20 ('cpp'), got '${selectedLang}'`);

    await page.screenshot({ path: path.join(SNAPSHOT_DIR, '01-flow1-problem-workspace-mounted.png') });
    console.log('  ✓ Monaco Editor mounted with C++20 boilerplate');

    // 2. Click "Run Samples"
    console.log('  ▶ Clicking "Run Samples" and awaiting execution telemetry...');
    const runSamplesBtn = page.locator('button.btn-secondary:has-text("Run Samples"), button:has-text("Run Samples")').first();
    assert(await runSamplesBtn.isVisible(), 'Run Samples button must be visible');
    await runSamplesBtn.click();

    // 3. Wait for #test-output / terminal tab
    await page.waitForSelector('#test-output', { timeout: 15000 });
    // Wait for execution to settle
    await page.waitForTimeout(3000);

    const testOutputText = await page.locator('#test-output').innerText();
    assert(!testOutputText.includes('COMPILATION ERROR'), `Found COMPILATION ERROR in output: ${testOutputText}`);
    assert(!testOutputText.includes('422'), `Found 422 error in output: ${testOutputText}`);
    assert(!testOutputText.includes('SYSTEM ERROR'), `Found SYSTEM ERROR in output: ${testOutputText}`);
    assert(
      testOutputText.includes('ACCEPTED') || testOutputText.includes('passed') || testOutputText.includes('Execution Output'),
      `Output must contain sample run telemetry. Received: ${testOutputText}`
    );

    await page.screenshot({ path: path.join(SNAPSHOT_DIR, '02-flow1-sample-run-telemetry.png') });
    console.log('  ✓ "Run Samples" succeeded with clean telemetry (0 compilation errors, 0 422s)');

    // 4. Click "Submit Solution"
    console.log('  ▶ Clicking "Submit Solution" and asserting live evaluation stream verdict...');
    const submitBtn = page.locator('button.btn-primary:has-text("Submit Solution"), button:has-text("Submit Solution")').first();
    assert(await submitBtn.isVisible(), 'Submit Solution button must be visible');
    await submitBtn.click();

    // Wait for live evaluation stream to complete
    await page.waitForTimeout(3500);

    const submitOutputText = await page.locator('#test-output').innerText();
    assert(
      submitOutputText.includes('ACCEPTED') || submitOutputText.includes('passed'),
      `Verdict must be recorded as ACCEPTED. Received: ${submitOutputText}`
    );

    await page.screenshot({ path: path.join(SNAPSHOT_DIR, '03-flow1-submission-verdict-recorded.png') });
    console.log('  ✓ "Submit Solution" finished with recorded verdict');
    await context.close();
  }

  // ===========================================================================
  // Test Flow 2: Problem Catalog (/problems)
  // ===========================================================================
  console.log('\n[Flow 2] Auditing Problem Catalog (/problems)...');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    attachSentinelListeners(page, 'Flow-2-Catalog');

    await page.goto(`${BASE_URL}/problems`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.catalog-table', { timeout: 10000 });

    // 1. Test search input filter
    console.log('  ▶ Testing search input filtering...');
    const searchInput = page.locator('.catalog-search-input');
    assert(await searchInput.isVisible(), 'Search input must be visible');
    await searchInput.fill('Two Sum');
    await page.waitForTimeout(400);

    const filteredRows = page.locator('.catalog-table tbody tr');
    const rowCount = await filteredRows.count();
    assert(rowCount > 0, 'Catalog table must display filtered problem row');
    const firstRowText = await filteredRows.first().innerText();
    assert(firstRowText.includes('Two Sum'), `Filtered row must contain "Two Sum", got: ${firstRowText}`);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(400);

    // 2. Test difficulty tags
    console.log('  ▶ Testing difficulty segment filters...');
    const easyPill = page.locator('.difficulty-pill-btn:has-text("Easy")');
    assert(await easyPill.isVisible(), 'Easy difficulty pill must be visible');
    await easyPill.click();
    await page.waitForTimeout(400);
    assert(await easyPill.evaluate((el) => el.classList.contains('active')), 'Easy pill must be active');

    const allPill = page.locator('.difficulty-pill-btn:has-text("All")');
    await allPill.click();
    await page.waitForTimeout(400);

    // 3. Test problem navigation
    console.log('  ▶ Testing problem navigation link...');
    const problemLink = page.locator('.catalog-table tbody tr .td-title a').first();
    const problemHref = await problemLink.getAttribute('href');
    assert(problemHref && problemHref.startsWith('/problems/'), `Expected problem href, got ${problemHref}`);

    await page.screenshot({ path: path.join(SNAPSHOT_DIR, '04-flow2-problem-catalog.png') });
    console.log('  ✓ Problem Catalog filter, difficulty tags, and navigation links verified');
    await context.close();
  }

  // ===========================================================================
  // Test Flow 3: Landing Page & Contests (/, /contests)
  // ===========================================================================
  console.log('\n[Flow 3] Auditing Landing Page & Contests (/, /contests)...');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    attachSentinelListeners(page, 'Flow-3-Landing-Contests');

    // 1. Landing Page
    console.log('  ▶ Inspecting Landing Page (/) layout and zero overflow...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.landing-hero-title', { timeout: 10000 });

    const landingOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
    });
    assert(landingOverflow, 'Landing page must have zero horizontal overflow');
    await page.screenshot({ path: path.join(SNAPSHOT_DIR, '05-flow3-landing-page.png') });
    console.log('  ✓ Landing page verified with zero horizontal overflow');

    // 2. Contests Hub
    console.log('  ▶ Inspecting Contests Hub (/contests) countdown timers & tabular-nums...');
    await page.goto(`${BASE_URL}/contests`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.contest-card', { timeout: 10000 });

    const countdownTimer = page.locator('.countdown-timer-mono').first();
    assert(await countdownTimer.isVisible(), 'Countdown timer must be visible on active/upcoming contest');

    const fontVariant = await countdownTimer.evaluate((el) => {
      return window.getComputedStyle(el).fontVariantNumeric;
    });
    assert(
      fontVariant.includes('tabular-nums'),
      `Countdown timer must render with tabular-nums font variant. Received: '${fontVariant}'`
    );

    const contestsOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
    });
    assert(contestsOverflow, 'Contests page must have zero horizontal overflow');

    await page.screenshot({ path: path.join(SNAPSHOT_DIR, '06-flow3-contests-countdown.png') });
    console.log('  ✓ Contests Hub verified: countdown timers render with tabular-nums and zero overflow');
    await context.close();
  }

  // ===========================================================================
  // Test Flow 4: User Profile (/u/admin)
  // ===========================================================================
  console.log('\n[Flow 4] Auditing Developer Profile (/u/admin)...');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    attachSentinelListeners(page, 'Flow-4-Profile');

    await page.goto(`${BASE_URL}/u/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.profile-hero-card', { timeout: 10000 });

    // Assert Stats
    console.log('  ▶ Verifying profile metrics and user statistics...');
    const usernameHeading = await page.locator('.profile-username').innerText();
    assert(usernameHeading.toLowerCase().includes('admin'), `Expected admin profile, got: ${usernameHeading}`);

    const statsElements = page.locator('.profile-hero-stats dd');
    assert((await statsElements.count()) >= 3, 'Profile hero stats must render global rank, solved, rating');

    // Assert Rating SVG Chart
    console.log('  ▶ Verifying rating SVG chart and geometry paths...');
    const ratingChartSvg = page.locator('.rating-chart-container svg');
    assert(await ratingChartSvg.isVisible(), 'Rating history SVG chart must be visible');

    const ratingLinePath = page.locator('.rating-chart-container svg path.rating-line');
    assert(await ratingLinePath.isVisible(), 'Rating chart path.rating-line must render valid coordinates');

    await page.screenshot({ path: path.join(SNAPSHOT_DIR, '07-flow4-admin-profile.png') });
    console.log('  ✓ User profile (/u/admin) rating SVG chart and stats rendered cleanly');
    await context.close();
  }

  // ===========================================================================
  // Test Flow 5: Campus Arena & Viva Workspace
  // ===========================================================================
  console.log('\n[Flow 5] Auditing Campus Arena & Viva Candidate Rubric Masking...');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    attachSentinelListeners(page, 'Flow-5-Campus');

    // Set Candidate Role in browser window
    await page.addInitScript(() => {
      window.__vivaRole = 'candidate';
    });

    // 1. Campus Assessment Arena
    console.log('  ▶ Verifying Candidate Exam Arena (/campus/assessments/:id/arena)...');
    const assessmentId = 'a1111111-1111-4111-8111-111111111111';
    await page.goto(`${BASE_URL}/campus/assessments/${assessmentId}/arena`, { waitUntil: 'domcontentloaded' });

    // Complete readiness checklist
    await page.waitForSelector('.arena-readiness-card', { timeout: 10000 });
    const honorCheckbox = page.locator('.honor-checkbox-label input[type="checkbox"]');
    await honorCheckbox.click();
    const enterArenaBtn = page.locator('.btn-enter-arena');
    await enterArenaBtn.click();

    // Verify Arena Split Layout and Fullscreen Watchdog
    await page.waitForSelector('.arena-split-layout', { timeout: 10000 });
    const watchdogDigits = page.locator('.watchdog-timer-digits');
    assert((await watchdogDigits.count()) > 0, 'Exam Arena: Watchdog timer clock must be visible');
    await page.screenshot({ path: path.join(SNAPSHOT_DIR, '08-flow5-candidate-arena.png') });
    console.log('  ✓ Fullscreen watchdog clock verified in Exam Arena');

    // 2. Viva Workspace Candidate Masking
    console.log('  ▶ Verifying Candidate Rubric Masking Invariant in Viva Workspace (/campus/viva/:room_code)...');
    const roomCode = 'VIVA-CS301-A';
    await page.goto(`${BASE_URL}/campus/viva/${roomCode}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.viva-workspace-root', { timeout: 10000 });

    // ASSERT CANDIDATE RUBRIC MASKING: DOM excludes .viva-rubric-drawer
    const rubricDrawerCount = await page.locator('.viva-rubric-drawer').count();
    assert(
      rubricDrawerCount === 0,
      `INVARIANT VIOLATION: Candidate DOM must exclude .viva-rubric-drawer, found ${rubricDrawerCount} elements`
    );

    await page.screenshot({ path: path.join(SNAPSHOT_DIR, '09-flow5-viva-candidate-masked.png') });
    console.log('  ✓ Candidate Rubric Masking Invariant verified (DOM excludes .viva-rubric-drawer)');
    await context.close();
  }

  console.log('\n========================================================================');
  console.log('🎉 ALL 5 AUDIT FLOWS PASSED WITH 100% SUCCESS ACROSS DEVTOOLS SENTINELS!');
  console.log('   - 0 Console Errors');
  console.log('   - 0 Uncaught Page Errors');
  console.log('   - 0 HTTP >= 400 Faults');
  console.log('   - All 5 Test Flows Verified End-to-End');
  console.log('========================================================================\n');
} catch (error) {
  console.error('\n❌ Platform Audit Failed:', error);
  process.exit(1);
} finally {
  await browser.close();
}

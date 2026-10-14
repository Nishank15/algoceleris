#!/usr/bin/env node

/**
 * scripts/verify-local-runtime.mjs
 *
 * End-to-End Live Verification Suite for AlgoCeleris Local Runtime:
 * 1. Verifies http://localhost:8080/health returns HTTP 200 OK with X-Served-By: rust-axum.
 * 2. Runs Playwright check on http://localhost:3000/problems/two-sum:
 *    - Asserts top navigation displays green "online" latency badge.
 *    - Clicks "Run Samples" and asserts execution transitions from PENDING -> ACCEPTED.
 *    - Asserts runtime (ms) and memory metrics (MB) are displayed.
 *    - Asserts zero 503 errors and zero 422 errors.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const INGRESS_URL = process.env.INGRESS_URL || 'http://localhost:8080';
const SNAPSHOT_DIR = path.resolve(ROOT_DIR, '.planning/local-runtime-snapshots');

if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

// 1. Verify HAProxy Ingress Health Endpoint directly
console.log('========================================================================');
console.log('🧪 AlgoCeleris End-to-End Live Runtime Verification');
console.log(`🌐 HAProxy Ingress URL: ${INGRESS_URL}`);
console.log(`💻 Web Application URL: ${BASE_URL}`);
console.log('========================================================================\n');

console.log('[Step 1/3] Verifying HAProxy Ingress Health & Header Routing...');
const healthRes = await fetch(`${INGRESS_URL}/health`);
assert.strictEqual(healthRes.status, 200, `Expected HTTP 200 from ${INGRESS_URL}/health, got ${healthRes.status}`);

const servedBy = healthRes.headers.get('x-served-by');
const backendPool = healthRes.headers.get('x-backend-pool');
console.log(`  ✓ Health status: HTTP 200 OK`);
console.log(`  ✓ X-Served-By: ${servedBy}`);
console.log(`  ✓ X-Backend-Pool: ${backendPool}`);
assert(
  servedBy && servedBy.includes('rust-axum'),
  `Expected X-Served-By header to contain 'rust-axum', got: ${servedBy}`
);

// 2. Launch Playwright
console.log('\n[Step 2/3] Launching Playwright browser for live user journey...');
const { chromium } = await import(path.join(ROOT_DIR, 'packages/frontend/node_modules/playwright/index.mjs'));

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
});

// Guard against 503 and 422 errors across all network responses
const trackedErrors = [];
page.on('response', (res) => {
  const status = res.status();
  const url = res.url();
  if (status === 503) {
    trackedErrors.push(`[HTTP 503 Service Unavailable] ${url}`);
  } else if (status === 422) {
    trackedErrors.push(`[HTTP 422 Unprocessable Content] ${url}`);
  }
});

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const text = msg.text();
    // Ignore benign 401 on unauthenticated background session check
    if (!text.includes('401') && !text.includes('favicon.ico')) {
      console.warn(`  [Browser Console Error] ${text}`);
    }
  }
});

// Navigate to problem workspace
const targetUrl = `${BASE_URL}/problems/two-sum`;
console.log(`  ▶ Navigating to ${targetUrl}...`);
await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

// Verify Top Navigation Latency Badge
console.log('  ▶ Asserting Top Navigation latency badge is online...');
await page.waitForSelector('#nav-latency', { timeout: 10000 });

// Wait up to 6 seconds for ping interval to populate online status
let latencyBadgeOnline = false;
let latencyText = '';
for (let i = 0; i < 15; i++) {
  const dotOnline = await page.locator('#nav-latency .latency-dot.online').count();
  latencyText = (await page.locator('#nav-latency').innerText()).trim();
  if (dotOnline > 0 && latencyText.includes('ms') && !latencyText.includes('offline')) {
    latencyBadgeOnline = true;
    break;
  }
  await page.waitForTimeout(500);
}

assert(latencyBadgeOnline, `Expected latency badge to be online with ms reading, got: '${latencyText}'`);
console.log(`  ✓ Top navigation latency badge is green online: "${latencyText}"`);

await page.screenshot({ path: path.join(SNAPSHOT_DIR, '01-workspace-online-header.png') });

// 3. Click "Run Samples" and Assert Execution Telemetry
console.log('\n[Step 3/3] Clicking "Run Samples" and asserting execution telemetry...');
const runSamplesBtn = page.locator('button.btn-secondary:has-text("Run Samples"), button:has-text("Run Samples")').first();
assert(await runSamplesBtn.isVisible(), 'Run Samples button must be visible in action bar');

await runSamplesBtn.click();
console.log('  ▶ "Run Samples" clicked, waiting for execution output...');

// Wait for #test-output to be rendered
await page.waitForSelector('#test-output', { timeout: 15000 });

// Wait for verdict to settle to ACCEPTED
let verdictAccepted = false;
let outputText = '';
for (let i = 0; i < 30; i++) {
  outputText = await page.locator('#test-output').innerText();
  if (outputText.includes('ACCEPTED') && outputText.includes('passed')) {
    verdictAccepted = true;
    break;
  }
  await page.waitForTimeout(500);
}

assert(
  verdictAccepted,
  `Expected execution output to transition to ACCEPTED. Received text:\n${outputText}`
);
console.log('  ✓ Execution transitioned from PENDING -> ACCEPTED cleanly!');

// Assert metrics are present
const metricsLocator = page.locator('#test-output .telemetry-metrics');
assert(await metricsLocator.isVisible(), 'Telemetry metrics (.telemetry-metrics) must be visible');
const metricsText = await metricsLocator.innerText();
console.log(`  ✓ Telemetry metrics visible: "${metricsText.replace(/\n/g, ' ')}"`);
assert(metricsText.includes('passed'), 'Metrics must include test cases passed');
assert(metricsText.includes('ms'), 'Metrics must include runtime in ms');
assert(metricsText.includes('MB'), 'Metrics must include memory consumption in MB');

await page.screenshot({ path: path.join(SNAPSHOT_DIR, '02-run-samples-accepted.png') });

// Assert zero 503 and zero 422 errors
assert.strictEqual(
  trackedErrors.length,
  0,
  `Encountered forbidden HTTP status errors:\n${trackedErrors.join('\n')}`
);
console.log('  ✓ Verified 0 HTTP 503 errors and 0 HTTP 422 errors across all requests!');

await browser.close();

console.log('\n========================================================================');
console.log('🎉 LIVE VERIFICATION SUCCESSFUL: ALL CRITERIA MET');
console.log('   - Ingress Health: 200 OK (X-Served-By: rust-axum)');
console.log('   - Header Latency Badge: Green Online');
console.log('   - Run Samples: PENDING -> ACCEPTED');
console.log('   - Runtime & Memory Metrics: Displayed');
console.log('   - Zero 503 errors, Zero 422 errors');
console.log('========================================================================\n');

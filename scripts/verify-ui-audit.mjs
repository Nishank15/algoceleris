#!/usr/bin/env node

/**
 * scripts/verify-ui-audit.mjs
 * 
 * Phase 4 Verification Harness: Autonomous Playwright & DevTools Verification
 * - Crawls 7 primary routes across Desktop (1440x900) & Mobile (390x844).
 * - Console & Error Sentinel: Asserts 0 uncaught exceptions or console errors.
 * - Network Sentinel: Asserts 0 unhandled 404s or 500s.
 * - Layout Overflow Sentinel: Asserts 0 horizontal document overflow.
 * - Element Verification: Split panes, mobile tabs, pinned toolbar, mobile nav sheet, tabular-nums.
 * - Reference Screenshots: Saves PNG snapshots to .planning/ui-audit-snapshots/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SNAPSHOT_DIR = path.resolve(ROOT_DIR, '.planning/ui-audit-snapshots');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Ensure snapshot output directory exists
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

// Dynamically resolve Playwright
async function getPlaywright() {
  try {
    return await import('playwright');
  } catch {
    return await import('/usr/local/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs');
  }
}

const VIEWPORTS = [
  {
    name: 'desktop',
    label: 'Desktop (1440x900)',
    options: {
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      isMobile: false,
      hasTouch: false,
    },
  },
  {
    name: 'mobile',
    label: 'Mobile (390x844 iPhone 14/15)',
    options: {
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      isMobile: true,
      hasTouch: true,
    },
  },
];

const ROUTES = [
  { path: '/', id: 'landing', title: 'Landing Page' },
  { path: '/problems', id: 'problems', title: 'Problem Catalog' },
  { path: '/problems/two-sum', id: 'two-sum', title: 'Problem Workspace' },
  { path: '/contests', id: 'contests', title: 'Contests Hub' },
  { path: '/u/admin', id: 'admin-profile', title: 'Developer Profile' },
  { path: '/auth/login', id: 'login', title: 'Auth Login' },
  { path: '/auth/signup', id: 'signup', title: 'Auth Signup' },
];

async function runAudit() {
  console.log('\n===============================================================');
  console.log('🚀 Phase 4: Autonomous Playwright & DevTools Verification Suite');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📸 Snapshots Directory: ${SNAPSHOT_DIR}`);
  console.log('===============================================================\n');

  const { chromium } = await getPlaywright();
  const browser = await chromium.launch({ headless: true });

  const auditResults = [];
  let totalAudits = 0;
  let passedAudits = 0;

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n📱 --- Starting Audits for Viewport: ${vp.label} ---`);
      const context = await browser.newContext(vp.options);

      for (const route of ROUTES) {
        totalAudits++;
        const auditName = `${vp.name} | ${route.path} (${route.title})`;
        process.stdout.write(`  ▶ [Audit ${totalAudits}/14] ${auditName} ... `);

        const page = await context.newPage();

        const consoleErrors = [];
        const pageErrors = [];
        const networkFailures = [];

        // Error & Console Sentinels
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            const text = msg.text();
            const locUrl = msg.location()?.url || '';
            // Filter expected 401 unauthenticated silent token refresh probe in guest sessions
            if (locUrl.includes('/api/v1/auth/refresh') && text.includes('401')) {
              return;
            }
            consoleErrors.push(text);
          }
        });

        page.on('pageerror', (err) => {
          pageErrors.push(err.message || String(err));
        });

        // Network Sentinel (assert 0 unhandled 404s or 500s)
        page.on('response', (res) => {
          const status = res.status();
          const url = res.url();
          if (status === 404 || status >= 500) {
            networkFailures.push(`${status} ${res.request().method()} ${url}`);
          }
        });

        const targetUrl = `${BASE_URL}${route.path}`;
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(300); // Allow react state settling

        // 1. Assert Console & Page Errors
        if (pageErrors.length > 0) {
          throw new Error(`Uncaught Page Errors detected:\n  ${pageErrors.join('\n  ')}`);
        }
        if (consoleErrors.length > 0) {
          throw new Error(`Console Errors detected:\n  ${consoleErrors.join('\n  ')}`);
        }

        // 2. Assert Network Sentinel (0 unhandled 404s or 500s)
        if (networkFailures.length > 0) {
          throw new Error(`Network Failures (404/500+) detected:\n  ${networkFailures.join('\n  ')}`);
        }

        // 3. Layout Overflow Sentinel
        const layoutMetrics = await page.evaluate(() => {
          return {
            bodyScrollWidth: document.body.scrollWidth,
            docScrollWidth: document.documentElement.scrollWidth,
            windowInnerWidth: window.innerWidth,
          };
        });

        if (layoutMetrics.bodyScrollWidth > layoutMetrics.windowInnerWidth) {
          throw new Error(
            `Horizontal Document Overflow! body.scrollWidth (${layoutMetrics.bodyScrollWidth}px) > window.innerWidth (${layoutMetrics.windowInnerWidth}px)`
          );
        }
        if (layoutMetrics.docScrollWidth > layoutMetrics.windowInnerWidth) {
          throw new Error(
            `Horizontal Document Overflow! doc.scrollWidth (${layoutMetrics.docScrollWidth}px) > window.innerWidth (${layoutMetrics.windowInnerWidth}px)`
          );
        }

        // 4. Element Verification per Route & Viewport
        if (route.path === '/problems/two-sum') {
          if (vp.name === 'desktop') {
            const splitPanes = await page.evaluate(() => {
              const resizer = document.querySelector('.resizer-horizontal');
              const problemPane = document.querySelector('.pane-problem');
              const editorPane = document.querySelector('.pane-editor');
              return {
                resizer: resizer ? window.getComputedStyle(resizer).display !== 'none' : false,
                problemPane: problemPane ? window.getComputedStyle(problemPane).display !== 'none' : false,
                editorPane: editorPane ? window.getComputedStyle(editorPane).display !== 'none' : false,
              };
            });
            if (!splitPanes.resizer || !splitPanes.problemPane || !splitPanes.editorPane) {
              throw new Error(`Desktop workspace split panes missing or hidden: ${JSON.stringify(splitPanes)}`);
            }
          } else {
            // Mobile workspace
            const mobileElements = await page.evaluate(() => {
              const tabs = document.querySelector('.mobile-workspace-tabs');
              const toolbar = document.querySelector('.mobile-workspace-toolbar');
              return {
                tabs: tabs ? window.getComputedStyle(tabs).display !== 'none' : false,
                toolbar: toolbar ? window.getComputedStyle(toolbar).display !== 'none' : false,
              };
            });
            if (!mobileElements.tabs || !mobileElements.toolbar) {
              throw new Error(`Mobile workspace tabs or pinned toolbar missing or hidden: ${JSON.stringify(mobileElements)}`);
            }
          }
        }

        // Mobile Nav Drawer / Sheet Verification
        if (vp.name === 'mobile') {
          const navToggle = await page.$('.mobile-nav-toggle');
          if (navToggle) {
            await navToggle.click();
            await page.waitForTimeout(200);

            const drawerCheck = await page.evaluate(() => {
              const sheet = document.querySelector('.mobile-nav-sheet');
              const links = document.querySelectorAll('.mobile-nav-sheet a');
              return {
                sheetVisible: sheet ? window.getComputedStyle(sheet).display !== 'none' : false,
                linkCount: links.length,
                bodyScrollWidth: document.body.scrollWidth,
                windowInnerWidth: window.innerWidth,
              };
            });

            if (!drawerCheck.sheetVisible || drawerCheck.linkCount < 2) {
              throw new Error(`Mobile navigation sheet failed to open or missing links: ${JSON.stringify(drawerCheck)}`);
            }
            if (drawerCheck.bodyScrollWidth > drawerCheck.windowInnerWidth) {
              throw new Error(`Mobile navigation drawer caused horizontal overflow!`);
            }

            // Close the sheet
            const closeBtn = await page.$('.mobile-nav-close');
            if (closeBtn) {
              await closeBtn.click();
            } else {
              await navToggle.click();
            }
            await page.waitForTimeout(150);
          }
        }

        // Tabular numbers verification on latency and timers
        if (route.path === '/problems') {
          const latencyVariant = await page.evaluate(() => {
            const pill = document.querySelector('.latency-pill');
            return pill ? window.getComputedStyle(pill).fontVariantNumeric : null;
          });
          if (!latencyVariant || !latencyVariant.includes('tabular-nums')) {
            throw new Error(`Expected .latency-pill to have tabular-nums, got '${latencyVariant}'`);
          }
        }

        if (route.path === '/contests') {
          const timerVariant = await page.evaluate(() => {
            const timer = document.querySelector('.contest-countdown') || document.querySelector('.countdown-timer-mono');
            return timer ? window.getComputedStyle(timer).fontVariantNumeric : null;
          });
          if (!timerVariant || !timerVariant.includes('tabular-nums')) {
            throw new Error(`Expected contest countdown timer to have tabular-nums, got '${timerVariant}'`);
          }
        }

        // 5. Capture reference screenshot
        const screenshotFile = `${vp.name}-${route.id}.png`;
        const screenshotPath = path.resolve(SNAPSHOT_DIR, screenshotFile);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        console.log('✅ PASSED');
        passedAudits++;
        auditResults.push({ name: auditName, status: 'PASSED', screenshot: screenshotFile });

        await page.close();
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log('\n===============================================================');
  console.log(`📊 PHASE 4 AUDIT SUMMARY: ${passedAudits}/${totalAudits} PASSED`);
  console.log('===============================================================');
  for (const r of auditResults) {
    console.log(`  ✔ [${r.status}] ${r.name} -> ${r.screenshot}`);
  }

  if (passedAudits !== totalAudits) {
    console.error(`\n❌ Error: Only ${passedAudits}/${totalAudits} audits passed.`);
    process.exit(1);
  }

  console.log('\n🎉 ALL 14 VIEWPORT AND ROUTE AUDITS PASSED WITH ZERO DEFECTS!\n');
}

runAudit().catch((err) => {
  console.error('\n❌ Phase 4 Audit Fatal Failure:', err);
  process.exit(1);
});

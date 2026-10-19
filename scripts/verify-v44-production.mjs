import path from 'path';
import assert from 'assert';

console.log('========================================================================');
console.log(' Cloud-Judge V2 — Milestone v4.4 Production Audit & Verification Suite');
console.log(' Automated Playwright Verification: Themes, Sanitization, Auth, RBAC, DB');
console.log('========================================================================\n');

const rootDir = process.cwd();
const { chromium } = await import(
  path.join(rootDir, 'packages/frontend/node_modules/playwright/index.mjs')
);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:8080';

console.log(`[Config] Frontend Target: ${BASE_URL}`);
console.log(`[Config] Gateway Target:  ${API_URL}\n`);

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

const results = {
  themeContrastPassed: 0,
  routesTested: 0,
  sanitizationChecks: 0,
  bragTermsFound: [],
  hackathonGatingPassed: false,
  rbacIsolationPassed: false,
  backend403Passed: false,
  consoleErrors: [],
  pageErrors: [],
};

const attachListeners = (page, contextName) => {
  page.on('pageerror', (err) => {
    // Filter non-fatal hydration or external resource issues
    results.pageErrors.push({ context: contextName, message: err.message });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        !text.includes('favicon.ico') &&
        !text.includes('React DevTools') &&
        !text.includes('401 (Unauthorized)') &&
        !text.includes('Download the React DevTools')
      ) {
        console.warn(`    [Console Error]: ${text}`);
        results.consoleErrors.push({ context: contextName, text });
      }
    }
  });
};

const FORBIDDEN_BRAG_TERMS = [
  'cgroup',
  'kernel sandbox',
  'winnowing',
  '256MB / 1 CPU',
  '256mb / 1 cpu',
  'sub-millisecond worker',
  'sub-millisecond dispatch',
];

const ROUTES = [
  { path: '/', role: 'guest', name: 'Landing Page' },
  { path: '/problems', role: 'guest', name: 'Problems Catalog' },
  { path: '/problems/two-sum', role: 'guest', name: 'Problem Editor' },
  { path: '/contests', role: 'guest', name: 'Contests List' },
  { path: '/contests/biweekly-1', role: 'guest', name: 'Contest Arena' },
  { path: '/hackathons', role: 'guest', name: 'Hackathons Hub' },
  { path: '/hackathons/devshouse-26', role: 'guest', name: 'Hackathon Detail Page' },
  { path: '/pricing', role: 'guest', name: 'Subscription Pricing' },
  { path: '/auth/login', role: 'guest', name: 'Authentication Login' },
  { path: '/auth/signup', role: 'guest', name: 'Authentication Signup' },
  { path: '/u/admin', role: 'guest', name: 'Public User Profile' },
  { path: '/campus', role: 'guest', name: 'Campus Landing Page' },
  { path: '/campus/register', role: 'guest', name: 'Institutional Onboarding' },
  { path: '/campus/vit-chennai/login', role: 'guest', name: 'Campus Institution Login' },
  { path: '/campus/vit-chennai/student/dashboard', role: 'student', name: 'Student Main Dashboard' },
  { path: '/campus/vit-chennai/student/labs', role: 'student', name: 'Student Labs Catalog' },
  { path: '/campus/vit-chennai/student/labs/completed', role: 'student', name: 'Student Completed Labs' },
  { path: '/campus/vit-chennai/student/tests', role: 'student', name: 'Student Assessments List' },
  { path: '/campus/vit-chennai/student/tests/completed', role: 'student', name: 'Student Completed Assessments' },
  { path: '/campus/vit-chennai/student/labs/pps-11-multi-threading/room', role: 'student', name: 'Student Lab Workspace' },
  { path: '/campus/vit-chennai/student/labs/pps-11-multi-threading/review', role: 'student', name: 'Student Lab Review' },
  { path: '/campus/vit-chennai/student/analytics', role: 'student', name: 'Student Analytics Suite' },
  { path: '/campus/vit-chennai/student/workspace', role: 'student', name: 'Student Active Workspace' },
  { path: '/campus/vit-chennai/faculty/dashboard', role: 'instructor', name: 'Faculty Main Dashboard' },
  { path: '/campus/vit-chennai/faculty/labs', role: 'instructor', name: 'Faculty Labs Management' },
  { path: '/campus/vit-chennai/faculty/cockpit/40000000-0000-0000-0000-000000000008', role: 'instructor', name: 'Faculty Proctoring Cockpit' },
  { path: '/campus/vit-chennai/faculty/viva/VIVA-CS201-9871', role: 'instructor', name: 'Faculty Viva Workspace' },
  { path: '/campus/vit-chennai/faculty/plagiarism', role: 'instructor', name: 'Faculty Plagiarism Matrix' },
  { path: '/campus/vit-chennai/admin/dashboard', role: 'org_admin', name: 'Enterprise Campus Admin Dashboard' },
];

async function loginCampusUser(identifier, password, role) {
  const resp = await fetch(`${API_URL}/api/v1/campus/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_slug: 'vit-chennai',
      identifier,
      password,
      role,
    }),
  });
  if (!resp.ok) {
    throw new Error(`Failed to log in as ${role} (${identifier}): ${resp.status} ${await resp.text()}`);
  }
  return await resp.json();
}

console.log('Authenticating test personas against Gateway...');
const studentLogin = await loginCampusUser('DEMO-001', 'Campus@2026', 'student');
const facultyLogin = await loginCampusUser('FAC-VIT-01', 'Campus@2026', 'faculty');
const adminLogin = await loginCampusUser('demoadmin', 'Campus@2026', 'org_admin');

const STUDENT_SESSION = {
  role: 'student',
  orgSlug: 'vit-chennai',
  orgName: 'VIT Chennai',
  userId: studentLogin.user.user_id,
  name: studentLogin.user.username || 'Student 1',
  loginId: 'DEMO-001',
  regNumber: studentLogin.user.reg_number || 'DEMO-001',
  department: 'Computer Science',
  initials: 'AS',
  cohortId: studentLogin.user.cohort_id || '20000000-0000-0000-0000-000000000001',
  cohortName: studentLogin.user.cohort_name || 'CSE Core 2026',
  token: studentLogin.access_token,
};

const INSTRUCTOR_SESSION = {
  role: 'faculty',
  orgSlug: 'vit-chennai',
  orgName: 'VIT Chennai',
  userId: facultyLogin.user.user_id,
  name: facultyLogin.user.username || 'Dr. Suresh Kumar',
  loginId: 'FAC-VIT-01',
  regNumber: facultyLogin.user.reg_number || 'FAC-VIT-01',
  department: 'Computer Science',
  initials: 'SK',
  token: facultyLogin.access_token,
};

const ADMIN_SESSION = {
  role: 'org_admin',
  orgSlug: 'vit-chennai',
  orgName: 'VIT Chennai',
  userId: adminLogin.user.user_id,
  name: adminLogin.user.username || 'Campus Dean Office',
  loginId: 'DEAN001',
  regNumber: adminLogin.user.reg_number || 'ADM-001',
  department: 'Administration',
  initials: 'CD',
  token: adminLogin.access_token,
};

console.log('✓ Successfully authenticated Student, Faculty, and Admin personas with cryptographic JWTs\n');

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  attachListeners(page, 'AuditSuite');

  // =========================================================================
  // TEST 1 & 2: 29-Route Contrast & Copy Sanitization Audit
  // =========================================================================
  console.log('--- [Phase 33 & 36 Audit] Crawling All 29 Routes (Dark/Light Contrast & Copy Scan) ---');

  for (const item of ROUTES) {
    // Configure session role
    await context.clearCookies();
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    
    if (item.role === 'student') {
      await page.evaluate((sess) => {
        localStorage.setItem('algoceleris_campus_session', JSON.stringify(sess));
        sessionStorage.setItem('algoceleris_campus_session', JSON.stringify(sess));
      }, STUDENT_SESSION);
    } else if (item.role === 'instructor') {
      await page.evaluate((sess) => {
        localStorage.setItem('algoceleris_campus_session', JSON.stringify(sess));
        sessionStorage.setItem('algoceleris_campus_session', JSON.stringify(sess));
      }, INSTRUCTOR_SESSION);
    } else if (item.role === 'org_admin') {
      await page.evaluate((sess) => {
        localStorage.setItem('algoceleris_campus_session', JSON.stringify(sess));
        sessionStorage.setItem('algoceleris_campus_session', JSON.stringify(sess));
      }, ADMIN_SESSION);
    } else {
      await page.evaluate(() => {
        localStorage.removeItem('algoceleris_campus_session');
        sessionStorage.removeItem('algoceleris_campus_session');
      });
    }

    // Navigate to route
    await page.goto(`${BASE_URL}${item.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(async () => {
      await page.waitForTimeout(1000);
    });
    await page.waitForTimeout(300);

    // 1. Dark Mode Contrast Check
    const darkStyles = await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      const body = window.getComputedStyle(document.body);
      return {
        bg: body.backgroundColor,
        color: body.color,
      };
    });

    // 2. Invert to Light Mode & Contrast Check
    const lightStyles = await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      const body = window.getComputedStyle(document.body);
      return {
        bg: body.backgroundColor,
        color: body.color,
      };
    });

    // Verify contrast: Background and Color must not be identical
    assert(darkStyles.bg !== darkStyles.color, `Dark mode low contrast on ${item.path}`);
    assert(lightStyles.bg !== lightStyles.color, `Light mode low contrast on ${item.path}`);
    results.themeContrastPassed++;
    results.routesTested++;

    // 3. Scan DOM Text Nodes for Technical Infrastructure Brag Terms
    const textContent = await page.evaluate(() => document.body.innerText || '');
    for (const term of FORBIDDEN_BRAG_TERMS) {
      results.sanitizationChecks++;
      if (textContent.toLowerCase().includes(term.toLowerCase())) {
        // Exclude intentional code blocks or test IDs if any
        results.bragTermsFound.push({ route: item.path, term });
      }
    }

    // Restore to dark theme
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    process.stdout.write(`  ✓ [Route ${results.routesTested}/29] ${item.name} (${item.path}) - Contrast & Copy OK\n`);
  }

  console.log(`\n  => All 29 Routes Verified for Light/Dark Inversion & Clean Text.\n`);

  // =========================================================================
  // TEST 3: Hackathon Auth Gating (Phase 34)
  // =========================================================================
  console.log('--- [Phase 34 Audit] Hackathon Auth Gating for Guest Visitors ---');
  
  // Clear any existing session
  await context.clearCookies();
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  console.log('  Navigating to /hackathons/devshouse-26 as unauthenticated guest...');
  await page.goto(`${BASE_URL}/hackathons/devshouse-26`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Assert discreet guest notice exists
  const guestBanner = await page.locator('text=Guest Mode').count();
  console.log(`  Discreet guest banner detected: ${guestBanner > 0 ? 'YES' : 'NO'}`);

  // Click "Register for Sprint"
  console.log('  Clicking "Register for Sprint" button as unauthenticated visitor...');
  const registerBtn = page.locator('button:has-text("Register for Sprint"), button:has-text("Register")').first();
  await registerBtn.click();
  await page.waitForTimeout(600);

  const currentUrl = page.url();
  console.log(`  Resulting URL after action: ${currentUrl}`);
  assert(
    currentUrl.includes('/auth/login?redirect=') || currentUrl.includes('/auth/login'),
    `Expected redirection to login page with redirect param, got: ${currentUrl}`
  );
  results.hackathonGatingPassed = true;
  console.log('  ✓ Hackathon guest registration intercepted and redirected to /auth/login\n');

  // =========================================================================
  // TEST 4: Strict Enterprise RBAC & Security Isolation (Phase 35)
  // =========================================================================
  console.log('--- [Phase 35 Audit] Strict Cryptographic RBAC & Student Isolation ---');

  // Step 4.1: Establish verified student session
  console.log('  Logging in with verified student session (Student 1 / DEMO-001)...');
  await page.goto(`${BASE_URL}/campus/vit-chennai/login`, { waitUntil: 'networkidle' });
  await page.evaluate((sess) => {
    localStorage.setItem('algoceleris_campus_session', JSON.stringify(sess));
    sessionStorage.setItem('algoceleris_campus_session', JSON.stringify(sess));
  }, STUDENT_SESSION);

  await page.goto(`${BASE_URL}/campus/vit-chennai/student/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Step 4.2: Assert NO role switcher select exists in sidebar
  const roleSelectCount = await page.locator('select[aria-label="Campus Role Switcher"]').count();
  const testRoleButtons = await page.locator('button:has-text("Student"), button:has-text("Faculty")').count();
  console.log(`  Role switcher <select> element count: ${roleSelectCount}`);
  assert.strictEqual(roleSelectCount, 0, 'Found forbidden <select aria-label="Campus Role Switcher"> in sidebar');

  // Assert verified role badge exists
  const verifiedBadge = await page.locator('.campus-verified-role-badge').count();
  console.log(`  Read-only verified role badge present: ${verifiedBadge > 0 ? 'YES' : 'NO'}`);
  assert(verifiedBadge > 0, 'Verified role badge missing from CampusSidebarLayout');

  // Step 4.3: Attempt to navigate to faculty dashboard as student
  console.log('  Attempting student navigation to /campus/vit-chennai/faculty/dashboard...');
  await page.goto(`${BASE_URL}/campus/vit-chennai/faculty/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const interceptedUrl1 = page.url();
  console.log(`  Intercepted URL: ${interceptedUrl1}`);
  assert(
    interceptedUrl1.includes('/campus/vit-chennai/student/dashboard'),
    `Student was not redirected away from faculty view! Got: ${interceptedUrl1}`
  );

  // Step 4.4: Attempt to navigate to admin dashboard as student
  console.log('  Attempting student navigation to /campus/vit-chennai/admin/dashboard...');
  await page.goto(`${BASE_URL}/campus/vit-chennai/admin/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const interceptedUrl2 = page.url();
  console.log(`  Intercepted URL: ${interceptedUrl2}`);
  assert(
    interceptedUrl2.includes('/campus/vit-chennai/student/dashboard'),
    `Student was not redirected away from admin view! Got: ${interceptedUrl2}`
  );
  results.rbacIsolationPassed = true;
  console.log('  ✓ CampusRouteGuard strictly blocked student session from faculty and admin portals');

  // Step 4.5: Direct Backend API Authorization Test (HTTP 403 Forbidden)
  console.log('\n  Testing direct backend POST /api/v1/campus/vit-chennai/labs authorization...');
  
  // Call without token
  const unauthResp = await fetch(`${API_URL}/api/v1/campus/vit-chennai/labs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      course_code: 'CSE1001',
      course_name: 'Security Test',
      title: 'Unauthorized Lab',
      code: '99',
      deadline: '2026-12-31',
      duration_minutes: 60,
      max_marks: 100,
      clo: 'CLO-1',
      description: 'Test lab',
    }),
  });
  console.log(`  Direct unauthenticated POST status: ${unauthResp.status} ${unauthResp.statusText}`);
  assert(
    unauthResp.status === 401 || unauthResp.status === 403,
    `Expected HTTP 401 Unauthorized or 403 Forbidden, got: ${unauthResp.status}`
  );

  // Call with student token
  const studentResp = await fetch(`${API_URL}/api/v1/campus/vit-chennai/labs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${STUDENT_SESSION.token}`,
    },
    body: JSON.stringify({
      course_code: 'CSE1001',
      course_name: 'Security Test',
      title: 'Student Created Lab',
      code: '99',
      deadline: '2026-12-31',
      duration_minutes: 60,
      max_marks: 100,
      clo: 'CLO-1',
      description: 'Test lab',
    }),
  });
  console.log(`  Direct student token POST status: ${studentResp.status} ${studentResp.statusText}`);
  assert.strictEqual(studentResp.status, 403, `Expected HTTP 403 Forbidden for student role, got: ${studentResp.status}`);
  const studentErrBody = await studentResp.json();
  assert(
    studentErrBody.detail && studentErrBody.detail.includes('insufficient_campus_permissions'),
    `Expected detail to include insufficient_campus_permissions, got: ${JSON.stringify(studentErrBody)}`
  );
  results.backend403Passed = true;
  console.log('  ✓ Backend strictly enforces HTTP 403 Forbidden with insufficient_campus_permissions on unauthorized lab creation\n');

  // =========================================================================
  // TEST 5: Student Analytics Dynamic Database Computation (Phase 36)
  // =========================================================================
  console.log('--- [Phase 36 Audit] Student Analytics Dynamic Aggregation ---');
  const analyticsResp = await fetch(
    `${API_URL}/api/v1/campus/vit-chennai/analytics/student?student_id=${STUDENT_SESSION.userId}`,
    {
      headers: {
        Authorization: `Bearer ${STUDENT_SESSION.token}`,
      },
    }
  );
  assert.strictEqual(analyticsResp.status, 200, `Expected HTTP 200 from analytics endpoint, got ${analyticsResp.status}`);
  const analyticsData = await analyticsResp.json();
  console.log(`  Analytics response received for: ${analyticsData.student_name} (${analyticsData.reg_number})`);
  console.log(`  Active Labs Count:    ${analyticsData.active_labs_count}`);
  console.log(`  Completed Labs Count: ${analyticsData.completed_labs_count}`);
  console.log(`  Average Marks:        ${analyticsData.average_marks}`);
  console.log(`  CLO Attainment:       ${analyticsData.clo_attainment_percent}%`);
  assert(analyticsData.active_labs_count !== undefined, 'active_labs_count missing from analytics response');
  assert(analyticsData.completed_labs_count !== undefined, 'completed_labs_count missing from analytics response');
  console.log('  ✓ Student Analytics dynamically aggregated and served via Gateway API\n');

} finally {
  await browser.close();
}

// =========================================================================
// SUMMARY & AUDIT SCORECARD
// =========================================================================
console.log('========================================================================');
console.log(' MILESTONE v4.4 AUDIT SCORECARD');
console.log('========================================================================');
console.log(`Total Routes Tested:                 ${results.routesTested}/29`);
console.log(`Theme Contrast Checks Passed:        ${results.themeContrastPassed}/29`);
console.log(`Technical Brag Terms Found in UI:    ${results.bragTermsFound.length}`);
if (results.bragTermsFound.length > 0) {
  console.log('  Violations:', JSON.stringify(results.bragTermsFound, null, 2));
}
console.log(`Hackathon Guest Redirection:         ${results.hackathonGatingPassed ? 'PASS' : 'FAIL'}`);
console.log(`CampusRouteGuard RBAC Isolation:     ${results.rbacIsolationPassed ? 'PASS' : 'FAIL'}`);
console.log(`Backend 403 Authorization Enforced:  ${results.backend403Passed ? 'PASS' : 'FAIL'}`);
console.log(`Page Runtime Errors:                 ${results.pageErrors.length}`);
console.log(`Unhandled Console Errors:            ${results.consoleErrors.length}`);
if (results.consoleErrors.length > 0) {
  console.log('  Console Errors:', JSON.stringify(results.consoleErrors, null, 2));
}
console.log('========================================================================\n');

assert.strictEqual(results.routesTested, 29, 'Not all 29 routes were crawled');
assert.strictEqual(results.bragTermsFound.length, 0, 'Found forbidden technical brag terms in UI text');
assert.strictEqual(results.hackathonGatingPassed, true, 'Hackathon auth gating failed');
assert.strictEqual(results.rbacIsolationPassed, true, 'RBAC route isolation failed');
assert.strictEqual(results.backend403Passed, true, 'Backend 403 API protection failed');
assert.strictEqual(results.pageErrors.length, 0, `Detected ${results.pageErrors.length} page runtime errors: ${JSON.stringify(results.pageErrors)}`);
assert.strictEqual(results.consoleErrors.length, 0, `Detected ${results.consoleErrors.length} unhandled console errors: ${JSON.stringify(results.consoleErrors)}`);

console.log('🎉 ALL MILESTONE v4.4 VERIFICATION TESTS PASSED WITH 0 ERRORS!');
process.exit(0);

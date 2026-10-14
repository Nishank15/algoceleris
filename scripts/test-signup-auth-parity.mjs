#!/usr/bin/env node
/**
 * scripts/test-signup-auth-parity.mjs
 * 
 * End-to-End Live Verification Suite for Auth Registration,
 * Session Lifecycle, and API Route Parity against live HAProxy (8080) & Web (3000).
 */

import assert from 'assert';

const API_BASE = 'http://localhost:8080';
const WEB_BASE = 'http://localhost:3000';

console.log('================================================================================');
console.log('Live Verification: Auth Registration, Session Profile & Route Parity Audit');
console.log('================================================================================\n');

async function run() {
  const testId = `user_${Date.now().toString(36)}`;
  const testUsername = `user_${testId}`;
  const testEmail = `${testUsername}@algoceleris.io`;
  const testPassword = 'Password123!';

  // 1. Health check via HAProxy
  console.log('[Test 1] Verifying HAProxy ingress health...');
  const healthRes = await fetch(`${API_BASE}/health`);
  assert.strictEqual(healthRes.status, 200, 'Health endpoint must return 200');
  const healthData = await healthRes.json();
  assert.strictEqual(healthData.status, 'healthy');
  assert.strictEqual(healthRes.headers.get('x-served-by'), 'rust-axum');
  assert.strictEqual(healthRes.headers.get('x-backend-pool'), 'rust_gateway_pool');
  console.log('✓ Ingress health confirmed with X-Served-By: rust-axum\n');

  // 2. Debounced availability check
  console.log('[Test 2] Verifying availability check for unused credentials...');
  const availUserRes = await fetch(`${API_BASE}/api/v1/auth/check-availability?username=${testUsername}`);
  assert.strictEqual(availUserRes.status, 200);
  const availUserData = await availUserRes.json();
  assert.strictEqual(availUserData.available, true);
  assert.strictEqual(availUserData.field, 'username');
  console.log(`✓ Username ${testUsername} is verified available`);

  const availEmailRes = await fetch(`${API_BASE}/api/v1/auth/check-availability?email=${testEmail}`);
  assert.strictEqual(availEmailRes.status, 200);
  const availEmailData = await availEmailRes.json();
  assert.strictEqual(availEmailData.available, true);
  assert.strictEqual(availEmailData.field, 'email');
  console.log(`✓ Email ${testEmail} is verified available\n`);

  // 3. User registration via POST /api/v1/auth/signup
  console.log('[Test 3] Testing user registration via POST /api/v1/auth/signup...');
  const signupRes = await fetch(`${API_BASE}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      email: testEmail,
      password: testPassword,
      college_name: 'AlgoCeleris Campus',
    }),
  });
  assert.strictEqual(signupRes.status, 201, `Signup must return 201 Created, got ${signupRes.status}`);

  const signupCookie = signupRes.headers.get('set-cookie');
  assert(signupCookie && signupCookie.includes('HttpOnly'), 'Signup must set HttpOnly cookie');
  assert(signupCookie.includes('refresh_token='), 'Signup must set refresh_token cookie');

  const signupData = await signupRes.json();
  assert(signupData.access_token, 'Signup must issue JWT access token');
  assert.strictEqual(signupData.user.username, testUsername);
  assert.strictEqual(signupData.user.email, testEmail);
  assert.strictEqual(signupData.user.account_type, 'free');
  assert.strictEqual(signupData.user.role, 'free');
  const accessToken = signupData.access_token;
  console.log('✓ Account registered and immediate session established\n');

  // 4. Duplicate checks (RFC 7807 Conflict 409)
  console.log('[Test 4] Testing duplicate username & email conflict rejections (RFC 7807)...');
  const dupUserRes = await fetch(`${API_BASE}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      email: `other_${testEmail}`,
      password: testPassword,
    }),
  });
  assert.strictEqual(dupUserRes.status, 409, 'Duplicate username must return 409 Conflict');
  const dupUserData = await dupUserRes.json();
  assert.strictEqual(dupUserData.type, 'urn:problem-type:conflict');
  assert(dupUserData.detail.includes('Username is already taken'));

  const dupEmailRes = await fetch(`${API_BASE}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `other_${testUsername}`,
      email: testEmail,
      password: testPassword,
    }),
  });
  assert.strictEqual(dupEmailRes.status, 409, 'Duplicate email must return 409 Conflict');
  const dupEmailData = await dupEmailRes.json();
  assert(dupEmailData.detail.includes('Email is already registered'));
  console.log('✓ Duplicate username and email correctly rejected with 409 Conflict\n');

  // 5. Profile inspection via GET /api/v1/auth/me
  console.log('[Test 5] Verifying session profile via GET /api/v1/auth/me...');
  const meRes = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.strictEqual(meRes.status, 200);
  const meData = await meRes.json();
  assert.strictEqual(meData.username, testUsername);
  assert.strictEqual(meData.email, testEmail);
  assert.strictEqual(meData.account_type, 'free');
  console.log('✓ /api/v1/auth/me successfully returned authenticated profile\n');

  // 6. Sign in via POST /api/v1/auth/login using newly created account
  console.log('[Test 6] Verifying sign-in with newly registered account credentials...');
  const loginRes = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: testPassword,
    }),
  });
  assert.strictEqual(loginRes.status, 200, 'Login must succeed with 200 OK');
  const loginData = await loginRes.json();
  assert(loginData.access_token);
  assert.strictEqual(loginData.user.username, testUsername);
  console.log('✓ Successful login and token issuance with new user\n');

  // 7. Route parity audit across all frontend endpoints
  console.log('[Test 7] Running route parity audit against rust_gateway_pool...');
  const parityEndpoints = [
    { method: 'GET', path: '/api/v1/problems' },
    { method: 'GET', path: '/api/v1/problems/two-sum' },
    { method: 'GET', path: '/api/v1/contests' },
    { method: 'GET', path: '/api/v1/contests/weekly-contest-412' },
    { method: 'GET', path: '/api/v1/contests/weekly-contest-412/leaderboard' },
    { method: 'GET', path: '/api/v1/leaderboard' },
    { method: 'GET', path: `/api/v1/users/${testUsername}` },
    { method: 'GET', path: `/api/v1/users/${testUsername}/profile` },
    { method: 'POST', path: '/api/v1/users/submissions/migrate-guest', body: { submissions: [] } },
    { method: 'GET', path: `/api/v1/subscriptions/entitlements/${testUsername}` },
    { method: 'POST', path: '/api/v1/ai/debug', body: { code: 'def solve(): pass', language: 'python' } },
  ];

  for (const ep of parityEndpoints) {
    const opts = {
      method: ep.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    };
    if (ep.body) opts.body = JSON.stringify(ep.body);

    const res = await fetch(`${API_BASE}${ep.path}`, opts);
    assert(
      res.status === 200 || res.status === 201,
      `Endpoint ${ep.path} failed with status ${res.status}`
    );
    assert.strictEqual(
      res.headers.get('x-backend-pool'),
      'rust_gateway_pool',
      `Endpoint ${ep.path} must route to rust_gateway_pool`
    );
    console.log(`  ✓ ${ep.method} ${ep.path} -> ${res.status} [rust_gateway_pool]`);
  }

  console.log('\n================================================================================');
  console.log('All tests passed successfully! Parity achieved with zero legacy fallback.');
  console.log('================================================================================');
}

run().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});

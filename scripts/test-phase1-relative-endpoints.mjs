import fs from 'fs';
import path from 'path';
import assert from 'assert';

const rootDir = process.cwd();
const navPath = path.join(rootDir, 'packages/frontend/src/components/LinearHeaderNav.tsx');
const apiPath = path.join(rootDir, 'packages/frontend/src/services/api.ts');
const viteConfigPath = path.join(rootDir, 'packages/frontend/vite.config.ts');

console.log('--- Running Phase 1 Relative Endpoints Test Suite ---');

// Test 1: LinearHeaderNav.tsx checks
const navContent = fs.readFileSync(navPath, 'utf8');
assert(
  !navContent.includes('http://localhost:8080/health'),
  'FAIL: LinearHeaderNav.tsx must not contain hardcoded http://localhost:8080/health'
);
assert(
  navContent.includes("fetch('/api/v1/health'"),
  "FAIL: LinearHeaderNav.tsx must fetch relative '/api/v1/health'"
);
console.log('✓ PASS: LinearHeaderNav.tsx uses relative /api/v1/health without hardcoded localhost:8080');

// Test 2: api.ts checks
const apiContent = fs.readFileSync(apiPath, 'utf8');
assert(
  !apiContent.includes('localhost:8080'),
  'FAIL: api.ts must not contain hardcoded localhost:8080'
);
assert(
  !apiContent.includes('localhost:8000'),
  'FAIL: api.ts must not contain hardcoded localhost:8000'
);
assert(
  apiContent.includes('export function buildWebSocketUrl') || apiContent.includes('export const buildWebSocketUrl'),
  'FAIL: api.ts must export buildWebSocketUrl'
);
console.log('✓ PASS: api.ts has zero hardcoded localhost:8080 / localhost:8000 and exports buildWebSocketUrl');

// Test 3: vite.config.ts proxy checks
const viteContent = fs.readFileSync(viteConfigPath, 'utf8');
assert(
  viteContent.includes("'/api'") && viteContent.includes("target: 'http://localhost:8080'"),
  'FAIL: vite.config.ts must proxy /api to http://localhost:8080'
);
assert(
  viteContent.includes("'/ws'") && viteContent.includes('ws: true'),
  'FAIL: vite.config.ts must proxy /ws with ws: true'
);
console.log('✓ PASS: vite.config.ts correctly proxies /api and /ws (ws: true) to http://localhost:8080');

console.log('--- ALL PHASE 1 RELATIVE ENDPOINTS TESTS PASSED ---');

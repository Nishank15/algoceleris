#!/usr/bin/env node
/**
 * scripts/test-phase17-haproxy-cutover.mjs
 * 
 * Automated Verification Suite for Phase 17:
 * HAProxy Strangler-Fig Routing Configuration & Zero-Downtime Cutover
 * 
 * Verifications:
 * 1. Syntax check of deploy/haproxy/haproxy.cfg using `haproxy -c -V -f ...`
 * 2. Static validation of Strangler-Fig ACLs, backends, and server definitions
 * 3. Dynamic L7 routing verification via live HAProxy instance on port 8080:
 *    - /health -> rust_gateway_pool
 *    - /api/v1/health -> rust_gateway_pool
 *    - /api/v1/campus/orgs -> rust_gateway_pool
 *    - /api/v1/submissions -> rust_gateway_pool
 *    - /api/v1/auth/login -> rust_gateway_pool
 *    - /ws/campus/viva (WebSocket Upgrade) -> rust_gateway_pool
 *    - /ws/submissions/sub-123 (WebSocket Upgrade) -> rust_gateway_pool
 *    - /api/v1/problems (Fallback) -> legacy_python_pool
 *    - Load balancing distribution across rust nodes (9000 & 9001)
 */

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import assert from 'assert';

const ROOT_DIR = process.cwd();
const HAPROXY_CFG = path.join(ROOT_DIR, 'deploy/haproxy/haproxy.cfg');
const HAPROXY_PID = path.join(ROOT_DIR, 'deploy/haproxy/haproxy-test.pid');

console.log('================================================================================');
console.log('Phase 17 Verification: HAProxy Strangler-Fig Routing & Zero-Downtime Cutover');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: HAProxy Configuration Syntax & Static Directives Check
// -----------------------------------------------------------------------------
console.log('--- Step 1: Validating HAProxy Configuration Syntax ---');

assert(fs.existsSync(HAPROXY_CFG), `Config file not found at ${HAPROXY_CFG}`);

let syntaxOutput = '';
try {
  syntaxOutput = execSync(`haproxy -c -V -f "${HAPROXY_CFG}"`, { encoding: 'utf8' });
  console.log('HAProxy Validation Output:\n' + syntaxOutput.trim());
} catch (err) {
  console.error('HAProxy configuration check failed:', err.message);
  if (err.stdout) console.error('STDOUT:', err.stdout);
  if (err.stderr) console.error('STDERR:', err.stderr);
  process.exit(1);
}

assert(
  syntaxOutput.includes('Configuration file is valid'),
  'FAIL: HAProxy syntax check did not output "Configuration file is valid"'
);
console.log('✓ PASS: `haproxy -c -V -f deploy/haproxy/haproxy.cfg` confirmed configuration file is valid.\n');

// Static file content assertions
const cfgContent = fs.readFileSync(HAPROXY_CFG, 'utf8');

assert(cfgContent.includes('backend rust_gateway_pool'), 'FAIL: Missing backend rust_gateway_pool');
assert(cfgContent.includes('127.0.0.1:9000'), 'FAIL: Missing Rust node 127.0.0.1:9000 in config');
assert(cfgContent.includes('127.0.0.1:9001'), 'FAIL: Missing Rust node 127.0.0.1:9001 in config');
assert(cfgContent.includes('backend legacy_python_pool'), 'FAIL: Missing backend legacy_python_pool');
assert(cfgContent.includes('127.0.0.1:8000'), 'FAIL: Missing legacy node 127.0.0.1:8000 in config');
assert(cfgContent.includes('127.0.0.1:8001'), 'FAIL: Missing legacy node 127.0.0.1:8001 in config');
assert(cfgContent.includes('option httpchk GET /health'), 'FAIL: Missing option httpchk GET /health');
assert(cfgContent.includes('path_beg /api/v1/campus'), 'FAIL: Missing ACL for /api/v1/campus');
assert(cfgContent.includes('path_beg /ws/campus'), 'FAIL: Missing ACL for /ws/campus');
assert(cfgContent.includes('path_beg /api/v1/submissions'), 'FAIL: Missing ACL for /api/v1/submissions');
assert(cfgContent.includes('path_beg /ws/submissions'), 'FAIL: Missing ACL for /ws/submissions');
assert(cfgContent.includes('path_beg /api/v1/auth'), 'FAIL: Missing ACL for /api/v1/auth');
assert(cfgContent.includes('path /health'), 'FAIL: Missing ACL for /health');
assert(cfgContent.includes('path_beg /api/v1/health'), 'FAIL: Missing ACL for /api/v1/health');
assert(cfgContent.includes('default_backend legacy_python_pool'), 'FAIL: Missing fallback to legacy_python_pool');

console.log('✓ PASS: Static verification of backends, ACLs, and health checks succeeded.\n');

// -----------------------------------------------------------------------------
// Step 2: Spin Up Mock Upstream Nodes (Rust on 9000/9001, Legacy on 8000/8001)
// -----------------------------------------------------------------------------
console.log('--- Step 2: Starting Mock Upstream Clusters ---');

const nodes = [
  { port: 9000, name: 'rust_gateway_1', pool: 'rust_gateway_pool', role: 'rust' },
  { port: 9001, name: 'rust_gateway_2', pool: 'rust_gateway_pool', role: 'rust' },
  { port: 8000, name: 'legacy_1', pool: 'legacy_python_pool', role: 'legacy' },
  { port: 8001, name: 'legacy_2', pool: 'legacy_python_pool', role: 'legacy' },
];

const servers = [];
const requestCounts = {
  rust_gateway_1: 0,
  rust_gateway_2: 0,
  legacy_1: 0,
  legacy_2: 0,
};

async function createMockServer(nodeConfig) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      requestCounts[nodeConfig.name]++;

      if (req.url === '/health') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Mock-Node': nodeConfig.name,
          'X-Mock-Role': nodeConfig.role,
        });
        res.end(JSON.stringify({ status: 'ok', node: nodeConfig.name, role: nodeConfig.role }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Mock-Node': nodeConfig.name,
        'X-Mock-Role': nodeConfig.role,
      });
      res.end(
        JSON.stringify({
          message: 'handled',
          path: req.url,
          node: nodeConfig.name,
          role: nodeConfig.role,
        })
      );
    });

    // Handle WebSocket Upgrades
    server.on('upgrade', (req, socket, head) => {
      requestCounts[nodeConfig.name]++;
      const key = req.headers['sec-websocket-key'];
      const accept = crypto
        .createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');

      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n` +
        `X-Mock-Node: ${nodeConfig.name}\r\n` +
        `X-Mock-Role: ${nodeConfig.role}\r\n` +
        '\r\n'
      );

      // Keep socket alive briefly then close cleanly
      setTimeout(() => {
        socket.end();
      }, 50);
    });

    server.listen(nodeConfig.port, '127.0.0.1', () => {
      console.log(`  [Mock Node] ${nodeConfig.name} (${nodeConfig.role}) listening on 127.0.0.1:${nodeConfig.port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

// -----------------------------------------------------------------------------
// Step 3: Spawn HAProxy & Execute Routing Assertions
// -----------------------------------------------------------------------------
let haproxyProcess = null;

async function runRoutingTests() {
  // Start all 4 mock upstream nodes
  for (const node of nodes) {
    const s = await createMockServer(node);
    servers.push(s);
  }

  console.log('\n--- Step 3: Launching HAProxy Daemon on Port 8080 ---');
  haproxyProcess = spawn('haproxy', ['-f', HAPROXY_CFG, '-p', HAPROXY_PID], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  haproxyProcess.stdout.on('data', (d) => process.stdout.write(`[haproxy] ${d}`));
  haproxyProcess.stderr.on('data', (d) => process.stderr.write(`[haproxy] ${d}`));

  // Wait for HAProxy to start listening on port 8080 and pass health checks
  console.log('Waiting for HAProxy to warm up and health checks to pass...');
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const res = await makeHttpRequest('GET', '/health');
      if (res.statusCode === 200) {
        ready = true;
        break;
      }
    } catch (e) {
      // wait
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!ready) {
    throw new Error('HAProxy failed to become ready on port 8080 within timeout');
  }
  console.log('✓ HAProxy is live and accepting connections on port 8080.\n');

  console.log('--- Step 4: Executing Strangler-Fig Routing Tests ---');

  // Test 4.1: /health -> Rust gateway pool
  const resHealth = await makeHttpRequest('GET', '/health');
  assert.strictEqual(resHealth.statusCode, 200);
  assert.strictEqual(resHealth.headers['x-backend-pool'], 'rust_gateway_pool');
  assert.strictEqual(resHealth.headers['x-served-by'], 'rust-axum');
  const bodyHealth = JSON.parse(resHealth.body);
  assert.strictEqual(bodyHealth.role, 'rust');
  console.log('✓ PASS: GET /health routed to rust_gateway_pool (X-Served-By: rust-axum, Node: ' + bodyHealth.node + ')');

  // Test 4.2: /api/v1/health -> Rust gateway pool
  const resHealthApi = await makeHttpRequest('GET', '/api/v1/health');
  assert.strictEqual(resHealthApi.statusCode, 200);
  assert.strictEqual(resHealthApi.headers['x-backend-pool'], 'rust_gateway_pool');
  assert.strictEqual(resHealthApi.headers['x-served-by'], 'rust-axum');
  console.log('✓ PASS: GET /api/v1/health routed to rust_gateway_pool');

  // Test 4.3: /api/v1/campus/orgs -> Rust gateway pool
  const resCampus = await makeHttpRequest('GET', '/api/v1/campus/orgs');
  assert.strictEqual(resCampus.statusCode, 200);
  assert.strictEqual(resCampus.headers['x-backend-pool'], 'rust_gateway_pool');
  assert.strictEqual(resCampus.headers['x-served-by'], 'rust-axum');
  const bodyCampus = JSON.parse(resCampus.body);
  assert.strictEqual(bodyCampus.role, 'rust');
  console.log('✓ PASS: GET /api/v1/campus/orgs routed to rust_gateway_pool (Node: ' + bodyCampus.node + ')');

  // Test 4.4: POST /api/v1/submissions -> Rust gateway pool
  const resSub = await makeHttpRequest('POST', '/api/v1/submissions', { code: 'print(1)' });
  assert.strictEqual(resSub.statusCode, 200);
  assert.strictEqual(resSub.headers['x-backend-pool'], 'rust_gateway_pool');
  assert.strictEqual(resSub.headers['x-served-by'], 'rust-axum');
  console.log('✓ PASS: POST /api/v1/submissions routed to rust_gateway_pool');

  // Test 4.5: POST /api/v1/auth/login -> Rust gateway pool
  const resAuth = await makeHttpRequest('POST', '/api/v1/auth/login', { username: 'test' });
  assert.strictEqual(resAuth.statusCode, 200);
  assert.strictEqual(resAuth.headers['x-backend-pool'], 'rust_gateway_pool');
  assert.strictEqual(resAuth.headers['x-served-by'], 'rust-axum');
  console.log('✓ PASS: POST /api/v1/auth/login routed to rust_gateway_pool');

  // Test 4.6: WebSocket Upgrade /ws/campus/viva -> Rust gateway pool
  const wsCampus = await makeWebSocketUpgrade('/ws/campus/viva');
  assert.strictEqual(wsCampus.statusCode, 101);
  assert.strictEqual(wsCampus.headers['upgrade'].toLowerCase(), 'websocket');
  assert.strictEqual(wsCampus.headers['x-mock-role'], 'rust');
  console.log('✓ PASS: WebSocket /ws/campus/viva upgraded (101) and routed to Rust backend (Node: ' + wsCampus.headers['x-mock-node'] + ')');

  // Test 4.7: WebSocket Upgrade /ws/submissions/sub-test-99 -> Rust gateway pool
  const wsSub = await makeWebSocketUpgrade('/ws/submissions/sub-test-99');
  assert.strictEqual(wsSub.statusCode, 101);
  assert.strictEqual(wsSub.headers['upgrade'].toLowerCase(), 'websocket');
  assert.strictEqual(wsSub.headers['x-mock-role'], 'rust');
  console.log('✓ PASS: WebSocket /ws/submissions/sub-test-99 upgraded (101) and routed to Rust backend (Node: ' + wsSub.headers['x-mock-node'] + ')');

  // Test 4.8: Fallback routing to legacy Python pool for unmigrated endpoints
  const resLegacy = await makeHttpRequest('GET', '/api/v1/problems');
  assert.strictEqual(resLegacy.statusCode, 200);
  assert.strictEqual(resLegacy.headers['x-backend-pool'], 'legacy_python_pool');
  assert.strictEqual(resLegacy.headers['x-served-by'], 'legacy-fastapi');
  const bodyLegacy = JSON.parse(resLegacy.body);
  assert.strictEqual(bodyLegacy.role, 'legacy');
  console.log('✓ PASS: GET /api/v1/problems routed to legacy_python_pool fallback (Node: ' + bodyLegacy.node + ')');

  // Test 4.9: Round-robin verification across Rust nodes
  const rustNodeHits = { rust_gateway_1: 0, rust_gateway_2: 0 };
  for (let i = 0; i < 10; i++) {
    const res = await makeHttpRequest('GET', '/api/v1/campus/stats');
    const body = JSON.parse(res.body);
    if (rustNodeHits[body.node] !== undefined) {
      rustNodeHits[body.node]++;
    }
  }
  assert(rustNodeHits.rust_gateway_1 > 0 && rustNodeHits.rust_gateway_2 > 0, 
    'FAIL: Expected traffic to be balanced across both Rust nodes');
  console.log(`✓ PASS: Load balancing active: rust_gateway_1=${rustNodeHits.rust_gateway_1}, rust_gateway_2=${rustNodeHits.rust_gateway_2}`);

  console.log('\n================================================================================');
  console.log('ALL PHASE 17 ROUTING AND ZERO-DOWNTIME CUTOVER TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================================');
}

function makeHttpRequest(method, reqPath, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port: 8080,
        path: reqPath,
        method: method,
        headers: {
          Host: 'localhost:8080',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: chunks,
          });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function makeWebSocketUpgrade(reqPath) {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({
      host: '127.0.0.1',
      port: 8080,
      path: reqPath,
      method: 'GET',
      headers: {
        Host: 'localhost:8080',
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key,
      },
    });

    req.on('upgrade', (res, socket, head) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
      });
      socket.end();
    });

    req.on('response', (res) => {
      reject(new Error(`Expected upgrade 101, but got HTTP status ${res.statusCode}`));
    });

    req.on('error', reject);
    req.end();
  });
}

// Teardown helper
async function cleanup() {
  console.log('\n--- Cleaning up test processes ---');
  if (fs.existsSync(HAPROXY_PID)) {
    try {
      const pid = fs.readFileSync(HAPROXY_PID, 'utf8').trim();
      if (pid) {
        process.kill(parseInt(pid, 10), 'SIGTERM');
      }
      fs.unlinkSync(HAPROXY_PID);
    } catch (e) {
      // ignore
    }
  }

  if (haproxyProcess && !haproxyProcess.killed) {
    try {
      haproxyProcess.kill('SIGTERM');
    } catch (e) {}
  }

  for (const s of servers) {
    try {
      s.close();
    } catch (e) {}
  }
  console.log('Cleanup complete.');
}

runRoutingTests()
  .then(async () => {
    await cleanup();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n❌ Verification Failed:', err);
    await cleanup();
    process.exit(1);
  });

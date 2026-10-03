---
phase: 07-plagiarism-engine-3d-isometric-analytics-haproxy-ingress
plan: "03"
subsystem: devops/ingress-haproxy
tags: [haproxy, layer-7, reverse-proxy, websockets, load-balancing, docker-compose]
key_files:
  - deploy/haproxy/haproxy.cfg
  - deploy/docker-compose.yml
  - deploy/Dockerfile.gateway
  - deploy/Dockerfile.worker
  - packages/gateway/src/main.py
  - packages/gateway/tests/test_proxy_config.py
verification:
  - python3 -m unittest packages/gateway/tests/test_proxy_config.py
  - python3 -m unittest discover -s packages/gateway/tests
  - python3 -m unittest discover -s packages/engine/tests && python3 -m unittest discover -s packages/worker/tests
  - npm --prefix packages/frontend run build
---

# Plan 07-03 Summary: HAProxy Layer 7 Ingress & Multi-Instance Gateway Load Balancing

## Objective
Implemented the production HAProxy Layer 7 reverse proxy configuration, WebSocket stream tunneling, health check monitoring, and multi-instance gateway topology (`PROXY-01`).

## Key Implementations

### 1. Production HAProxy Layer 7 Configuration (`deploy/haproxy/haproxy.cfg`)
- **Global & Defaults**:
  - `mode http`, `maxconn 4096`, `retries 3`.
  - Configured `timeout tunnel 3600000ms` (1-hour keepalive) to prevent timeout terminations during live contest submissions.
- **Frontend `ingress_http`**:
  - Binds ports `80` and `8080`.
  - Normalizes headers with `X-Forwarded-Proto` and `option forwardfor`.
  - WebSocket ACLs: `acl is_websocket hdr(Upgrade) -i WebSocket` and `acl is_ws_path path_beg /ws/`.
  - Dynamic routing: routes WebSocket traffic to `gateway_ws_cluster` and REST APIs to `gateway_api_cluster`.
- **Backend `gateway_api_cluster`**:
  - `balance roundrobin` across gateway nodes.
  - Active health checks with `option httpchk GET /health` and `http-check expect status 200` (`inter 2s fall 3 rise 2`).
- **Backend `gateway_ws_cluster`**:
  - `balance leastconn` to spread long-lived streaming connections evenly.
  - Dedicated `timeout tunnel 3600000ms` with active health monitoring.
- **Admin Statistics Listener**:
  - Live administrative telemetry bound to `0.0.0.0:8404` at `/stats` with 5s refresh.

### 2. Multi-Instance Deployment Stack (`deploy/docker-compose.yml`, `Dockerfile.gateway`, `Dockerfile.worker`)
- Composed 5 interconnected services:
  - `haproxy`: Ingress reverse proxy mapping host `8080` -> `80` and `8404` -> `8404`.
  - `gateway_1` and `gateway_2`: Redundant FastAPI gateway instances listening on port 8000.
  - `redis`: Redis 7 instance for queue broker, token-bucket rate limiter, and contest leaderboard state.
  - `worker`: Background evaluation worker daemon processing sandbox jobs.
- Updated `packages/gateway/src/main.py` to dynamically bind `HOST`, `PORT`, and `WORKERS` via environment variables.

### 3. Automated Configuration Test Suite (`packages/gateway/tests/test_proxy_config.py`)
- Unit tests parsing and validating HAProxy config blocks:
  - File existence and section parsing.
  - Defaults and timeouts validation.
  - WebSocket ACL inspection rules and routing statements.
  - API cluster round-robin balancing and health check expectation.
  - WebSocket cluster least-connections balancing and 1-hour tunnel timeout.
  - Admin stats listener configuration.
  - Docker Compose topology verification.

## Verification
- `test_proxy_config.py`: 7/7 tests passed.
- Full backend regression suite: 102/102 tests passed (66 gateway, 32 engine, 4 worker).
- Frontend production build: Passed with 0 errors in 3.72s.

## Self-Check: PASSED
All artifacts created, HAProxy configuration validated, 102 tests passing cleanly.

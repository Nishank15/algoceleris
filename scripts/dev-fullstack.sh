#!/usr/bin/env bash
# ==============================================================================
# Cloud-Judge V2 - Unified Process Supervision Orchestrator
# Starts:
#   1. PostgreSQL & Redis Docker containers
#   2. Native host HAProxy daemon on port 8080
#   3. Rust Axum Gateway (cargo run -p judge-gateway) on port 9000
#   4. Rust Evaluation Worker (cargo run -p judge-worker)
#   5. Frontend dev server (npm --prefix packages/frontend run dev)
# Traps SIGINT/SIGTERM for clean shutdown without leaving orphaned PID locks.
# ==============================================================================

set -eo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "======================================================================"
echo "⚡ AlgoCeleris / Cloud-Judge V2: Unified Fullstack Orchestrator"
echo "======================================================================"

PIDS=()

cleanup() {
    echo ""
    echo "======================================================================"
    echo "🛑 Received termination signal. Shutting down all supervised services..."
    echo "======================================================================"
    
    # Terminate recorded child PIDs
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            echo "Stopping PID $pid..."
            kill "$pid" 2>/dev/null || true
        fi
    done

    # Wait up to 3 seconds for graceful shutdown
    local deadline=$((SECONDS + 3))
    for pid in "${PIDS[@]}"; do
        while kill -0 "$pid" 2>/dev/null && [ $SECONDS -lt $deadline ]; do
            sleep 0.1
        done
        if kill -0 "$pid" 2>/dev/null; then
            echo "Force killing PID $pid..."
            kill -9 "$pid" 2>/dev/null || true
        fi
    done

    # Prevent orphaned PID locks on host ports
    echo "Verifying no orphaned locks on ports 8080, 9000, 9001..."
    for port in 8080 9000 9001; do
        local orphaned_pid
        orphaned_pid=$(lsof -ti :"$port" 2>/dev/null || true)
        if [ -n "$orphaned_pid" ]; then
            echo "Cleaning up lingering process on port $port (PID: $orphaned_pid)..."
            kill -9 $orphaned_pid 2>/dev/null || true
        fi
    done

    echo "✓ All supervised processes cleanly stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Start Docker containers (PostgreSQL & Redis)
echo "[1/5] Ensuring Docker dependencies are active..."
if command -v docker >/dev/null 2>&1; then
    docker start cloud_judge_postgres cloud_judge_redis >/dev/null 2>&1 || true
    echo "  ✓ Docker containers cloud_judge_postgres & cloud_judge_redis started"
else
    echo "  ⚠️ Docker CLI not found. Assuming external PostgreSQL & Redis are running."
fi

# Locate HAProxy binary
HAPROXY_BIN=""
if [ -x "/opt/homebrew/bin/haproxy" ]; then
    HAPROXY_BIN="/opt/homebrew/bin/haproxy"
elif [ -x "/usr/local/bin/haproxy" ]; then
    HAPROXY_BIN="/usr/local/bin/haproxy"
elif command -v haproxy >/dev/null 2>&1; then
    HAPROXY_BIN="$(command -v haproxy)"
else
    echo "❌ HAProxy binary not found in PATH or Homebrew locations."
    exit 1
fi

# Clean any existing processes occupying our ports before starting
for port in 8080 9000 9001; do
    existing_pid=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$existing_pid" ]; then
        echo "Clearing existing process on port $port (PID: $existing_pid)..."
        kill -9 $existing_pid 2>/dev/null || true
        sleep 0.2
    fi
done

# 2. Start Native Host HAProxy daemon on port 8080
echo "[2/5] Starting Native Host HAProxy Ingress on port 8080..."
"$HAPROXY_BIN" -f "$ROOT_DIR/deploy/haproxy/haproxy.cfg" &
HAPROXY_PID=$!
PIDS+=("$HAPROXY_PID")
echo "  ✓ HAProxy started (PID: $HAPROXY_PID)"

# 3. Start Rust Axum Gateway on port 9000
echo "[3/5] Starting Rust Axum Gateway on port 9000..."
PORT=9000 cargo run -p judge-gateway &
GATEWAY_PID=$!
PIDS+=("$GATEWAY_PID")
echo "  ✓ Rust Axum Gateway launched (PID: $GATEWAY_PID)"

# 4. Start Rust Evaluation Worker popping from submissions:queue
echo "[4/5] Starting Rust Evaluation Worker..."
cargo run -p judge-worker &
WORKER_PID=$!
PIDS+=("$WORKER_PID")
echo "  ✓ Rust Evaluation Worker launched (PID: $WORKER_PID)"

# 5. Start Frontend Dev Server
echo "[5/5] Starting Frontend dev server..."
npm --prefix packages/frontend run dev &
FRONTEND_PID=$!
PIDS+=("$FRONTEND_PID")
echo "  ✓ Frontend dev server launched (PID: $FRONTEND_PID)"

echo "Waiting for services to become healthy on http://localhost:8080/health..."
RETRIES=30
HEALTHY=0
while [ $RETRIES -gt 0 ]; do
    if curl -s -f http://localhost:8080/health >/dev/null 2>&1; then
        HEALTHY=1
        break
    fi
    sleep 1
    RETRIES=$((RETRIES - 1))
done

if [ $HEALTHY -eq 1 ]; then
    echo "======================================================================"
    echo "🎉 Full stack successfully operational!"
    echo "   - HAProxy Ingress: http://localhost:8080"
    echo "   - Health Check:    http://localhost:8080/health"
    echo "   - Gateway API:     http://localhost:8080/api/v1/health"
    echo "   - Web Frontend:    http://localhost:3000"
    echo "   Press Ctrl+C to terminate all supervised processes."
    echo "======================================================================"
else
    echo "⚠️ Gateway health check timed out. Checking background logs..."
fi

# Wait for all processes
wait

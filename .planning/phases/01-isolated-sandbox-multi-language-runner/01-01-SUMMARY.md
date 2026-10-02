---
phase: 01-isolated-sandbox-multi-language-runner
plan: "01"
subsystem: sandbox
tags: [cgroups, sandbox, execution-engine, security, resource-limits]

requires: []
provides:
  - Linux cgroups v2 transient scope controller with 256MB memory cap, 1 CPU quota, and 64 PIDs limit
  - Hardened IsolationSandbox runner with unshare network namespace drop and rlimit fallbacks
  - ProcessWatcher supervisor with millisecond-accuracy CPU/wall-time tracking and OOM/TLE detection
affects: [01-02-PLAN, 01-03-PLAN, Phase 2]

actuals:
  tokens: 1650
  tasks: 3
  commits: 1

tech-stack:
  added: [python3, cgroups-v2, setrlimit]
  patterns: [transient-cgroup-scope, watchdog-supervisor, rlimit-fallback]

key-files:
  created:
    - packages/engine/pyproject.toml
    - packages/engine/src/__init__.py
    - packages/engine/src/models.py
    - packages/engine/src/cgroups.py
    - packages/engine/src/sandbox.py
    - packages/engine/src/monitor.py
    - packages/engine/tests/__init__.py
    - packages/engine/tests/test_sandbox.py

key-decisions:
  - "cgroups v2 transient scope with /sys/fs/cgroup/cloudjudge/sub_{id} for sub-millisecond setup"
  - "Graceful OS fallback to setrlimit when cgroups v2 is not writable, preserving seamless local macOS dev while locking Linux prod"
  - "Preexec unshare --net flag on Linux to guarantee absolute zero network egress during submission runs"

patterns-established:
  - "IsolationSandbox.run() wraps command inside transient cgroup scope, supervises with ProcessWatcher, and auto-destroys on exit"
  - "ExecutionResult and ExecutionVerdict standard contract returned by all runners"

requirements-completed:
  - SAND-01

coverage:
  - id: D1
    description: "Multi-language isolated execution sandbox with Linux cgroups (256MB RAM, 1 CPU quota, network disabled)"
    requirement: "SAND-01"
    verification:
      - kind: unit
        ref: "packages/engine/tests/test_sandbox.py"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-02
status: complete
---

# Phase 01 Plan 01: Isolated Sandbox & Cgroups Controller Summary

**Engine package scaffolded with Linux cgroups v2 transient scopes, unshare network drops, 256MB RAM / 1 CPU caps, and process supervision.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-02T22:22:30Z
- **Completed:** 2026-10-02T22:25:10Z
- **Tasks:** 3 completed
- **Files modified:** 8

## Accomplishments

- Established `packages/engine` package with strongly-typed `ExecutionResult`, `ExecutionVerdict`, and `ResourceLimits`.
- Built `CgroupV2Manager` applying `memory.max` (256MB), `cpu.max` (100% quota), and `pids.max` (64) with automatic teardown.
- Built `IsolationSandbox` and `ProcessWatcher` with high-frequency telemetry, timeout enforcement, and memory breach detection.
- All unit tests passing with zero failures.

## Task Commits

1. **Task 1-3: Scaffold engine and implement cgroups v2 sandbox controller** - `b6da9d0` (feat)

**Plan metadata:** `docs(01-01): complete plan`

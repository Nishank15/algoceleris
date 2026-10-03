---
phase: 01-isolated-sandbox-multi-language-runner
plan: "02"
subsystem: runners
tags: [cpp, python, runners, output-diff, compilation, comparator]

requires: [01-01]
provides:
  - BaseRunner ABC with compile/execute lifecycle and standard error encapsulation
  - CppRunner with g++ -O3 -std=c++20 compilation and sandboxed binary execution
  - PythonRunner with unbuffered (-u -B) execution and cleaned traceback classification
  - OutputComparator with whitespace-normalized, tokenized line comparison and unified diff generation
affects: [01-03-PLAN, Phase 2]

actuals:
  tokens: 1950
  tasks: 3
  commits: 1

tech-stack:
  added: [g++, python3, difflib]
  patterns: [runner-abc, tokenized-diff, compiler-diagnostics, traceback-sanitization]

key-files:
  created:
    - packages/engine/src/runners/__init__.py
    - packages/engine/src/runners/base.py
    - packages/engine/src/runners/cpp.py
    - packages/engine/src/runners/python.py
    - packages/engine/src/comparator.py
    - packages/engine/tests/test_runners.py
  modified:
    - packages/engine/src/sandbox.py

key-decisions:
  - "CppRunner compiles with -O3 -std=c++20 -Wall -Wextra with 15s compiler timeout to prevent malicious preprocessor expansion"
  - "PythonRunner executes with -u (unbuffered) and -B (no .pyc) for clean I/O streaming and tamper-proof runtime environments"
  - "OutputComparator normalizes CRLF line endings, trims trailing whitespace, collapses inter-token whitespace per line, and produces unified diffs for mismatches"
  - "Preserve system environment variables (SDKROOT, TMPDIR) in clean_env on Darwin hosts while maintaining minimal environment for Linux sandboxes"

patterns-established:
  - "Language runners inherit from BaseRunner and delegate execution to IsolationSandbox"
  - "Execution verdicts comprehensively map to ACCEPTED, COMPILATION_ERROR, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED, RUNTIME_ERROR, and WRONG_ANSWER"

requirements-completed:
  - SAND-02
  - SAND-03

coverage:
  - id: D2
    description: "C++ (gcc:latest / C++20) runner with compilation error diagnostics and sandboxed execution"
    requirement: "SAND-02"
    verification:
      - kind: unit
        ref: "packages/engine/tests/test_runners.py::TestCppRunner"
        status: pass
    human_judgment: false
  - id: D3
    description: "Python 3.12 runner with unbuffered execution, MemoryError classification, and traceback cleanup"
    requirement: "SAND-03"
    verification:
      - kind: unit
        ref: "packages/engine/tests/test_runners.py::TestPythonRunner"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-02
status: complete
---

# Phase 01 Plan 02: C++ & Python Runners with Output Comparator Summary

**C++20 and Python 3 runners implemented with compiler diagnostics, runtime exception classification, and whitespace-normalized output diffing.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-02T22:27:00Z
- **Completed:** 2026-10-02T22:33:00Z
- **Tasks:** 3 completed
- **Files created/modified:** 7
- **Tests passing:** 14/14 runner tests, 20/20 total engine tests

## Accomplishments

- Built `BaseRunner` abstract contract defining compilation and execution lifecycles.
- Built `CppRunner` supporting `g++ -O3 -std=c++20` with compiler diagnostic extraction and sandboxed execution.
- Built `PythonRunner` supporting unbuffered `-u -B` execution, syntax validation, and traceback sanitization.
- Implemented `OutputComparator` with CRLF normalization, whitespace tolerance, and unified diff output.
- All 20 engine unit tests passing with zero failures.

## Task Commits

1. **Task 1-3: Implement cpp and python runners with output comparator** - `c011c67` (feat)

**Plan metadata:** `docs(01-02): complete plan`

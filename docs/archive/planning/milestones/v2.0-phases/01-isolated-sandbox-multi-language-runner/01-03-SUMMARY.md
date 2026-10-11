---
phase: 01-isolated-sandbox-multi-language-runner
plan: "03"
subsystem: evaluator
tags: [java, jvm, evaluator, multi-testcase, sandbox, batch-runner]

requires: [01-02]
provides:
  - JavaRunner for Java 21 with bounded heap (-Xmx256m -Xms64m -XX:+UseSerialGC) and OutOfMemoryError detection
  - JudgeEvaluator multi-testcase evaluation engine with single-compilation and per-testcase execution
  - SubmissionReport with aggregated verdict, metrics, and granular TestCaseResult list
  - Public engine API exports in packages/engine/src/__init__.py
affects: [Phase 2, Phase 3]

actuals:
  tokens: 2150
  tasks: 3
  commits: 1

tech-stack:
  added: [java, javac, serial-gc]
  patterns: [single-compilation-multi-execution, short-circuit-evaluation, delta-rusage-monitoring]

key-files:
  created:
    - packages/engine/src/runners/java.py
    - packages/engine/src/evaluator.py
    - packages/engine/tests/test_java.py
    - packages/engine/tests/test_evaluator.py
  modified:
    - packages/engine/src/__init__.py
    - packages/engine/src/runners/__init__.py
    - packages/engine/src/monitor.py

key-decisions:
  - "JavaRunner extracts class name via regex (supporting custom class names or default Solution) and compiles with UTF-8 encoding"
  - "JVM options locked to -Xmx256m -Xms64m -XX:+UseSerialGC -XX:ActiveProcessorCount=1 -Dfile.encoding=UTF-8 to prevent runaway threads or memory"
  - "JudgeEvaluator compiles C++ and Java sources exactly once per submission and evaluates all test cases sequentially against the cached binary"
  - "ProcessWatcher computes differential rusage (rusage_after - rusage_before) preventing cumulative multi-test process execution leakage"

patterns-established:
  - "SubmissionJob -> JudgeEvaluator.evaluate() -> SubmissionReport standard engine contract"
  - "Short-circuit evaluation on compilation error and optional early termination on failing test cases"

requirements-completed:
  - SAND-04

coverage:
  - id: D4
    description: "Java 21 OpenJDK runner with heap constraint (-Xmx256m), single-compilation batch evaluation, and SubmissionReport generation"
    requirement: "SAND-04"
    verification:
      - kind: unit
        ref: "packages/engine/tests/test_java.py"
        status: pass
      - kind: integration
        ref: "packages/engine/tests/test_evaluator.py"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-02
status: complete
---

# Phase 01 Plan 03: Java 21 Runner & JudgeEvaluator Engine Summary

**Java 21 runner with bounded heap (-Xmx256m) and complete multi-testcase JudgeEvaluator engine evaluating C++, Python, and Java submissions.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-02T22:34:00Z
- **Completed:** 2026-10-02T22:40:00Z
- **Tasks:** 3 completed
- **Files created/modified:** 7
- **Tests passing:** 32/32 tests across 4 test suites

## Accomplishments

- Implemented `JavaRunner` with automatic public class name extraction, UTF-8 compilation, serial GC, and bounded 256MB heap cap.
- Built `JudgeEvaluator` orchestrating compilation once per submission, sequential test case evaluation, diff calculation via `OutputComparator`, and short-circuit failure handling.
- Enhanced `ProcessWatcher` with differential POSIX child rusage tracking to guarantee accurate per-testcase execution times and peak memory tracking without cross-test accumulation.
- Exposed public engine interface through `packages/engine/src/__init__.py`.
- End-to-end integration test battery validated across C++, Python, and Java.

## Task Commits

1. **Task 1-3: Implement java runner and multi-testcase judge evaluator** - `b2b11fd` (feat)

**Plan metadata:** `docs(01-03): complete plan`

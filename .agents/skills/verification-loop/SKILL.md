---
name: verification-loop
description: "Executes test-driven verification loops and automated regression checks before declaring task completion."
---

# Eval-Driven Verification Protocol

You are prohibited from signaling task completion (finish_task) or generating a PR summary until the implementation passes the complete verification loop:

## Phase 1: Test-First Regression Capture
1. Write a focused unit test exposing the bug or verifying the requested feature.
2. Run the test suite via run_command and confirm the test fails as expected.
3. If the test passes before implementation changes are made, the test is invalid. Rewrite it.

## Phase 2: Implementation & Green Verification
1. Apply the minimal code changes necessary to satisfy the test.
2. Run the test suite again and confirm all tests pass cleanly.

## Phase 3: Project-Wide Sanity Check
1. Run the workspace typechecker (tsc --noEmit, mypy, or cargo check).
2. Run the repository linter.
3. Run the complete existing regression test suite to ensure no regressions were introduced.
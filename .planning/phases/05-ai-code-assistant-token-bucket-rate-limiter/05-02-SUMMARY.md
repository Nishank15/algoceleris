---
phase: 05-ai-code-assistant-token-bucket-rate-limiter
plan: "02"
subsystem: ai/assistant
tags: [gemini-2.5-flash, ai-debugging, structured-output, diff-viewer, pro-entitlement]
key_files:
  - packages/gateway/src/ai/__init__.py
  - packages/gateway/src/ai/models.py
  - packages/gateway/src/ai/assistant.py
  - packages/gateway/src/ai/router.py
  - packages/gateway/src/api.py
  - packages/gateway/tests/test_ai_assistant.py
  - packages/frontend/src/types.ts
  - packages/frontend/src/services/api.ts
  - packages/frontend/src/components/AIDebugModal.tsx
  - packages/frontend/src/components/TestConsole.tsx
  - packages/frontend/src/App.tsx
verification:
  - python3 -m unittest packages/gateway/tests/test_ai_assistant.py
  - python3 -m unittest discover -s packages/gateway/tests
  - python3 -m unittest discover -s packages/engine/tests && python3 -m unittest discover -s packages/worker/tests
  - npm --prefix packages/frontend run build
---

# Plan 05-02 Summary: Gemini 2.5 Flash AI Assistant & One-Click Diff Repairs

## Objective
Implemented the Gemini 2.5 Flash AI Code Assistant backend service and Linear midnight dark frontend debugging workflow with root-cause analysis, complexity inspection, and single-click diff fixes (`AI-01`).

## Key Implementations

### 1. Structured Debugging Contract & Models (`packages/gateway/src/ai/models.py`)
- **`AIDebugRequest`**: Strongly typed payload capturing user ID, programming language, failing source code, problem statement and constraints, failing test cases (with actual vs expected output), and compiler/runtime diagnostics.
- **`AIDebugResponse`**: Structured output schema guaranteeing:
  - `root_cause`: Crisp diagnosis of algorithmic or boundary defect.
  - `complexity_analysis`: Time & space complexity comparison against target constraints.
  - `fix_explanation`: Algorithmic correction notes.
  - `fixed_code`: Syntactically correct complete replacement code.
  - `code_diff`: Standard unified diff patch format.

### 2. Gemini 2.5 Flash Assistant Service (`packages/gateway/src/ai/assistant.py`)
- **`GeminiDebugAssistant`**:
  - Leverages Google GenAI SDK (`google-genai`) with system instructions optimized for competitive programming algorithmic analysis.
  - Enforces JSON structured output with Pydantic response schema.
  - Provides deterministic offline mock fallback when `GEMINI_API_KEY` is omitted, guaranteeing 100% test suite reliability without external network dependencies.
  - Generates unified diffs using Python's `difflib.unified_diff`.

### 3. API Router & Pro Tier Gate (`packages/gateway/src/ai/router.py`)
- **`POST /api/v1/ai/debug`**:
  - Pro tier entitlement gate: Blocks Free tier users with HTTP 403 Forbidden and upgrade guidance payload (`upgrade_url: "/pricing"`).
  - Quota enforcement: Integrates `RateLimiter("ai_debug")` restricting Pro users to 10 debug calls per minute, returning HTTP 429 when quota is exhausted.
  - Mounted onto `/api/v1/ai` in `packages/gateway/src/api.py`.

### 4. Linear Midnight Dark Frontend Workflow
- **`AIDebugModal.tsx`**:
  - Sleek midnight dark interface (`bg: #0f1015`, subtle purple/indigo glow).
  - Categorized diagnosis cards for Root Cause, Complexity Inspection, and Fix Explanation.
  - Interactive syntax-highlighted unified diff preview (red deletions, green additions).
  - Single-click "Apply Fix to Editor" button that directly applies `fixed_code` into the Monaco editor buffer.
- **`TestConsole.tsx`**:
  - Contextual "AI Debug" button with Sparkles icon appearing whenever tests fail, runtime errors occur, or compilation aborts.
- **`App.tsx`**:
  - Free tier users clicking "AI Debug" trigger the `PricingModal` with seamless Stripe / Razorpay Pro upgrade paths.
  - Pro users get instant automated diagnosis with diff preview and one-click code replacement.

## Verification
- Unit & integration tests (`test_ai_assistant.py`): 6/6 tests passed.
- Gateway test suite: 38/38 tests passed.
- Full repository regression suite: 74/74 tests passed with 0 failures.
- Frontend production bundle build (`tsc && vite build`): Succeeded in 3.62s with zero TypeScript errors.

## Self-Check: PASSED
All artifacts created and verified on disk, tests passing, production build clean.

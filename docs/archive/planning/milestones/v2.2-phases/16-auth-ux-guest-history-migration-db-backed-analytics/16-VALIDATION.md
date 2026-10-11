---
phase: "16"
slug: "auth-ux-guest-history-migration-db-backed-analytics"
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-10-05"
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Python `unittest` (Gateway) + TypeScript/Vite (Frontend) |
| **Config file** | `packages/gateway/pyproject.toml` / `packages/frontend/vite.config.ts` |
| **Quick run command** | `USE_IN_MEMORY_RATE_LIMIT=true python3 -m unittest packages/gateway/tests/test_profile_analytics.py packages/gateway/tests/test_guest_migration.py` |
| **Full suite command** | `USE_IN_MEMORY_RATE_LIMIT=true python3 -m unittest discover packages/gateway/tests && npm --prefix packages/frontend run build` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick test command
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | UX-02 | T-16-01 | Rejects unauthenticated migration requests with 401 | unit | `USE_IN_MEMORY_RATE_LIMIT=true python3 -m unittest packages/gateway/tests/test_guest_migration.py` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | UX-03 | — | Aggregates distinct ACCEPTED problems by difficulty | unit | `USE_IN_MEMORY_RATE_LIMIT=true python3 -m unittest packages/gateway/tests/test_profile_analytics.py` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 1 | UX-04, UX-05 | — | Calculates contest rating progressions & 365d daily skyline counts | unit | `USE_IN_MEMORY_RATE_LIMIT=true python3 -m unittest packages/gateway/tests/test_profile_analytics.py` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 2 | UX-01 | — | 150ms debounced checks on username/email with Emerald/Coral Red badges | build/unit | `npm --prefix packages/frontend run build` | ✅ | ⬜ pending |
| 16-02-02 | 02 | 2 | UX-02 | — | Automatically migrates localStorage submissions post-signup | build/unit | `npm --prefix packages/frontend run build` | ✅ | ⬜ pending |
| 16-02-03 | 02 | 2 | UX-03, UX-04, UX-05 | — | Fetches authentic DB analytics on ProfilePage and renders 3D skyline | build/unit | `npm --prefix packages/frontend run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/gateway/tests/test_guest_migration.py` — Stubs and test cases for guest submission migration (`UX-02`)
- [ ] `packages/gateway/tests/test_profile_analytics.py` — Stubs and test cases for profile analytics endpoints (`UX-03`, `UX-04`, `UX-05`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual badge transitions | UX-01 | Visual styling / animation check | Type in `/auth/signup` and observe Emerald / Coral Red badge appearance after 150ms |
| 3D Skyline Orbit Interaction | UX-05 | Canvas / mouse orbit interaction | Open `/u/:username`, toggle 3D view, drag to orbit canvas |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-10-05

---
name: strategic-compact
description: "Monitors trajectory step depth and executes structured context compaction at logical task boundaries."
---

# Strategic Context Compaction Protocol

## Operational Mandate
Antigravity automatically initiates compaction near ~135,000 tokens. This automated threshold is phase-blind: it risks purging essential file paths, variable names, and open hypotheses mid-edit. Use this skill to execute intentional compaction at logical task boundaries.

## Boundary Decision Guidelines
- Research to Planning Transition: COMPACT. Consolidate exploration findings into a concise specification, then compact the context.
- Planning to Implementation Transition: COMPACT. Write the plan to IMPLEMENTATION_PLAN.md, then wipe exploratory history before modifying code.
- Mid-Implementation: DO NOT COMPACT. Preserve active diffs, variable declarations, and compiler outputs in context.
- Dead-End Recovery: COMPACT. If an implementation approach fails, record why it was abandoned, clear failed code trails, and restart.

## Compaction Checklist
1. Persist current session status to .agents/memory/ACTIVE_SESSION.md.
2. Document completed milestones and list remaining deliverables.
3. Call /compact or provide a consolidated handoff prompt before launching subsequent subagents.
---
trigger: always_on
---

cat << 'EOF' > .agents/rules/event-bus-guidelines.md
---
trigger: model_decision
description: Schema validation, DLQ backoff, and idempotent transaction boundaries for distributed pipelines
---

# Event-Bus & Message Pipeline Guidelines

## Operational Mandate
All asynchronous task dispatches and event bus interactions across the Redis broker, worker daemons, and WebSocket channels must maintain strict reliability guarantees.

## Core Requirements
1. **Payload Schema Validation**: All message payloads published over Redis queues must validate against strict Pydantic or JSON Schemas before dispatch.
2. **Idempotent Workers**: Worker processing must be idempotent, using submission UUIDs to prevent duplicate execution side-effects.
3. **Dead-Letter Queue (DLQ) & Backoff**: Failed evaluations or unhandled exceptions must transition to a DLQ with exponential backoff rather than stalling the queue.
EOF
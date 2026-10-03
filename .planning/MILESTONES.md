# Milestones

## v2.0 Commercial Launch & Complete Platform (Shipped: 2026-10-03)

**Phases completed:** 7 phases, 20 plans, 18 tasks

**Key accomplishments:**
- Engine package scaffolded with Linux cgroups v2 transient scopes, unshare network drops, 256MB RAM / 1 CPU caps, and process supervision.
- C++20 and Python 3 runners implemented with compiler diagnostics, runtime exception classification, and whitespace-normalized output diffing.
- Java 21 runner with bounded heap (-Xmx256m) and complete multi-testcase JudgeEvaluator engine evaluating C++, Python, and Java submissions.
- FastAPI submission gateway and Redis queue broker with strict Pydantic payload validation and asynchronous job ingestion.
- Worker daemon pool consuming jobs from the Redis submission queue, evaluating via the sandboxed JudgeEvaluator, and streaming live Pub/Sub events.
- Live WebSocket streaming broadcaster delivering real-time per-testcase execution feedback and telemetry directly to connected clients.
- Commercial subscription billing with Stripe and Razorpay dual payment gateways, cryptographic signature verification, and automated entitlement provisioning.
- Gemini 2.5 Flash AI code debugging assistant providing structured root-cause analysis and code diffs, protected by Redis Token-Bucket rate limiting.
- Real-time contest engine with ICPC 20-min penalty scoring, Redis Sorted Set O(log N) live leaderboards, and fullscreen/clipboard anti-cheat proctoring.
- Post-contest AST Winnowing plagiarism detection engine, 21st.dev 3D isometric submission skyline heatmap, tumbling cube loader, and HAProxy Layer 7 reverse proxy.

---

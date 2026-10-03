# Milestones

## v2.1 LeetCode-Grade Multi-Page Architecture & Refero Linear Midnight Platform (Shipped: 2026-10-04)

**Phases completed:** 5 phases, 10 plans, 0 tasks

**Key accomplishments:**
- Precision Refero Linear Midnight design system with Bedrock Void, Carbon, Obsidian, and hairline Graphite tokens, typography capped at ≤ 590 weights, and zero purple/violet gradients.
- Client-side routing with react-router-dom and unified LinearHeaderNav with live gateway latency indicator and guest/user status.
- Minimalist hero landing page with live benchmark telemetry (<15ms cold start, 256MB cap, 1 vCPU, air-gapped network) and interactive micro-sandbox runner teaser.
- Centered Carbon authentication views with guest login bypass and session persistence via AuthContext.
- High-density LeetCode problem catalog at /problems with 12 classic problems, sub-50ms reactive search, difficulty pills (Pulse Green, Amber, Coral Red), and topic taxonomy strip.
- Distraction-free 3-pane Monaco IDE workspace at /problems/:slug with LeetCode class Solution stubs across C++20, Python 3.12, Java 21, and Acid Lime primary submit action.
- Side-by-side testcase diff viewer with token mismatch highlights and 10-second client execution watchdog preventing hung evaluation states.
- Full-page developer profile at /u/:username with 21st.dev 3D isometric skyline, contest rating progression chart, and circular solved breakdown ring.
- Full-page contests hub at /contests with active/upcoming live countdown clocks, persistent registration toggle, and real-time Redis Sorted Set leaderboards with ICPC penalties.

---

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

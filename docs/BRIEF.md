# Cloud-Judge V2 Vision & Feature Requirements

A production-grade, commercial online judge platform with a Linear-style midnight dark design.

## Core Capabilities
- Multi-language sandbox: C++ (gcc:latest), Python 3.12, Java 21 with Linux cgroups (256MB RAM, 1 CPU, no network).
- Asynchronous queue pipeline: FastAPI gateway + Redis broker + Worker daemon pool.
- Real-time streaming: WebSockets replacing polling for live test case execution feedback.
- Frontend IDE: Next.js/Vite with Monaco Editor, 3-pane resizable layout, and Zen/Normal mode toggle.

## Commercial & Competition Features
- Tiered Subscriptions: Free vs. Pro tiers with dual payment gateways (Stripe + Razorpay).
- AI Code Assistant: Debugging suggestions backed by Gemini 2.5 Flash with Redis Token-Bucket rate limiting.
- Contest Engine & Proctoring: Live Redis-backed leaderboard (Sorted Sets), Fullscreen enforcement with exit-warning detection, and clipboard copy/paste disablement.
- Post-contest Plagiarism: AST-based Winnowing / MOSS plagiarism check daemon.
- Analytics: 3D Isometric contribution activity heatmap and custom isometric cube loader.
- Load Balancing: HAProxy Layer 7 reverse proxy for high-throughput traffic distribution.
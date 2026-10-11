---
phase: 04-commercial-subscriptions-dual-payment-gateways
plan: "03"
subsystem: gateway/razorpay
tags: [razorpay, hmac-sha256, signature-verification, webhook, dual-gateway]

requires: [04-01, 04-02]
provides:
  - RazorpayService for order creation, payment signature verification, and webhook verification
  - POST /api/v1/subscriptions/razorpay/create-order endpoint returning order_id and key_id for client-side checkout
  - POST /api/v1/subscriptions/razorpay/verify-payment endpoint with cryptographic HMAC-SHA256 verification granting immediate Pro entitlement
  - POST /api/v1/subscriptions/razorpay/webhook endpoint verifying X-Razorpay-Signature
  - Frontend api.ts client createRazorpayOrder and verifyRazorpayPayment methods
  - Automated test suite in test_razorpay_integration.py (5 tests passing)
affects: [Phase 5]

actuals:
  tokens: 2200
  tasks: 3
  commits: 1

tech-stack:
  added: [razorpay-hmac-sha256-verification]
  patterns: [cryptographic-signature-verification, order-payment-fulfillment, dual-gateway-architecture]

key-files:
  created:
    - packages/gateway/src/subscriptions/razorpay_service.py
    - packages/gateway/tests/test_razorpay_integration.py
  modified:
    - packages/gateway/src/subscriptions/models.py
    - packages/gateway/src/subscriptions/router.py
    - packages/frontend/src/services/api.ts

key-decisions:
  - "Implemented native HMAC-SHA256 signature verification for order_id|payment_id using constant-time comparison (hmac.compare_digest)"
  - "Created Razorpay order endpoint supporting INR amounts in paise (149900 paise = ₹1,499.00)"
  - "Integrated X-Razorpay-Signature webhook validation for asynchronous payment.captured fulfillment"

patterns-established:
  - "Unified EntitlementResponse and SubscriptionStore across both Stripe and Razorpay payment providers"

requirements-completed:
  - SUB-03

coverage:
  - id: SUB3
    description: "User can upgrade to Pro via Razorpay payment gateway with verified signature and webhook fulfillment"
    requirement: "SUB-03"
    verification:
      - kind: unit
        ref: "packages/gateway/tests/test_razorpay_integration.py"
        status: pass
      - kind: build
        ref: "packages/frontend/src/services/api.ts"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-10-02
status: complete
---

# Phase 04 Plan 03: Razorpay Payment Gateway & HMAC Verification Summary

## Overview

Plan 03 completed the dual-gateway monetization architecture with native Razorpay integration:
- **RazorpayService**: Created order generation (`create_order`), cryptographic HMAC-SHA256 payment signature verification (`verify_payment_signature`), and webhook body verification (`verify_webhook_signature`).
- **FastAPI Endpoints**: Implemented `POST /api/v1/subscriptions/razorpay/create-order`, `POST /api/v1/subscriptions/razorpay/verify-payment`, and `POST /api/v1/subscriptions/razorpay/webhook`.
- **Frontend Integration**: Added `createRazorpayOrder` and `verifyRazorpayPayment` in `packages/frontend/src/services/api.ts` wired to `PricingModal.tsx`.
- **Test Suite**: Verified via `test_razorpay_integration.py` (5 tests passing) with all 61 repository tests passing.

---
phase: 04-commercial-subscriptions-dual-payment-gateways
date: 2026-10-02
status: approved
tags: [pricing-modal, pro-badge, stripe, razorpay, dual-currency, linear-design]
---

# UI Design Contract: Commercial Subscriptions & Pricing Matrix

**Linear-style midnight dark pricing modal, dual-currency support ($ USD vs ₹ INR), tier entitlement matrix, and checkout flows for Stripe & Razorpay.**

---

## 1. Visual Hierarchy & Pricing Card Structure

### Color & Elevation Palette
- **Modal Overlay Backdrop:** `rgba(9, 11, 16, 0.85)` with `backdrop-filter: blur(12px)`
- **Modal Card Surface:** `--bg-surface` (`#0f121a`), border `--border-subtle` (`rgba(255, 255, 255, 0.08)`)
- **Pro Tier Highlight Card:**
  - Border: `1px solid rgba(99, 102, 241, 0.5)`
  - Shadow: `0 0 30px rgba(99, 102, 241, 0.15)`
  - Badge: Gradient `linear-gradient(135deg, #6366f1 0%, #a855f7 100%)` with text `MOST POPULAR`
- **Feature Icons:**
  - Included feature: Emerald green checkmark (`#10b981`)
  - Excluded / Free tier limit: Muted grey dash or minus (`#64748b`)

---

## 2. Currency Switcher

- Switcher located at top of pricing modal:
  - `[ $ USD ]` | `[ ₹ INR ]`
- Rates:
  - **USD:** $19 / month (billed monthly)
  - **INR:** ₹1,499 / month (billed monthly)

---

## 3. Tier Comparison Matrix

| Feature | Free Tier ($0 / mo) | Pro Tier ($19 / ₹1,499 mo) |
|---|---|---|
| **Sandbox Execution** | Standard Queue | **Priority Fast-Lane Queue** |
| **Submissions Rate Limit** | 5 submissions / min | **Unlimited Submissions** |
| **Execution Diagnostics** | Basic stdout/stderr | **Deep Memory & CPU Telemetry Profiling** |
| **AI Debugging Assistant** | Locked (Pro only) | **Full Gemini 2.5 Flash Fix Explanations & Diffs** |
| **Contest Participation** | All Public Contests | **Public + Exclusive Pro Contests** |
| **Plagiarism Audit** | Basic Check | **AST Fingerprinting Immunity Pre-Check** |

---

## 4. Payment Provider Actions

1. **Stripe (Global & Credit Cards):**
   - Button text: `Upgrade with Stripe`
   - Gradient indigo styling (`--accent-gradient`)
   - Suitable for USD and international credit cards.
2. **Razorpay (India & Regional):**
   - Button text: `Upgrade with Razorpay (UPI / NetBanking / Cards)`
   - Emerald / Blue accent button
   - Instant verification via client-side callback and HMAC-SHA256 signature verification.
3. **Pro Badge in Header:**
   - Active Pro users display `[PRO]` gradient badge in top navbar.
   - Free users display `[✦ Upgrade to Pro]` button.

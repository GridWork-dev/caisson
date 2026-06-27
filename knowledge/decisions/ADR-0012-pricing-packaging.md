# ADR-0012 — Pricing & packaging model

Status: proposed · 2026-06-27 (Phase 5 spec; pending Gate 4 — numbers are working, refine pre-launch)

Forge sells the **same library three ways at once** (the market gap: no per-module commerce, and
one-time products have no durable MRR):

- **Whole editions, one-time** (own-the-code psychology, dominant model): Compliance $899–1,499 ·
  AI Production Kit $399–699 · Local-first AI $349–599 · Agentic-Dev $349–599. Anchored on Clynova
  compliance $999–1,999 (compliance dev-kits clear 5–10× generic) and generic $199–599.
- **Bundle** (higher AOV): base + all editions ~$1,999–2,499.
- **Per-module à-la-carte** ($49–199/module) — the unserved "buy auth/billing/audit separately" gap.
- **Subscription** ($49–199/mo or annual) — **the MRR fix**: a monthly **credit allotment**
  (codegen + AI-feature) + **compliance-framework updates** (the #1 retention lever in the market)
  + private-registry pulls + priority support SLA + new-edition access. **Grandfather** existing
  buyers on price increases (forced uplift is the top voluntary-churn driver).
- **Open-core flank:** Local-first AI core AGPL → monetize license kit + hosted-inference/GPU
  credits + pro modules (ADR-0010).

Value-add tiers (from `support-strategy.md`): base one-time = private repo + lifetime updates +
Discord + AGENTS.md/MCP bundle + AI docs; bundle = + onboarding call + course + component kit +
AI Production Kit; subscription = priority SLA + credits + framework updates. AppSumo only for a
zero-audience launch (30–50% rev share + low price anchor); otherwise self-serve via Merchant-of-Record.

Rejected: subscription-only (buyers resist for code they want to own; comparison sites penalize it).
One-time-only (the documented "revenue dry spell" — ShipFast's named weakness). AppSumo as a primary
channel (anchors price low, deal-hunter churn).

Binding: every edition is also purchasable as its component modules; the subscription's credits
debit the ADR-0007 wallet; price changes grandfather existing buyers.

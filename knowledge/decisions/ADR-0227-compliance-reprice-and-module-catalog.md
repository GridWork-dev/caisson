# ADR-0227 — commerce: compliance reprice to $799 + per-module sandbox catalog now

**Status:** accepted · 2026-07-02 (third picker round of the day, operator-locked).
**Relates:** **supersedes the ADR-0137 compliance $749 point-value** (the ADR-0137
below-sum invariant is KEPT and re-verified below; the other edition numbers hold) ·
ADR-0106 / ADR-0116 (go-live commerce wiring — Paddle-side changes ride the commerce
execution wave) · ADR-0082 (committed-prices posture — the site shows committed numbers,
so a reprice is an ADR-level act, not a copy tweak) · ADR-0129 (the module point-value
sheet, unchanged) · ADR-0205 (compliance runtime composition — display member lists
deliberately NOT re-cut to match it) · ADR-0131 / ADR-0200 (the cart + Paddle checkout the
per-module catalog feeds) · ADR-0113 (one-time purchase grants the module SKUs resolve to).

## Context

ADR-0137 locked every edition strictly below its module-sum and set Compliance at $749.
The display member sheet for Compliance now sums to **$846** (compliance-core $299 +
field-crypto $199 + audit-worm $149 + retention-runner $199), leaving the flagship edition
discounted ~11.5% below sum — deeper than the operator wants. Separately, the pricebook
carries **placeholder Paddle price ids for the per-module SKUs**
(`packages/pricebook/src/purchases.ts` — only the edition/credit-pack rows have real
sandbox `pri_` ids): per-module checkout is untestable until the products/prices exist in
a Paddle account. The tabled recommendation was to guard the module rows until the
production catalog exists at the commerce flip; the operator overrode it.

## Decision (operator-locked)

- **Compliance edition one-time price: $749 → $799.** Member-sum on the display sheet is
  $846; $799 is **5.6% below sum — the ADR-0137 below-sum invariant HOLDS.** Member display
  lists are unchanged: `alerting` stays displayed under ai-kit despite the ADR-0205 runtime
  composition (the display sheet and the runtime composition are different artifacts, and
  re-cutting the sheet would re-open every edition's sum). The other edition numbers
  (AI-Kit $599 · Agentic-Dev $249 · Local-first $349 · Bundle $1,499) hold per ADR-0137.
- **Execution boundary:** the Paddle-side price change + the `apps/site/lib/pricing.ts`
  display change (`amount: 749` → `799`) ride the **commerce execution wave, NOT the docs
  PR that files this ADR.** This ADR is the lock; no price code/copy lands with it.
- **Per-module checkout posture (OPERATOR OVERRIDE of the guard-now recommendation):
  CREATE all 14 per-module Paddle products/prices in the SANDBOX now and fill the
  pricebook placeholder ids.** Per-module checkout becomes testable immediately — the cart
  → multi-item Paddle checkout → webhook → one-time grant path (ADR-0131/0200/0113) gets
  exercised on real sandbox SKUs before the flip, not first-exercised at the flip.
  **Acknowledged cost:** sandbox catalog ids do not port; the catalog must be re-created in
  the production Paddle account at the commerce flip (double data entry, accepted).

## Rejected

- **Keep Compliance at $749** — leaves the flagship edition discounted deeper below its
  member-sum than any other edition, for no positioning gain.
- **Re-cut the member display lists to match the ADR-0205 runtime composition** — would
  re-open every edition's sum arithmetic and the ADR-0137 numbers with it; display and
  runtime composition are allowed to differ.
- **Guard-now (hide/disable the per-module rows until the production catalog exists)** —
  the tabled recommendation; keeps the placeholders honest but leaves the entire
  per-module checkout path untested until the commerce flip, the riskiest possible moment
  to first-exercise it.
- **Create the catalog once, in production only, at the flip** — avoids the double entry
  but blocks all module-checkout testing until launch day.

## Consequences

- The **commerce execution wave** now carries: the 14 sandbox products/prices + pricebook
  id fill, the Compliance Paddle price at $799, and the `pricing.ts` display change. Until
  it runs, the site continues to display $749 — a known, bounded display-vs-lock gap of the
  same kind every prior reprice ADR carried between lock and execution.
- **Double catalog entry accepted** (sandbox now, production at the flip) — the price of
  immediate end-to-end testability of per-module checkout.
- The below-sum invariant survives supervision: any future member-sheet change that drops
  the Compliance sum below $799 re-opens this number (same rule ADR-0137 established).
- Grandfathering stays operator-owned per ADR-0106/0137 — untouched here.

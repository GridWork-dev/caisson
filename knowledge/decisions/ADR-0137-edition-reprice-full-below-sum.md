# ADR-0137 — Edition reprice: every edition below its module-sum (Q4 lock)

Status: accepted · 2026-06-30 (store-rework build wave, operator picker Q4) · **supersedes the
ADR-0129 edition point-values in full** — and with them the ADR-0106 edition numbers ADR-0129 had
carried forward · **reverses ADR-0129 §2** (the thin-edition "premium above module-sum" thesis):
every edition is now priced _below_ its module-sum · keeps the ADR-0129 **module** price sheet
unchanged · extends ADR-0106 grandfathering (forward-only, per-SKU) · the display numbers this ADR
locks live in `apps/site/lib/pricing.ts`; commerce-truth SKUs in `@caisson/pricebook`. Append-only;
supersede with a later ADR, never edit.

## Context

ADR-0129 priced modules value-based and made **fat** editions (AI Production Kit) discounted bundles,
but held **thin** editions as value-anchored premiums _above_ their module-sum — Compliance at $2,499
against a 3-module sum of $647, the Everything Bundle at $2,999. Shown the full storefront (ADR-0130:
every edition + module visible at once with real prices), the operator judged the premium-above-sum
optics wrong for a self-serve buyer comparing an edition card directly against its module cards on the
same page, and locked the opposite rule: **price every edition below the sum of its modules**, so each
edition reads as an honest bundle discount. This is a deliberate ~70% cut on the flagship + bundle, not
a math correction.

## Decision

**Every edition is a discounted bundle priced below its module-sum. Final locked edition points:**

| Edition           | Module-sum (intended)                                                                                     | ADR-0129 | **This ADR**    | Off-sum |
| ----------------- | --------------------------------------------------------------------------------------------------------- | -------- | --------------- | ------- |
| Compliance        | $995 (`compliance` 299 + `field-crypto` 199 + `audit-worm` 149 + `alerting` 149 + `retention-runner` 199) | $2,499   | **$749**        | ~25%    |
| AI Production Kit | $795 (`ai-kit` 149 + `ai-meter` 199 + `ai-evals` 199 + `guardrails` 149 + `prompt-registry` 99)           | $599     | **$599** (hold) | ~25%    |
| Agentic-Dev       | $298 (`agent-kernel` 199 + `agent-dev` 99)                                                                | $499     | **$249**        | ~16%    |
| Local-first AI    | $398 (`local-ai` 299 + `local-store` 99)                                                                  | $399     | **$349**        | ~12%    |
| All-Access Bundle | $1,946 (edition-sum 749 + 599 + 249 + 349)                                                                | $2,999   | **$1,499**      | ~23%    |

- **Module prices are unchanged** from the ADR-0129 sheet (12 built + the two ADR-0135 harvest modules
  `alerting` $149 / `retention-runner` $199, pending).
- **Compliance's $995 basis is the intended 5-module edition** — it counts the two `alerting` /
  `retention-runner` modules the ADR-0135 harvest adds. At launch the edition ships 3 built modules
  (`compliance` + `field-crypto` + `audit-worm` = $647), so $749 sits slightly _above_ the built-3 sum
  but _below_ the intended-5 sum: the price anticipates the completed compliance program, consistent
  with ADR-0129 §"the edition price buys the whole program, not three packages".
- **Bundle savings vs. edition-sum = $447** (1,946 − 1,499), the truthful figure the storefront shows;
  no fabricated per-edition "was/strikethrough" anchors (the site never charged the old numbers —
  ADR-0130 honesty floor).
- **Grandfathering (ADR-0106, forward-only):** one-time buyers lock their purchase price + version
  forever; this reprice is forward-only and never claws back or re-bills an existing buyer.

## Why

- **On a single storefront page (ADR-0130), an edition priced above the sum of the modules shown right
  beside it reads as a penalty, not a bundle.** The whole point of showing modules and editions
  together is to let the buyer see the edition as the better deal — which requires it to actually be
  cheaper than buying the parts.
- **The flagship cut is a demand bet, not a margin concession.** At $749 Compliance still displaces
  Vanta/Drata's $10-15K/yr; the operator chose volume + an accessible entry point over a premium anchor
  that the à-la-carte modules visibly undercut.
- **Below-sum on all four is coherent today without waiting for the harvest** — unlike ADR-0129's
  interim, which needed the harvest to fatten thin editions before their bundle math worked.

## Confidence + revisit

**MEDIUM** — figures are operator-locked and research-adjacent (ADR-0129 comparables) but not
WTP-validated against the per-edition catalog. Revisit post-launch via a superseding ADR once real
purchase data exists. The operator retains the right to adjust a number before checkout goes live;
the storefront no longer _says_ prices are indicative (ADR-0082), so any pre-launch change is a quiet
edit, not a displayed disclaimer.

## Rejected

- **Hold ADR-0129's thin-edition premiums** — rejected by the operator on seeing the full storefront;
  the premium-above-sum optic loses the self-serve comparison.
- **Drop Compliance to ~$599** (below even the built-3 sum) — rejected; $749 holds the compliance
  program's value while still clearing below the intended 5-module sum.
- **Keep fabricated "was" strikethrough anchors to dramatize the cut** — rejected; the site never
  charged the old prices, so a struck-through anchor is a dark pattern against the ADR-0130 honesty
  floor and the guardrails module's own posture. Only the truthful bundle "Save $447" badge stands.

## Downstream (this ADR documents display numbers already landed)

- `apps/site/lib/pricing.ts` — `EDITION_PRICES` / `PLAN_PRICES` set to the locked points; `wasAmount`
  removed; `editionsSubtotal()` = 1946, `bundleSavings()` = 447.
- `@caisson/pricebook` — edition rows carry the Paddle price-ids (commerce truth); per-module Paddle
  price-ids remain placeholders until provisioned (Stage-2 ops).
- `docs/build-state.md` + `docs/state/decisions-and-forks.md` — reflect the final numbers + this ADR.

Evidence: the operator's round-2 / Q4 picker (2026-06-30, "full below-sum"); the price sheet in
`pricing-and-store-rework-plan.md`; ADR-0129 (superseded point-values) + ADR-0106 (grandfathering).

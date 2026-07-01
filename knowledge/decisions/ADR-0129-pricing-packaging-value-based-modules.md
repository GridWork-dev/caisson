# ADR-0129 — Pricing & packaging: value-based per-module à la carte + discounted edition bundles

Status: accepted · 2026-06-30 (pricing + store-rework grill session, round 1 locks #1-#4) ·
**supersedes the ADR-0106 point-values for Local-first AI ($499 → $399) and the Everything Bundle
($3,499 → $2,999)**; every other ADR-0106 number (Compliance $2,499, AI Production Kit $599,
Agentic-Dev $499, Compliance-Updates $1,499/yr, Developer $499/yr, Enterprise contact-us) is
reaffirmed unchanged · extends ADR-0012 (commerce model), ADR-0081/0082/0095 (pricing display
chain), ADR-0106 (grandfathering policy, extended here to per-module SKUs) · sets the catalog this
ADR-0130 (as-if-built) and ADR-0131 (cart) build against. Append-only; supersede with a later ADR,
never edit.

## Context

ADR-0106 locked edition-level pricing only. The store-rework grill session (round 1, two-round
operator picker) opened four packaging forks ADR-0106 never addressed: whether modules get their
own price (vs edition-only), whether editions discount against their modules, how wide the
individually-sold catalog is, and how grandfathering applies to the new per-module SKUs. A research
agent retrieved competitive comparables (Vanta/Drata, Portkey/Helicone, Braintrust, PromptLayer,
Lakera/Nightfall, IronCore/Evervault, Comp AI) for value-based per-module anchoring.

## Decision

1. **Module pricing is value-based, research-backed, per module** — not a uniform price across the
   catalog. Each module's price anchors against its closest commercial comparable (table below).
2. **Editions are discounted bundles vs. the sum of their constituent modules — for "fat" editions
   only.** AI Production Kit (5 modules) bundles at ~25% off the module-sum. **Thin editions**
   (Compliance and Local-first AI at 3 modules, Agentic-Dev at 2) are **value-anchored premiums
   ABOVE their module-sum** — their modules are à la carte **entry points** into the edition, not a
   bundle the edition discounts against. The post-go-live harvest (ADR-0133) is expected to fatten
   these three editions to 5-7 modules each, at which point they convert to clean bundle-discount
   math like AI-Kit's today. Until then, a thin edition's premium-over-sum is intentional, not a
   pricing bug.
3. **Catalog scope = all substantial commercial modules sold individually** — 12 modules (table
   below). Thin seams (`ai-config`, `tenancy-rls`, `jobs`, `email`) stay **bundle-only** — they are
   not separable products on their own and never get a standalone SKU.
4. **Grandfathering extends to every new per-module/per-edition SKU**: one-time buyers lock their
   purchase price + version forever (ADR-0106's forward-only price-lock principle, restated here
   because ADR-0106 only covered the 5 edition-level SKUs that existed at the time).

## Price sheet

### Editions

| Edition           | ADR-0106 | **This ADR**    | Basis                                                                                                                                                                                                                               |
| ----------------- | -------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compliance        | $2,499   | **$2,499 hold** | Value-anchored: displaces Vanta/Drata at $10-15K/yr; the only one-time comparable found is Comp AI at $3K. Premium exception (above module-sum, per Decision §2).                                                                   |
| AI Production Kit | $599     | **$599 hold**   | Value-leader; bundles 5 capabilities each individually priced $49-249/mo as SaaS.                                                                                                                                                   |
| Agentic-Dev       | $499     | **$499 hold**   | Agent infra is OSS-free-plus-$25/mo in the market; sits at the standard one-time-boilerplate norm.                                                                                                                                  |
| Local-first AI    | $499     | **$399**        | The vector-store comparable is free OSS (LanceDB/Chroma) — the weakest comp in the set; nudged down.                                                                                                                                |
| Everything Bundle | $3,499   | **$2,999**      | Module-sum at these prices is $3,996 ($2,499+$599+$399+$499); the prior $3,499 was only 15% off. Market bundle-discount norm (Tailwind UI, AG-Grid tiering) is 25-40% off; $2,999 = ~25% off ($997 saved), landing inside the norm. |

### Modules ($49-299 band, value-based — entry points / edition constituents)

| Module                  | Edition     | Price | Basis                                                                                |
| ----------------------- | ----------- | ----- | ------------------------------------------------------------------------------------ |
| `compliance`            | Compliance  | $299  | Frameworks/evidence flagship; no one-time comparable exists.                         |
| `field-crypto`          | Compliance  | $199  | Displaces IronCore/Evervault at $395-1,954/mo.                                       |
| `audit-worm`            | Compliance  | $149  | WORM/tamper-evident logging; market SaaS comps run $39-99/mo.                        |
| `ai-meter`              | AI-Kit      | $199  | Displaces Portkey/Helicone at $49-79/mo.                                             |
| `ai-evals`              | AI-Kit      | $199  | Displaces Braintrust at $249/mo.                                                     |
| `guardrails`            | AI-Kit      | $149  | Displaces Lakera/Nightfall-class moderation SaaS.                                    |
| `prompt-registry`       | AI-Kit      | $99   | Displaces PromptLayer at $49/mo.                                                     |
| `ai-kit` (gateway root) | AI-Kit      | $149  | The gateway chokepoint itself.                                                       |
| `local-ai`              | Local-first | $299  | Substantial package (2,209 LOC per `docs/build-state.md`); on-device inference.      |
| `local-store`           | Local-first | $99   | Embeddable hybrid vec+FTS store (market comparable is free OSS).                     |
| `agent-kernel`          | Agentic-Dev | $199  | Governed-agent kernel — the closest 1:1 lift target in the harvest sweep (ADR-0133). |
| `agent-dev`             | Agentic-Dev | $99   | Agent/skill/rule schema + lifecycle.                                                 |

**AI-Kit bundle math:** module-sum $199+$199+$149+$99+$149 = $795 vs. the $599 edition = ~25% off
($196 saved) — the one edition that already clears the fat-bundle bar at today's 5-module catalog.

## Why

- **Value-based beats uniform pricing for a 12-module catalog spanning $49-$299** — a flat price
  either underprices `compliance` (flagship, no comparable) or overprices `agent-dev` (a thin
  schema/lifecycle layer).
- **Thin-edition premiums are an honest interim, not a workaround.** Selling Compliance's three
  modules à la carte at $299+$199+$149 = $647 while the edition costs $2,499 looks inverted only
  until you read it correctly: the edition price buys the **whole compliance program** (controls
  catalog, evidence packs, the wedge positioning), not just three packages — the modules are a
  cheaper way to sample the substrate, not a discount path around the edition.
- **Bundle discount only where the math is real.** Forcing a 25%+ discount onto a 2-3-module
  edition would either gut the edition's margin or require inflating the per-module prices to make
  the math work backwards — both worse than waiting for the harvest to fatten the catalog.

## Confidence + revisit

**MEDIUM** — same caveat as ADR-0106: figures are research-anchored, not WTP-validated (no ICP
interviews, no paid pilots run against the per-module catalog specifically). Revisit post-launch via
a superseding ADR once real per-module purchase data exists.

## Rejected

- **Uniform per-module pricing** (e.g. flat $149 across all 12) — rejected; ignores the real value
  spread between a flagship `compliance` module and a thin `agent-dev` schema layer.
- **Force a bundle discount on every edition regardless of module count** — rejected (Decision §2);
  produces incoherent math on thin editions today.
- **Hold the Everything Bundle at $3,499** — rejected; once Local-first drops to $399 the bundle
  discount thins to 12.5%, below the market norm this ADR targets.

## Downstream (code/design track wires; this ADR only locks the numbers)

- `@caisson/pricebook` gains 12 new module-level price rows alongside the 5 edition rows (extends
  ADR-0089/0098's plan-book shape).
- ADR-0131 (cart + multi-item Paddle checkout) depends on every module/edition in this price sheet
  having its own Paddle price id.
- ADR-0130 (as-if-built availability) is what makes all 12 modules + 5 editions visible on the
  pricing page at once.
- `apps/site` pricing-page copy rewrite (design/code track, separate from this lock).

Evidence: `pricing-and-store-rework-plan.md` (research-backed price sheet, cited research agent,
retrieved 2026-06-30); `knowledge/decisions/ADR-0106` §"Locked pricebook"; the operator's round-1
grill session (2026-06-30).

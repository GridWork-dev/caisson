---
updated: 2026-07-05
status: live
grounds:
  - knowledge/decisions/ADR-0012-pricing-packaging.md
  - knowledge/decisions/ADR-0095-gtm-offer-structure.md
  - knowledge/decisions/ADR-0106-final-pricing-grandfathering.md
  - knowledge/decisions/ADR-0129-pricing-packaging-value-based-modules.md
  - knowledge/decisions/ADR-0137-edition-reprice-full-below-sum.md
  - knowledge/decisions/ADR-0222-public-distribution-and-catalog-completion.md
  - knowledge/decisions/ADR-0227-compliance-reprice-and-module-catalog.md
  - knowledge/decisions/ADR-0238-drop-edition-core-alacarte-rows.md
  - knowledge/decisions/ADR-0240-local-ai-price-349-canonical.md
  - knowledge/decisions/ADR-0244-perpetual-updates-window.md
  - knowledge/decisions/ADR-0245-credit-pooled-rollover-12mo.md
  - apps/site/lib/pricing.ts
  - outputs/research/gtm-market-analysis-2026-06.md
  - outputs/research/gtm-customer-acquisition.md
---

# Pricing & packaging

Caisson sells the same library four ways: whole editions (one-time), an everything bundle
(one-time), per-module à la carte, and two annual update subscriptions — plus a founder-assisted
Enterprise tier. The model exists to fix two gaps the market leaves open: no vendor sells
compliance-grade modules individually, and one-time-only code products have no recurring floor
(ADR-0012).

## Locked price matrix (current, live in `apps/site/lib/pricing.ts`)

| SKU                                                     | Price                   | Note                                                                                                                   |
| ------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Compliance** (edition, one-time)                      | **$799**                | Flagship/wedge. $749 → $799 same day as the module-sum check (ADR-0227), keeping it below its $846 member-sum by 5.6%. |
| **AI Production Kit** (edition, one-time)               | **$599**                | Unchanged since ADR-0129.                                                                                              |
| **Agentic-Dev** (edition, one-time)                     | **$249**                | ADR-0137 cut from $499.                                                                                                |
| **Local-first AI** (edition, one-time)                  | **$349**                | ADR-0137 canonical; ADR-0240 closed a manifest-comment drift flag confirming $349, not $399 — no number changed.       |
| **Everything Bundle** (base + all 4 editions, one-time) | **$1,499**              | ADR-0137; ~23% off the $1,946 edition-sum.                                                                             |
| **Per-module à la carte**                               | $49–$299                | 11 standalone modules (ADR-0238 dropped 4 edition-core rows — see below).                                              |
| **Compliance-Updates** (subscription)                   | **$1,499/yr**           | Annual cadence per ADR-0095 §3, numbers per ADR-0106.                                                                  |
| **Developer** (subscription)                            | **$499/yr**             | Same.                                                                                                                  |
| **Enterprise / SLA**                                    | **Contact us**          | No public number, founder-assisted only (ADR-0095 §2).                                                                 |
| **Credit top-up pack**                                  | **$49** (5,000 credits) | ADR-0222.                                                                                                              |
| **Agent-runner** (à la carte module)                    | **$49**                 | ADR-0222, 15th marketplace module.                                                                                     |

## The below-sum invariant

Every edition must price **below** the sum of its constituent modules — this is the current,
binding rule (ADR-0137, superseding ADR-0129's opposite "thin editions premium above sum" thesis
once the full storefront showed both edition and module cards on the same page). Discount depth
per edition, as locked:

- Compliance: $846 member-sum → $799 (5.6% off — the thinnest margin of the four; ADR-0227
  reopened this specific number after a module-sum recount pushed the old $749 to ~11.5% off,
  deeper than the operator wanted).
- AI Production Kit: $795 sum → $599 (~25% off).
- Agentic-Dev: $298 sum → $249 (~16% off).
- Local-first AI: $398 sum → $349 (~12% off).
- Everything Bundle: $1,946 edition-sum → $1,499 (~23% off, $447 saved).

**Any future change to a module's price or an edition's member list that pushes an edition's
price above its own member-sum re-opens that edition's number** — this is a standing check, not
a one-time fix (ADR-0227's own consequence clause). No fabricated "was" strikethrough anchors are
shown; the site never charged the earlier numbers, so a struck-through price would be a dark
pattern (ADR-0137).

## Module catalog: 11 standalone, not 12 or 15

ADR-0129 originally value-anchored 12 individually-sellable modules against commercial
comparables (e.g. `field-crypto` vs. IronCore/Evervault $395–1,954/mo; `ai-meter` vs.
Portkey/Helicone $49–79/mo; full comparable table in ADR-0129). ADR-0238 then **dropped 4 rows**
whose module id collided with its own parent edition id (`compliance`, `ai-kit`, `local-ai`,
`agent-dev`) — a $299 module purchase was resolving to a full $799 edition grant because
`expandEntitlements` resolves edition-first and there is no separable "core" artifact to sell
(every edition meta-package hard-depends on its commercial members). The fix was removal, not
rename: editions are how composition is bought, modules are entry points into them. Net catalog:
11 standalone modules + `agent-runner` (ADR-0222) = the current à-la-carte list in the price
matrix above. No price _number_ changed in this cut — only which rows are sellable.

`ai-evals` is `standaloneOnly`: no edition or bundle grants it (its manifest states it is not a
base service or an edition), so every "included in" surface must show it as a separate add.

## Updates window (ADR-0244, locked 2026-07-05)

One-time purchases (edition or module) are **perpetual-use**: the entitled version keeps working
forever, offline Ed25519-verified, no phone-home. Bundled with that:

- **12 months of registry-pull updates included** from purchase date (any entitled-package
  version published within `[purchase, purchase + 12 months]`, plus everything already pulled).
- **Optional renewal at ~40% of then-current list** for another 12 months of updates — exact
  per-SKU cents land at the checkout-flip session, within a 35–50% band. Non-renewal is never
  punitive: the license keeps working on everything already entitled, updates just stop.
- Subscriptions are untouched — an active subscription includes updates while active; this window
  governs one-time purchases only.
- **Hard timing law: this policy must be in checkout + EULA copy before the checkout flip.** It
  is not yet built (registry/entitlement version-window check is a named, not-yet-built,
  checkout-flip item) — this doc states the policy now per the ADR's own instruction.

Chosen over unbounded free updates (the AG-Grid-vs-Tailwind-Plus comparison in the ADR: Tailwind's
unbounded lifetime model front-loaded LTV and left no recurring floor, −80% off peak when traffic
cratered) and over a major-version boundary (majors are rare for a continuously-hardened library,
so that framing is unbounded in practice anyway).

## Credit policy (ADR-0245, locked 2026-07-05)

- **Pooled rollover**: unused subscription-cycle credit grants roll into one pooled wallet — no
  use-it-or-lose-it monthly reset (a hard reset scored as the less-coherent, punitive-reading
  majority pattern against 2026 comparables Clay/ElevenLabs).
- **Every grant expires 12 months after issue** — subscription-cycle grants, the $49 top-up pack
  (ADR-0222), and promotional grants alike, unless a later ADR states otherwise per class.
- **FIFO burn**: consumption draws oldest grant first, so a steady subscriber's balance near
  expiry burns before it lapses.
- Ledger mechanics (grant-level expiry timestamps, FIFO ordering) land at the checkout-flip/billing
  build — the wallet is already integer + ledgered (ADR-0007/0024); expiry is additive, not a
  rework. Credit idempotency and codegen debit points are unaffected.

## Grandfathering posture (ADR-0106, extended by ADR-0129/0137)

- **Forward-only, per-SKU, no exceptions.** Every buyer's purchased price + version is honored
  against all future increases — a one-time edition or module owns the purchased version
  perpetually; a subscription renewal holds the rate the subscriber signed at. Increases never
  claw back or re-bill an existing buyer. This binding was reaffirmed at every subsequent reprice
  (ADR-0129, ADR-0137, ADR-0227) with no exception carved.
- **Zero live buyers today** — the site sits CF-Access-gated and checkout has not flipped, so
  every reprice so far has grandfathered nobody in practice. The rule is load-bearing starting at
  checkout-flip, not retroactively.
- **Pre-flip safety clause**: any early/manual/founder-assisted sale that closes at an
  earlier-committed display price before the gate flips is honored at that price — currently
  vacuous (no such sale has occurred).

## What is still operator-adjustable

The board note carried since ADR-0095/0106 stands: **exact price numbers stay silently
operator-adjustable until checkout goes live** — the site no longer _says_ prices are indicative
(ADR-0082 committed-prices posture), so a pre-flip change is a quiet edit + ADR, not a displayed
disclaimer. Confidence on every number above is **MEDIUM** — research-anchored (competitor
comparables in ADR-0129, the two GTM reports behind ADR-0106) but not WTP-validated: no ICP
interviews, no paid WTP pilots, no live purchase data yet. Each pricing ADR names itself as
revisit-after-launch via a superseding ADR once real data exists.

Sandbox-only detail: all 11 module + `agent-runner` + edition Paddle products/prices were created
in **SANDBOX now** (ADR-0227 operator override of a guard-until-flip recommendation), so the full
cart → checkout → webhook → grant path is exercisable pre-launch. Sandbox catalog ids do not port
— the same catalog must be re-created in the production Paddle account at the commerce flip
(accepted double entry).

## OPEN FORK — catalog doctrine (not decided; do not treat as locked)

The operator redirected the R3 "compliance god-package split" pricing question (originally: does
splitting framework-catalog/evidence-assembly/signing into separately sellable surfaces re-open
the $799 anchor math) into a **broader catalog-doctrine research round**, not yet resolved. The
direction under study — **all editions become bundle options over an individually-sellable
package catalog, with an explicit OSS/commercial-line and package-split standard** — would, if
locked, generalize the ADR-0238 edition-vs-module boundary rather than patch it edition-by-edition.
Findings are slated for `outputs/research/catalog-doctrine-2026-07.md` (not yet written as of this
distillation). **Until that fork resolves, R3 stays parked and every price above stays as
currently locked** — do not pre-empt the split, and do not read this section as describing a
committed future catalog shape.

## Contradictions found while distilling

- **ADR-0240 vs. build-state prose**: `docs/build-state.md`/`docs/state/package-catalog.md` may
  still carry a stale "$749" or "12-module" figure in places not yet swept by the ADR-0238/0240
  closeout PRs — this file states the current live numbers ($799 compliance, 11 standalone
  modules, $349 local-first) as ground truth per `apps/site/lib/pricing.ts`, which matches the
  latest ADRs exactly.
- No numeric contradiction found between ADR-0227 and ADR-0137/0238/0240 — each supersession is
  explicit and the live pricing.ts file matches the final chain.

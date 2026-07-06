---
updated: 2026-07-06
status: live
grounds:
  - knowledge/decisions/ADR-0251-ui-pro-spec-locks.md
  - knowledge/decisions/ADR-0252-pricing-revalidation-locks.md
  - outputs/research/pricing-revalidation-2026-07.md
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

## Stage-3 amendments (ADR-0258, 2026-07-06) — three numbers move, two deferred items close

The Stage-3 catalog-rework picker closed ADR-0252's two deferred items and recomputed where the
formula demanded it. **Superseding rows (everything else in the Stage-2 table below stands):**

| SKU                           | Locked (ADR-0258)                                                                                             | Basis                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local-first bundle**        | **$629**                                                                                                      | full 3-way carve: **local-sync $199 · local-inference $249 · local-privacy $99**; 0.75 × $845 member-sum (carves + local-store $99 + field-crypto $199); closes the ADR-0252 deferred round; supersedes ADR-0240's $349 |
| **AI-Production bundle**      | **$739**                                                                                                      | credits ($149) confirmed in the member set (registry-true; ai-kit/ai-meter hard-depend) → 0.75 × $994 recompute                                                                                                         |
| **Everything bundle**         | **$2,059**                                                                                                    | 0.75 × Σ(1,049 + 739 + 629 + 329 = $2,746); **content = every sellable SKU incl. ui-pro** (only private `brand` excluded; supersedes ADR-0251 §5 on this point)                                                         |
| org module                    | **$249** as ONE merged **`org-controls`**                                                                     | ADR-0257 shape call — the $199 standalone branch is dead                                                                                                                                                                |
| **Renewal cents (moved/new)** | AI **$289** · Local-first **$249** · Everything **$819** · sync **$79** · inference **$99** · privacy **$39** | flat-40% X9 ladder otherwise unchanged                                                                                                                                                                                  |

Below-sum ✓ on all six bundles at lock. Display still flips in one wave (W6/W7 of
`outputs/specs/catalog-rework/PLAN.md`); Paddle sandbox rebuilds big-bang at W7.

## Stage-2 price locks (ADR-0252, 2026-07-06) — display rides the catalog-rework build

The pricing-revalidation pass (Kickoff D Stage 2) locked the post-catalog-rework sheet. **These
numbers are the committed prices for the bundle catalog; the site display flips in one wave with
the Stage-3/4 catalog-rework build** — the matrix in the next section stays what `pricing.ts`
shows until then. Formula binding: bundle display = 0.75 × priced-member sum (registry-truth
membership), rounded down to the 9-ending; **Everything = 0.75 × Σ(bundle prices),
recompute-on-move**; below-sum invariant verified per bundle at lock. **Amended by ADR-0258
above (AI-Production, Local-first, Everything, auth-sso shape, and their renewal cents).**

| SKU                         | Locked                                                                                       | Basis                                                                                                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Compliance bundle**       | **$1,049**                                                                                   | 0.75 × $1,443 member-sum (carve $299+$249+$199 + fc $199 + worm $149 + alerting $149 + retention $199); supersedes ADR-0227's $799                                                                                     |
| **AI-Production bundle**    | **$629**                                                                                     | 0.75 × $845 (field-crypto is a registry-true member; ai-evals folded in per ADR-0249 G1); if `credits` joins the member set at Stage 3, re-runs to ≈$745                                                               |
| **Local-first bundle**      | **DEFERRED**                                                                                 | operator-commissioned local-ai carve round decides members before the number; $349 carries interim (ADR-0240 not superseded)                                                                                           |
| **Agentic-Dev bundle**      | **$329**                                                                                     | 0.75 × $446 (kernel $199 + runner $49 + local-store $99 + tool-exec $99)                                                                                                                                               |
| **Provenance bundle** (new) | **$399**                                                                                     | 0.75 × $547 (P_S $199 + audit-worm $149 + field-crypto $199); $0 incremental into Everything (member-subset of Compliance)                                                                                             |
| **Everything bundle**       | **$1,749**                                                                                   | 0.75 × Σ(1,049 + 629 + 349 interim + 329)                                                                                                                                                                              |
| P_C compliance-core         | **$299**                                                                                     | evidence-assembly engine; comp desert confirmed — internal premium tier                                                                                                                                                |
| P_F frameworks-pack         | **$249**                                                                                     | SOC2+HIPAA+EU-AI-Act data packs; one-time framework-pack comps $59–1,050                                                                                                                                               |
| P_S signing-primitive       | **$199**                                                                                     | per-tenant Ed25519 + RFC-3161                                                                                                                                                                                          |
| tool-exec                   | **$99**                                                                                      | Agentic trio coherence                                                                                                                                                                                                 |
| auth-sso                    | **$199** standalone / **$249** merged with the rls admin-write carve (Stage 3 decides shape) |
| credits (post-decouple)     | **$149**                                                                                     | Stigg $399/mo validates; Lago OSS caps                                                                                                                                                                                 |
| billing-orchestration       | **$99**                                                                                      | Kill Bill/Lago free-OSS ceiling                                                                                                                                                                                        |
| ui-pro                      | **$129**                                                                                     | inside the ADR-0251 band, low end                                                                                                                                                                                      |
| 11 existing modules         | **unchanged**                                                                                | every live-comp verdict "keep"                                                                                                                                                                                         |
| Subscriptions + top-up      | **unchanged**                                                                                | $1,499/yr · $499/yr · $49/5,000 (margin audited 89.8%, mix-proof)                                                                                                                                                      |
| **Updates-renewal cents**   | **flat 40% of list, X9-rounded**                                                             | Compliance $419 · AI $249 · Agentic $129 · Everything $699 · Provenance $159 · LF $139 interim · modules 299→$119 · 249→$99 · 199→$79 · 149→$59 · 129→$49 · 99→$39 · 49→$19 — Kickoff E's renewal plumbing wires these |

Evidence + formula worksheets: `outputs/research/pricing-revalidation-2026-07.md`. The anchor
tension resolved sum-of-parts: the Vanta/Drata TCO band ($8–40k+/yr, quote-gated) is marketing
narrative ("less than 2 months of your first Vanta invoice — and you own it forever"), never
pricing logic.

## Locked price matrix (current, live in `apps/site/lib/pricing.ts` — pre-rework display)

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

## Catalog doctrine — RESOLVED (ADR-0246–0252); what stays open

The catalog-doctrine round locked 2026-07-05/06: every commercial package individually priced +
displayed (ADR-0246 F1b), editions dissolve into the Persona+Provenance bundle set (ADR-0246
F2b / ADR-0249 G1), the compliance 3-SKU carve is formula-priced (ADR-0246 F6), bundle
mechanics are 25%-off-sum + snapshot-at-sale + crediting map (ADR-0247), and the Stage-2
pricing pass (ADR-0252) locked the numbers — see the Stage-2 section at the top of this file.
R3 is thereby closed (the carve exists and is priced).

**Still open after Stage 2 — ALL CLOSED at Stage 3 (ADR-0257/0258, see the amendments section
at the top):** Local-first → full 3-way carve, $629 · credits-in-AI → joined, recompute $739 ·
auth-sso shape → ONE merged `org-controls` $249. **Still open after Stage 3:** optional WTP
validation only (Cookiy Van Westendorp survey 374111 is live/unanswered; ~$20 recruitment needs
live operator approval — validates, never blocks; now also covers the three local-ai carve
bands, which are catalog-ladder-grounded rather than comps-researched).

## Contradictions found while distilling

- **ADR-0240 vs. build-state prose**: `docs/build-state.md`/`docs/state/package-catalog.md` may
  still carry a stale "$749" or "12-module" figure in places not yet swept by the ADR-0238/0240
  closeout PRs — this file states the current live numbers ($799 compliance, 11 standalone
  modules, $349 local-first) as ground truth per `apps/site/lib/pricing.ts`, which matches the
  latest ADRs exactly.
- No numeric contradiction found between ADR-0227 and ADR-0137/0238/0240 — each supersession is
  explicit and the live pricing.ts file matches the final chain.

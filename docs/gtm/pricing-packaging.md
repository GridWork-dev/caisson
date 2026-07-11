---
updated: 2026-07-09
status: live
grounds:
  - knowledge/decisions/ADR-0259-ui-pro-spec-locks.md
  - knowledge/decisions/ADR-0260-pricing-revalidation-locks.md
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

## ROI framing rider (2026-07-11, CAISSON-98)

Cookiy's top platform-ranked recommendation (study 019f4a11), missed by the in-house
synthesis: surface a "weeks-of-engineering-saved" translation next to the anchor price —
the finance/exec tier of the two-tier approval needs it, and buyers currently do the math
themselves. Copy change only (ADR-0080 laws apply); anchors themselves stay ADR-0304-locked.

## Stage-3 amendments (ADR-0258, 2026-07-06) — three numbers move, two deferred items close

The Stage-3 catalog-rework picker closed ADR-0260's two deferred items and recomputed where the
formula demanded it. **Superseding rows (everything else in the Stage-2 table below stands):**

| SKU                           | Locked (ADR-0258)                                                                                             | Basis                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local-first bundle**        | **$629**                                                                                                      | full 3-way carve: **local-sync $199 · local-inference $249 · local-privacy $99**; 0.75 × $845 member-sum (carves + local-store $99 + field-crypto $199); closes the ADR-0260 deferred round; supersedes ADR-0240's $349 |
| **AI-Production bundle**      | **$739**                                                                                                      | credits ($149) confirmed in the member set (registry-true; ai-kit/ai-meter hard-depend) → 0.75 × $994 recompute                                                                                                         |
| **Everything bundle**         | **$2,059**                                                                                                    | 0.75 × Σ(1,049 + 739 + 629 + 329 = $2,746); **content = every sellable SKU incl. ui-pro** (only private `brand` excluded; supersedes ADR-0259 §5 on this point)                                                         |
| org module                    | **$249** as ONE merged **`org-controls`**                                                                     | ADR-0257 shape call — the $199 standalone branch is dead                                                                                                                                                                |
| **Renewal cents (moved/new)** | AI **$289** · Local-first **$249** · Everything **$819** · sync **$79** · inference **$99** · privacy **$39** | flat-40% X9 ladder otherwise unchanged                                                                                                                                                                                  |

Below-sum ✓ on all six bundles at lock. Display still flips in one wave (W6/W7 of
`outputs/archive/specs/catalog-rework/PLAN.md`); Paddle sandbox rebuilds big-bang at W7.

## Stage-2 price locks (ADR-0260, 2026-07-06) — display rides the catalog-rework build

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
| ui-pro                      | **$129**                                                                                     | inside the ADR-0259 band, low end                                                                                                                                                                                      |
| 11 existing modules         | **unchanged**                                                                                | every live-comp verdict "keep"                                                                                                                                                                                         |
| Subscriptions + top-up      | **unchanged**                                                                                | $1,499/yr · $499/yr · $49/5,000 (margin audited 89.8%, mix-proof)                                                                                                                                                      |
| **Updates-renewal cents**   | **flat 40% of list, X9-rounded**                                                             | Compliance $419 · AI $249 · Agentic $129 · Everything $699 · Provenance $159 · LF $139 interim · modules 299→$119 · 249→$99 · 199→$79 · 149→$59 · 129→$49 · 99→$39 · 49→$19 — Kickoff E's renewal plumbing wires these |

Evidence + formula worksheets: `outputs/research/pricing-revalidation-2026-07.md`. The anchor
tension resolved sum-of-parts: the Vanta/Drata TCO band ($8–40k+/yr, quote-gated) is marketing
narrative ("less than 2 months of your first Vanta invoice — and you own it forever"), never
pricing logic.

## Locked price matrix (current, live in `apps/site/lib/pricing.ts`)

The six-bundle catalog (ADR-0257 vocabulary · ADR-0258 numbers) is what `pricing.ts`
`BUNDLE_PRICES` exports today — editions dissolved into these bundles at the Stage-3/4
catalog-rework build (W7 Paddle SANDBOX big-bang, PR #130, 2026-07-06). The Stage-2/Stage-3
sections above show the derivation; this is the flat lookup, cents verified against code:

| SKU                                        | Price                   | Note                                                                                                                                                       |
| ------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Compliance** (bundle, one-time)          | **$1,049**              | Fail-closed RLS, WORM, audit chain, evidence packs, framework + signing carves. Supersedes the $799 edition (ADR-0227).                                    |
| **AI-Production** (bundle, one-time)       | **$739**                | Metering, guardrails, prompt versioning, CI eval harness; credits joined the member set at Stage 3 (ADR-0258), recompute over $629.                        |
| **Local-first** (bundle, one-time)         | **$629**                | On-device inference, privacy egress gate, local vector search; full 3-way carve (sync/inference/privacy), ADR-0258 supersedes the $349 edition (ADR-0240). |
| **Agentic-Dev** (bundle, one-time)         | **$329**                | Governed-agent kernel: typed agent/skill/rule schema, guarded lifecycle, sandboxed execution.                                                              |
| **Provenance** (bundle, one-time, net-new) | **$399**                | Detached signing, append-only WORM audit chain, per-tenant field encryption; $0 incremental into Everything (member-subset of Compliance).                 |
| **Everything** (bundle, one-time)          | **$2,059**              | Every sellable SKU incl. ui-pro (only private `brand` excluded); 0.75 × Σ(the five persona bundles), ADR-0258 supersedes Stage-2's $1,749.                 |
| **Per-module à la carte**                  | $49–$299                | Every sellable commercial SKU individually priced (ADR-0246 F1b) — see the module-catalog section below.                                                   |
| **Compliance-Updates** (subscription)      | **$1,499/yr**           | Annual cadence per ADR-0095 §3, numbers per ADR-0106.                                                                                                      |
| **Developer** (subscription)               | **$499/yr**             | Same.                                                                                                                                                      |
| **Enterprise / SLA**                       | **Contact us**          | No public number, founder-assisted only (ADR-0095 §2).                                                                                                     |
| **Credit top-up pack**                     | **$49** (5,000 credits) | ADR-0222.                                                                                                                                                  |

### Superseded — pre-catalog-rework 4-edition matrix (historical only)

Retained for continuity; every row below was replaced by the six-bundle matrix above at the
Stage-3 rework (ADR-0257/0258, 2026-07-06) — do not sell against these numbers:

| SKU (edition, one-time)                   | Price  | Superseded by             |
| ----------------------------------------- | ------ | ------------------------- |
| Compliance                                | $799   | Compliance bundle $1,049  |
| AI Production Kit                         | $599   | AI-Production bundle $739 |
| Agentic-Dev                               | $249   | Agentic-Dev bundle $329   |
| Local-first AI                            | $349   | Local-first bundle $629   |
| Everything Bundle (base + all 4 editions) | $1,499 | Everything bundle $2,059  |

## The below-sum invariant

Every bundle must price **below** the sum of its constituent modules — still the current, binding
rule, now formalized at the catalog rework as the flat **0.75 × priced-member-sum** formula
(ADR-0258), superseding the per-edition ad hoc discount depths this section used to carry.
Below-sum ✓ verified on all six bundles at lock; the Stage-2/Stage-3 sections above carry each live
bundle's member-sum basis.

**Historical — pre-rework per-edition discount depth (ADR-0137, superseded 2026-07-06):**

- Compliance: $846 member-sum → $799 (5.6% off — the thinnest margin of the four; ADR-0227
  reopened this specific number after a module-sum recount pushed the old $749 to ~11.5% off,
  deeper than the operator wanted).
- AI Production Kit: $795 sum → $599 (~25% off).
- Agentic-Dev: $298 sum → $249 (~16% off).
- Local-first AI: $398 sum → $349 (~12% off).
- Everything Bundle: $1,946 edition-sum → $1,499 (~23% off, $447 saved).

**Any future change to a module's price or a bundle's member list that pushes a bundle's price
above its own member-sum re-opens that bundle's number** — this is a standing check, not a
one-time fix (ADR-0227's original consequence clause, carried into ADR-0258). No fabricated "was"
strikethrough anchors are shown; the site never charged the earlier numbers, so a struck-through
price would be a dark pattern (ADR-0137).

## Module catalog: 22 sellable modules across six bundles

ADR-0129 originally value-anchored 12 individually-sellable modules against commercial
comparables (e.g. `field-crypto` vs. IronCore/Evervault $395–1,954/mo; `ai-meter` vs.
Portkey/Helicone $49–79/mo; full comparable table in ADR-0129). ADR-0238 then **dropped 4 rows**
whose module id collided with its own parent edition id (`compliance`, `ai-kit`, `local-ai`,
`agent-dev`) — a $299 module purchase was resolving to a full $799 edition grant because
`expandEntitlements` resolves edition-first and there is no separable "core" artifact to sell
(every edition meta-package hard-depends on its commercial members). The fix was removal, not
rename: editions were how composition was bought, modules were entry points into them. That
11-standalone-module count was itself superseded at the Stage-3 catalog rework (ADR-0246 F1b):
every commercial package is now individually priced, and `apps/site/lib/pricing.ts`
`MODULE_PRICES` carries **22 sellable modules** — 19 hold membership in one or more of the six
bundles (`bundles: [...]`), and 3 are genuinely standalone with no bundle grant
(`org-controls`, `billing-orchestration`, `ui-pro`).

`ai-evals` is **no longer** `standaloneOnly`: the ADR-0258 members-fold joined it to the
`ai-production` bundle (it was never in the legacy `ai-kit` edition map) — verify current
membership against `MODULE_PRICES` before restating it, since bundle membership is registry-truth
pinned by `pricing.test.ts`, not hand-tracked here.

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

Sandbox-only detail: the full six-bundle + 22-module Paddle products/prices were created in
**SANDBOX now** (ADR-0227 operator override of a guard-until-flip recommendation, carried through
the W7 catalog-rework big-bang with editions archived), so the full cart → checkout → webhook →
grant path is exercisable pre-launch. Sandbox catalog ids do not port — the same catalog must be
re-created in the production Paddle account at the commerce flip (accepted double entry).

## Catalog doctrine — RESOLVED (ADR-0246–0252); what stays open

The catalog-doctrine round locked 2026-07-05/06: every commercial package individually priced +
displayed (ADR-0246 F1b), editions dissolve into the Persona+Provenance bundle set (ADR-0246
F2b / ADR-0249 G1), the compliance 3-SKU carve is formula-priced (ADR-0246 F6), bundle
mechanics are 25%-off-sum + snapshot-at-sale + crediting map (ADR-0247), and the Stage-2
pricing pass (ADR-0260) locked the numbers — see the Stage-2 section at the top of this file.
R3 is thereby closed (the carve exists and is priced).

**Still open after Stage 2 — ALL CLOSED at Stage 3 (ADR-0257/0258, see the amendments section
at the top):** Local-first → full 3-way carve, $629 · credits-in-AI → joined, recompute $739 ·
auth-sso shape → ONE merged `org-controls` $249. **Still open after Stage 3:** optional WTP
validation only (Cookiy Van Westendorp survey 374111 is live/unanswered; ~$20 recruitment needs
live operator approval — validates, never blocks; now also covers the three local-ai carve
bands, which are catalog-ladder-grounded rather than comps-researched).

## Contradictions found while distilling

- **Pre-rework build-state prose**: `docs/build-state.md`/`docs/state/package-catalog.md` may
  still carry stale edition-era figures ("$799 compliance," "$749," "11 standalone modules," "12
  modules") in places not yet swept by the catalog-rework closeout PRs — this file states the
  current live numbers (six bundles: $1,049/$739/$629/$329/$399/$2,059; 22 sellable modules) as
  ground truth per `apps/site/lib/pricing.ts`, verified directly against `BUNDLE_PRICES` and
  `MODULE_PRICES` in code, which matches ADR-0257/0258 exactly.
- No numeric contradiction found between ADR-0227/0137/0238/0240 (the superseded edition chain)
  and ADR-0257/0258 (the six-bundle successor) — each supersession is explicit and the live
  pricing.ts file matches the final chain.

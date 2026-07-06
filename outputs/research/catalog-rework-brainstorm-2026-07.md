---
updated: 2026-07-05
status: live
grounds:
  - packages/ui/src
  - tooling/standards-gate/src/checks.ts
  - apps/site/lib/pricing.ts
  - docs/gtm/positioning.md
---

# Catalog-rework brainstorm — ui split · OSS-line redraw · bundle-set redesign

**Mandate:** the 2026-07-05 catalog-rework picker (ADR-0246/0247/0248) locked structure and
doctrine but left three design surfaces OPEN by operator instruction: the bundle SET, the
OSS-line per-package redraws (including the `ui` basic/deep split), and every price number.
This document is the brainstorm evidence + the **G-series fork queue** for the follow-up picker.
Grounded by three sweep agents (full transcripts in the session workflow journal); every fact
cited to disk. **Nothing here is locked.** The ratchet (ADR-0248 §2) has not engaged — nothing
is published — so every redraw below is still free.

## 1. `packages/ui` split — feasibility read

**Inventory** (75 files, 5,483 LOC): a clean 40/60 BASIC/DEEP split exists on disk.

- **BASIC (~1,500 LOC):** the token floor (`src/tokens/*`, 648 LOC with tests — OKLCH palette,
  breakpoint ladder, `SemanticTheme`) + 13 generic components (`button`, `card`, `section`,
  `form-field`, `status-chip/pill`, `empty/error/loading-state`, `feature-grid`, `faq`,
  `theme-init`) + the Lucide icon passthrough.
- **DEEP (~3,270 LOC):** the 22 hand-drawn domain glyphs (`icon.tsx:105-804`, ~700 LOC — RLS,
  WORM, audit-chain, fail-closed, edition marks…), `app-shell` dashboard chrome (560),
  `data-table`, `ledger-list`, `money-cell` (ADR-0212 tie-in), `sku-matrix`, `edition-card`,
  `mobile-buy-bar`, the marketing code-as-proof set (`hero`, `terminal`, `code-block`,
  `credential-strip`), `metric-stat`, the `reveal` motion layer (ADR-0078 §6), `theme-toggle`,
  and the brand mark itself (ADR-0103).

**The load-bearing fact:** `create-caisson` templates contain **zero** `@caisson/ui`
references — a buyer-generated repo does not consume the kit today. The only real consumers are
`apps/site` and `apps/admin` (both first-party; every DEEP component is live in at least one
site route). So a DEEP-goes-commercial split breaks **no external buyer**; the cost is
rewriting ~50 mixed-bucket barrel imports across two first-party apps.

**Shapes** (sweep verdicts):

| Shape                                                          | What                                                                          | Cost                                                                                                                                     | Verdict                                                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **A** — `ui` stays OSS-basic; new `@caisson/ui-pro` commercial | move the 19 DEEP components + glyphs out; `ui-pro` depends on `ui` for tokens | medium (~50 import rewrites, both first-party); standards-gate untouched (`ui` stays in `OPEN_BASE_NAMES`, `ui-pro` defaults commercial) | **recommended** — additive, no rename against a public Apache name, matches the ADR-0094 open-core pattern |
| **B** — `ui` flips commercial; new `@caisson/ui-core` OSS      | inverted naming                                                               | high (every import renamed, `OPEN_BASE_NAMES` edited, a published-name license flip reads hostile if anyone snapshotted the mirror)      | same split, worse optics, zero extra benefit                                                               |
| **C** — one package, entitlement-gated DEEP subpath            | registry-Worker filtering on `./components/*`                                 | lowest                                                                                                                                   | weakest — source-available `.tsx` copy-paste defeats it; a feature-gate, not a SKU                         |

**The honest counter-case (carry into the picker):** nobody buys caisson for the component kit;
DEEP has **no demand signal** (no funnel data, no ticket, no sales note in `docs/state/`), and
the actual gap is that the generator doesn't wire even BASIC `ui` into buyer repos. The
evidence-backed sequencing is: wire `@caisson/ui` into generated repos first (the funnel), ship
`ui-pro` when a demand signal exists — with the split shape (A) pre-locked so the later move is
mechanical. To justify a price, `ui-pro` needs its own docs/demo surface + 2–3 flagship
components beyond today's internals; plausible $99–199 add-on against the $599–799 editions.

## 2. OSS-line redraw — flip candidates + blast radius

Per-package buyer-based verdicts (ADR-0248 §1) with runtime-dependency blast radius from
`tooling/standards-gate/src/checks.ts`:

**Mechanically or doctrinally locked open:** `kernel` (13/15 open packages depend on it),
`registry-schema` (the open↔commercial interop contract, 3 open dependents), `cli` (the
acquisition funnel, ADR-0136), `migrate` (cli runtime dep), `license-verify` (circular —
commercial license verification can't itself require a license).

**Low-value flips (keep open):** `jobs`, `email`, `ai-config`, `rate-limit`, `observability`
(commodity wrappers, zero differentiation), `mcp-server` (already designed open-transport /
entitlement-gated-tools per ADR-0094 — flipping the shell buys nothing).

**Ranked live candidates:**

1. **`billing`** — zero open dependents; money-movement reads commercial under the buyer-based
   test. BUT the test has two honest readings here: the caisson buyer is an individual dev
   shipping _their_ SaaS — billing wiring is their day-one workflow, and free-billing-in-base is
   part of the adoption story ADR-0094 built. Sweep's own hedge: flip whole, or split (raw
   webhook-verify stays open, the 4-provider orchestration goes commercial).
2. **`auth` split** — textbook ADR-0248 mixed package: `jwt.ts`/`session.ts` (135 LOC,
   dev-value) stays open; `workos.ts`/`membership.ts` (236 LOC — enterprise SSO + org roles, the
   procurement concern) carves commercial. Zero blast radius.
3. **`credits`** — real buyer-value, but `cli` runtime-depends on it for its own codegen-debit
   gate (`packages/cli/manifest.ts:16-21`); flip requires decoupling that first (else the open
   generator depends up on a commercial package — gate violation).
4. **`tenancy-rls` narrow carve** — wholesale flip is off the table (5 direct open dependents
   cascading everywhere), and open fail-closed RLS is a positioning proof point. Only the
   org-controls layer (`buildAdminWritePolicySql`/`withAdminWrite`) is a carve candidate.
5. **`ui` split** — §1.

## 3. Bundle-set redesign — three candidate sets + a synthesis variant

Buyer job-to-be-done clusters (from the live registry members maps): Compliance/regulated-SaaS
(hero) · AI-production · Local-first/privacy · Agentic-dev · the free Base substrate ·
back-office never-SKUs (`pricebook`, `platform-reads`, `license-issue`, `audit-harness`).
Real cross-bundle sharing already live: `field-crypto` in 3 editions; `local-store` in 2;
`ai-config` in 2 — **any set needs the F8 crediting map; shared modules must never
double-charge** (ADR-0247 §3).

Formula prices = 0.75 × member-sum (ADR-0247 §1). Known module prices from
`apps/site/lib/pricing.ts`; `P_C/P_F/P_S` = the compliance carve SKUs, `P_T` = `tool-exec`
(both priced in the pricing pass).

- **(a) Persona bundles** — the four ICP-mapped bundles + Everything, with the compliance 3-SKU
  carve, `ai-evals` folded into AI-Production as a real member (today it's standalone-only),
  and `tool-exec` added as the missing SKU. Migration near-1:1; Paddle delta ~+4 products.
  _Against:_ reads as a relabel — the safest set, but arguably not the "redesign" the mandate
  asked for.
- **(a+) Persona bundles + a Provenance cross-bundle** _(synthesis variant)_ — set (a) plus one
  cross-cutting bundle: **Provenance** = `signing-primitive` + `audit-worm` + `field-crypto`
  (~$348 + P_S sum → ~$260 + 0.75·P_S). Rationale: the signing carve's entire justification is
  the non-compliance buyer who wants tamper-evidence à la carte (`sign.ts` self-describes
  "distinct from the license key") — this gives that buyer a named landing spot without
  dragging in frameworks, and it makes the set a genuine redesign rather than a relabel.
  _Against:_ one more bundle to merchandise; overlaps Compliance (crediting map handles it).
- **(b) Value ladder** (Starter → Production → Everything) — fewer top-level choices (the
  market's 6→3-plans evidence). _Against, and it's disqualifying-grade:_ a cheap Starter tier
  invites exactly the price-shopper the locked anti-ICP firewall refuses
  (`docs/gtm/positioning.md:24-26`), and it erases persona self-selection.
- **(c) Minimal mega-bundles** (Compliance · Build-and-Ship-AI · Everything) — smallest display
  surface. _Against:_ merges 2 ICPs + a flank persona into one grant; loses the "which persona
  am I" marketing mechanics; grandfathering becomes a widening, must be explicit.

**Bundle-only metas stay bundle-only:** `ai-kit`, `local-ai`, `agent-dev` meta-packages
hard-depend on their commercial members (a bare meta fails mid-install — the ADR-0238 wall);
only compliance has carve evidence. Do not price the other three metas standalone.

## 4. Cross-cutting constraints

1. **Ratchet timing** — every flip/split above must lock and execute BEFORE first publish
   (`confirm=publish` still gated; mirror private). After that, open surfaces are permanent.
2. **Generator-wiring gap** — `create-caisson` ships no frontend; whatever G2 decides, wiring
   BASIC `ui` into generated repos is the funnel move that makes the OSS floor real.
3. **Crediting map is mandatory** — every candidate set shares modules across bundles; the F8
   `pricebook` map (ADR-0247 §3) is a precondition of the build, not an option.
4. **Blast-radius law** — a flip of X forces every open runtime-dependent of X to flip or
   decouple (`checkOpenCommercialBoundary`); the §2 table already prices this in.

## 5. Fork queue for the follow-up picker (G-series — NOT locked)

| #      | Fork                | Options                                                                                                                                                         | Rec + confidence          | One-line evidence                                                                                                                                                             |
| ------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1** | Bundle set          | (a) persona+carve · (a+) persona + Provenance cross-bundle · (b) value ladder · (c) minimal mega-bundles                                                        | **(a+)** · Med            | (a) is safe but reads relabel; (a+) is the smallest real redesign and gives the signing carve its buyer; (b) breaks the anti-ICP firewall; (c) breaks persona self-selection. |
| **G2** | `ui` split          | (A) split now, `ui-pro` commercial · (A-seq) lock shape A, wire generator first, ship `ui-pro` on demand signal · (C) entitlement-gate subpath · defer entirely | **(A-seq)** · Med-High    | Split is clean (no external consumer) but DEEP has zero demand signal; sequencing captures the operator's deep-design intent without speculative packaging now.               |
| **G3** | `billing` posture   | flip whole commercial · split (webhook-verify open / multi-provider orchestration commercial) · keep open (ADR-0094 funnel posture)                             | **split** · Med           | Zero blast radius either way; the buyer-based test reads both ways (money-movement vs day-one dev workflow) — the split honors both readings.                                 |
| **G4** | `auth` SSO carve    | carve `workos.ts`+`membership.ts` commercial (`auth-sso`) · keep whole open                                                                                     | **carve** · Med-High      | Textbook ADR-0248 mixed package; enterprise SSO/org-roles is procurement-value; zero blast radius; 236 LOC.                                                                   |
| **G5** | `credits` flip      | decouple `cli` debit-gate then flip · keep open                                                                                                                 | keep open for now · Med   | Real buyer-value but the decouple is a precondition; sequence behind G3/G4 which are free.                                                                                    |
| **G6** | `tenancy-rls` carve | carve the admin-write/org-controls layer · keep whole open                                                                                                      | **keep whole open** · Med | Open fail-closed RLS is a positioning proof point; the carve is small (2 functions) and the trust cost of touching the RLS story pre-launch outweighs it.                     |
| **G7** | Bundle-only metas   | keep `ai-kit`/`local-ai`/`agent-dev` metas unpriced bundle-glue · price them standalone                                                                         | **bundle-only** · High    | Bare metas fail mid-install (ADR-0238 wall); no carve evidence exists for these three.                                                                                        |

## 6. What feeds the pricing-revalidation pass

The pass (commissioned, on the tracker) prices: `P_C/P_F/P_S` (compliance carve), `P_T`
(tool-exec), the G1-chosen bundle set via the 0.75 formula, `ui-pro` if G2 ships it ($99–199
band suggested), `auth-sso` if G4 carves, the per-package à-la-carte catalog (F1b displays
everything), and re-validates the existing module numbers against the market-intel tension
(`docs/gtm/market-intel.md` — the $799–1,499 vs $2,999–4,999 compliance anchor disagreement).

Next step: G-series picker (operator), then the catalog-rework SPEC session builds against the
locked set.

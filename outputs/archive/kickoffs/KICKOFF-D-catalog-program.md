# Kickoff D — The catalog program: ui-pro SPEC → pricing pass → catalog-rework SPEC → build

**Authored:** 2026-07-05 (post-merge split picker: Program-vs-Independent, both kickoffs parallel
worktrees). **Sibling:** `KICKOFF-E-independent-build-wave.md` (everything with no catalog
dependency — runs in parallel; whichever lands second rebases). **Branch:** `feat/catalog-program`
off `main` (worktree). **Shape:** research-FIRST at every stage, then deep forks to the operator
via AskUserQuestion in rounds of ≤4 (never auto-decide), then lock → SPEC → build. **Routing:**
research/scrapes → sonnet dispatches (`gw-pricing-analyst` lane for pricing) · synthesis/SPEC
authoring + picker prep → opus main thread · money/license-seam implementation at build →
fable per the caisson routing note · every dispatch sets `model` explicitly.

## Locks carried in (do not re-ask)

The full ADR-0244–0250 chain: 12mo updates window + ~40% renewal (0244) · pooled credit rollover,
12mo expiry, FIFO (0245) · every package priced+displayed, editions dissolve into bundles,
compliance 3-SKU carve formula-priced (0246) · 25%-off-sum anchor, snapshot-at-sale growing
bundles, `bundle − owned` crediting off a pricebook map (0247) · buyer-based OSS line,
**ratchet engages at first publish — every carve/flip in this program executes BEFORE first
publish or not at all** (0248) · Persona+Provenance bundle set, billing verify/orchestration
split, auth-sso carve, credits decouple-then-flip, rls admin-write carve, metas bundle-only
(0249) · kit tiering P3 (ui floor · ui-pro commercial · brand private), staged buildout,
per-package `./ui` frontends, S-class wave 1 (0250).

## Program stages (hard order; one session per stage is the default, merge green between)

### Stage 1 — ui-pro SPEC

1. **Research:** component-gap survey (the post-brand-cut floor vs what a paying buyer needs:
   richer data-table, charts, modal/drawer, motion presets — ground in `apps/site/app/dashboard`
   - `apps/admin` real usage); competitor pro-kit teardowns (Tailwind Plus, MUI X/premium,
     shadcn-pro ecosystems, Kendo) via refero + exa — component lists, docs surfaces, price bands.
2. **Deep forks (operator):** the ui-pro component list · the public docs/gallery shape
   (own site vs docs-section vs Storybook-class) · what ships v1 vs roadmap · price-band input
   for Stage 2.
3. **Output:** `outputs/specs/ui-pro/SPEC.md` (locked scope, no build) + its ADR.

### Stage 2 — Pricing-revalidation pass

1. **Research:** re-validate EVERY displayed number; resolve the market-intel anchor tension
   ($799–1,499 dev-kit vs $2,999–4,999 Vanta-TCO — `docs/gtm/market-intel.md` carries both);
   competitor scrapes + WTP memo (`gw-pricing-analyst`); price the new SKUs: the 3 compliance
   carve SKUs (P_C/P_F/P_S) · `tool-exec` (P_T) · the Provenance bundle · billing-orchestration ·
   auth-sso (possibly one org/enterprise module with the rls carve) · post-decouple `credits` ·
   ui-pro (Stage-1 band) · renewal SKU cents (35–50% band per ADR-0244 — **Kickoff E builds the
   renewal plumbing with sandbox placeholders; this stage owns the real cents**).
2. **Deep forks (operator):** every number, presented with formula outputs (bundle prices =
   0.75 × member sum) and the below-sum invariant checked per bundle.
3. **Output:** the price-lock ADR(s) superseding ADR-0227/0238 numbers where moved; `docs/gtm/
pricing-packaging.md` updated same commit.

### Stage 3 — Catalog-rework SPEC + PLAN

1. **Research/design:** bundle objects + grant migration (whole-edition grants → bundle grants;
   ADR-0113/0225 revoke/clawback semantics must survive the mapping) · Paddle product plan
   (per-package products, bundle prices, retire dead edition products) · brand extraction
   stage 1 mechanics (~9 real call sites, Icon extension-point) · per-package display
   (marketplace rework against the F1b every-package-displayed lock + choice-overload
   mitigation at display level) · the org/enterprise module packaging call (auth-sso + rls
   admin-write in one package or two).
2. **Deep forks (operator):** grant-migration shape · Paddle sequencing (sandbox-first) ·
   org-module packaging · marketplace display design direction.
3. **Output:** `outputs/specs/catalog-rework/SPEC.md` + `PLAN.md` (atomic tasks, per-task
   verify + routing, PRable waves). Tags: `billing` + `external-system` minimum.

### Stage 4 — Build waves (per the PLAN; operator approves PLAN, then unattended per doctrine)

Bundles/carves/brand-cut wave → kit stage 2 (runtime theme API + preset registry) →
per-package frontends wave 1 (the six S-class `./ui` surfaces, ADR-0250 G2d) → cli
codegen-debit decouple then `credits` flip (ADR-0249 G5) → the 4 standards-gate catalog checks
(advisory; greptile critical path) → kit stage 3 (public docs/gallery) when marketed.

## Inputs on disk

`outputs/research/catalog-doctrine-2026-07.md` (F-queue evidence) ·
`outputs/research/catalog-rework-brainstorm-2026-07.md` (G-queue evidence: ui inventory, flip
blast-radius table, bundle-set candidates) · the G2 frontend-investigation results (session
workflow journal; re-derive from the brainstorm doc §1–2 if needed) · `docs/gtm/
{pricing-packaging,market-intel,positioning}.md` · `apps/site/lib/pricing.ts` ·
`docs/state/package-catalog.md`.

## Boundaries

Never auto-decide a fork — **price numbers above all**. The ratchet clock: all OSS-line moves
land before the first `confirm=publish` dispatch. Kickoff E owns the checkout-flip mechanics
(window check, expiry/FIFO, renewal plumbing, EULA copy) — this program only supplies the
NUMBERS. `bun run sot` green is part of every stage wrap. Linear owns WORK (issues per stage
fine); git owns DECISIONS.

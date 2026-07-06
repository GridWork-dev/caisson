# SPEC — @caisson/ui-pro: the commercial kit tier (component line · gallery · v1 · band)

**Status:** LOCKED scope (operator picker 2026-07-06, Kickoff D Stage 1) — **NO BUILD in this
stage**; build scheduling lands in the catalog-rework PLAN (Kickoff D Stage 3).
**Tags:** `ui` `frontend` (the build inherits the standards-gate critical path where it touches
the license boundary; no `billing`/`security` surface in this SPEC itself).
**ADR:** ADR-0259 (locks the four forks below; extends ADR-0250 G2a).
**Kickoff:** `outputs/kickoffs/KICKOFF-D-catalog-program.md` (Stage 1).
**Research grounding:** 11-agent workflow 2026-07-05/06 (internal gap survey grounded in
`apps/site/app/dashboard` + `apps/admin`; Tailwind Plus / MUI X / shadcn-ecosystem /
enterprise-suite teardowns, all prices fetched live; docs-surface survey incl. refero; opus
completeness critic + 4 gap-fills: Cookiy synthetic-persona demand study
`019f35a3-3732-717c-ba5d-d458ba0f46bb`, dashboard-kit + charting-market comps, repo-grounded
commercial-placement analysis, free-vs-paid component matrix). Full agent returns: session
workflow journal `wf_fdeef35a-fc1`.

## Goal

Define the ADR-0250 G2a commercial kit tier precisely enough that (a) the pricing pass (Stage 2)
can price it, (b) the catalog-rework SPEC (Stage 3) can schedule its build and the floor
backfill, and (c) the Apache floor never reads deliberately crippled next to `npx shadcn add`.

## Operator locks (2026-07-06 picker — do not re-ask)

1. **Component line = market-line split.** ui-pro gates only what the market itself paywalls
   (advanced data-ops — the exact MUI X Pro/Premium / AG Grid Enterprise line) plus
   domain-composed compliance/ops surfaces no free kit ships. Every table-stakes basic lives in
   the Apache floor (§2).
2. **Docs surface = `caisson.sh/ui` gallery route** inside the existing `apps/site` Next app:
   live-rendered demos fully public; the package gated at the registry/license layer the Worker
   already runs (MUI/AG model). Build stays deferred per ADR-0250 G2b ("when the kit is marketed
   or the frontend wave needs it") — this lock is the shape, not a build order.
3. **v1 = full 7** (operator override of the written 5-core recommendation): all seven §1
   components ship at first marketing; the internal backlog starts empty. ADR-0237 V1-live
   posture applies — the site only ever shows what exists.
4. **Price-band input to Stage 2 = $129–199, anchor $149; commercial placement =
   standalone-only** (the `ai-evals` pattern: no edition membership, no bundle membership at v1
   — folding it in would re-open the locked below-sum edition math, ADR-0137/0227/0247). Stage 2
   owns the exact cents; the band is input, not a lock.

## 1. The ui-pro component list (v1 = all seven)

Each row names its contract; per-component prop APIs are build-time work. Sources:
`existing-DEEP` = generalize a component already in `packages/ui/src`; `new-build` = greenfield
with a named internal precedent.

| #   | Component           | Source        | Effort | Contract                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------- | ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **DataTable-Pro**   | existing-DEEP | M/L    | Layered ON the floor DataTable's `columns`/`rows` contract (same shape, strictly additive props): multi-column filter builder · row grouping + aggregation · column pin/resize/reorder + saved views · virtualization (10k+ rows) · CSV/XLSX export. Flagship — Cookiy #1 unanimous (4–6-week build-cost quotes).                    |
| 2   | **Tree-Pro**        | new-build     | M/L    | Virtualized large hierarchies, lazy-loaded children, drag-reorder. Mirrors the identical Pro gate in both MUI X Tree View and AG Grid Tree Data. Basic expand/collapse/select disclosure stays floor-eligible (not shipped in floor today — see §2 backfill note).                                                                   |
| 3   | **Ops Matrix**      | existing-DEEP | S      | Generalized `SkuMatrix` (`label + (boolean\|string)[] cells` is already generic under pricing-specific styling): permission matrix · control-coverage matrix · SKU/edition comparison. `SkuMatrix` is absorbed by this component; `apps/site` consumes it first-party (apps/ are exempt from the module boundary).                   |
| 4   | **Audit Timeline**  | new-build     | S/M    | Hash-chain event timeline with verification badges (verified/tampered-link). Generalizes the `.board` link-row pattern hand-rolled 5× in `apps/admin`. **Props-contract only**: type-compatible with `@caisson/audit-worm` chain-entry shapes but takes data as props — NO runtime dependency (see §3 leaf law).                     |
| 5   | **Payload Viewer**  | existing-DEEP | M      | Domain-composed JSON/OSCAL/webhook payload viewer: syntax highlight, copy, collapsible tree, **redaction-aware display**. Builds on the floor `CodeBlock`; replaces the raw `<pre>{JSON.stringify}` dumps in `apps/admin` (`mutations.tsx` ResultBody). Bare JSON trees are commodity — the domain composition is the sellable unit. |
| 6   | **Type-to-Confirm** | new-build     | M      | Destructive-action dialog: retype-the-resource-name arming, busy/ok/warn/err result states, optional audit-event emit hook (callback prop — no audit-worm dep). Extracts the 727-line `MutationCard` pattern (`apps/admin/src/app/business/mutations.tsx:304-368`). Cookiy #3, audit-safety framing.                                 |
| 7   | **Adv Date-Range**  | new-build     | L      | Range picker with fiscal-quarter/billing-cycle presets, comparison-range mode, timezone-aware. Tracks exactly what MUI X paywalls (the richer variant — basic single-range pickers are free in shadcn/Mantine). Weakest internal evidence (no date input exists in either first-party app); heaviest build.                          |

**Acceptance criteria (binding, per component):**

- **Accessibility is a launch gate, not a polish item**: full keyboard navigation, correct ARIA
  roles/labels, focus management (trap/restore in overlays). This was the #1 unprompted
  buy-trigger in all three Cookiy transcripts — ahead of price.
- Ships through `tooling/` (the one standards gate): strict TS, tests, no `any`, no
  `console.log`. Dialog-class components build on native `<dialog>`/`showModal()` (the
  cart-drawer precedent, `apps/site/components/cart-drawer.tsx`).
- Every component themeable via the floor token contract (`SemanticTheme`) — no hardcoded brand
  values (the brand lives in `@caisson/brand`, ADR-0250).

## 2. The floor side of the line (consequence, built as its own open-line work item)

The market-line split is two-sided: gating table-stakes reads as a crippled floor (free in
shadcn/Mantine/MUI-Community/AG-Community/Tremor). The Apache `@caisson/ui` floor therefore:

- **Keeps/returns (post-brand-cut, from today's DEEP set):** `app-shell` (de-branded),
  `data-table` (**gains** basic single-column sort, simple filter, pagination — the free line
  everywhere), `ledger-list`, `money-cell`, `metric-stat`, `theme-toggle`, `reveal`, and the
  marketing set (`hero`, `terminal`, `code-block`, `credential-strip`, `edition-card`,
  `mobile-buy-bar`). `sku-matrix` is the one DEEP component that moves INTO ui-pro (absorbed by
  Ops Matrix, §1.3).
- **Backfills (new open builds, evidence = the hand-rolled-pattern survey):** drawer/modal
  (extract the cart-drawer native-`<dialog>` pattern) · toast · styled select/combobox ·
  pagination control · copy-field/clipboard-button · basic confirm-dialog · link-row/detail-list
  rows (the `.board` + key-value patterns) · **charts as themed Recharts (MIT) wrappers** in an
  optional `@caisson/ui/charts` subpath — charting is a commodity (Tremor gives away 300+
  dashboard blocks free post-Vercel; the ai-meter wave-1 chart consumes these floor wrappers).
- **Ratchet note (ADR-0248):** floor additions are one-way once published — everything above is
  an intentional, permanent widening of the open line, locked here pre-publish.

The backfill is open-line build work scheduled by the catalog-rework PLAN (it precedes or
accompanies the ui-pro build: DataTable-Pro layers on the floor DataTable's upgraded contract).

## 3. Package + commerce mechanics

- **Name/license:** `@caisson/ui-pro`, `LicenseRef-Caisson-Commercial`, registry-gated like
  every commercial module (Worker entitlement filtering, offline Ed25519 — zero new gating
  mechanism). Delivery = the self-hosted registry npm protocol (ADR-0223). The shadcn-CLI
  copy-paste registry pattern the segment is converging on is noted as a possible later
  delivery fork — NOT v1.
- **Leaf law (binding):** nothing under `packages/` may ever depend on `@caisson/ui-pro` — not
  open packages (license boundary) and not commercial ones (the entitlement resolver never walks
  code deps; a ui-pro dep inside a purchased module would break buyer installs — the ADR-0238
  bug class in reverse). Consumers are first-party apps (`apps/site`, `apps/admin` — exempt from
  the module boundary) and buyers. Wave-1 `./ui` package surfaces build on the FLOOR per
  ADR-0250 G2c, unchanged.
- **Dependencies:** the floor (`@caisson/ui`) + permissive-licensed (MIT/Apache) third-party
  libs only (e.g. TanStack Table/Virtual as an implementation choice at build) — no copyleft, no
  commercial pass-through licensing (the Highcharts/AG-Charts math does not close at this band).
- **Placement:** standalone-only (`ai-evals` pattern) — no edition `members` entry, no bundle
  membership at v1. Marketplace display placement (browse family, catalog row) lands in the
  catalog-rework SPEC against the ADR-0246 every-package-displayed lock.
- **Purchase model:** one-time perpetual + 12-month updates window + ~40% renewal (ADR-0244)
  — nothing bespoke.

## 4. Docs/gallery surface (shape locked; build deferred per ADR-0250 G2b)

`caisson.sh/ui` — a dedicated gallery route inside `apps/site` (same Railway service, no new
deploy target): grid/category catalog shell, per-component pages with live-rendered demos
(same-origin, first-party — doubles as dogfooding) + prop tables. **Public everything, gate at
the package layer** (the MUI/AG model: public docs + runtime/registry gate — best SEO and
try-before-buy, and the gate already exists). No docs-side code-blur mechanism gets built. A
lightweight doc-gen convention (component source → prop tables) is named build work so the
gallery can't drift from the package. No roadmap labels anywhere (ADR-0237).

## 5. Price-band input to Stage 2 (evidence, not the lock)

Band **$129–199, anchor $149**, standalone-only. Grounding: Catalyst $149/26-components (the
closest structural comp); shadcn-pro solo tiers $79–199; full dashboard-kit libraries $249–349
(Chakra Pro $299 · Flowbite $299 · Preline $249 · Untitled UI $349) ship 300+ blocks — above
ui-pro's surface; MUI X Pro $657 perpetual/dev is per-seat and not like-for-like. Cookiy WTP
ladder (3 synthetic personas, moderate confidence): $99 no-brainer · $149 fair ceiling · $199
flagship-only · $299 walk-away for anything short of assembled screens.

**Stage-2 rider notes (for the ADR-0244 owner):** MUI's perpetual renewal is a _decaying_
discount (50% → 35% → 15% off as you delay), the opposite shape of caisson's flat ~40% — a
deliberate contrast, flagged not adopted. MUI also publishes an LTS floor (2yr security fixes
regardless of license) that ADR-0244's language has no equivalent for — worth a copy decision
before checkout flips.

## 6. Non-goals (v1)

- No charts in ui-pro (commodity — floor Recharts wrappers, §2).
- No copy-field as a sellable unit (universal Cookiy reject — it's floor backfill).
- No seat metering (flat per-org entitlement like the whole catalog; the market's team
  multiplier is ~2–2.5×, a Stage-2 note at most).
- No edition/bundle membership; no assembled page-template product (that is what $249+ buys
  elsewhere — out of scope at this band).
- No Storybook deployment; no Fumadocs component docs; no shadcn-CLI delivery.

## 7. Follow-ups surfaced by the research (owned elsewhere)

1. **PostHog instrumentation gap** — `apps/site` has no `$pageview` autocapture and the
   `purchase` event carries no SKU/module property; there is zero funnel data for any future
   pricing decision. → Linear issue (filed at Stage-1 wrap).
2. **Generator wiring** — `create-caisson` templates reference `@caisson/ui` zero times; wiring
   the floor into generated repos is the funnel move that makes both the OSS floor and the
   ui-pro upsell real. → catalog-rework SPEC candidate (already flagged in the brainstorm §4.2).
3. **ADR-0244 riders** — §5 notes (LTS security-patch language; renewal-shape contrast). →
   Stage 2.

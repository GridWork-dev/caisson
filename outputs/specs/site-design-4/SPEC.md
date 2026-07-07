---
slug: site-design-4
title: Dual-door hero + top-3 honest-artifact patterns on the homepage
status: SPEC
tags: [ui, frontend]
date: 2026-07-07
locks: [D1 dual-door hero, D4 top-3 UI wave]
sources:
  - docs/state/decisions-and-forks.md — "2026-07-07 research-synthesis picker" (D1 + D4 locks)
  - docs/state/outstanding-work.md — "site-design-4: dual-door hero + top-3 patterns" build row
  - outputs/research/prelaunch-fanout-2026-07/SYNTHESIS.md §1 (positioning) + §6 (UI catalog)
  - outputs/research/prelaunch-fanout-2026-07/wave2-ui-patterns.md (turbostarter file-tree · getRoman diagrams · WorkOS calculator)
linear: CAISSON-28
---

# SPEC — site-design-4: dual-door hero + top-3 honest-artifact patterns

## Goal

Render the already-locked D1 positioning and D4 UI-wave decisions on the marketing homepage (`/`):

1. A **dual-door first-scroll hero** — one umbrella frame with two doors: **"Building something
   regulated?"** → `/compliance` (the compliance acquisition surface) and **"Building for
   production?"** → the six-bundle platform section on `/`. Compliance stays the **wedge** (the lead
   door), production the umbrella — the correct rendering of the ADR-0040 two-layer frame, not two
   equal doors.
2. The **top-3 honest-artifact patterns** from the research catalog, on `/`:
   (a) a **real file-tree + code bento** — real monorepo paths and real code, honest artifacts only;
   (b) an **architecture-isolation + data-lifecycle diagram pair** — the real tenancy-RLS boundary
   and the real write → audit-chain → WORM → verify lifecycle;
   (c) a **bundle-builder calculator** — six bundles + all 22 à-la-carte modules, every price read
   from the pricebook SOT, never a hardcoded cent.
3. **`/compliance` repoint + coherent nav** — compliance-specific acquisition lands on `/compliance`
   (the regulated door routes there); `/` stops doing double duty; the nav stays coherent with
   compliance reachable as the hero door, the lead bundle card, and the first Marketplace-panel entry.

## Why

The shipped `/` is internally inconsistent (SYNTHESIS §1): the hero is 100% compliance, the nav
already treats the six bundles as peers, and a dedicated `/compliance` route exists **unused** as an
acquisition landing page. The wedge-first evidence is one-way (Vanta, WorkOS both broadened only
_after_ wedge traction), so compliance must stay the sharp hook — but the homepage cannot foreclose
the broader platform for the ~60% of visitors who are not regulated-SaaS buyers. The dual-door hero
resolves the split without abandoning the wedge: the regulated buyer gets the sharpest possible hook,
the production buyer gets a door into the six bundles, and `/compliance` finally does the acquisition
job it was built for.

The through-line of the entire research fanout (SYNTHESIS §6): **every winning device for this buyer
is an honest artifact** — real code, real file tree, real architecture, real math. Caisson has 22
real modules and a live pricebook to draw from; the copy law (ADR-0080) is not a constraint here, it
is the strategy the best references already run (TurboStarter's real monorepo tree, getRoman's
architecture-isolation diagram, WorkOS's running-total calculator).

## Background / ground truth

- **D1 LOCKED (2026-07-07 research-synthesis picker):** dual-door hero; compliance stays the hero
  wedge; compliance-specific acquisition repoints at `/compliance`; the Cookiy frame-test (survey 287453) informs door **copy** later, not the direction.
- **D4 LOCKED:** top-3 first — file-tree + code bento · architecture-isolation + data-lifecycle
  diagram pair · bundle-builder calculator. The rest of the Tier-1 catalog + copy sweeps queue behind.
- **ADR-0040** (hero = compliance wedge under a production-rigor umbrella) stands; this is its
  execution. **ADR-0082 / ADR-0237 rider 2**: live self-serve, committed prices, FULL V1-live posture.
- **ADR-0080** copy laws: no invented numbers, no fake scarcity/testimonials, name the mechanism (no
  "enterprise-grade" vagueness), six-bundle vocabulary only (the four editions are DISSOLVED,
  ADR-0257/0258; legacy ids are aliases only).

## What already exists (reuse — do not rebuild)

- **Bundle-builder calculator:** `apps/site/components/stack-builder.tsx` (`StackBuilder`) already
  renders all 22 modules grouped by bundle with a live running total and the cheapest-covering-bundle
  upgrade nudge, driven by `buildStackSummary()` / `MODULE_PRICES` / `BUNDLE_PRICES` in
  `apps/site/lib/pricing.ts` — every figure already interpolated from the pricebook SOT, integer USD
  (ADR-0007), pinned to `@caisson/pricebook` by `pricing.test.ts`. It is mounted at
  `/marketplace/build`. The homepage calculator **reuses `StackBuilder`** (a compact home embed) — the
  pricing math is not re-authored. "Prices interpolated from the pricebook SOT, never hardcoded cents"
  is therefore already satisfied by the shared source.
- **`/compliance` acquisition surface:** `apps/site/app/(marketing)/compliance/page.tsx` is a full
  landing page (hero, ten-package composition, five evidence-card controls, honesty boundary, FAQ +
  FAQPage JSON-LD, pricing). The repoint is **routing/nav**, not a page rebuild.
- **Six-bundle grid:** the `EditionCard` grid already lives on `/` (the "Bundles" section). The
  production door **anchors to it** (add a section `id`); the grid is not re-authored.
- **Kit primitives:** `Hero`, `Terminal`, `CodeBlock`, `Card`, `Section`, `Reveal`, `Icon`,
  `FeatureGrid`, `StatusChip`, `EditionCard` (barrel `apps/site/components/index.ts`). The honest
  artifacts compose from these.

## In scope

### 1. Dual-door hero (`/`)

- A site-local `DualDoorHero` composition (Card + Button + StatusChip + kit primitives) replacing the
  compliance-only `Hero` on `/`. **Compliance is the lead/primary door** (accent identity), production
  the secondary door — the wedge is preserved, the doors are not visually equal.
- Umbrella headline names the production-rigor layer (ADR-0040 two-layer frame); each door carries a
  one-line honest sub-claim and a CTA. Regulated door → `/compliance`; production door → the
  six-bundle section anchor on `/`.
- Door **copy is placeholder-honest** now (real, mechanism-named, ADR-0080-clean) and is refined from
  Cookiy survey 287453 in a later pass — not a blocker for this build.
- A supporting artifact (the existing cross-tenant-denied `Terminal` and/or the install `CodeBlock`)
  may sit alongside the doors; keep it honest (real code/output, ADR-0104 static hero).

### 2. Top-3 honest-artifact patterns (`/`)

- **(a) File-tree + code bento:** a new site-local `FileTree` + a bento layout. The tree shows **real
  monorepo paths** (`apps/`, `packages/`, `tooling/`, `services/`, `registry/`); the bento cells show
  **real code from real files** (e.g. the RLS `FORCE` statement, the `sha256(prev ‖ payload)` chain
  step, an install line) — honest artifacts only, no fabricated file or snippet. Reuse `CodeBlock`/
  `Terminal` inside the bento.
- **(b) Architecture-isolation + data-lifecycle diagram pair:** two hand-authored inline-SVG/CSS
  diagrams — no charting/graph library added. Diagram 1 = the real per-tenant RLS isolation boundary
  (tenant A / tenant B separated by the fail-closed force boundary; a no-context query returns
  nothing). Diagram 2 = the real evidence data-lifecycle (write → append-only audit-chain hash →
  S3 Object-Lock WORM anchor → `caisson audit verify` / evidence-pack export). Both static; motion is
  optional via the existing `Reveal`. Theme-aware (light/dark) per the design system tokens.
- **(c) Bundle-builder calculator:** embed `StackBuilder` (or a compact home wrapper over it) in a
  homepage section, with a short lede and a link to the full `/marketplace/build`. No new pricing math.

### 3. `/compliance` repoint + coherent nav

- The regulated door routes to `/compliance`; confirm `/compliance` reads as the compliance
  acquisition landing (it already does) and carries the correct metadata/JSON-LD (already present).
- The six-bundle section on `/` gets a stable `id` anchor for the production door.
- Nav coherence check: compliance remains reachable as (hero door · lead `EditionCard` · first
  Marketplace-panel bundle); no dead links; the six-bundle vocabulary is consistent across hero,
  grid, and nav.

## Non-goals (queue behind / do not touch)

- The rest of the Tier-1 UI catalog + the copy sweeps (SYNTHESIS §6 Tier-1 tail) — queued behind D4.
- **Any pricing change** — D2/D3 (seat allowance at $629/$739 · compliance/Everything price level)
  are HELD for Cookiy WTP data. Prices are display-only from the existing SOT; this build changes no
  number and no checkout behavior.
- The D8 `/updates` roadmap block (open fork, not adopted), the AEO content program (CAISSON-29), the
  affiliate program (CAISSON-30), and Paddle production prep (CAISSON-31) — separate work rows.
- Final door copy from Cookiy survey 287453 — informs a later copy pass, not this direction.
- Any kit (`@caisson/ui`) change — the dual-door hero and honest-artifact devices are **site-local**
  compositions; the shared Apache-2.0 kit stays untouched (so no `packages/*` changeset is due).

## Constraints / invariants

- **Copy laws (ADR-0080):** no invented numbers — every file path, code snippet, and diagram must
  reflect real repo behavior; no fake scarcity/testimonials; name the mechanism; FULL V1-live posture
  (no roadmap labels / "coming soon" / future framing); six-bundle vocabulary only.
- **Prices from the SOT:** every price rendered (calculator, door sub-claims, any figure) reads from
  `lib/pricing.ts` / `@caisson/pricebook`; no hardcoded cents; money is integer USD (ADR-0007).
- **No new dependency** for the diagrams — hand-authored inline SVG/CSS (ponytail: native over a lib).
- **Kit-first & apps-only:** site-local components live under `apps/site/components`; no `packages/*`
  edits, so no changeset. Server Components by default; the calculator stays the existing client island.
- **Theme-aware + accessible:** diagrams and doors render correctly in light/dark; doors are real
  links/buttons (keyboard-reachable); the calculator keeps its existing polite live-region a11y.
- **`bun run check` green**, `@caisson/site` `next build` green (client/server bundle leaks only
  surface in the build), and `apps/site` tests pass (incl. `components/page-sections.test.tsx`).

## Acceptance criteria (goal-backward)

1. `/` first scroll shows two doors under one umbrella frame; the compliance door leads and routes to
   `/compliance`, the production door routes to the six-bundle section on `/`. Compliance is visibly
   the wedge, not an equal peer.
2. `/` carries all three honest-artifact patterns: a real-path file-tree + real-code bento; the
   architecture-isolation and data-lifecycle diagram pair (both reflecting real behavior); and the
   bundle-builder calculator (all 22 modules + six bundles, prices from the SOT, live total + upgrade
   nudge).
3. Compliance-specific acquisition lands on `/compliance`; `/` no longer acts as a compliance-only
   page; nav has no dead links and uses six-bundle vocabulary throughout.
4. No price changed; no `packages/*` edited (no changeset due); copy passes ADR-0080; build + check +
   site tests green.

## Risks / open questions

- **Door copy** is provisional pending Cookiy survey 287453 — shipped copy must be honest and
  mechanism-named now; a copy-only follow-up swaps in the data-informed lines (no rebuild).
- **Homepage length:** three new sections + the calculator lengthen `/`; order the honest artifacts so
  the wedge → proof → compose narrative reads top-to-bottom, and let the existing `Reveal` pacing
  carry it (SWEEP checks scroll weight, not a blocker).
- **Diagram fidelity:** the two diagrams must not overstate — they depict the shipped RLS/WORM/audit
  behavior already proven by the evidence cards, nothing aspirational (ADR-0080 honesty floor).

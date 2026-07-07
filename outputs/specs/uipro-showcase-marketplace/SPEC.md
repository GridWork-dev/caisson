# SPEC — ui-pro showcase wave + marketplace purchase pop-out

**Status:** locked 2026-07-07 (operator picker, second round) · **Tags:** `ui`, `frontend`
**Tracks:** U (ui-pro) and M (marketplace) — parallel worktree builds, serial merge (U first).

## Goal

1. **Track U** — `@caisson/ui-pro` becomes publish-ready: the 3 confirmed hardening findings
   fixed, four new components added, and a public showcase/gallery shipped — the wave the
   first-publish was HELD for.
2. **Track M** — marketplace browsing never leaves the page: the pop-out card IS the purchase
   surface for both modules and bundles; standalone pages remain as SEO/AEO spokes.

## Track U scope

- **Hardening (all confirmed in code):**
  - `src/lib/date-presets.ts` `previousPeriod()` — guard invalid/empty ranges (no
    `RangeError` from `Invalid Date .toISOString()`); callers in `date-range-picker.tsx`.
  - `src/lib/table-ops.ts` `csvField` — neutralize leading `=` `+` `-` `@` (formula
    injection) on top of RFC-4180 quoting.
  - `src/lib/table-ops.ts` `aggregate()` — replace `Math.min(...nums)`/`Math.max(...nums)`
    spreads with a loop (RangeError at ~125k+ rows).
- **New components (operator picked all four):** Charts pack (dependency-free SVG
  line/bar/area/sparkline, token-driven) · Command palette (Cmd-K, fuzzy match, action
  registry) · DiffViewer (JSON + text before/after, reuses `lib/redact.ts` awareness) ·
  Kanban board (dependency-free DnD + swimlanes). Each: component + pure-logic lib split
  (the sellable-logic convention) + tests.
- **Showcase:** `caisson.sh/ui` route in `apps/site` (ADR-0250 G2b stage-3 locked shape),
  live demos of all 11 components, registry-layer gate posture per the ADR; site gains the
  workspace dep on `@caisson/ui-pro`.

## Track M scope

- **Bundle content record:** extract the 5 hand-authored bundle pages into a shared
  `lib/bundle-pages.ts` record (pages refactor to read from it; rendered SEO content stays
  identical).
- **Pop-out purchase card:** expand `ModulePreviewDialog` to the full card — media slot
  (`MediaVideo`/`MediaPlaceholder` contract), definition, what-ships, artifact,
  stack-compat, collapsed FAQ, add-to-cart; add the mirror `BundlePreviewDialog` off the
  new record. Card/“Learn more” clicks open pop-outs; page links demoted to secondary
  (SEO spokes stay live, marketing nav never redirects).
- **Nav:** bundles dropdown → two-column layout (full 6-bundle list | marketplace pages),
  per the operator note on the picker.
- **Extras (operator picked all four):** cart-aware bundle upsell (pure `lib/pricing.ts`
  math; banner in drawer + `/cart` with one-click swap) · client-side search + filters on
  the module grid (bundle membership / category / has-media) · live `@caisson/ui-pro`
  demos as the ui-pro module pop-out's media (imports the workspace package) · compare
  tray (2–3 modules side-by-side strip).
- **Constraints:** graceful-degrade for the 11 modules without depth records; `onAdded` →
  self-close wiring so the cart drawer never stacks under a dialog; all catalog data stays
  in the three existing layers (`pricing.ts` / `catalog.ts` / page records — no fourth
  registry).

## Out of scope (separate acts)

- ui-pro first-publish (atomic: index entry + `RESERVED_MODULE_ENTITLEMENT_IDS` drop +
  everything-members pin) — trigger fires when this wave MERGES; still its own gated act.
- Bundle-only index delist + Worker republish — ADR-0271, runs independently now.
- CAISSON-25 dunning sandbox simulation — independent verification act.

## Verify

Goal-backward: (U) the three findings have failing-before/passing-after tests; 11
components render in the showcase; gates green incl. the four CI-only classes. (M) from
`/marketplace`, a buyer can view full module/bundle detail and add to cart without a
single navigation; bundle pages byte-render the same SEO content from the new record.

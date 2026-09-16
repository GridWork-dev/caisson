# @caisson/ui-pro

## 0.3.8

### Patch Changes

- Updated dependencies [cd694f1]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/ui@0.6.7
  - @caisson/kernel@0.10.0

## 0.3.7

### Patch Changes

- 2405d9e: Remove unused dependencies and unreferenced internal helpers, relocate integration coverage to the package seams it verifies, and consolidate repeated build and test plumbing. The CLI no longer exports the obsolete minimal `defaultEngine`; use `templatesEngine` or inject a `GeneratorEngine`.
- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [f669d4a]
- Updated dependencies [2405d9e]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [886e1e7]
- Updated dependencies [e190797]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0
  - @caisson/ui@0.6.6

## 0.3.6

### Patch Changes

- Updated dependencies [98bf1f3]
- Updated dependencies [68df709]
- Updated dependencies [7d74f8f]
  - @caisson/ui@0.6.5
  - @caisson/kernel@0.8.0

## 0.3.5

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
- Updated dependencies [b5cd9d6]
  - @caisson/kernel@0.7.0
  - @caisson/ui@0.6.4

## 0.3.4

### Patch Changes

- Updated dependencies [6d1c805]
- Updated dependencies [a00a9ef]
- Updated dependencies [96aa01d]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [2cd4184]
- Updated dependencies [6d1c805]
- Updated dependencies [56e46f1]
  - @caisson/ui@0.6.3
  - @caisson/kernel@0.6.0

## 0.3.3

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [cd48b89]
- Updated dependencies [bd071c9]
- Updated dependencies [c36b9e2]
  - @caisson/ui@0.6.2
  - @caisson/kernel@0.5.3

## 0.3.2

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2

## 0.3.1

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1

## 0.3.0

### Minor Changes

- e5e4311: The redaction predicate re-homes to the open base: `@caisson/ui-pro`'s `lib/redact` now re-exports
  `REDACTED`, `DEFAULT_REDACT_KEYS`, `isRedactedKey`, and `redactValue` from `@caisson/kernel/redact`.
  Every `../lib/redact` import stays stable, and the proof-bundle endpoint redacts server-side
  from the same predicate. Adds a `@caisson/kernel` dependency.

  `AuditTimeline` closes its anchor-blindness gap (T-U4): a new optional `statuses` prop takes
  anchor-derived per-row six-state statuses (computed by the caller from real WORM anchors — no new
  dependency) and badges from them, so a truncated or wholesale-rewritten chain reads `tampered` /
  `unverifiable`, not "verified". When no statuses are given the presentation-side link check still runs
  but its badge is honestly relabelled "Link only" — a link check proves neighbour consistency, never the
  anchor commitment.

  Signed-anchor copy pass: the anchor-aware `verified` badge's aria-label
  now reads "Verified against write-once anchor (signature-checked)", matching the SPEC's locked seal
  copy. Never "impossible to tamper" or an unqualified "independently verified" claim.

  Fix: `build` now copies `src/components/*.css` into `dist/components/` — the plain `tsc` build never
  copied these, so any consumer resolving `@caisson/ui-pro`'s "default"/dist condition (e.g. a Next.js
  app bundling `PayloadViewer`, reached transitively via `audit-worm/ui`'s new dependency) hit a
  `Module not found: ./payload-viewer.css` build failure. Workspace consumers using Bun's "bun" source
  condition were unaffected; this only broke the compiled dist path.

### Patch Changes

- 59e1365: Static a11y lint floor (Kickoff T task 14): eslint-plugin-jsx-a11y recommended wired into the
  shared eslint config, scoped to JSX surfaces. Severities ride at warn for this wave because the
  remaining findings live in packages/ui and apps/site (frozen, owned by the parallel design
  session); the reconcile session fixes those and deletes the warn mapping so the plugin's own
  error severities gate the repo. ui-pro's nine findings are fixed here: labels bound to their
  Selects via useId, redundant tbody role dropped, menu/tree/option containers made
  programmatically focusable, treeitems carry aria-selected, and keyboard handling moved onto the
  focused tree rows.
- 59e1365: TypeScript bridge to 6.0.3 (Kickoff T task 5, re-derived version map): the workspace catalog moves
  from ^5.7.3 to ^6.0.3 (the stable JS-compiler transition release; 7.x is the native compiler whose
  stable API waits for 7.1). standards-gate pins its own typescript to ^6.0.3 explicitly so a future
  catalog move to 7.x cannot strand its ts.createScanner usage. brand, ui-pro, and demo-registry gain
  a css.d.ts ambient declaration for the side-effect CSS imports TS 6.0 now checks (TS2882).
- Updated dependencies [e5e4311]
- Updated dependencies [809592d]
- Updated dependencies [809592d]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/ui@0.6.1

## 0.2.0

### Minor Changes

- b7e58a8: Add the premium component tier, layered on the open design-system floor: an advanced data grid (multi-column filter builder, row grouping with aggregation, column show/hide and pin, CSV export, and fixed-height row virtualization), a virtualized keyboard-navigable tree, an operations/coverage matrix, a hash-chain audit timeline with per-link verification badges, a redaction-aware payload viewer, a retype-to-confirm destructive-action dialog, and an advanced date-range picker with fiscal-quarter and billing-cycle presets and a comparison range. Every component ships full keyboard navigation, ARIA roles and labels, and focus management, and themes entirely through the design-system token contract.

  The open floor kit also gains the table-stakes pieces it was missing: single-column sort, a substring filter, and pagination on the DataTable, plus Dialog (native modal and edge drawer), ConfirmDialog, Toast with a live region, a styled Select, CopyField, standalone Pagination, and DetailList.

- b5a3690: Add three focus-managed interactive primitives: Tooltip, Popover, and Menu (dropdown). All
  hand-rolled with zero Radix and no `@floating-ui` dependency and rendered through a portal
  via `react-dom`'s own `createPortal`. Tooltip follows the WAI-ARIA Tooltip pattern
  (hover/focus-triggered, `aria-describedby`); Popover is a non-modal trigger-anchored
  disclosure (`aria-expanded`/`aria-controls`, Escape-to-close-and-refocus, outside-click
  dismiss) positioned by a small pure, unit-tested placement function (anchor to the trigger,
  flip when it would overflow the viewport, clamp on the cross axis); Menu follows the
  WAI-ARIA Menu Button pattern (`role="menu"`/`"menuitem"`, roving tabindex, arrow-key
  navigation). Every new primitive ships with an automated axe-core accessibility regression
  test exercised against a real, interactive DOM.
- 4c8daa9: Four new components — a dependency-free SVG chart pack (line, bar, area, sparkline), a fuzzy-matched command palette, a redaction-aware JSON and text diff viewer, and a drag-and-drop Kanban board with swimlanes and a keyboard-accessible move fallback. Each splits its pure logic (scale and path math, fuzzy scoring, line and JSON diff, board moves) into a separately exported, unit-tested lib. Also hardens three existing helpers: the previous-period date preset now returns null on a malformed range instead of throwing, CSV export neutralizes leading spreadsheet formula triggers, and column aggregation replaces a min/max argument spread with a loop so large row sets no longer overflow the call limit.

### Patch Changes

- 8253e76: OSS launch readiness wave. LICENSE copyright restamped to Caisson Software LLC across the
  open set. README/AGENTS prose trued to the built reality: six-bundle vocabulary, current
  entitlement examples, decision-record citations stripped from public-facing docs. The
  eu-ai-act-sample template's kernel pin corrected to the current release line, with a
  dynamic staleness test so future version cuts fail loud. Docs service search now races the
  per-query embed against an eight-second deadline and degrades to the keyword floor instead
  of holding the query open past caller budgets; a refund-policy docs page makes refund
  questions answerable. Site sign-in sets a non-HttpOnly session-hint cookie so owned-items
  UI renders without an extra round trip, and the build ignores a spurious Next trace
  warning. Public-mirror exporter hardened: prose renames scoped to the open package set,
  four mirror-only test exclusions, a root bunfig for the mirror workspace, and a historical
  backfill mode for the rot-guard.
- 2c93128: Closes out the a11y and perf polish deferred from the interactive-primitives review:

  - `Dialog` now locks background scroll while open (a native `<dialog>`'s `showModal()`
    traps focus and makes the page inert, but never stopped it from scrolling underneath),
    restoring the prior value on close — including for nested dialogs, which share one
    counted lock so an inner dialog closing doesn't unlock scroll while an outer one is
    still open. Every drawer/modal consumer picks this up automatically.
  - `Tabs` no longer points `aria-controls` at a tabpanel id that doesn't exist in the DOM.
    Only the active tab's panel is ever mounted, so inactive tabs now omit `aria-controls`
    instead of referencing a dangling id.
  - `Tooltip`'s merged trigger ref is now memoized instead of being rebuilt on every render.

- 4d85f28: UI Pro is published to the registry at $129 standalone, and its description now covers the
  full eleven-component set. The Everything bundle republishes with UI Pro pinned at its real
  published version instead of the pre-publish placeholder, so an Everything purchase now
  installs UI Pro like any other member.
- Updated dependencies [08fd857]
- Updated dependencies [0137008]
- Updated dependencies [5a8b317]
- Updated dependencies [8253e76]
- Updated dependencies [f903014]
- Updated dependencies [eff7248]
- Updated dependencies [47e04fd]
- Updated dependencies [51e3ed0]
- Updated dependencies [b5a3690]
- Updated dependencies [b5a3690]
- Updated dependencies [51e3ed0]
- Updated dependencies [c905c61]
- Updated dependencies [2c93128]
- Updated dependencies [b7e58a8]
- Updated dependencies [b43959c]
  - @caisson/ui@0.6.0

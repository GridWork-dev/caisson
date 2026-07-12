# @caisson/ui-pro

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

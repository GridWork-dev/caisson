# ADR-0295 — Drawer primitive + mobile-nav repoint; marketplace-tabs repoint dropped

**Status:** accepted · 2026-07-07 (operator-locked, eleventh-sitting picker over the PR #167
SHIP-review deviation report). Refines ADR-0291. Append-only; supersede with a later ADR,
never edit. **Tags:** `ui`, `frontend`.

## Context

ADR-0291 named `marketplace-tabs` and `mobile-nav` as repoint targets for the new interactive
primitives. The PR #167 builder skipped both with shape rationales, and the independent SHIP
review verified them: marketplace-tabs is genuine cross-page navigation (`<nav>` of links with
`aria-current` — forcing `role="tablist"` would promise same-page arrow-key switching that does
not exist), and mobile-nav is an edge-anchored full-height drawer, the wrong shape for
Popover's anchored-floating-panel model. The fork: accept the intent-satisfied deviation vs
enforce the repoints.

## Decision

- **marketplace-tabs repoint is DROPPED** — it already has the correct a11y shape; repointing
  it to `Tabs` would be an anti-pattern the component's own contract forbids.
- **mobile-nav IS repointed — via a new `Drawer` primitive in `@caisson/ui-pro`** (commercial
  set), built to the same hand-rolled zero-Radix recipe as the other ADR-0291 components.
  Drawer is dialog-class: `role="dialog"` + `aria-modal`, focus trap while open, Escape and
  scrim close, focus returns to the trigger — unlike Popover, a trap is correct here.
- mobile-nav keeps its current behavior contract (hidden above the mobile breakpoint, closes
  on route change, hamburger trigger with `aria-expanded`).

## Consequences

- The ui-pro commercial set grows to four (Tooltip, Popover, Menu, Drawer); the open
  `@caisson/ui` six are unchanged.
- ADR-0291's repoint list is corrected on shape grounds rather than silently deviated from —
  the deviation path (builder rationale → independent review verification → operator lock)
  is the precedent for future ADR-vs-code-shape conflicts.

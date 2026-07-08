# ADR-0296 — Mobile-nav drawer reuses the open Dialog; ui-pro Drawer deleted

**Status:** accepted · 2026-07-08 (operator-locked, eleventh-sitting picker over the PR #167
delta-review findings). Supersedes ADR-0295's mechanism (the repoint enforcement stands; the
vehicle changes). **Tags:** `ui`, `frontend`.

## Context

ADR-0295 locked a new hand-rolled `Drawer` in commercial `ui-pro` and the mobile-nav repoint.
The delta review of the built Drawer surfaced two facts the lock was made without: (1) the
hand-rolled implementation's background is not made `inert`, and `aria-modal` alone is ignored
by iOS VoiceOver — the mobile nav's primary screen-reader platform could walk the AX cursor into
the page behind the scrim; (2) the open-base `@caisson/ui` already ships a native-`<dialog>`
`Dialog` with `variant="drawer"` + a `side` prop, whose `showModal()` provides the focus trap,
Escape, scroll-lock, AND inert background natively — its own docstring warns against exactly the
hand-rolled `role="dialog"` div approach.

## Decision

- **mobile-nav repoints to the existing open `@caisson/ui` Dialog** (`variant="drawer"`),
  extending its `side` support with the top/bottom edges as needed (CSS-level change).
- **The ui-pro hand-rolled `Drawer` is deleted before merge** — no parallel drawer
  implementations ship. The ui-pro commercial set stays Tooltip/Popover/Menu.
- ADR-0295's intent is unchanged and satisfied: mobile-nav rides the kit. The mechanism is the
  open half of the kit, which crosses no tier boundary (Dialog was already Apache-2.0).

## Consequences

- The iOS VoiceOver inert-background hole never ships; `showModal()` semantics are the floor.
- The delta-review→picker path (build → independent review surfaces decision-relevant facts →
  operator re-locks) supersedes a same-sitting lock cleanly; the Drawer implementation remains
  recoverable from the PR #167 branch history if a commercial drawer is ever wanted.

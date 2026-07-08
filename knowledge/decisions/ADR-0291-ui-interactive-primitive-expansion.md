# ADR-0291 — UI interactive-primitive expansion: split by complexity, hand-rolled zero-Radix

**Status:** accepted · 2026-07-07 (operator-locked, tenth-sitting picker over the
`gw-frontend-designer` component-library audit `outputs/research/ui-component-library-audit-2026-07-07.md`).
Extends ADR-0099 (the component recipe) and ADR-0250 (the ui / ui-pro open-vs-commercial split).
Append-only; supersede with a later ADR, never edit. **Tags:** `frontend`, `ui`.

## Context

`@caisson/ui` (34 components) is strong on marketing / data / status primitives but **missing the
standard interactive primitives** a paid kit's consumers expect: Tabs, Tooltip, Popover,
Dropdown/Menu, Accordion, Checkbox, Radio, Switch, Badge. The gap forces app surfaces to
**hand-roll native controls inline** (raw `<input type=checkbox>`, a bespoke `marketplace-tabs`
bar, a hand-rolled nav drawer) — exactly the drift the kit exists to prevent, and the class of bug
this session fixed (the marketplace card meta-row overflow). Two forks were open: where the new
primitives live (open base vs commercial), and whether the focus-managed ones may pull a headless
dependency against the kit's zero-Radix recipe.

## Decision

- **Placement split by complexity.**
  - **Open base — Apache-2.0 `@caisson/ui`:** the presentational / simple-state primitives that are
    table stakes and drive adoption — **Tabs, Checkbox, Radio, Switch, Badge, Accordion**.
  - **Commercial `@caisson/ui-pro`:** the three focus-managed / positioning-hard primitives —
    **Tooltip, Popover, Dropdown/Menu** — as premium components.
- **Hand-roll all, zero-Radix.** Every new primitive — including the hard three — is hand-rolled to
  preserve the kit's zero-dependency recipe (ADR-0099): co-located plain CSS reading only `--cs-*`
  tokens, `forwardRef` onto one root, BEM naming, server-safe unless it owns state. Focus-trap and
  positioning for Tooltip/Popover/Menu are hand-written (no `@floating-ui`, no Radix). The
  zero-dependency, own-the-source posture is the kit's real differentiator vs shadcn/Radix and the
  "own it, no lock-in" pitch — worth the extra code and a11y-test burden.
- **Repoint the hand-rolled inline controls** at the new primitives once they land: the marketplace
  facet checkboxes + `marketplace-tabs`, the nav drawer, and any admin inline controls. This removes
  the drift class, not just adds components.
- **A11y is enforced, not just written:** the new interactive primitives ship with an automated a11y
  regression check (jest-axe or Playwright + axe) in the kit test suite, since the strong
  hand-written a11y (WAI-ARIA, focus-visible, ≥24px targets) is otherwise unguarded as the kit grows.

## Consequences

- The open base gains the primitives that make it genuinely adoptable; `ui-pro` gains three premium,
  harder-to-build components that justify the paid layer — the split matches the revenue story
  without gutting the free base (competitors give the simple ones away, so keeping those open is
  strategically correct).
- Hand-rolling the hard three is the larger build + test cost; it is accepted deliberately for
  recipe purity and zero new dependencies. Revisit only if a hand-rolled positioning/focus bug
  proves intractable.
- The `no-depend-up` open↔commercial boundary (standards-gate) holds: `ui-pro`'s Tooltip/Popover/Menu
  may depend on open `@caisson/ui` primitives, never the reverse.
- Theming contract + the `/ui` showcase rebuild (audit recs 2/3, the public gallery = the CAISSON-35
  Kit-stage-3 surface) are adjacent follow-ons, not bound by this ADR.
- Presentation/kit-layer only — no pricing, entitlement, auth, or go-live-copy change.

# ADR-0194 — WCAG 2.2 AA accessibility floor

**Status:** accepted · 2026-07-01 (site-marketplace-rework track — operator lock, picker round 2026-07-01).
**Relates:** ADR-0100 (token/theming hardening — dark-mode contrast), ADR-0101 (deterministic design-quality
gates, incl. the axe both-modes gate), ADR-0193 (drawer focus contract this ADR requires), ADR-0195 (mobile
`ThemeToggle` this ADR requires), ADR-0191 (`/build` + `/modules` live regions this ADR requires), and
sibling site-marketplace ADRs 0189-0193/0196.

## Context

Code-grounding found the good parts already pass: focus-visible rings ship (`button.css:47-50`,
`global.css:76-79`), contrast gate #2 is live over semantic + functional tokens in both modes (per
ADR-0101), and dark-nav contrast is ~7.84:1, clearing AA. The real, confirmed gaps: the cart drawer has no
focus management, and the mobile menu has no theme toggle.

## Decision

AA is the non-negotiable floor — a compliance brand failing AA basics is an own-goal. Every fix folds into
its **owning fork** rather than a standalone build:

- The drawer focus contract → D-5/ADR-0193 (native `<dialog>.showModal()`).
- The mobile `ThemeToggle` → D-7/ADR-0195.
- The `/build` running-total + `/modules` filter-count live regions → D-3/ADR-0191.

Keep the skip-link before nav; interactive trigger target sizes ≥24px (SC 2.5.8); the axe both-modes gate
(#6, per ADR-0101) runs at SHIP. Any new functional token extends the contrast gate.

## Rejected

- **A standalone "a11y phase" build** — a11y rides each surface's fork so each gap is root-caused once, in
  the surface that owns it.

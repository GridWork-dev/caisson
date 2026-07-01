# ADR-0190 — Primary nav: Editions disclosure panel

**Status:** accepted · 2026-07-01 (site-marketplace-rework track — operator lock, picker round 2026-07-01).
**Relates:** ADR-0078 (brand system), ADR-0099 (component/kit packaging), ADR-0102 (marketing signature —
restraint precedent), ADR-0192 (buy-verb — fixes the "Get started" CTA destination this fork defers), and
sibling site-marketplace ADRs 0189/0191/0193-0196.

## Context

The four edition links sit flat beside Pricing/Docs with no umbrella grouping — `routes.ts:37-41` give
editions and Pricing identical `nav: true` with no hierarchy, and `nav-links.tsx:16-31` renders them as a
flat `.map`. The umbrella→edition model (one base, four editions) is invisible in the nav, the audit's #1 IA
failure. Dark-mode nav contrast was investigated and **refuted** as a problem (~7.84:1, clears AA).

## Decision

Operator picked option A. Replace the flat edition links with **one "Editions ▾" trigger** opening a
text+mono disclosure panel — **no icon grid**: "one base, four editions" → the 4 editions each with a
one-line mono descriptor → an à-la-carte modules link → the bundle price. Top nav becomes: **Editions ▾ ·
Pricing · Docs · ⌘K · Cart**. Implement as a WAI-ARIA APG **Disclosure** (not `role=menu`); top-level items
stay real `<a>` links; `Esc` closes; focus is contained; mobile collapses to an accordion in mobile-nav. The
"Get started" CTA destination is fixed under D-4/ADR-0192.

## Rejected

- **B — search-first minimal**: punts the umbrella explainer to an `/editions` page cold traffic may not click.
- **C — persistent umbrella sub-bar**: a permanent second-row chrome taxes the restrained brief.
- **Stripe-style icon-grid mega-menu**: the exact cliché the brand exists to avoid.

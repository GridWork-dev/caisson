# ADR-0191 — Marketplace: three-route split + `/build` configurator

**Status:** accepted · 2026-07-01 (site-marketplace-rework track — operator lock, picker round 2026-07-01).
**Relates:** ADR-0129 (per-module pricing), ADR-0131 (on-site cart + multi-item Paddle checkout), ADR-0136
(license-keyed registry gating), ADR-0137 (edition reprice below module-sum), ADR-0194 (a11y — the live
regions this fork specifies), and sibling site-marketplace ADRs 0189-0190/0192-0196.

## Context

`/pricing` is a 727-line single scroll doing four jobs at once: 4 edition cards, a 14-module grid, the SKU
matrix, and subscriptions. The module grid has no filter/sort/running-total. The SKU matrix is duplicated
home vs `/pricing`. No `/modules` or `/build` route exists. `CartProvider.useCart()` already tracks items —
the running-total primitive exists, but no page consumes it as a total yet. Backend commerce (per-module
registry gating + multi-item Paddle cart) already exists; this fork is the **frontend**.

## Decision

Operator picked option 1. Split into three routes sharing **one client cart/pricing hook**:

| Route      | Job                                                                                                                                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/pricing` | Tiers + bundle with the de-duplicated comparison matrix.                                                                                                                                                                                                                    |
| `/modules` | Faceted à-la-carte catalog — left facets (category / edition-included-in / price-band / license-type) with per-value counts, active-filter chips, AND-across-facets / OR-within-facet — plus grid.                                                                          |
| `/build`   | Flagship two-column configurator — module picker left, `position: sticky` running-total rail right with itemized integer-cent line items and a "this equals Edition X — upgrade & save $Y" card once the total crosses an edition price; bottom-sheet fallback under 768px. |

The running total is wrapped in `role=status aria-live=polite aria-atomic` (initialized empty, debounced
~500ms); a **separate** live region announces filter result counts. All three route to the existing
multi-item Paddle cart. Sequencing: do the split first (extract `ModuleCatalogGrid` to `/modules` + hoist
the shared SKU const), then build `/build`.

## Rejected

- **Option 2 — two-route + drawer configurator**: a drawer is a weak flagship, hard to deep-link/share a
  build, and forfeits `/build` SEO.
- **Option 3 — single `/modules` with a sticky tier strip**: re-creates the exact "4 jobs on 1 page"
  overload this fork exists to escape.

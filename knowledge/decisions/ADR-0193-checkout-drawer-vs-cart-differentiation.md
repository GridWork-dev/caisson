# ADR-0193 — Checkout: differentiate drawer vs `/cart`, single-sourced primitives

**Status:** accepted · 2026-07-01 (site-marketplace-rework track — operator lock, picker round 2026-07-01).
**Relates:** ADR-0131 (on-site cart + multi-item Paddle checkout), ADR-0132 (buyer sign-in — the
`/dashboard/cart` post-auth handoff), ADR-0194 (a11y — resolves the drawer focus-management gap this ADR
closes), and sibling site-marketplace ADRs 0189-0192/0195-0196.

## Context

The cart drawer, the `/cart` page, and `/dashboard/cart` triplicate near-identical item+subtotal JSX with no
shared line-item component. There is no bundle-savings nudge in cart (`bundleSavings()`/`editionsSubtotal()`
exist but are imported only by `/pricing`). There is no trust row at checkout (the `/procurement`
`WHAT_CAISSON_SHIPS` content is unlinked from every cart surface). The drawer asserts `aria-modal=true` with
**no** focus-trap / `Esc`-dismiss / return-focus — a real WCAG 2.4.11 / 2.1.2 failure. Paddle is only
reachable post-login at `/dashboard/cart`.

## Decision

Operator picked option C — differentiate by purpose, not collapse to one surface:

| Surface           | Job                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Drawer            | Quick glance — line items with product links, a compact bundle-savings nudge, a condensed trust row, CTA → `/cart`.                                                      |
| `/cart`           | The rich surface — line-item edit, the full bundle-optimizer nudge, the trust row, and an inline "Buying for a team / need a PO?" procurement form (VAT/invoice fields). |
| `/dashboard/cart` | The post-auth Paddle pay handoff — a third, distinct job, not a duplicate.                                                                                               |

Neutralize option C's known duplication risk by **single-sourcing** the shared primitives: one line-item
component and one bundle-math function consumed by both the drawer and `/cart`, so the two surfaces differ
in **depth**, never in duplicated JSX or a second copy of the price/bundle logic. The drawer gets the native
`<dialog>.showModal()` focus contract (free trap + `Esc` + return-focus), closing the D-6 gap. The bundle
nudge is shown upfront (FTC-clean, no dark pattern — the brand is anti-scareware).

## Rejected

- **Option A — single-surface drawer checkout**: the operator kept `/cart` for procurement/PO breathing room.
- **Option B — full `/checkout` page**: contradicts the drawer-glance value and adds a nav+load hop for a
  handful of license SKUs.

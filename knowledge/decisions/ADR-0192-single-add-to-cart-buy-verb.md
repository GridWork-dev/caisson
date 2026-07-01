# ADR-0192 — Single "Add to cart" buy-verb sitewide

**Status:** accepted · 2026-07-01 (site-marketplace-rework track — operator lock, picker round 2026-07-01).
**Relates:** ADR-0131 (on-site cart + multi-item Paddle checkout), ADR-0116 (billing driver scope), ADR-0190
(nav — the "Get started" CTA this fork fixes), ADR-0195 (button-variant lock — the "2 variants + 1 tertiary"
rule this fork co-establishes), and sibling site-marketplace ADRs 0189-0191/0193-0196.

## Context

Edition and bundle cards render **both** `CheckoutCta` ("Get X" → `/dashboard/plan` direct checkout) and
`AddToCartButton` on the same card with no hierarchy (`pricing/page.tsx:391-398, 488-505`). Edition
**detail** pages have only "Get \<Edition\>" → `/pricing` and no add-to-cart at peak intent. Module cards are
already single-verb (`AddToCartButton` only).

## Decision

Collapse to a single **"Add to cart"** primary verb wherever a SKU is purchasable — edition cards, the
bundle card, and the edition detail pages (add `AddToCartButton` at peak intent, the currently-missing CTA).
Demote the direct "Get X" → `/dashboard/plan` path to at most a secondary "Learn more →" text link (or retire
it), so the cart is the one road to Paddle; every surface then matches the module cards' existing
single-verb pattern. Fix the "Get started" nav CTA to a real getting-started destination or relabel it (was →
`/pricing`, a label≠destination mismatch). This locks the "exactly 2 button variants + 1 tertiary text link"
rule together with D-7/ADR-0195.

## Rejected

- **Keeping the two competing verbs** — a consistency-and-standards violation and a measured conversion
  leak: buyers can't predict which button takes their money.

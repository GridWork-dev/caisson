# C02 — delete retired marketplace/build residue

**Verdict:** VERIFIED DELETE  
**Size:** 441 directly targeted LOC  
**Risk:** low

## Evidence

- Dead CSS spans: `apps/site/components/marketplace.module.css:8-28,286-300,426-655`.
- Dead pricing surface: `SKU_PRICE_ROW`, `StackUpgrade`, `StackSummary`, `bestStackUpgrade`, and
  `buildStackSummary` at `apps/site/lib/pricing.ts:666-676,678-764` (98 lines; retained separator at
  line 677 excluded).
- Self-only tests are `apps/site/lib/pricing.test.ts:10,229-304`.
- `/pricing`, `/build`, and old marketplace build/catalog routes permanently redirect at
  `apps/site/next.config.ts:133-144`.
- Live cart/upsell paths use separate implementations:
  `apps/site/components/cart-shared.tsx:67-125`, `apps/site/lib/cart-upsell.ts:50-115`, and
  `apps/site/lib/cart.ts:111-127`.
- `marketplace-surface.tsx:34` is the sole CSS-module importer; no dynamic/indexed class access was
  found for the candidate selectors.
- ADR-0378 explicitly retired StackRail (`knowledge/decisions/ADR-0378-media-overhaul-program-locks.md:53-74`).

## Registry/revenue

Private app code only; no ledger/index/bundle effect. Current marketplace, cart, and checkout
behavior remain unchanged.

## Refute attempt

The refuter checked route conventions, dynamic imports, CSS-module indexing, cart paths, and tests.
No hidden caller survived. Retain the live CSS region at `marketplace.module.css:302-424` and update
stale comments that still name retired surfaces.

**Buyer/site notice:** none expected.

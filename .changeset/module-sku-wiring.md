---
"@caisson/pricebook": patch
---

Wire the real Paddle sandbox price ids for the 15 a-la-carte module SKUs
(including the newly locked agent-runner module) plus a direct credit-pack
row into PURCHASE_BOOK (module-SKU wiring). Every module row is a perpetual
license-only buy (credits 0, entitlements the bare module slug), mirroring
the earlier edition/bundle REAL rows; the credit-pack REAL row grants 5000
credits and no entitlement, mirroring its own PLACEHOLDER row. The existing
PLACEHOLDER rows stay in place as bound purchases.test.ts fixtures, and
agent-runner gains a matching PLACEHOLDER row for convention symmetry. The
alerting/retention-runner rows drop their stale FUTURE/not-yet-built caveat:
both shipped in Stage-2 (ADR-0150/ADR-0151) and are registry-indexed.
PURCHASE_BOOK_VERSION bumped to 2026-07-02.1 (ADR-0006 append-only).

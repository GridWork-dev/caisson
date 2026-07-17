---
"@caisson/site": patch
"@caisson/platform-migrations": patch
---

Renumber the three CAISSON-110 demo-run site-local migrations 0023-0025 → 0027-0029: the shared
platform chain had itself grown 0023_order_record_subscription_link…0026_affiliate_code, so the
demo entries sorted mid-chain, renumbered prod's applied positional ledger, and failed the
caisson-license predeploy closed on checksum drift (nothing applied). The migrations have never
been applied anywhere persistent, so the rename is safe. Adds an append-only assembled-ledger
golden test pinning the merged chain, and updates the claimed-prefix registry note (next free:
0030).

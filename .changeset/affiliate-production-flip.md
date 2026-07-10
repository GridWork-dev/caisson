---
"@caisson/billing": minor
"@caisson/billing-orchestration": minor
"@caisson/platform-migrations": minor
"@caisson/platform-reads": patch
---

Affiliate program production flip (ADR-0315/ADR-0319). Paddle webhook parsing now
captures `discount_id` on both one-time purchases and subscription invoices, and the
order record stamps it via a new append-only platform migration. The billing provider
port gains an optional `createDiscount` method (Paddle implementation mints the fixed
10%-off affiliate codes), and a new affiliate code registry migration carries per-code
program parameters (discount percent, commission basis points) stamped at mint time so
historical rows survive future parameter changes. Platform-reads test harnesses updated
for the new order-record column.

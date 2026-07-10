---
"@caisson/billing": minor
"@caisson/billing-orchestration": minor
"@caisson/platform-migrations": minor
"@caisson/platform-reads": patch
---

Affiliate program support. Paddle webhook parsing now captures `discount_id` on both
one-time purchases and subscription invoices, and the order record stamps it via a new
append-only platform migration. The billing provider port gains an optional
`createDiscount` method (the Paddle implementation mints percentage discount codes; other
drivers may omit it), and a new affiliate code registry migration carries per-code program
parameters (discount percent, commission basis points) stamped at mint time so historical
rows survive future parameter changes. Platform-reads test harnesses updated for the new
order-record column.

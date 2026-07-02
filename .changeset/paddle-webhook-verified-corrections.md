---
"@caisson/billing": patch
---

Fold in the 2026-07-01 Paddle-docs adversarial verification (all claims checked against
developer.paddle.com): the signature timestamp tolerance now matches Paddle's documented SDK default
of 5 seconds (was Stripe's 300s, a silent 5-minute replay envelope); transaction `origin` maps
correctly — `web`/`api` = the subscription's first charge → `subscription_create`,
`subscription_recurring` → `subscription_cycle`, and `subscription_charge` (a MID-CYCLE one-time
charge, not the first charge) is now non-granting, closing an over-grant of a full cycle allotment;
the cycle idempotency anchor is the transaction id (Paddle documents `invoice_id` as deprecated and
scheduled for removal).

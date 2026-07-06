---
"@caisson/pricebook": minor
---

New RENEWAL_BOOK (ADR-0244/0251): one updates-renewal SKU per renewable edition/module mapping a Paddle price id to the entitlement whose 12-month updates window it extends. Fail-closed resolveRenewal plus the isRenewalPrice branch predicate; a price id lives in exactly one of PURCHASE_BOOK / PLAN_BOOK / RENEWAL_BOOK. Placeholder sandbox price ids; cents live in Paddle, never in code.

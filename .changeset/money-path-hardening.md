---
"@caisson/billing": patch
"@caisson/credits": patch
"@caisson/service-license": patch
---

Money-path hardening (post-wave triage CAISSON-5/6/7/8/9). `parsePaddleEvent` now correlates
`items[]` to `details.line_items[]` by their shared `price_id` instead of array position, and fails
closed on a duplicate non-empty per-line join id; a malformed adjustment item now signals through an
optional `onWarn` callback instead of a silent skip. `@caisson/credits` gains
`creditsClawedForSource`, which `services/license`'s `applyBillingEvent` uses to bound a
whole-transaction `type:full` refund claw to the purchase's granted-minus-already-clawed remainder,
never spilling onto another purchase's credits. `services/license`'s admin mutation surface
(`grantEntitlementAdmin` / `adjustCreditsAdmin`) now fails closed with a 404 on a nonexistent target
account, rolling back the whole transaction before any entitlement or credit row commits.

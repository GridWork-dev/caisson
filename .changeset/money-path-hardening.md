---
"@caisson/billing": patch
"@caisson/credits": patch
"@caisson/tenancy-rls": patch
"@caisson/service-license": patch
---

Money-path hardening (post-wave triage CAISSON-5/6/7/8/9). `parsePaddleEvent` now correlates
`items[]` to `details.line_items[]` by their shared `price_id` instead of array position, and fails
closed on a duplicate non-empty per-line join id; a malformed adjustment item now signals through an
optional `onWarn` callback, threaded all the way from `PaddleConfig` through `verifyAndParse` and
wired to `services/license`'s stderr telemetry, instead of a silent skip. `@caisson/credits` gains
`creditsClawedForSource`, which `services/license`'s `applyBillingEvent` uses to bound BOTH a
whole-transaction `type:full` refund claw AND a per-line partial claw to the purchase's
granted-minus-already-clawed remainder regardless of delivery order, never spilling onto another
purchase's credits. `@caisson/tenancy-rls` gains `buildAdminSelectPolicySql`, a SELECT-only
cross-tenant policy variant; `services/license`'s admin mutation surface now uses it (rather than the
write variant) for its read-only `account_member` existence check, and (`grantEntitlementAdmin` /
`adjustCreditsAdmin`) fails closed with a 404 on a nonexistent target account, rolling back the whole
transaction before any entitlement or credit row commits.

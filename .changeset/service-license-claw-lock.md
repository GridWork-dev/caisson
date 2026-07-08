---
"@caisson/service-license": patch
---

Route the refund webhook (whole-transaction and per-line branches) and the admin `purchase_revoke`
action's credit clawback through `@caisson/credits`'s new `outstandingClaw` guard, closing the
read-then-claw race described in ADR-0225/ADR-0113's clawback arithmetic. Also close a sibling
ADR-0269 residual: the Developer-plan `coversOwnedEntitlements` re-grant (`invoice.paid`) now
shares an account-scoped advisory lock with `reconcileCoverageGrants` (the refund sweep), via a new
`grantOwnedCoverageMirrors` function both routes call — a coverage-mirror grant and a concurrent
refund's reconcile for the same account can no longer interleave out of order. Two new tests pin the
scoping boundary a one-time purchase's refund already respects (a sibling subscription grant's
credits/entitlement stay untouched) and today's safe no-op on Paddle dunning/past-due event types
(ADR-0269 §6 — the follow-up on whether Paddle's dunning config cancels vs pauses is unchanged;
building `subscription.paused` handling stays out of scope here per that accepted residual).

---
"@caisson/service-license": patch
---

Route the refund webhook (whole-transaction and per-line branches) and the admin purchase-revoke
action's credit clawback through the shared `outstandingClaw` guard in `@caisson/credits`, closing
a read-then-claw race where two differently-keyed clawback attempts against the same purchase
could drain an unrelated purchase's unspent credits out of the shared wallet. The Developer-plan
owned-coverage re-grant now shares an account-scoped advisory lock with the refund sweep via a new
`grantOwnedCoverageMirrors` function, so a coverage-mirror grant and a concurrent refund reconcile
for the same account can no longer interleave out of order — and every billing mutation path
(invoice grant, cancel revoke, both refund branches, admin revoke) now acquires that account lock
FIRST via `acquireAccountBillingLock`, one canonical order that removes advisory-lock deadlocks
between racing deliveries. Tests pin the lock order on every path, the one-time refund's scoping
boundary (a sibling subscription grant's credits and entitlement stay untouched), the actual
behavior of a refund keyed to a subscription cycle's transaction id (the cycle's own unspent
credits are clawed, bounded to that cycle's grant; the entitlement survives until cancellation),
and today's safe no-op on dunning and past-due event types.

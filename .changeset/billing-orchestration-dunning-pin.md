---
"@caisson/billing-orchestration": patch
---

Test-only: pin that Paddle dunning/past-due event types (`transaction.payment_failed`,
`subscription.past_due`, `subscription.paused`, `subscription.resumed`) parse to a safe no-op
today, so a future change to the event-type switch is a deliberate decision rather than an
accidental drop. No behavior change; the released artifact is byte-identical (tests are excluded
from the tarball).

---
"@caisson/billing-orchestration": minor
"@caisson/site": patch
---

Billing orchestration gains a browser-safe `./browser` entry point carrying the pure claim-key half
of the webhook idempotency layer: the fail-closed source event id guard and the per-effect composite
key derivation, which now live in their own module with no database or Node dependencies. The claim
itself is unchanged and stays on the main entry, since it runs as an insert inside your tenant
transaction. Both guards are also exported from the main entry, which keeps the complete surface, and
`processEvent` and `withIdempotentSideEffect` delegate to them, so the key rules have exactly one
implementation and every thrown message is what it always was. The site's billing-orchestration
interactive demo now runs those shipped guards instead of a hand-maintained copy.

---
"@caisson/ai-meter": minor
"@caisson/site": patch
---

ai-meter gains a browser-safe `./browser` entry point: the versioned price book with its integer
cost normalizer, the pre-call token estimator, and the spend vocabulary — the default scope, the
breaker's state shape, and the `SpendCapError` a capped tenant raises — can now be imported inside
a client bundle. The database-bound half is deliberately absent from it: `reserve()`,
`reconcile()`, the stored circuit breaker and the schema all stay on the main entry, which is
otherwise unchanged and still carries the complete surface. Every name on the browser entry is also
available there, and no existing import moves or changes behavior. The site's ai-meter interactive
demo now prices its sample calls through that real code instead of a hand-maintained copy.

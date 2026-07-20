---
"@caisson/compliance-core": minor
---

Compliance evidence packs can now be re-run on a schedule instead of only on demand. A new drift
monitor re-executes your registered evidence collectors, compares the fresh results against the
last run, and flags exactly which controls changed status. Buyers can accept a known, named gap for
a limited time (with an expiry and a required reason) so an already-acknowledged issue doesn't
re-alert on every run — but a genuinely new or different problem on that same control still alerts,
even while an acceptance is active. Every scheduled run is committed to the existing tamper-evident
audit trail, so the history of compliance posture over time is itself verifiable, not just the
latest snapshot.

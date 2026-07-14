---
"@caisson/ui-pro": minor
---

The redaction predicate re-homes to the open base: `@caisson/ui-pro`'s `lib/redact` now re-exports
`REDACTED`, `DEFAULT_REDACT_KEYS`, `isRedactedKey`, and `redactValue` from `@caisson/kernel/redact`
(GATE-3). Every `../lib/redact` import stays stable, and the proof-bundle endpoint redacts server-side
from the same predicate. Adds a `@caisson/kernel` dependency.

`AuditTimeline` closes its anchor-blindness gap (T-U4): a new optional `statuses` prop takes
anchor-derived per-row six-state statuses (computed by the caller from real WORM anchors — no new
dependency) and badges from them, so a truncated or wholesale-rewritten chain reads `tampered` /
`unverifiable`, not "verified". When no statuses are given the presentation-side link check still runs
but its badge is honestly relabelled "Link only" — a link check proves neighbour consistency, never the
anchor commitment.

T-F1 copy pass (GATE-1 lock, ADR-0344 — signed anchors): the anchor-aware `verified` badge's aria-label
now reads "Verified against write-once anchor (signature-checked)", matching the SPEC's locked seal
copy. Never "impossible to tamper" or an unqualified "independently verified" claim.

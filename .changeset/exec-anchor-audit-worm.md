---
"@caisson/audit-worm": minor
---

External anchoring v1 (TSA `trusted-timestamped` leg): the `TrustedTimestampLog` port with a
deterministic `StubTrustedTimestampLog` and a live RFC-3161 `TsaAnchorLog` (real DER via pkijs), a
durable `anchor_outbox` state machine (persist-before-egress; response loss resolves to
`needs_reconcile`, never a blind resubmit), and the per-tenant checkpoint handler + `@caisson/jobs`
task (`ANCHOR_CHECKPOINT_TASK`). Adds pinned `pkijs`/`asn1js` and a `@caisson/jobs` down-edge.
`packages/jobs` gains zero anchoring knowledge (CR-16). The audit-worm minor bump needs the
Compliance bundle members-fold republish (`packages/compliance/manifest.ts` pins
`@caisson/audit-worm`).

---
"@caisson/kernel": minor
---

Per-row audit verification kernel surface (per-row-verification-ui, forks ADR-0344). The pure,
node-free canonical serialization and the JSON value/entry/anchor/verification types move to a new
`canonical.ts`, so a browser bundle can reach them without the node-tainted `.` barrel. A new
`@caisson/kernel/audit-verify` subpath adds the WebCrypto `hashChainLinkAsync`,
`verifyEntryAgainstAnchor`, the six-state `classifyRowState`, and the versioned `buildRowReceipt` (raw
proof material, no WORM key). A new `@caisson/kernel/redact` subpath holds the redaction predicate
moved out of ui-pro so the proof-bundle endpoint can mask secret fields server-side. The `.` barrel
API stays byte-identical and the canonical-bytes goldens are unchanged.

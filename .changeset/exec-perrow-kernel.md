---
"@caisson/kernel": minor
---

Per-row audit verification kernel surface (per-row-verification-ui, forks ADR-0344). The pure,
node-free canonical serialization and the JSON value/entry/anchor/verification types move to a new
`canonical.ts`, so a browser bundle can reach them without the node-tainted `.` barrel. A new
`@caisson/kernel/audit-verify` subpath adds the WebCrypto `hashChainLinkAsync`,
`verifyEntryAgainstAnchor`, the six-state `classifyRowState`, and the versioned `buildRowReceipt` (raw
proof material, no WORM key). A new `@caisson/kernel/redact` subpath holds the redaction predicate
moved out of ui-pro so the proof-bundle endpoint can mask secret fields server-side. `AuditChainAnchor`
gains additive optional `sig` and `keyId` fields (signed anchors, GATE-1) that are excluded from the
canonical core, so unsigned anchors stay byte-identical. The `.` barrel API stays byte-identical and
the canonical-bytes goldens are unchanged.

A new `@caisson/kernel/evidence` subpath (T-E1/T-K4) adds `buildEvidencePack(receipts, meta)`: a
deterministic, self-describing export bundle — the caller's `RowReceipt`s (seq-sorted), a
self-contained zero-dependency `standalone-verifier.mjs` (no `@caisson/*` import — a third party runs
`node verify.mjs receipts.json` with no monorepo install), and a README whose trust claim matches
what the verifier actually checks. `RowReceipt.anchor` gains additive, OPT-IN `genesisHash`/`sig`/
`keyId` fields (`buildRowReceipt`'s new `includeAnchorProvenance` flag, default off — every existing
receipt shape, including the live admin proof endpoint's, is byte-identical to before) so a pack can
carry enough material for its bundled verifier to independently check an anchor's Ed25519 signature
against a pinned public key (GATE-1/H4) — the offline instance of "verify without trusting caisson".
When no signing key is embedded, the pack's README states the weaker, honest self-consistency claim
instead of overclaiming (SPEC copy law).

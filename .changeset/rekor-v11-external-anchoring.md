---
"@caisson/audit-worm": minor
---

External anchoring v1.1 (Rekor `externally-transparent` leg): the `TransparencyLog` port grows a
self-managed-key `RekorAnchorLog` that submits the canonical anchor bytes to a Rekor v2 tiles log
(`hashedrekord/0.0.2`, ed25519ph over a deployment-level anchoring key) read from a deployment-supplied
SigningConfig (never a hardcoded shard URL), plus an `OpenTimestampsAnchorLog` drop-in behind the same
port. `verifyExternal` deepens from existence+byte-match to a fully offline check for public-log
receipts — C2SP signed-note checkpoint verification against the receipt-embedded log key (no live
TUF/Rekor fetch, freshness-independent so receipts outlive shard turndown), RFC-6962 inclusion-proof
verification, and a `SHA-512(anchorBytes)` leaf-digest binding. The persisted WORM receipt is
self-contained (checkpoint + inclusion proof + embedded log key + origin). Public-log submission
requires a typed irreversible-publicity opt-in (mirrors the COMPLIANCE opt-in); TSA stays the default
target. Adds `@noble/curves`. The audit-worm minor bump needs the Compliance bundle members-fold
republish.

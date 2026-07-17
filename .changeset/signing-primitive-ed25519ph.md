---
"@caisson/signing-primitive": minor
---

Adds an `Ed25519PhSigner` — the deployment-level Ed25519ph anchoring signer for external anchoring
(Fork R-α). Rekor v2 `hashedrekord` rejects a pure Ed25519 signature (it re-hashes a message it is only
given the digest of), so anchoring binds a deployment key via the RFC-8032 §5.1 prehash variant over
`@noble/curves`. It implements the shared `Signer` port with `algorithm: "ed25519ph"`, holds its 32-byte
seed in a private field (never logged/serialized), and loads from `CAISSON_REKOR_ANCHORING_KEY` via
`fromEnv` (fail-closed on a missing/wrong-length seed). Distinct from `@caisson/audit-worm`'s per-anchor
`Ed25519AnchorSigner`. The `SignatureAlgorithm` type widens to `"ed25519" | "ed25519ph"`; the existing
pure-Ed25519 evidence-pack signing path is unchanged. Adds `@noble/curves`.

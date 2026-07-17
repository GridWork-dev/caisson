# @caisson/signing-primitive

## 0.3.0

### Minor Changes

- 1de88d7: Adds an `Ed25519PhSigner` — the deployment-level Ed25519ph anchoring signer for external anchoring
  (Fork R-α). Rekor v2 `hashedrekord` rejects a pure Ed25519 signature (it re-hashes a message it is only
  given the digest of), so anchoring binds a deployment key via the RFC-8032 §5.1 prehash variant over
  `@noble/curves`. It implements the shared `Signer` port with `algorithm: "ed25519ph"`, holds its 32-byte
  seed in a private field (never logged/serialized), and loads from `CAISSON_REKOR_ANCHORING_KEY` via
  `fromEnv` (fail-closed on a missing/wrong-length seed). Distinct from `@caisson/audit-worm`'s per-anchor
  `Ed25519AnchorSigner`. The `SignatureAlgorithm` type widens to `"ed25519" | "ed25519ph"`; the existing
  pure-Ed25519 evidence-pack signing path is unchanged. Adds `@noble/curves`.

## 0.2.2

### Patch Changes

- c186409: Wire the mirrored evidence-pack goldens to the compliance-core v2 format bump (the new
  `crosswalkRollup` section): re-blesses each package's static copy of the evidence-pack manifest
  golden and, for `@caisson/signing-primitive`, regenerates the golden detached Ed25519 signature over
  the new canonical bytes (same fixed test key; public key unchanged). No behavior change, fixture
  parity only.
- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0

## 0.2.1

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3

## 0.2.0

### Minor Changes

- f01b6ed: Splits the Compliance edition into three separately purchasable modules — the framework
  catalogs (`@caisson/frameworks-pack`), the per-tenant evidence signer
  (`@caisson/signing-primitive`), and the evidence engine (`@caisson/compliance-core`) — while
  the Compliance edition keeps composing all three. The public API is unchanged: every symbol
  that was importable from `@caisson/compliance` still is.

### Patch Changes

- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

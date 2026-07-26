# @caisson/kernel

Governance kernel: typed config loader, the CaissonError model, security primitives (constant-time compare, SSRF guard), and the standards gate.

- **Layer:** base

Real src + tests: typed config/schema, the `CaissonError` model, a SHA-256 audit-chain, and
append-only version primitives.

The `@caisson/kernel/evidence` subpath builds v2 logical audit packs whose detached Ed25519 seal
covers a canonical manifest of every exported file name and SHA-256 digest. Packs contain no
executable verifier; verification lives out of band in `@caisson/verify-pack`.

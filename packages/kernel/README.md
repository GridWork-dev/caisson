# @caisson-sh/kernel

Governance kernel: typed config loader, the CaissonError model, security primitives (constant-time compare, SSRF guard), and the standards gate.

- **Layer:** base

Real src + tests: typed config/schema, the `CaissonError` model, a SHA-256 audit-chain, and
append-only version primitives.

The `@caisson-sh/kernel/audit-verify` subpath is the browser-safe half of the audit chain: per-row
verification against a WORM anchor plus WebCrypto twins of the chain builders and the whole-chain
verifier, so a client bundle or an offline pack verifier can recompute a chain without the Node
crypto module. The Node-only hashing half stays on `@caisson-sh/kernel/node`.

The `@caisson-sh/kernel/evidence` subpath builds v2 logical audit packs whose detached Ed25519 seal
covers a canonical manifest of every exported file name and SHA-256 digest. Packs contain no
executable verifier; verification lives out of band in `@caisson-sh/verify-pack`.

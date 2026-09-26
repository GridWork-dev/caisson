# @caisson-sh/verify-pack — agent usage note

Verifies a logical audit evidence-pack export without trusting executable code that travelled
inside the pack. The verifier is intentionally a separate package and must be obtained out of band.

## Key surface

- `verifyEvidencePack(input, trust)` requires an independently obtained public-key fingerprint, then
  strictly validates the v2 envelope, exact file set, canonical manifest digest, detached Ed25519
  pack seal, complete receipt sequence, link hashes, per-length anchors, and anchor signatures.
- `verify-pack <logical-evidence-pack.json>` is the CLI used by `npx @caisson-sh/verify-pack`.
- Any malformed, unsupported, unsigned, incomplete, renamed, added, removed, or substituted content
  fails closed. Embedded receipt `checks` are never trusted.

## Trust boundary

This package verifies only. It never accepts a pack-supplied key as its own trust root, signs,
exports, publishes, mutates, fetches, or executes content from a pack.

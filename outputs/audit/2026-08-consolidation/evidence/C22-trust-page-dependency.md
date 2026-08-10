# C22 — remove unused trust-page devDependency

**Verdict:** VERIFIED DELETE  
**Size:** one package metadata row plus one lockfile row  
**Risk:** low

## Evidence

- Sole declaration: `packages/trust-page/package.json:30`.
- Knip reports exactly one unused trust-page dependency: `@caisson/frameworks-pack`.
- No source, test, documentation, or configuration import exists.
- Runtime/manifest dependencies correctly omit it:
  `packages/trust-page/manifest.ts:24-28` and `registry/tarballs.json:6407-6414`.
- Package dry-run confirms package.json is packed, so the change belongs in a normal patch release.

## Registry/revenue

The trust-page SKU, bundle membership, runtime dependencies, and ledger/index rows remain unchanged.
No delist or grandfathering action is required.

## Refute attempt

Clean package-scoped dependency analysis found no dynamic or test-only use. The row survived.

**Buyer/site notice:** none.

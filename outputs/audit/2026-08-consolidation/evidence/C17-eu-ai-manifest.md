# C17 — delete orphan EU AI Act manifest

**Verdict:** VERIFIED DELETE  
**Size:** 26 exact packed source lines  
**Risk:** low

## Evidence

- Orphan file: `packages/compliance/eu-ai-act.manifest.ts:1-26`; it declares nonexistent
  `@caisson/eu-ai-act@0.0.0`.
- Workspace/registry discovery reads only exact `<workspace>/manifest.ts` paths:
  `tooling/standards-gate/src/workspace.ts:71-94` and
  `registry/scripts/ci-publish-step.ts:671-685`.
- Compliance compilation includes only `src` (`packages/compliance/tsconfig.json:4-7`), and its
  package exports only `.` (`packages/compliance/package.json:11-17`).
- No `@caisson/eu-ai-act` row exists in registry index, ledger, or tarball sidecar.
- The real catalog lives at `packages/frameworks-pack/src/frameworks/eu-ai-act.ts:28-45` and is
  exported by `packages/frameworks-pack/src/index.ts:14`.
- Knip independently reports the file unused; package dry-run confirms it is currently packed into
  `@caisson/compliance` bytes despite being unreachable.

## Registry/revenue

No SKU ID, delist, bundle, or entitlement change. Historical compliance tarballs stay immutable;
the next compliance patch simply omits the orphan file.

## Refute attempt

The refuter checked compile, export, discovery, registry, pack, and catalog paths. No hidden reader
survived.

**Buyer/site notice:** none.

# C10 — remove `PgKeyVersionStore` in the next field-crypto major

**Verdict:** NEXT-MAJOR DELETE  
**Size:** 28 runtime + 36 dedicated test LOC = 64 physical LOC  
**Risk:** high public API compatibility

## Evidence

- Port/class: `packages/field-crypto/src/store.pg.ts:41-51,104-118`.
- Public exports: `packages/field-crypto/src/index.ts:98-99`.
- Only executable callers are dedicated tests:
  `packages/field-crypto/src/store.pg.integration.test.ts:55-90`.
- The async class cannot implement the synchronous key-version registry used by derived keys;
  `store.pg.ts:41-51` explicitly leaves pure callers on the synchronous registry.
- Production and buyer docs use `PgWrappedKeyStore`, not this class:
  `apps/site/lib/field-crypto-kms.ts:561-577` and
  `apps/site/content/docs/provenance/field-crypto.mdx:139-163`.
- A site posture assertion still names it at `apps/site/lib/stack-fit.test.ts:29-40` and must move
  with any deprecation.

## Registry/revenue

`@caisson/field-crypto@1.1.0` is a sold, published package with bundle membership. No package ID
delist is needed, but the export cannot disappear before `2.0.0`; all affected bundle member pins
must advance normally in that train. Historical tarballs remain immutable.

## Refute attempt

Immediate deletion was refuted because external buyer usage is unknown. Internal non-use and the
sync/async mismatch support deprecation plus next-major removal only.

**Buyer/site notice:** hosted Caisson does not notice; an external importer could.

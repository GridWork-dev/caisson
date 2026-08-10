# C23 — move dependency graph guard into standards-gate ownership

**Verdict:** VERIFIED FOLD-INTO `tooling/standards-gate`  
**Size:** approximately zero net; 226 source + 183 test LOC moved  
**Risk:** medium CI gate ownership

## Evidence

- Loose implementation/test:
  `tooling/scripts/dependency-graph-guard.ts` and
  `tooling/scripts/dependency-graph-guard.test.ts`.
- Sole CI caller is inside the required standards-gate job:
  `.github/workflows/ci.yml:48-79`.
- Standards-gate already owns `dependency-cruiser`
  (`tooling/standards-gate/package.json:21-26`).
- Its README already describes the graph guard as Layer 3:
  `tooling/standards-gate/README.md:20-24`.

## Safe shape

Move implementation/tests under the standards-gate package and update CI/docs. Keep graph execution
as an independent Layer 3 command; do not merge it into the static CLI because ADR-0022 requires
separate enforcement layers.

## Registry/revenue

Private tooling move, no registry or buyer effect. Primary value is automatic package test ownership,
not LOC reduction.

## Refute attempt

Deleting the graph layer was refuted because it catches dynamic/transitive edges. Ownership move
survived and closes the loose-test gap for this file pair.

**Buyer/site notice:** none; CI attribution improves.

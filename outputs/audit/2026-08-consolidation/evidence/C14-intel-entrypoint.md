# C14 — delete unused Intel package entrypoint

**Verdict:** VERIFIED DELETE  
**Size:** 30 exact lines  
**Risk:** low

## Evidence

- Unused barrel: `services/intel/src/index.ts:1-23`.
- Unused package export metadata: `services/intel/package.json:8-14`.
- No code imports the Intel service by package name.
- Runtime starts `services/intel/src/server.ts` directly (`services/intel/package.json:22`).
- Tests target concrete modules, not the package API.

The first pass paired this with Better Stack package metadata. Refutation split the row: Better
Stack's `handler.ts` is the real Worker entry and its package export helps standards-gate classify
the workspace as code-bearing. Only Intel's 30 lines remain admitted.

## Registry/revenue

Private service, absent from registry/index/tarballs and bundle manifests. Deployed service command
is unchanged.

## Refute attempt

Workspace and deployment searches found no importer/tool consuming the package root. The concrete
server entry remains.

**Buyer/site notice:** none.

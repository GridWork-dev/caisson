# C09 — replace kernel's duplicate browser graph walker

**Verdict:** VERIFIED FOLD-INTO `@caisson/testing/module-graph`  
**Size:** approximately 80 net test LOC  
**Risk:** low

## Evidence

- Duplicate parser/walker: `packages/kernel/src/browser-safety.test.ts:23-100`.
- Shared implementation: `tooling/testing/src/module-graph.ts:1-230`; its header identifies the
  kernel copy as its predecessor (`:8-12`).
- Kernel already dev-depends on testing (`packages/kernel/package.json:59-64`).
- The graph subpath is exported by `tooling/testing/package.json:14-18`.
- Kernel's sibling browser-entry test already imports the shared implementation:
  `packages/kernel/src/browser-entry.test.ts:1-7`.
- The shared walker handles workspace export maps, external/unresolved edges, and global taint,
  making it stronger than the local copy.

## Safe shape

Use `nodeBuiltinTaint` from `@caisson/testing/module-graph`. Retain non-vacuity, unresolved-edge,
positive-control, type-only, and barrel-superset assertions; update expected paths to the shared
walker's workspace-relative form.

## Registry/revenue

Test-only consolidation. Public kernel bytes change only through test/source cleanup; no public API,
ledger, bundle, or entitlement change.

## Refute attempt

The refuter replayed the shared walker over 14 kernel barrel files, found zero unresolved edges, and
found the expected four node-only modules. No distinct local behavior survived.

**Buyer/site notice:** none.

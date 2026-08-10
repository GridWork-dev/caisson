# C15 — delete standards-gate library residue

**Verdict:** VERIFIED DELETE  
**Size:** approximately 30 net LOC  
**Risk:** low

## Evidence

- `tooling/standards-gate/src/index.ts:1-14` only re-exports APIs.
- The package exposes a bin but no library `main`/`exports`:
  `tooling/standards-gate/package.json:7-14`.
- No live source importer exists.
- `Pkg.externalDeps` is declared/populated at
  `tooling/standards-gate/src/workspace.ts:13-16,79-92`.
- The external-license scan walks the installed tree and explicitly ignores `pkgs` at
  `tooling/standards-gate/src/checks.ts:245-270`, leaving `externalDeps` unused.

## Safe shape

Delete `tooling/standards-gate/src/index.ts`, stale README schema prose, `Pkg.externalDeps`, and
fixture boilerplate. Keep the direct `zod` dependency until a clean-install manifest-import proof
says it is unnecessary.

## Registry/revenue

Private tooling package; no registry or buyer surface.

## Refute attempt

The refuter checked dynamic manifest loading and bin wiring. Neither uses the dead re-export file or
external dependency field.

**Buyer/site notice:** none.

# C06 — prune unused service-license barrel exports

**Verdict:** VERIFIED DELETE/PRUNE  
**Size:** 138 exact barrel lines, or 137 after C03 removes its overlapping export  
**Risk:** medium

## Evidence

- Barrel: `services/license/src/index.ts:12-248`.
- AST inventory found 177 exported symbols, 65 imported elsewhere, and 112 with no named importer.
- The removable surface is 23 whole export declarations (93 lines) plus 45 specifier lines in mixed
  declarations.
- One namespace import exists in
  `apps/admin/src/app/api/admin/mutation-error-mapping.test.ts:14,32-44`; it spreads the module into
  a mock but does not require any candidate symbol.
- Implementations remain in their source modules; this row removes only unreachable private barrel
  exposure.

## Registry/revenue

The service package is private/unpublished and absent from ledger/index/tarballs. Forty-two live
imports across admin, site, platform-migrations, and platform-reads remain intact.

## Refute attempt

The refuter checked the namespace mock and private-package status. It found no external support
contract and preserved every imported name. Knip does not report these because package entrypoints
are assumed public; direct AST analysis closes that blind spot.

**Buyer/site notice:** none; service behavior unchanged.

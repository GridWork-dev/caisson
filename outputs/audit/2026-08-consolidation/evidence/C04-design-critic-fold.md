# C04 — fold design critic into audit harness

**Verdict:** DECISION-GATED FOLD  
**Size:** estimated 350–400 active LOC; 5,835 ledger lines archive unchanged  
**Risk:** high identity/provenance migration

## Evidence

- `@caisson/design-critic` has no source importer; its live surface is its CLI and ledger:
  `tooling/design-critic/src/cli.ts:1-40`.
- Audit-harness is the generalized cross-domain ledger:
  `tooling/audit-harness/src/findings.ts:1-17`.
- Both already use the shared reconciler.
- The ID formulas differ materially: design hashes workflow/surface/title
  (`tooling/design-critic/src/findings.ts:50-77`); audit-harness hashes
  domain/dimension/subject/title (`tooling/audit-harness/src/findings.ts:62-83`).
- Audit-harness has no dedicated visual/Nielsen dimension
  (`tooling/audit-harness/src/dimensions.ts:11-74`).
- ADR-0134 and package instructions currently say generalized “without replacing” design critic
  (`knowledge/decisions/ADR-0134-cross-domain-audit-validate-harness.md:24-31`).

## Registry/revenue

Both are private tooling packages with no registry rows, bundle seat, or buyer entitlement.

## Required fold shape

1. Superseding ADR and an explicit visual audit dimension.
2. Archive `tooling/design-critic/findings.toml` verbatim with its old stable-ID formula.
3. Route future visual findings through audit-harness without re-keying historical rows.
4. Remove design-critic package/bin and update audit coverage/catalog history.

## Refute attempt

A silent merge was refuted because stable IDs and dimension models are incompatible. The active-code
fold remains valid only with the explicit migration above.

**Buyer/site notice:** none; operator audit workflows notice.

# Targeted evidence — tooling inventory

Disk contains nine tooling directories: eight workspace packages plus loose `tooling/scripts/`.
All tooling package IDs are private/internal and absent from registry ledger/index/tarballs.

| Surface          |      Source LOC | Test LOC | Direct consumers / role                                                                               | Disposition                                  |
| ---------------- | --------------: | -------: | ----------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `audit-harness`  |           1,421 |    1,068 | Audit ledgers and coverage gates; advisory reconciliation (`tooling/audit-harness/src/cli.ts:84-138`) | KEEP                                         |
| `browser-audit`  |              39 |       25 | Sole relative import from production-browser-audit skill                                              | CONDITIONAL FOLD, C13                        |
| `demo-registry`  |           1,459 |       45 | Buyer `/ui` gallery and admin component catalog                                                       | KEEP                                         |
| `design-critic`  |             206 |       96 | Manual CLI/legacy visual ledger; no source importer                                                   | DECISION-GATED FOLD, C04                     |
| `eslint-config`  |             264 |       62 | Declared by 69 workspaces; OSS mirror boundary enforcement                                            | KEEP                                         |
| `scripts`        |           4,119 |    3,015 | CI/operator scripts; no package.json                                                                  | KEEP directory; move selected ownership only |
| `standards-gate` |           2,034 |    1,881 | Required CI license/catalog/RLS/prose/price enforcement                                               | KEEP; absorb C23 and trim C15                |
| `testing`        |             677 |      177 | 66 declarations, 190 import files, shared graph/reconcile/render helpers                              | KEEP; absorb C09 use                         |
| `tsconfig`       | 13 TS + 29 JSON |        0 | 68 declarations and 77 config extensions                                                              | KEEP                                         |

## Named overlap checks

- **Audit-harness vs standards-gate:** retain separate. Audit harness normally reconciles/advises;
  standards-gate fails CI. ADR-0134 deliberately places them beside each other
  (`knowledge/decisions/ADR-0134-cross-domain-audit-validate-harness.md:66-74`).
- **Demo registry vs registry scripts:** retain separate. Demo registry stores React render/sample
  data (`tooling/demo-registry/src/registry.ts:1-58`); registry scripts own publish ledger/index/
  tarballs (`registry/scripts/build-index.ts:1-19`).
- **Root scripts vs tooling/scripts:** retain separate wholesale. Root scripts own mirror/release
  distribution; tooling scripts own internal CI/SOT/provider operations.
- **Browser-audit:** the wrapper boundary has one skill caller, but package deletion must preserve
  required CI test execution (C13).
- **Design-critic:** active-code fold is plausible only with a new visual dimension and immutable
  legacy-ledger archive (C04).

## Refuted tooling cuts

- Public kernel gate stays; it is not private standards-gate duplication that can be deleted.
- Audit-harness validation spine and matrix UI stay under prior locks.
- Demo registry, testing, eslint, and tsconfig packages have real consumers.
- Railway deploy/env-sync merger was refuted by mutating versus read-only trust boundaries.

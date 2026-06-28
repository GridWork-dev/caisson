# ADR-0090 — Promote `@caisson/migrate` base package (full extract)

Status: accepted · 2026-06-28 (operator lock, picker round) · resolves the open implementation fork of
ADR-0070 ("ONE base owns the assembler + runner"). Composes on ADR-0003 (composable packages, no
depend-up), ADR-0014 (single ledger), ADR-0070 (compose-time assembly).

## Context

ADR-0070 mandates a **base** migration-assembler + runner that every contributor consumes. P5 shipped the
assembler in `packages/cli/src/migrate/assemble.ts` to unblock generation, with a **verbatim parallel
copy** in `packages/compliance/src/migrate/assemble.ts` (`MIGRATION_FILE`, `SelectedPackage`,
`readPackageMigrations` duplicated line-for-line) and a **third** re-implementation of the apply loop in
`compliance/.../assemble.integration.test.ts:43-77`. The board framed promotion as a "one-line import
flip sharing `GeneratedFile`"; fork research (2026-06-28) corrected this: `GeneratedFile`
(`packages/cli/src/seam.ts:38`) is **cli-internal**, and `compliance` has no `@caisson/cli` dependency,
so the runner cannot be shared today without a new package. The duplication is real and three-headed.

## Decision

**Create `packages/migrate/` (`@caisson/migrate`) as the base package owning BOTH the assembler and the
runner**, per ADR-0070's binding ("assembler and runner ship in the base"). Hoist into it: the disk-read
function (`readPackageMigrations`), the canonical `SelectedPackage` type, the `MIGRATION_FILE` constant,
and the migration **runner** seam. `@caisson/cli` and `@caisson/compliance` both import from it;
`compliance` drops its 60-LOC parallel copy and its test re-implements nothing (calls the shared runner).
The shared file-emit types currently coupled via `cli/src/seam.ts` (`GeneratedFile`) are hoisted to the
base so neither consumer reaches "up" into the cli (ADR-0003).

This is a **full new-package bootstrap** (~2-3h: scaffold through `tooling/`, ~80 LOC moved, dep wiring in
cli + compliance), **not** a one-line flip — the board undersold it. It is **NOT** P5-exit-gate-blocking
(the assembler byte-matches its golden today); it is a fast-follow that pays down the ADR-0070 debt before
more consumers fork the copy.

## Rejected

- **Narrow extract** (export only the type + `readPackageMigrations`, leave the runner in `@caisson/cli`)
  — smaller (~1h) but leaves the runner OUT of the base, only partially honoring ADR-0070; a second
  consumer of the runner would re-fork it.
- **Defer to P6 with the bundling fork** (ADR-0091) — accepting the three-way duplication longer invites
  drift between the copies; the operator chose to honor ADR-0070 now.

## Binding

- Exactly one assembler + one runner exist, in `@caisson/migrate`; `cli` and `compliance` import them, never
  copy them. A reviewer flags any re-introduced `assemble`/`readPackageMigrations` copy outside the base.
- `@caisson/migrate` depends only on base packages (`kernel`), never "up" on an edition or on `@caisson/cli`
  (ADR-0003). The hoisted `GeneratedFile`/file-emit seam types live in the base.
- Honors ADR-0070 (compose-time assembly, single `schema_version` ledger) and ADR-0014 unchanged.

Scheduled as a fast-follow. Evidence: `packages/cli/src/migrate/assemble.ts:21,27-33,41-50` ≡
`packages/compliance/src/migrate/assemble.ts:23,34-39,74-81`; third copy
`compliance/.../assemble.integration.test.ts:43-77`; `packages/cli/src/seam.ts:38` (`GeneratedFile`,
cli-only); `packages/compliance/package.json` (no `@caisson/cli` dep);
`knowledge/decisions/ADR-0070-migration-assembly-single-ledger.md` (binding: assembler+runner ship in base).

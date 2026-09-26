# @caisson-sh/migrate — agent contract

The base migration **assembler + runner** (ADR-0070/0090). One assembler, one runner, owned here;
`@caisson-sh/cli` and `@caisson-sh/compliance` import them — never
copy them (a re-introduced `assemble`/`readPackageMigrations` copy outside this package violates
the owned-once contract).

## What it does

A composed Caisson app is ONE database with ONE migration history, but its dependency closure each
owns numbered, forward-only `migrations/NNNN_*.sql`. This package:

1. **reads** each selected package's on-disk migrations (`readPackageMigrations`),
2. **merges** them via the kernel's pure `assembleMigrations` — topo-order by the down-only dep DAG,
   global renumber into one `NNNN_*.sql` sequence, ONE `schema_version` checksum ledger (ADR-0014),
3. **emits** the result as the generated app's file set (`emitMigrationFileSet`),
4. **applies** the sequence forward-only + idempotent through an injected `MigrationApplier` port
   (`runMigrations`) — the ONLY DB-touching seam; no live DB runs in CI (tests inject a double).

## Public API

| Symbol                                                     | Use                                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `SelectedPackage`                                          | A package selected into a composition: `{ slug, dir, dependsOn }`.           |
| `readPackageMigrations(pkg)`                               | Read one package's `migrations/NNNN_*.sql` → kernel `PackageMigrations`.     |
| `assembleSelected(packages)`                               | Read + merge a selection into a `MigrationAssembly`.                         |
| `emitMigrationFileSet(assembly)`                           | Assembly → `EmittedFileSet` (`migrations/NNNN_*.sql` + ledger).              |
| `EmittedFile` / `EmittedFileSet`                           | The file-emit primitive (`{ path, content }`), shared with the generator.    |
| `MigrationApplier`                                         | The runner port: `applied()` + `apply(migration)` (one tx).                  |
| `runMigrations(assembly, applier)`                         | Apply forward-only; skip recorded; fail-closed on checksum drift (ADR-0006). |
| `pgMigrationApplier(pool)` (from `@caisson-sh/migrate/pg`) | A node-postgres `MigrationApplier` for a live Postgres `Pool`.               |

## Invariants

- Merge authority lives in `@caisson-sh/kernel` + this package — never an edition (ADR-0070).
- Down-only: depends on `@caisson-sh/kernel`, never on `@caisson-sh/cli` or an edition (ADR-0003).
- Deterministic: same inputs → byte-identical assembly + emitted file set (golden-stable).

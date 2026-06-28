# ADR-0070 — Migration assembly: compose-time assembler + single schema_version ledger

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Reconciles per-package DDL
ownership with ADR-0014's single-sequence/single-ledger mandate.)

Composable packages each own their schema, but a generated app is one database with one migration
history. The tension: let packages publish independently (own, numbered migrations) without
fragmenting the runtime into N competing sequences and N checksum ledgers.

## Decision

**A base MIGRATION-ASSEMBLER, run at generate/compose time, merges the contributing packages'
migrations into ONE ordered sequence and computes a SINGLE `schema_version` checksum ledger over the
merged set** (ADR-0014). Reconciles per-package DDL with ADR-0014's single-sequence/single-ledger
mandate — packages stay independently publishable; assembly is centralized.

- **Each package owns numbered, forward-only migrations in its own namespace** (e.g.
  `packages/<pkg>/migrations/NNNN_*.sql`). No package writes another package's DDL; no edits to
  shipped migrations (append-only, ADR-0006).
- **The assembler topologically merges** the selected packages' migrations — ordered by the package
  dependency DAG (ADR-0003: a package never depends "up" on an edition), ties broken
  deterministically — into one renumbered `migrations/NNNN_*.sql` sequence in the generated app.
- **One `schema_version` checksum ledger over the merged set** (ADR-0014): the checksum chain is
  computed across the assembled sequence, not per package. The runtime sees a single history.
- **Merge authority lives in the generator + a base migration-runner**, never in any one edition. An
  edition is a composition (ADR-0003) that selects packages; it does not own or override assembly.
- TypeScript/Bun/strict throughout; the assembler and runner ship in the base, under the standard
  one-standards-gate (`tooling/`), as fully-commercial code (ADR-0023) — note ADR-0050 makes the
  local-ai edition commercial too, so the assembler carries no AGPL flank.

## Rejected

- **A central global migration sequence** — every package writes into one shared, globally-numbered
  counter. Couples every package to a global ordinal, cuts against independent publish (two packages
  racing for `0042`), and re-introduces the cross-package coupling ADR-0003 forbids.
- **Per-package independent `schema_version` ledgers** — each package keeps its own checksum chain at
  runtime. Violates ADR-0014's single-ledger mandate: the runtime would reconcile N drifting
  histories, with no single source of truth for "is this database at the expected schema."

## Binding

Future code and agents MUST treat package-owned migrations as inputs to a compose-time assembly, not
as the runtime sequence: packages contribute namespaced, forward-only, append-only migrations; the
base generator + migration-runner are the sole authority that merges them into one ordered
`migrations/NNNN_*.sql` sequence and computes the one `schema_version` ledger (ADR-0014) over the
merged set. No edition, and no package, owns global ordering or a private ledger. Evidence: ADR-0014
(single-sequence/single-ledger), ADR-0003 (composable packages, no upward dependency), ADR-0006
(append-only locked artifacts), ADR-0023/0050 (fully-commercial, incl. local-ai); the `tooling/` +
`registry/` seam; research artifact `outputs/research/wave1-forks.md`.

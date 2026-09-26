# @caisson-sh/migrate

The base migration **assembler + runner** (ADR-0070/0090). Owned once, here; `@caisson-sh/cli` and
`@caisson-sh/compliance` import it.

A composed Caisson app is ONE database with ONE migration history. Each package in the dependency
closure ships forward-only `migrations/NNNN_*.sql`; this package reads them, merges them via the
kernel's pure algorithm into one renumbered sequence under a single `schema_version` checksum ledger
(ADR-0014), emits that as the generated app's file set, and applies it forward-only + idempotent
through an injected runner port (the only DB-touching seam — no live DB runs in CI).

See `AGENTS.md` for the public API and invariants.

Licensed Apache-2.0 (open-core: ships-with-generator tooling — open Base substrate).

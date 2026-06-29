# ADR-0091 — Compose-time migration bundling via a CLI build-step copy

Status: accepted · 2026-06-28 (operator lock, picker round) · resolves the open "compose-time migration
bundling" fork. Composes on ADR-0070 (compose-time assembly), ADR-0014 (single ledger), ADR-0090
(`@caisson/migrate` base).

## Context

`runGeneration` wires the gen-time migration merge (`assembleSelected` → `emitMigrationFileSet`), but the
source it reads is a CLI-bundled, `import.meta.url`-anchored `migrations-bundle/<module>/` directory that
is **empty today**, so the merge is a deterministic no-op. The resolver `packageDir()`
(`packages/cli/src/meter.ts:72-77`) already computes `../migrations-bundle/${name}` via `import.meta.url`
— wired and waiting for content. Only two modules currently carry migrations:
`packages/field-crypto/src/migrations/0001_field_keys.sql` and
`packages/audit-worm/src/migrations/{0001_audit_chain,0002_versions}.sql`. A bare workspace-source read is
cwd-fragile under turbo AND absent from a published CLI, so the migrations must be **bundled**.

## Decision

**A CLI build/pre-publish step copies each contributing module's `src/migrations/*.sql` into
`packages/cli/migrations-bundle/<name>/`** — mirroring the proven `templates/` bundling pattern
(`packages/cli/src/engine-templates.ts:23-27`, which ships `base/ai-kit/compliance/local-ai/agent-dev`
template dirs the same way). The already-coded `packageDir()` layout consumes it unchanged. Direct,
unblocked, and consistent with how the CLI already bundles non-TS assets. Once `@caisson/migrate`
(ADR-0090) lands, the copy step + the bundle MAY be relocated under that base package's build (the
mechanism is identical — a build-time copy — only its owner moves).

## Rejected

- **`@caisson/migrate` owns the bundle directly** — defensible once ADR-0090 lands, but still requires a
  build step somewhere and blocked on that promotion; the operator chose the unblocked path now and may
  relocate the copy under `@caisson/migrate` later (no semantic change).
- **Generated repos run each module's migrations post-install (no compose-time merge)** — VIOLATES
  ADR-0070 (compose-time assembly mandate) and ADR-0014 (single `schema_version` ledger), both locked.

## Binding

- Module migrations reach the assembler via a build-time copy into the CLI bundle (`migrations-bundle/`),
  never via a live workspace-source read at generation time.
- The compose-time merge + single-ledger invariant (ADR-0070/0014) is unchanged; this only populates its
  input.
- The bundle is a build artifact (gitignored like other build output where applicable); the copy step runs
  pre-build/pre-publish.

Scheduled with the P5 follow-up / P6 publish work. Evidence: `packages/cli/src/meter.ts:72-77`
(`packageDir()` already wired); `packages/cli/src/engine-templates.ts:23-27` (proven `templates/` pattern);
`packages/field-crypto/src/migrations/*.sql`, `packages/audit-worm/src/migrations/*.sql` (the only current
sources); `knowledge/decisions/ADR-0070-migration-assembly-single-ledger.md`.

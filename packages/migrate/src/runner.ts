// The base migration RUNNER seam (ADR-0070/0090). Applies an assembled sequence (from `./assemble.ts`)
// in order through an injected port — the ONLY DB-touching seam. A real driver runs the SQL + inserts
// the `schema_version` row inside one transaction; tests inject an in-memory double, so NO live DB
// runs in CI. The runner records checksums but never owns assembly: the kernel computes the sequence +
// ledger, the runner only applies it. Owned here in the base so every consumer (cli, compliance, any
// future tier) applies migrations the same way instead of re-forking the loop (ADR-0090).
import type { MergedMigration, MigrationAssembly } from "@caisson-sh/kernel";

/** One row recorded in a target DB's `schema_version` ledger (ADR-0014). */
export interface AppliedMigration {
  readonly version: number;
  readonly checksum: string;
}

/**
 * The migration-runner port: the ONLY DB-touching seam. A real driver runs the SQL + inserts the
 * `schema_version` row inside one transaction; tests inject an in-memory double — NO live DB runs in
 * CI (ADR-0070). Kept tiny + DB-agnostic so any tier (Postgres, PGlite, the local SQLite tier)
 * implements it the same way.
 */
export interface MigrationApplier {
  /** Rows already in the target's `schema_version` ledger (empty for a fresh DB). */
  applied(): Promise<readonly AppliedMigration[]>;
  /** Apply one migration's SQL and record its `schema_version` row — atomically (one tx). */
  apply(migration: MergedMigration): Promise<void>;
}

/** The outcome of a runner pass over an assembled sequence. */
export interface MigrationRunResult {
  /** Global ordinals applied by THIS run (already-recorded versions are skipped). */
  readonly applied: readonly number[];
  /** Global ordinals already present before this run (forward-only — never re-applied). */
  readonly skipped: readonly number[];
  /** The assembly's single `schema_version` checksum — the expected head after this run. */
  readonly schemaVersion: string;
}

/**
 * Apply an assembled sequence in order through the injected port — the base migration-runner seam.
 * Forward-only + idempotent: an already-recorded version is skipped, so a re-run applies nothing. If
 * a recorded version's checksum no longer matches the assembled one the run fails CLOSED — a shipped
 * migration's bytes were edited, which ADR-0006 (append-only) forbids. The runner records checksums
 * but never owns assembly: the kernel computes the sequence + ledger, the runner only applies it.
 */
export async function runMigrations(
  assembly: MigrationAssembly,
  applier: MigrationApplier,
): Promise<MigrationRunResult> {
  const priorByVersion = new Map<number, string>();
  for (const row of await applier.applied()) {
    priorByVersion.set(row.version, row.checksum);
  }

  const applied: number[] = [];
  const skipped: number[] = [];
  for (const migration of assembly.sequence) {
    const prior = priorByVersion.get(migration.seq);
    if (prior !== undefined) {
      // A migration checksum is a public content hash (not a secret/token/entitlement), so a plain
      // compare is correct here; a mismatch means a shipped migration changed — fail closed.
      if (prior !== migration.checksum) {
        throw new Error(
          `migration-runner: checksum drift at version ${migration.seq} (${migration.filename})`,
        );
      }
      skipped.push(migration.seq);
      continue;
    }
    await applier.apply(migration);
    applied.push(migration.seq);
  }
  return { applied, skipped, schemaVersion: assembly.schemaVersion };
}

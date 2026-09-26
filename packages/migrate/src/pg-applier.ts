// A node-postgres MigrationApplier (ADR-0090) — the real-Postgres implementation of the DB-touching
// runner port. Kept out of the main entry (subpath export `@caisson-sh/migrate/pg`) so PGlite-only
// consumers never pull `pg`'s types: `pg` is an OPTIONAL peer dependency, imported here type-only
// (the `Pool` is passed IN by the caller, so nothing here requires `pg` at runtime — only @types/pg
// at compile). Mirrors the PGlite applier shape proven in packages/compliance's integration test:
// `applied()` reads the schema_version ledger, `apply()` runs the migration SQL + records its ledger
// row inside ONE transaction. Forward-only idempotency + checksum-drift-fail-closed live in the
// shared runMigrations (runner.ts), never re-implemented here.
//
// ponytail: no unit test here — a node-postgres applier can't talk to PGlite, and mocking a Pool to
// assert SQL strings is low-value. The assembly + run-once contract is covered against a real
// Postgres (PGlite) by an integration test in the app that consumes this package; this adapter is
// exercised end-to-end against a live Postgres instance during deployment.
import type { MergedMigration } from "@caisson-sh/kernel";
import type { Pool } from "pg";
import type { AppliedMigration, MigrationApplier } from "./runner.ts";

/** The DB-side ledger (ADR-0014) the runner records against — created before the first read. */
const SCHEMA_VERSION_DDL = `CREATE TABLE IF NOT EXISTS schema_version (
  version    integer     PRIMARY KEY,
  checksum   text        NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);`;

/**
 * Build a `MigrationApplier` over a live node-postgres `Pool`. The pool is injected (the caller owns
 * its lifecycle + `DATABASE_URL`); this never constructs or closes it. The schema_version ledger is
 * created lazily+idempotently on first use.
 */
export function pgMigrationApplier(pool: Pool): MigrationApplier {
  let ensured = false;
  const ensure = async (): Promise<void> => {
    if (ensured) return;
    await pool.query(SCHEMA_VERSION_DDL);
    ensured = true;
  };
  return {
    async applied(): Promise<readonly AppliedMigration[]> {
      await ensure();
      const res = await pool.query(
        "SELECT version, checksum FROM schema_version ORDER BY version",
      );
      return (res.rows as Array<{ version: number; checksum: string }>).map(
        (r) => ({ version: Number(r.version), checksum: r.checksum }),
      );
    },
    async apply(migration: MergedMigration): Promise<void> {
      await ensure();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_version (version, checksum) VALUES ($1, $2)",
          [migration.seq, migration.checksum],
        );
        await client.query("COMMIT");
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Best-effort — the connection may already be unusable; the original error wins below.
        }
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

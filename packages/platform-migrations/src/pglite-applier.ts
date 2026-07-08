// A PGlite-backed `MigrationApplier` (ADR-0090) — the PGlite-driver twin of `@caisson/migrate/pg`'s
// `pgMigrationApplier`, kept on its own subpath export for the same reason: `@electric-sql/pglite`
// is an OPTIONAL peer dependency (a real-Postgres-only consumer, e.g. services/license, never pulls
// it in). Wired to PGlite's own query/transaction API instead of a node-postgres `Pool` (PGlite has
// no `.connect()`). Two production consumers now share this — apps/site/lib/db.ts and
// apps/admin/src/lib/admin-db.ts — so it lives here instead of being hand-copied a second time.
import type { MergedMigration } from "@caisson/kernel";
import type { MigrationApplier } from "@caisson/migrate";
import type { PGlite } from "@electric-sql/pglite";

/** The DB-side `schema_version` ledger (ADR-0014) the runner records against — created lazily on
 *  first use, same as `pgMigrationApplier`'s `ensure()`. */
const SCHEMA_VERSION_DDL = `CREATE TABLE IF NOT EXISTS schema_version (
  version    integer     PRIMARY KEY,
  checksum   text        NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);`;

/**
 * Build a `MigrationApplier` over a live `PGlite` instance. The instance is injected (the caller
 * owns its lifecycle); this never constructs one. The `schema_version` ledger is created lazily +
 * idempotently on first use.
 */
export function pgliteMigrationApplier(pg: PGlite): MigrationApplier {
  let ensured = false;
  const ensure = async (): Promise<void> => {
    if (ensured) return;
    await pg.exec(SCHEMA_VERSION_DDL);
    ensured = true;
  };
  return {
    async applied() {
      await ensure();
      const res = await pg.query<{ version: number; checksum: string }>(
        "SELECT version, checksum FROM schema_version ORDER BY version",
      );
      return res.rows;
    },
    async apply(migration: MergedMigration) {
      await ensure();
      await pg.transaction(async (tx) => {
        await tx.exec(migration.sql);
        await tx.query(
          "INSERT INTO schema_version (version, checksum) VALUES ($1, $2)",
          [migration.seq, migration.checksum],
        );
      });
    },
  };
}

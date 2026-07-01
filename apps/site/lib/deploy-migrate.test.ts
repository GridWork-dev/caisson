// Proves the platform migration assembly applies in order and is idempotent (a 2nd run applies
// nothing) against a real Postgres (PGlite), and that FORCE RLS survives assembly on every tenant
// table. Reuses the shared forward-only runner via a PGlite-backed applier — the same shape as
// packages/compliance's integration test. The node-postgres applier (pgMigrationApplier) is
// exercised end-to-end at the deploy D-step; this covers the risky part: assembly + run-once + RLS.
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { MergedMigration } from "@caisson/kernel";
import type { MigrationApplier } from "@caisson/migrate";
import { type TestPg, newTestPg } from "@caisson/testing";
import { runPlatformMigrations } from "./deploy-migrate.ts";

const SCHEMA_VERSION_DDL = `CREATE TABLE IF NOT EXISTS schema_version (
  version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
);`;

function pgliteApplier(tp: TestPg): MigrationApplier {
  return {
    applied: () =>
      tp.query<{ version: number; checksum: string }>(
        "SELECT version, checksum FROM schema_version ORDER BY version",
      ),
    apply: (m: MergedMigration) =>
      tp.pg.transaction(async (tx) => {
        await tx.exec(m.sql);
        await tx.query(
          "INSERT INTO schema_version (version, checksum) VALUES ($1, $2)",
          [m.seq, m.checksum],
        );
      }),
  };
}

let tp: TestPg;
beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(SCHEMA_VERSION_DDL);
});
afterAll(async () => {
  await tp.close();
});

test("platform migrations apply in order then are idempotent", async () => {
  const first = await runPlatformMigrations(pgliteApplier(tp));
  expect(first.applied).toEqual([1, 2, 3, 4, 5, 6]);

  const second = await runPlatformMigrations(pgliteApplier(tp));
  expect(second.applied).toEqual([]);
  expect(second.skipped).toEqual([1, 2, 3, 4, 5, 6]);
});

test("every composed tenant table ships FORCE row-level security", async () => {
  const rows = await tp.query<{ relname: string; force: boolean }>(
    `SELECT relname, relforcerowsecurity AS force FROM pg_class
     WHERE relname IN ('credit_wallet','credit_event','entitlement_grant','license_grant','usage_event','account_member')`,
  );
  expect(rows.length).toBeGreaterThanOrEqual(6);
  expect(rows.every((r) => r.force)).toBe(true);
});

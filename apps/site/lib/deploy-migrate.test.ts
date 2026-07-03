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
  expect(first.applied).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);

  const second = await runPlatformMigrations(pgliteApplier(tp));
  expect(second.applied).toEqual([]);
  expect(second.skipped).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
});

test("0007 adds the ADR-0212 rounding provenance columns to credit_event", async () => {
  const cols = await tp.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'credit_event' AND column_name IN ('rounding_raw','rounding_mode')
     ORDER BY column_name`,
  );
  expect(cols).toEqual([
    { column_name: "rounding_mode", data_type: "text" },
    { column_name: "rounding_raw", data_type: "integer" },
  ]);
});

test("0008/0009 add the ADR-0218 per-line join-key columns", async () => {
  const ent = await tp.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'entitlement_grant' AND column_name = 'line_item_id'`,
  );
  expect(ent).toEqual([{ column_name: "line_item_id" }]);
  const credit = await tp.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'credit_event' AND column_name IN ('line_item_id','line_charged_amount')
     ORDER BY column_name`,
  );
  expect(credit).toEqual([
    { column_name: "line_charged_amount", data_type: "integer" },
    { column_name: "line_item_id", data_type: "text" },
  ]);
});

test("0011 creates the ADR-0234 ask_ai_spend counter (no RLS — a global, non-tenant aggregate)", async () => {
  const rows = await tp.query<{ relname: string; force: boolean }>(
    `SELECT relname, relforcerowsecurity AS force FROM pg_class WHERE relname = 'ask_ai_spend'`,
  );
  expect(rows).toEqual([{ relname: "ask_ai_spend", force: false }]);
});

test("0012 creates the ADR-0236 ask_ai_question capture table (no RLS — global, anonymous by construction)", async () => {
  const rows = await tp.query<{ relname: string; force: boolean }>(
    `SELECT relname, relforcerowsecurity AS force FROM pg_class WHERE relname = 'ask_ai_question'`,
  );
  expect(rows).toEqual([{ relname: "ask_ai_question", force: false }]);
  const cols = await tp.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'ask_ai_question' ORDER BY column_name`,
  );
  // Anonymous by construction: exactly these columns — no IP, no user id, no answer text.
  expect(cols.map((c) => c.column_name)).toEqual([
    "created_at",
    "id",
    "lane",
    "outcome",
    "question",
  ]);
});

test("0013 re-creates every tenant policy with the empty-string GUC guard (NULLIF)", async () => {
  const rows = await tp.query<{ polname: string; qual: string }>(
    `SELECT p.polname, pg_get_expr(p.polqual, p.polrelid) AS qual
     FROM pg_policy p
     WHERE p.polname IN (
       'credit_wallet_tenant_isolation',
       'usage_event_tenant_isolation',
       'billing_processed_event_tenant_isolation',
       'account_member_isolation'
     ) ORDER BY p.polname`,
  );
  expect(rows.length).toBe(4);
  for (const r of rows) {
    expect(r.qual).toContain("NULLIF");
  }
  // The dual-GUC membership policy guards BOTH reads.
  const member = rows.find((r) => r.polname === "account_member_isolation");
  expect(member?.qual).toContain("app.current_user");
});

test("every composed tenant table ships FORCE row-level security", async () => {
  const rows = await tp.query<{ relname: string; force: boolean }>(
    `SELECT relname, relforcerowsecurity AS force FROM pg_class
     WHERE relname IN ('credit_wallet','credit_event','entitlement_grant','license_grant','usage_event','account_member')`,
  );
  expect(rows.length).toBeGreaterThanOrEqual(6);
  expect(rows.every((r) => r.force)).toBe(true);
});

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
  // 24 = the shared chain's abandoned-checkout append (@caisson/platform-migrations, 0024 —
  // numbered past the site-local 0020–0022 by design, following the order-record subscription-
  // link append at 0023). 25/26 = the ADR-0315/0320 affiliate-flip appends (order_record
  // discount_id, then the affiliate_code registry).
  const first = await runPlatformMigrations(pgliteApplier(tp));
  // 22 shared-chain migrations + the 8 apps/site-local extras (dense seq 1–30). CAISSON-128
  // appended the shared 0030_renewal_extension_months (tenor-aware refund pre-arm). CAISSON-64:
  // `SITE_LOCAL_MIGRATIONS` carries 0011/0012 (ask_ai_*, prod-canonical names) plus the net-new
  // 0020/0021/0022 (tenant_ai_credential / byok_key_meta / compliance_attestation) — previously
  // dev-PGlite-only. CAISSON-110 (ADR-0350 F5) appended 0027_rate_limit / 0028_demo_run_budget /
  // 0029_demo_run_leads (the sandbox demo-run store), taking the tail from 5 to 8 → +3 here.
  // ADR-0381 lock 2 appended the shared 0031_entitlement_grant_charged_amount (the per-grant paid
  // amount the upgrade-credit floor reads) → 31. ADR-0388 appends 0032_field_crypto_keys,
  // which persists tenant-scoped wrapped DEKs for the production KMS path → 32.
  expect(first.applied).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
  ]);

  const second = await runPlatformMigrations(pgliteApplier(tp));
  expect(second.applied).toEqual([]);
  expect(second.skipped).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
  ]);
});

test("0016 adds the ADR-0251 updates-window column to entitlement_grant", async () => {
  const cols = await tp.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'entitlement_grant' AND column_name = 'updates_expires_at'`,
  );
  expect(cols).toEqual([
    {
      column_name: "updates_expires_at",
      data_type: "timestamp with time zone",
    },
  ]);
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

test("0014 adds expires_at and backfills existing grant rows (ADR-0252 Decision 4)", async () => {
  const cols = await tp.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'credit_event' AND column_name = 'expires_at'`,
  );
  expect(cols).toEqual([
    { column_name: "expires_at", data_type: "timestamp with time zone" },
  ]);
});

test("0015 creates the grant_consumption + credit_expiry_notice tables with the SUM index (ADR-0252)", async () => {
  const tables = await tp.query<{ relname: string; force: boolean }>(
    `SELECT relname, relforcerowsecurity AS force FROM pg_class
     WHERE relname IN ('grant_consumption','credit_expiry_notice') AND relkind = 'r'
     ORDER BY relname`,
  );
  expect(tables).toEqual([
    { relname: "credit_expiry_notice", force: true },
    { relname: "grant_consumption", force: true },
  ]);
  const idx = await tp.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'grant_consumption' AND indexname = 'grant_consumption_grant_idx'`,
  );
  expect(idx).toEqual([{ indexname: "grant_consumption_grant_idx" }]);
});

test("0017 creates the ADR-0251 renewal_extension ledger with FORCE RLS (refund/renewal handlers depend on it)", async () => {
  const rows = await tp.query<{ relname: string; force: boolean }>(
    `SELECT relname, relforcerowsecurity AS force FROM pg_class
     WHERE relname = 'renewal_extension' AND relkind = 'r'`,
  );
  expect(rows).toEqual([{ relname: "renewal_extension", force: true }]);
  const idx = await tp.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'renewal_extension' AND indexname = 'renewal_extension_uniq'`,
  );
  expect(idx).toEqual([{ indexname: "renewal_extension_uniq" }]);
});

test("0018 creates the ADR-0293 subscription_status table with FORCE RLS", async () => {
  const rows = await tp.query<{ relname: string; force: boolean }>(
    `SELECT relname, relforcerowsecurity AS force FROM pg_class
     WHERE relname = 'subscription_status' AND relkind = 'r'`,
  );
  expect(rows).toEqual([{ relname: "subscription_status", force: true }]);
  const idx = await tp.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'subscription_status' AND indexname = 'subscription_status_account_subscription_uniq'`,
  );
  expect(idx).toEqual([
    { indexname: "subscription_status_account_subscription_uniq" },
  ]);
});

test("0019 creates the ADR-0293 order_record table with FORCE RLS", async () => {
  const rows = await tp.query<{ relname: string; force: boolean }>(
    `SELECT relname, relforcerowsecurity AS force FROM pg_class
     WHERE relname = 'order_record' AND relkind = 'r'`,
  );
  expect(rows).toEqual([{ relname: "order_record", force: true }]);
  const idx = await tp.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'order_record' AND indexname = 'order_record_source_event_uniq'`,
  );
  expect(idx).toEqual([{ indexname: "order_record_source_event_uniq" }]);
});

test("0020/0021/0022 create tenant_ai_credential, byok_key_meta, and compliance_attestation with FORCE RLS (CAISSON-64: these previously only existed in the dev PGlite double, never in a real deployment)", async () => {
  const rows = await tp.query<{ relname: string; force: boolean }>(
    `SELECT relname, relforcerowsecurity AS force FROM pg_class
     WHERE relname IN ('tenant_ai_credential', 'byok_key_meta', 'compliance_attestation')
       AND relkind = 'r'
     ORDER BY relname`,
  );
  expect(rows).toEqual([
    { relname: "byok_key_meta", force: true },
    { relname: "compliance_attestation", force: true },
    { relname: "tenant_ai_credential", force: true },
  ]);
});

test("every composed tenant table ships FORCE row-level security", async () => {
  const rows = await tp.query<{ relname: string; force: boolean }>(
    `SELECT relname, relforcerowsecurity AS force FROM pg_class
     WHERE relname IN ('credit_wallet','credit_event','entitlement_grant','license_grant','usage_event','account_member','grant_consumption','credit_expiry_notice','renewal_extension','subscription_status','order_record')`,
  );
  expect(rows.length).toBeGreaterThanOrEqual(11);
  expect(rows.every((r) => r.force)).toBe(true);
});

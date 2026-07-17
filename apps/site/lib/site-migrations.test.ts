// Drift test (CAISSON-64 P0 fix): proves the ONE `SITE_LOCAL_MIGRATIONS` list is what BOTH real
// consumers actually apply — `deploy-migrate.ts`'s real-Postgres deploy path and `db.ts`'s dev
// PGlite double. Before this fix these were two independently hand-maintained arrays that
// diverged (the dev double additionally ran `byok_key_meta` — never created in production, which
// is why /dashboard/ai-keys crashed for every account, CAISSON-64).
//
// PGlite is flaky under parallel workers — run apps/site with `--concurrency=1`.
import { afterEach, describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { assembleMigrations } from "@caisson/kernel";
import {
  applyAll,
  platformMigrationsPackage,
} from "@caisson/platform-migrations";
import { pgliteMigrationApplier } from "@caisson/platform-migrations/pglite";
import { platformPackage } from "./deploy-migrate.ts";
import { SITE_LOCAL_MIGRATIONS } from "./site-migrations.ts";

const EXPECTED_NAMES_IN_ORDER = [
  "0011_ask_ai_spend.sql",
  "0012_ask_ai_question.sql",
  "0020_tenant_ai_credential.sql",
  "0021_byok_key_meta.sql",
  "0022_compliance_attestation.sql",
  // CAISSON-110 (ADR-0350 F5): the demo-run rate-limit store + F5 budget/lead tables. 0027-0029:
  // the shared chain owns 0023-0026 (see the assembled-ledger golden below).
  "0027_rate_limit.sql",
  "0028_demo_run_budget.sql",
  "0029_demo_run_leads.sql",
];

// The assembled platform chain as prod's positional `schema_version` ledger records it — the
// kernel sorts the COMBINED (shared + site-local) array by source filename, then renumbers, so a
// new entry whose name sorts mid-chain SHIFTS every later migration's seq and fails the next real
// deploy closed on checksum drift (the 2026-07-17 caisson-license failure: the three demo
// migrations were first named 0023-0025 against a shared chain that had itself grown 0023-0026).
//
// APPEND-ONLY: a legitimate new migration extends the END of this list. If your change makes any
// EXISTING row move, do not edit the row — rename your migration to sort after the last entry
// (claimed prefixes: platformMigrationsPackage's doc note in @caisson/platform-migrations).
const ASSEMBLED_LEDGER_FILENAMES = [
  "0001_app_role.sql",
  "0002_credits.sql",
  "0003_entitlement_grant.sql",
  "0004_license_grant.sql",
  "0005_ai_meter.sql",
  "0006_account_member.sql",
  "0007_credit_rounding.sql",
  "0008_entitlement_line_item.sql",
  "0009_credit_line_item.sql",
  "0010_billing_processed_event.sql",
  "0011_ask_ai_spend.sql",
  "0012_ask_ai_question.sql",
  "0013_rls_empty_guc_guard.sql",
  "0014_credit_expiry.sql",
  "0015_grant_consumption.sql",
  "0016_entitlement_updates_window.sql",
  "0017_renewal_extension.sql",
  "0018_subscription_status.sql",
  "0019_order_record.sql",
  "0020_tenant_ai_credential.sql",
  "0021_byok_key_meta.sql",
  "0022_compliance_attestation.sql",
  "0023_order_record_subscription_link.sql",
  "0024_checkout_abandonment.sql",
  "0025_order_record_discount.sql",
  "0026_affiliate_code.sql",
  "0027_rate_limit.sql",
  "0028_demo_run_budget.sql",
  "0029_demo_run_leads.sql",
];

test("assembled platform chain matches prod's positional ledger — append-only, never re-slot", () => {
  const assembled = assembleMigrations([platformPackage()]);
  expect(assembled.sequence.map((m) => m.filename)).toEqual(
    ASSEMBLED_LEDGER_FILENAMES,
  );
  // Dense renumbering is the identity here: every source name already carries its final seq — the
  // proof no entry landed mid-chain and got silently renamed (0023_rate_limit -> 0024_rate_limit
  // was the failure's signature).
  for (const m of assembled.sequence) {
    expect(m.filename).toBe(m.sourceName);
  }
});

test("SITE_LOCAL_MIGRATIONS contains exactly the 8 expected apps/site-local migrations, in order", () => {
  expect(SITE_LOCAL_MIGRATIONS.map((m) => m.name)).toEqual(
    EXPECTED_NAMES_IN_ORDER,
  );
});

test("deploy-migrate.ts's platformPackage() folds in the SAME SITE_LOCAL_MIGRATIONS list db.ts applies", () => {
  // The shared chain's own migration count (no site-local extra) — deploy-migrate's local tail
  // starts right after it.
  const sharedOnly = platformMigrationsPackage().migrations.length;
  const withSiteLocal = platformPackage().migrations;
  const tail = withSiteLocal.slice(sharedOnly);
  expect(tail).toEqual(SITE_LOCAL_MIGRATIONS as (typeof tail)[number][]);
});

describe("db.ts's dev PGlite double applies the identical list (all 5 tables land)", () => {
  let pg: PGlite | undefined;

  afterEach(async () => {
    await pg?.close();
  });

  test("byok_key_meta, tenant_ai_credential, and compliance_attestation all exist — the exact CAISSON-64 crash surface", async () => {
    pg = new PGlite();
    // The exact call `db.ts`'s `bootstrapPglite()` makes — proves the PGlite consumer resolves
    // the SAME `SITE_LOCAL_MIGRATIONS` binding `deploy-migrate.ts` applies to a real Postgres.
    await applyAll(pgliteMigrationApplier(pg), SITE_LOCAL_MIGRATIONS);

    const tables = await pg.query<{ relname: string }>(
      `SELECT relname FROM pg_class
       WHERE relname IN ('byok_key_meta', 'tenant_ai_credential', 'compliance_attestation',
                          'ask_ai_spend', 'ask_ai_question')
       ORDER BY relname`,
    );
    expect(tables.rows.map((r) => r.relname)).toEqual([
      "ask_ai_question",
      "ask_ai_spend",
      "byok_key_meta",
      "compliance_attestation",
      "tenant_ai_credential",
    ]);
  });
});

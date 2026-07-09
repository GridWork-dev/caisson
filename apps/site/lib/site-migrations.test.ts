// Drift test (CAISSON-64 P0 fix): proves the ONE `SITE_LOCAL_MIGRATIONS` list is what BOTH real
// consumers actually apply — `deploy-migrate.ts`'s real-Postgres deploy path and `db.ts`'s dev
// PGlite double. Before this fix these were two independently hand-maintained arrays that
// diverged (the dev double additionally ran `byok_key_meta` — never created in production, which
// is why /dashboard/ai-keys crashed for every account, CAISSON-64).
//
// PGlite is flaky under parallel workers — run apps/site with `--concurrency=1`.
import { afterEach, describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
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
];

test("SITE_LOCAL_MIGRATIONS contains exactly the 5 expected apps/site-local migrations, in order", () => {
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

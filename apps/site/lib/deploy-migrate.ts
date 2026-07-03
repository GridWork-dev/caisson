// lib/deploy-migrate.ts — the Stage-2 platform migration orchestrator (ADR-0139). Run ONCE per
// deploy against a fresh Railway Postgres BEFORE any service serves: the license service's Railway
// preDeployCommand runs it, and it is run manually for the first cutover. Idempotent + forward-only.
//
// Two responsibilities over ONE connection:
//  1. PLATFORM schema — the `app` RLS role + every FORCE-RLS platform table (credits, entitlement,
//     license_grant, ai-meter). Assembled IN MEMORY from the SAME `*_SCHEMA_SQL` constants the app
//     applies to its PGlite dev double (lib/db.ts), so there is ONE source of truth for the DDL — no
//     duplicated .sql to drift. The kernel assembler + the shared forward-only runner
//     (@caisson/migrate) give ordering, checksums, and run-once for free.
//  2. better-auth tables — user/session/account/verification, created by better-auth's OWN migrator
//     (getMigrations) over the same pool, so they always match the adapter the app signs in with.
//
// support_ticket is intentionally NOT here: the support-bot self-bootstraps it via ensure_schema
// (CREATE TABLE IF NOT EXISTS) on its own boot.
import { AI_METER_SCHEMA_SQL } from "@caisson/ai-meter";
import { ACCOUNT_MEMBER_SCHEMA_SQL } from "@caisson/auth";
import {
  CREDIT_LINE_ITEM_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
} from "@caisson/credits";
import { createCaptureEmailer } from "@caisson/email";
import { type PackageMigrations, assembleMigrations } from "@caisson/kernel";
import {
  type MigrationApplier,
  type MigrationRunResult,
  runMigrations,
} from "@caisson/migrate";
import { pgMigrationApplier } from "@caisson/migrate/pg";
import {
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_MIGRATION_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  LICENSE_GRANT_SCHEMA_SQL,
} from "@caisson/service-license";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { createAuth } from "./auth-server.ts";
import { ASK_AI_SPEND_SCHEMA_SQL } from "./ask-ai/spend.ts";

// The `app` RLS role — prod-augmented beyond lib/db.ts's PGlite bootstrap (which only CREATEs the
// role). On a fresh Railway Postgres the connecting role must be able to `SET LOCAL ROLE app` (a
// superuser already can; GRANT membership makes it portable/explicit) and `app` needs schema USAGE.
// NOLOGIN + the CREATE ROLE defaults (NOSUPERUSER, NOBYPASSRLS) are load-bearing: a BYPASSRLS `app`
// would silently defeat the fail-closed tenant isolation (ADR-0005).
const APP_ROLE_MIGRATION_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
    CREATE ROLE app NOLOGIN;
  END IF;
END $$;
GRANT app TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO app;
`;

/**
 * The platform migration set in dependency order — app role FIRST because every tenant table's
 * embedded buildTenantPolicySql GRANTs to `app`. One in-memory package; the kernel sorts by
 * filename, so the `NNNN_` prefixes encode the order.
 */
function platformPackage(): PackageMigrations {
  return {
    slug: "caisson-platform",
    dependsOn: [],
    migrations: [
      { name: "0001_app_role.sql", sql: APP_ROLE_MIGRATION_SQL },
      { name: "0002_credits.sql", sql: CREDIT_SCHEMA_SQL },
      {
        // The guarded legacy backfill is a safe no-op on a fresh DB (its DO block checks for the
        // legacy flat table); appending it keeps a re-migration of an older DB coherent.
        name: "0003_entitlement_grant.sql",
        sql: `${ENTITLEMENT_SCHEMA_SQL}\n${ENTITLEMENT_GRANT_MIGRATION_SQL}`,
      },
      { name: "0004_license_grant.sql", sql: LICENSE_GRANT_SCHEMA_SQL },
      { name: "0005_ai_meter.sql", sql: AI_METER_SCHEMA_SQL },
      // D4 (ADR-0176): the org account_member table + dual-GUC RLS. After the app role (0001)
      // because its GRANT targets `app`. Additive/forward-only; existing single-user tenants keep
      // working (getSession fail-safes to the personal account when a user has no membership row).
      { name: "0006_account_member.sql", sql: ACCOUNT_MEMBER_SCHEMA_SQL },
      // ADR-0212: rounding provenance columns on credit_event. APPENDED as a new migration —
      // 0002_credits.sql is checksum-pinned on the live DB, so the columns must never be folded
      // into CREDIT_SCHEMA_SQL in place (the runner would fail closed on drift).
      { name: "0007_credit_rounding.sql", sql: CREDIT_ROUNDING_MIGRATION_SQL },
      // ADR-0218: per-line join-key columns for Paddle per-line partial refunds. Both appended as new
      // migrations for the same checksum-pinning reason — 0003/0002 are frozen on the live DB. Each
      // swaps its table's uniqueness index to fold in COALESCE(line_item_id, ''); pre-launch there is
      // no live grant data (ADR-0113 §1), so the swap is clean and forward-only.
      {
        name: "0008_entitlement_line_item.sql",
        sql: ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
      },
      {
        name: "0009_credit_line_item.sql",
        sql: CREDIT_LINE_ITEM_MIGRATION_SQL,
      },
      // ADR-0234: the Ask-AI public-lane daily spend counter. Global (non-tenant), no RLS — accessed
      // outside withTenant. Appended as a new forward-only migration (the earlier files are
      // checksum-pinned on the live DB).
      { name: "0010_ask_ai_spend.sql", sql: ASK_AI_SPEND_SCHEMA_SQL },
    ],
  };
}

/**
 * Apply the platform schema through an injected applier (node-postgres in prod, PGlite in the test).
 * The forward-only, idempotent, checksum-drift-fail-closed engine is the shared runMigrations.
 */
export async function runPlatformMigrations(
  applier: MigrationApplier,
): Promise<MigrationRunResult> {
  return runMigrations(assembleMigrations([platformPackage()]), applier);
}

async function main(): Promise<void> {
  // Fail closed: a deploy migration against no DB is never a silent no-op.
  const url = process.env.DATABASE_URL ?? "";
  if (url.length === 0) {
    throw new Error(
      "DATABASE_URL is required (the deploy migration needs a Postgres connection) — refusing to run.",
    );
  }
  const pool = new Pool({ connectionString: url });
  try {
    const result = await runPlatformMigrations(pgMigrationApplier(pool));
    process.stdout.write(
      `[deploy-migrate] platform: applied ${String(result.applied.length)}, skipped ${String(result.skipped.length)}\n`,
    );
    // better-auth owns its own tables; its migrator matches the adapter the app signs in with. The
    // secret is not used for table DDL, so a placeholder is safe when BETTER_AUTH_SECRET is unset.
    const auth = createAuth({
      database: pool,
      secret:
        process.env.BETTER_AUTH_SECRET ??
        "deploy-migrate-placeholder-secret-32chars-minimum",
      emailer: createCaptureEmailer(),
    });
    const { runMigrations: runAuthMigrations } = await getMigrations(
      auth.options,
    );
    await runAuthMigrations();
    process.stdout.write("[deploy-migrate] better-auth: tables ensured\n");
  } finally {
    await pool.end();
  }
}

if (import.meta.main) {
  await main();
}

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
import { PROCESSED_EVENT_SCHEMA_SQL } from "@caisson/billing";
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
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  LICENSE_GRANT_SCHEMA_SQL,
} from "@caisson/service-license";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { createAuth } from "./auth-server.ts";
import { ASK_AI_QUESTION_SCHEMA_SQL } from "./ask-ai/question-log.ts";
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
 *
 * Exported for read-only drift auditing (compare the assembled checksums against a live DB's
 * `schema_version` rows before any bless/apply — the CAISSON-16 procedure).
 */
export function platformPackage(): PackageMigrations {
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
      // ADR-0229 rows 50+51: the outer billing-webhook dedup table. Appended as a new checksum-pinned
      // migration (the prior files are frozen on the live DB, ADR-0006). Tenant-owned FORCE-RLS, so it
      // sits after the app role (0001). The claim runs inside the license webhook's withTenant tx.
      {
        name: "0010_billing_processed_event.sql",
        sql: PROCESSED_EVENT_SCHEMA_SQL,
      },
      // ADR-0234: the Ask-AI per-lane (public + premium) daily spend counters. Global (non-tenant), no
      // RLS — accessed outside withTenant.
      { name: "0011_ask_ai_spend.sql", sql: ASK_AI_SPEND_SCHEMA_SQL },
      // ADR-0236: consent-noticed question-text capture. Global (non-tenant), no RLS — same posture
      // as 0011. Anonymous by construction (no IP / user id / answer text); 90-day retention is a
      // hard DELETE swept on insert (question-log.ts), not a schema concern.
      { name: "0012_ask_ai_question.sql", sql: ASK_AI_QUESTION_SCHEMA_SQL },
      // Wave-6b (ADR-0239 row #2): re-create every platform tenant-isolation policy with the
      // empty-string GUC guard — NULLIF folds '' to NULL so a pooled connection whose custom GUC
      // was reset to '' (pgbouncer transaction pooling) always DENIES instead of matching a row
      // whose tenant column is ''. FROZEN LITERAL, deliberately NOT built via buildTenantPolicySql:
      // the 0002–0010 constants above interpolate the builder at import time, so the builder's
      // NULLIF change already drifted their pinned checksums on the live ledger (blessed at apply
      // time, once) — a builder call HERE would re-drift this file on the next builder change.
      // Future policy changes ship as a NEW re-create migration, never an edit here (ADR-0006).
      { name: "0013_rls_empty_guc_guard.sql", sql: RLS_EMPTY_GUC_GUARD_SQL },
      // ADR-0244/0251: the per-grant updates-window override a renewal purchase stamps
      // (`extendUpdatesWindow`) and /issue reads back (`computeUpdatesUntil`). Numbered 0016 —
      // 0014/0015 are RESERVED by the parallel credits build (kickoff-E W1b); the assembler
      // renumbers by sorted name, so the gap closes cleanly when those land.
      {
        name: "0016_entitlement_updates_window.sql",
        sql: ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
      },
    ],
  };
}

/** The 10 standard-shape tenant tables (policy `<table>_tenant_isolation`, column account_id). */
const NULLIF_GUARD_TABLES = [
  "credit_wallet",
  "credit_event",
  "entitlement_grant",
  "license_grant",
  "usage_event",
  "tenant_spend_window",
  "spend_policy",
  "spend_breaker",
  "billing_processed_event",
] as const;

const RLS_EMPTY_GUC_GUARD_SQL = `
${NULLIF_GUARD_TABLES.map(
  (t) => `DROP POLICY IF EXISTS ${t}_tenant_isolation ON ${t};
CREATE POLICY ${t}_tenant_isolation ON ${t}
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));`,
).join("\n")}
-- account_member keeps its dual-GUC shape (ADR-0176); both GUC reads gain the guard. The source
-- constant in @caisson/auth is intentionally untouched (editing it would drift pinned 0006).
DROP POLICY IF EXISTS account_member_isolation ON account_member;
CREATE POLICY account_member_isolation ON account_member
  USING (
    account_id = NULLIF(current_setting('app.current_account', true), '')
    OR user_id = NULLIF(current_setting('app.current_user', true), '')
  )
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));
-- rate_limit is boot-ensured by services/license (not ledger-created) — guard for absence so a
-- fresh DB migrating before the service's first boot doesn't fail on a missing relation.
DO $$ BEGIN
  IF to_regclass('rate_limit') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS rate_limit_tenant_isolation ON rate_limit';
    EXECUTE 'CREATE POLICY rate_limit_tenant_isolation ON rate_limit
      USING (account_id = NULLIF(current_setting(''app.current_account'', true), ''''))
      WITH CHECK (account_id = NULLIF(current_setting(''app.current_account'', true), ''''))';
  END IF;
END $$;
`;

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

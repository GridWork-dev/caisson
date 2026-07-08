// lib/deploy-migrate.ts — the Stage-2 platform migration orchestrator (ADR-0139). Run ONCE per
// deploy against a fresh Railway Postgres BEFORE any service serves: the license service's Railway
// preDeployCommand runs it, and it is run manually for the first cutover. Idempotent + forward-only.
//
// Two responsibilities over ONE connection:
//  1. PLATFORM schema — the `app` RLS role + every FORCE-RLS platform table (credits, entitlement,
//     license_grant, ai-meter). The shared chain (@caisson/platform-migrations, CAISSON-21) plus the
//     two apps/site-local ask_ai_* migrations (their SQL lives in this app, not a package — see
//     platformPackage() below). apps/admin's PGlite bootstrap applies the SAME shared chain, so a new
//     platform migration lands for both consumers or neither — closing the CAISSON-11 hand-mirror
//     drift class. The kernel assembler + the shared forward-only runner (@caisson/migrate) give
//     ordering, checksums, and run-once for free.
//  2. better-auth tables — user/session/account/verification, created by better-auth's OWN migrator
//     (getMigrations) over the same pool, so they always match the adapter the app signs in with.
//
// support_ticket is intentionally NOT here: the support-bot self-bootstraps it via ensure_schema
// (CREATE TABLE IF NOT EXISTS) on its own boot.
import { createCaptureEmailer } from "@caisson/email";
import type { PackageMigrations } from "@caisson/kernel";
import type { MigrationApplier, MigrationRunResult } from "@caisson/migrate";
import { pgMigrationApplier } from "@caisson/migrate/pg";
import {
  type MigrationFile,
  applyAll,
  platformMigrationsPackage,
} from "@caisson/platform-migrations";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { createAuth } from "./auth-server.ts";
import { ASK_AI_QUESTION_SCHEMA_SQL } from "./ask-ai/question-log.ts";
import { ASK_AI_SPEND_SCHEMA_SQL } from "./ask-ai/spend.ts";

/** The two apps/site-local migrations folded onto the shared chain — their SQL lives in this app, not
 *  a package (a package cannot depend "up" on an app, ADR-0003 / standards-gate Gate 3). Unchanged
 *  filenames + content from before the CAISSON-21 extraction. */
const SITE_LOCAL_MIGRATIONS: readonly MigrationFile[] = [
  // ADR-0234: the Ask-AI per-lane (public + premium) daily spend counters. Global (non-tenant), no
  // RLS — accessed outside withTenant.
  { name: "0011_ask_ai_spend.sql", sql: ASK_AI_SPEND_SCHEMA_SQL },
  // ADR-0236: consent-noticed question-text capture. Global (non-tenant), no RLS — same posture
  // as 0011. Anonymous by construction (no IP / user id / answer text); 90-day retention is a
  // hard DELETE swept on insert (question-log.ts), not a schema concern.
  { name: "0012_ask_ai_question.sql", sql: ASK_AI_QUESTION_SCHEMA_SQL },
];

/**
 * The platform migration set: the shared chain (@caisson/platform-migrations) plus the two
 * apps/site-local ask_ai_* entries above, folded in at their original filenames — the kernel sorts
 * one package's migrations by filename before renumbering, so this reproduces the exact pre-
 * extraction merged sequence (proven byte-identical against a pinned digest in
 * @caisson/platform-migrations's own test).
 *
 * Exported for read-only drift auditing (compare the assembled checksums against a live DB's
 * `schema_version` rows before any bless/apply — the CAISSON-16 procedure).
 */
export function platformPackage(): PackageMigrations {
  return platformMigrationsPackage(SITE_LOCAL_MIGRATIONS);
}

/**
 * Apply the platform schema through an injected applier (node-postgres in prod, PGlite in the test).
 * The forward-only, idempotent, checksum-drift-fail-closed engine is the shared runMigrations
 * (invoked here through @caisson/platform-migrations's `applyAll`).
 */
export async function runPlatformMigrations(
  applier: MigrationApplier,
): Promise<MigrationRunResult> {
  return applyAll(applier, SITE_LOCAL_MIGRATIONS);
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
  pool.on("error", (err) => {
    process.stderr.write(
      `[deploy-migrate] idle pg client error: ${err.message}\n`,
    );
  });
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

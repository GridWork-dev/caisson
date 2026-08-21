// lib/deploy-migrate.ts — the Stage-2 platform migration orchestrator (ADR-0139). Run ONCE per
// deploy against a fresh Railway Postgres BEFORE any service serves: the license service's Railway
// preDeployCommand runs it, and it is run manually for the first cutover. Idempotent + forward-only.
//
// Two responsibilities over ONE connection:
//  1. PLATFORM schema — the `app` RLS role + every FORCE-RLS platform table (credits, entitlement,
//     license_grant, ai-meter). The shared chain (@caisson/platform-migrations, CAISSON-21) plus the
//     apps/site-local extras from `./site-migrations.ts` (see platformPackage() below) — the SAME
//     list `lib/db.ts`'s dev PGlite double applies (CAISSON-64: these used to be two separately
//     hand-maintained lists that drifted — the dev double ran 3 migrations the real-Postgres apply
//     never learned about, so `byok_key_meta` was never created in prod and /dashboard/ai-keys
//     crashed for every account). apps/admin's PGlite bootstrap applies the SAME shared
//     @caisson/platform-migrations chain, so a new PLATFORM migration lands for both consumers or
//     neither — closing the CAISSON-11 hand-mirror drift class; `./site-migrations.ts` closes the
//     sibling apps/site-local-extras drift class. The kernel assembler + the shared forward-only
//     runner (@caisson/migrate) give ordering, checksums, and run-once for free.
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
  applyAll,
  platformMigrationsPackage,
} from "@caisson/platform-migrations";
import { createPgPool } from "@caisson/tenancy-rls";
import { getMigrations } from "better-auth/db/migration";
import { createAuth } from "./auth-server.ts";
import { SITE_LOCAL_MIGRATIONS } from "./site-migrations.ts";

/**
 * The platform migration set: the shared chain (@caisson/platform-migrations) plus the
 * apps/site-local extras (`./site-migrations.ts`), folded in at their original filenames — the
 * kernel sorts one package's migrations by filename before renumbering, so the two prod-canonical
 * `ask_ai_*` entries reproduce the exact pre-extraction merged sequence (proven byte-identical
 * against a pinned digest in @caisson/platform-migrations's own test); the 3 net-new BYOK/
 * compliance-attestation entries land after them.
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
  const url = process.env.DATABASE_DIRECT_URL ?? "";
  if (url.length === 0) {
    throw new Error(
      "DATABASE_DIRECT_URL is required (the deploy migration needs a direct Postgres connection) — refusing to run.",
    );
  }
  const pool = createPgPool(url, { purpose: "migration" });
  try {
    const result = await runPlatformMigrations(pgMigrationApplier(pool));
    process.stdout.write(
      `[deploy-migrate] platform: applied ${String(result.applied.length)}, skipped ${String(result.skipped.length)}\n`,
    );
    // better-auth owns its own tables; its migrator matches the adapter the app signs in with. The
    // secret is not used for table DDL, so a placeholder is safe when BETTER_AUTH_SECRET is unset.
    // Same for the ADR-0366 HMAC key: it's not used for table DDL either — the placeholder just
    // satisfies `createAuth()`'s fail-closed construction check when it's genuinely unset locally.
    const auth = await createAuth({
      database: pool,
      secret:
        process.env.BETTER_AUTH_SECRET ??
        "deploy-migrate-placeholder-secret-32chars-minimum",
      emailer: createCaptureEmailer(),
      hmacKey:
        process.env.SESSION_TOKEN_HMAC_KEY ??
        "deploy-migrate-placeholder-hmac-key-32chars-minimum",
    });
    // `auth.options.database` is the ADR-0366 wrapped adapter FACTORY (see the comment on
    // `createAuth` in auth-server.ts) — `getMigrations`'s own dialect detection needs the RAW
    // `pool` back in its place; schema DDL never goes through the session-token wrap.
    const { runMigrations: runAuthMigrations } = await getMigrations({
      ...auth.options,
      database: pool,
    });
    await runAuthMigrations();
    process.stdout.write("[deploy-migrate] better-auth: tables ensured\n");

    // ADR-0366 lock 3 (hard cutover, destructive, sanctioned): remove any session row still
    // carrying a pre-wrap raw token instead of the HMAC-SHA-256 lookup key this wrap now stores.
    // Self-limiting — safe to run on every deploy forever (see `cutoverLegacySessionTokens`).
    const removedLegacyTokens = await cutoverLegacySessionTokens((sql) =>
      pool.query(sql),
    );
    process.stdout.write(
      `[deploy-migrate] session-token cutover: removed ${String(removedLegacyTokens)} legacy raw-token row(s)\n`,
    );
  } finally {
    await pool.end();
  }
}

/**
 * ADR-0366 lock 3 (hard cutover, destructive, sanctioned — documented here per the lock's own
 * requirement): remove any `session` row still carrying a pre-wrap raw token — better-auth's
 * default `generateId(32)` (32 alphanumeric characters) — instead of the ADR-0366 adapter wrap's
 * HMAC-SHA-256 lookup key (always exactly 64 lowercase hex characters,
 * `packages/auth/src/session-token.ts`). A raw token stored before the wrap shipped can never
 * resolve through it (`session-adapter.ts` always hashes the incoming cookie before querying), so
 * those rows are already dead weight; removing them also makes the cutover UNCONDITIONAL — no
 * pre-cutover buyer session survives a deploy of this change, per the operator lock.
 *
 * Self-limiting by shape, not a ledger entry: safe to run on every deploy forever — a cheap no-op
 * once no legacy-shaped row remains, and it never matches a valid post-cutover row. This
 * deliberately does NOT go through the `@caisson/migrate` checksum-ledger chain
 * (`site-migrations.ts`): that chain owns Caisson's OWN schema DDL, applied BEFORE better-auth's
 * own migrator (above) creates/updates the `session` table it exclusively owns — a same-transaction
 * ledger entry can't run after a table that doesn't exist yet, and the ledger's per-assembly
 * version numbering isn't scoped for a second, later, independently-run assembly against tables it
 * doesn't own.
 *
 * Accepted residual (ADR-0366): a rolling deploy has a window where an OLD instance (pre-cutover
 * code, still serving traffic) can mint a fresh raw-token session row after a NEW instance's
 * cutover already ran. That row isn't cleaned up until the NEXT deploy's cutover pass — it's
 * self-healing, not permanent. Sanctioned by lock 3: pre-launch buyer traffic is ~0, so the
 * exposure window is negligible; revisit if a zero-downtime rolling strategy with in-flight
 * traffic draining lands before real volume does.
 */
export async function cutoverLegacySessionTokens(
  query: (sql: string) => Promise<{ rows: unknown[] }>,
): Promise<number> {
  const result = await query(
    "DELETE FROM session WHERE token !~ '^[0-9a-f]{64}$' RETURNING id",
  );
  return result.rows.length;
}

if (import.meta.main) {
  await main();
}

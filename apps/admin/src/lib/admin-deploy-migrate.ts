// admin's deploy migration (ADR-0283, mirroring apps/site/lib/deploy-migrate.ts:228-241). better-
// auth does NOT create its own tables at runtime — it needs `getMigrations(auth.options)` run
// explicitly, ONCE, before the first request ever hits `/api/auth/*`. Without this, a fresh
// `ADMIN_AUTH_DATABASE_URL` 500s the OAuth callback on relation-does-not-exist and the operator is
// locked out of their own control-plane on the very deploy meant to grant them access.
//
// WHERE it runs (Cloud Run T22): an explicit migration Job built from the Dockerfile's `migrate`
// target. The normal runtime image is Next standalone and deliberately contains no source tree,
// so schema work cannot accidentally reappear in process boot. This file remains runnable as a
// CLI (`bun apps/admin/src/lib/admin-deploy-migrate.ts`) for the finite Job. Idempotent +
// forward-only: better-auth's migrator tracks its own applied state, so a re-run against an
// already-migrated database is a safe no-op.
//
// The auth instance built here is MIGRATION-ONLY — its secret/client id/client secret are
// placeholders (never used for table DDL, and this path never serves a request), so it runs from
// just `ADMIN_AUTH_DIRECT_DATABASE_URL` with no OAuth app or session secret provisioned yet.
// `getAdminAuth()` (admin-auth-server.ts) is NOT reused here: it fails closed to `null` without the
// OAuth credentials, which a migration-only run must not require.
import { createPgPool } from "@caisson/tenancy-rls";
import { getMigrations } from "better-auth/db/migration";
import { createAdminAuth } from "./admin-auth-server.ts";

/** Ensure admin's better-auth tables exist against `url`. Idempotent + forward-only. Called only
 * by the finite migration entrypoint. Opens and closes its own short-lived pg pool. */
export async function ensureAdminAuthTables(url: string): Promise<void> {
  const pool = createPgPool(url, { purpose: "migration" });
  try {
    const auth = createAdminAuth({
      database: pool,
      secret:
        process.env.ADMIN_BETTER_AUTH_SECRET ??
        "admin-deploy-migrate-placeholder-secret-32chars-min",
      githubClientId:
        process.env.ADMIN_GITHUB_CLIENT_ID ?? "deploy-migrate-placeholder-id",
      githubClientSecret:
        process.env.ADMIN_GITHUB_CLIENT_SECRET ??
        "deploy-migrate-placeholder-secret",
      // The allowlist is irrelevant here — the databaseHooks gate only matters on a real OAuth
      // callback, which this path never drives.
      allowedGithubIds: new Set(),
    });
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  // Fail loud: a deploy migration against no DB is never a silent no-op.
  const url = process.env.ADMIN_AUTH_DIRECT_DATABASE_URL?.trim();
  if (url === undefined || url.length === 0) {
    throw new Error(
      "ADMIN_AUTH_DIRECT_DATABASE_URL is required (the admin deploy migration needs its own direct Postgres " +
        "connection) — refusing to run.",
    );
  }
  await ensureAdminAuthTables(url);
  process.stdout.write("[admin-deploy-migrate] better-auth: tables ensured\n");
}

if (import.meta.main) {
  await main();
}

// src/deploy.ts — the production deploy entrypoint (Stage-2, ADR-0110/0139). server.ts's
// `import.meta.main` is a deliberate hard stop: `startServer(db)` takes the tenant Transactor as an
// injected argument and the repo has no in-tree production Postgres pool. This file supplies one — a
// node-postgres Pool over DATABASE_URL wrapped in a Transactor — and calls startServer(db).
//
// The Pool→Transactor factory is INLINED, not imported from apps/site/lib/db.ts (that module is
// Next-coupled: a globalThis HMR singleton + a PGlite dev double + an eager drizzle handle). It is a
// ~15-line twin of that factory; the security-critical `SET LOCAL ROLE app` runs inside the SHARED
// `withTenant` (@caisson/tenancy-rls), NOT here — so the two copies can only ever diverge on
// transaction plumbing, never on tenant isolation.
// ponytail: two consumers, one Next-specific — lift into @caisson/tenancy-rls only if a THIRD
// headless service needs the same Pool→Transactor adapter.
import type { TenantExecutor, Transactor } from "@caisson/tenancy-rls";
import { Pool, type PoolClient } from "pg";
import { createJobAlertingDeps, loadOpsAlertChannels } from "./alerting.ts";
import {
  loadCreditExpiryScheduleConfig,
  startCreditExpiryScheduler,
} from "./credit-expiry-scheduler.ts";
import { recipientFor, resolveEmailer } from "./email-notify.ts";
import { startServer } from "./server.ts";

function nodePgExecutor(client: PoolClient): TenantExecutor {
  return {
    // `pg`'s `query<T>` constrains `T extends QueryResultRow`; the shared `TenantExecutor.query` has
    // no such bound (PGlite satisfies it too), so call untyped and cast rather than narrow the
    // interface to a pg-specific constraint every other driver would then have to satisfy.
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
      const res = await client.query(sql, params);
      return { rows: res.rows as T[] };
    },
    async exec(sql: string) {
      return client.query(sql);
    },
  };
}

function nodePgTransactor(pool: Pool): Transactor {
  return {
    async transaction<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(nodePgExecutor(client));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Best-effort — the connection may already be unusable; the original error wins below.
        }
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

if (import.meta.main) {
  // Fail closed: a production issuer must NEVER fall back to an in-memory PGlite double the way
  // apps/site's dev-only getDb does. An unset DATABASE_URL aborts startup before the socket binds,
  // matching server.ts's fail-closed posture on the token + signing key. Never log the URL.
  const url = process.env.DATABASE_URL ?? "";
  if (url.length === 0) {
    throw new Error(
      "DATABASE_URL is required (the license issuer needs a Postgres Transactor) — refusing to start.",
    );
  }
  const pool = new Pool({ connectionString: url });
  const db = nodePgTransactor(pool);
  // Bun.serve inside startServer holds the event loop open — the process stays up serving.
  startServer(db);

  // ADR-0256: inert until armed — CREDIT_EXPIRY_SCHEDULE unset resolves immediately with zero
  // pg-boss connection ever opened. Fire-and-forget (never awaited): a slow or failed scheduler
  // start must never delay or block the webhook/issuer socket already bound above, and the
  // function's own try/catch means this can never become an unhandled rejection.
  void startCreditExpiryScheduler({
    db,
    connectionString: url,
    schedule: loadCreditExpiryScheduleConfig(),
    // The real @caisson/email transport (email-notify.ts) — Resend when RESEND_API_KEY is set, the
    // capture driver otherwise. `recipientFor` resolves the buyer's address the same way the
    // post-purchase confirmation does (account_member → better-auth's user table).
    emailer: resolveEmailer(),
    recipientFor: (accountId) => recipientFor(db, accountId),
    dashboardUrl: "https://caisson.sh/dashboard/credits",
    // G24: the updates-window expiry notice's own CTA — a different dashboard page than credits.
    updatesWindowDashboardUrl: "https://caisson.sh/dashboard/license",
    // Alerts on a sweep/notice/tick task failure or a pg-boss infra error. Empty when
    // DISCORD_OPS_WEBHOOK_URL is unset — the same fail-safe-absent posture as every other env-gated
    // notifier in this file.
    alerting: createJobAlertingDeps(loadOpsAlertChannels()),
  });
}

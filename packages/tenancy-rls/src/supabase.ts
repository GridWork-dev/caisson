// Supabase `Transactor` driver for the `withTenant` seam (rls.ts:21,31) — ADR-0174. A thin
// node-postgres `Pool` wiring, shaped the same as `apps/site/lib/db.ts`'s `nodePgTransactor` (the
// repo's other production node-postgres `Transactor`).
//
// BINDING CONSTRAINT: `withTenant` does `SET LOCAL ROLE app` + `set_config(..., true)` and needs
// BOTH to hold for the life of ONE real transaction on ONE real TCP connection. Supabase's
// TRANSACTION-mode pooler (Supavisor, default port 6543) hands a *different* physical backend
// connection to each statement even inside what looks like one logical transaction from the
// app's side — `SET LOCAL` silently evaporates between statements and RLS quietly stops being
// tenant-scoped. A serverless-HTTP path (the Data API / PostgREST) has no session/transaction
// concept at all and can't run this driver's raw SQL either way. This driver therefore accepts
// ONLY a session-mode pooler or a direct connection (both default to port 5432) and fails closed
// at CONSTRUCTION — never at the first silently-unscoped query — when the connection string is
// shaped like the transaction-mode pooler.
import { Pool, type PoolClient } from "pg";
import { ConfigError } from "@caisson/kernel";
import type { TenantExecutor, Transactor } from "./rls.ts";

/** Supavisor's transaction-mode pooler defaults to this port; `SET LOCAL` cannot survive it. */
const TRANSACTION_MODE_POOLER_PORT = "6543";

export interface SupabaseTransactorConfig {
  /** A Postgres wire-protocol connection string — session-mode pooler or direct connection ONLY. */
  connectionString: string;
  /**
   * Override the underlying `Transactor`. Tests inject a PGlite-backed `Transactor` here instead
   * of a real Supabase connection, so `createSupabaseTransactor` never opens a socket in `bun
   * test` — the same override shape as `@caisson/jobs`'s `TriggerJobQueueConfig.client`.
   */
  driver?: Transactor;
}

function assertSessionModeConnection(connectionString: string): void {
  if (connectionString.length === 0) {
    throw new ConfigError(
      "createSupabaseTransactor requires a non-empty `connectionString`",
    );
  }
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new ConfigError(
      "createSupabaseTransactor received an unparseable `connectionString`",
    );
  }
  if (url.port === TRANSACTION_MODE_POOLER_PORT) {
    throw new ConfigError(
      "createSupabaseTransactor refuses Supabase's transaction-mode pooler (port 6543) — " +
        "SET LOCAL cannot survive it. Point `connectionString` at the session-mode pooler or a " +
        "direct connection (port 5432) instead.",
    );
  }
}

function nodePgExecutor(client: PoolClient): TenantExecutor {
  return {
    // `pg`'s `query<T>` constrains `T extends QueryResultRow`; `TenantExecutor.query`'s `T` has
    // no such constraint (PGlite, the other driver behind this same port, carries no bound
    // either) — call untyped and cast the rows rather than narrow the shared port to a
    // `pg`-specific generic every other driver would then have to satisfy too.
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
      const res = await client.query(sql, params);
      return { rows: res.rows as T[] };
    },
    async exec(sql: string) {
      await client.query(sql);
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

/**
 * The Supabase `Transactor` driver. Fails closed at construction (`ConfigError`) when
 * `connectionString` is empty, unparseable, or shaped like Supabase's transaction-mode pooler —
 * never at the first query that would otherwise leak across tenants. Dormant: no `Pool`, no
 * socket, is created until this factory runs with a real `connectionString` and no injected
 * `driver`.
 */
export function createSupabaseTransactor(
  config: SupabaseTransactorConfig,
): Transactor {
  assertSessionModeConnection(config.connectionString);
  if (config.driver !== undefined) {
    return config.driver;
  }
  const pool = new Pool({ connectionString: config.connectionString });
  // An idle pooled connection dying emits `error` on the Pool itself; with no listener node-postgres
  // rethrows it as an uncaught exception and kills the host process (this exact failure took down
  // caisson-admin). Log-and-survive: `pg` has already discarded the dead client, so the next
  // checkout dials a fresh connection — nothing to clean up here.
  pool.on("error", (err) => {
    process.stderr.write(
      `[tenancy-rls] idle pooled connection error (survived): ${err.message}\n`,
    );
  });
  return nodePgTransactor(pool);
}

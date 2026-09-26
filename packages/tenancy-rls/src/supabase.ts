// Supabase `Transactor` driver for the `withTenant` seam (rls.ts:21,31) — ADR-0174. A thin
// `Pool` wiring over the canonical node-postgres adapter (`createPgTransactor`, node-pg.ts).
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
import { ConfigError } from "@caisson-sh/kernel";
import { createPgTransactor } from "./node-pg.ts";
import { createPgPool } from "./pool.ts";
import type { Transactor } from "./rls.ts";

/** Supavisor's transaction-mode pooler defaults to this port; `SET LOCAL` cannot survive it. */
const TRANSACTION_MODE_POOLER_PORT = "6543";

export interface SupabaseTransactorConfig {
  /** A Postgres wire-protocol connection string — session-mode pooler or direct connection ONLY. */
  connectionString: string;
  /**
   * Override the underlying `Transactor`. Tests inject a PGlite-backed `Transactor` here instead
   * of a real Supabase connection, so `createSupabaseTransactor` never opens a socket in `bun
   * test` — the same override shape as `@caisson-sh/jobs`'s `TriggerJobQueueConfig.client`.
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
  const pool = createPgPool(config.connectionString);
  return createPgTransactor(pool);
}

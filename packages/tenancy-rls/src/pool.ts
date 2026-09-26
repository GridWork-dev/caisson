import { ConfigError } from "@caisson-sh/kernel";
import { Pool, type PoolConfig } from "pg";

export type PgPoolPurpose = "runtime" | "migration";

export interface CreatePgPoolOptions {
  /** Runtime request traffic uses the pooled endpoint; finite DDL jobs use the direct endpoint. */
  purpose?: PgPoolPurpose;
}

const RUNTIME_POOL_CONFIG = {
  max: 2,
  min: 0,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 4_000,
  statement_timeout: 25_000,
  query_timeout: 28_000,
  idle_in_transaction_session_timeout: 25_000,
  allowExitOnIdle: true,
} satisfies PoolConfig;

const MIGRATION_POOL_CONFIG = {
  max: 1,
  min: 0,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 300_000,
  query_timeout: 310_000,
  idle_in_transaction_session_timeout: 60_000,
  allowExitOnIdle: true,
} satisfies PoolConfig;

/**
 * The only production node-postgres pool constructor. Pools start empty, cap Cloud Run's
 * per-instance connection budget, discard idle clients promptly, and bound connection/query time.
 */
export function createPgPool(
  connectionString: string,
  { purpose = "runtime" }: CreatePgPoolOptions = {},
): Pool {
  const normalized = connectionString.trim();
  if (normalized === "") {
    throw new ConfigError(
      "createPgPool requires a non-empty connection string",
    );
  }

  const pool = new Pool({
    connectionString: normalized,
    ...(purpose === "migration" ? MIGRATION_POOL_CONFIG : RUNTIME_POOL_CONFIG),
  });
  // node-postgres removes an idle client after an error, but without this listener EventEmitter
  // turns that recoverable network event into an uncaught process crash.
  pool.on("error", (error) => {
    process.stderr.write(
      `[tenancy-rls] idle pooled connection error (survived): ${error.message}\n`,
    );
  });
  return pool;
}

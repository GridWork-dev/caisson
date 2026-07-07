// The `@caisson/tenancy-rls` `Transactor` — a thin `pg.Pool` wrapper. The pool is constructed
// lazily (on first `.transaction()` call, not at import time) so a missing `DATABASE_URL` never
// breaks a build/typecheck, only a real query at runtime.
import { Pool, type PoolClient } from "pg";
import { ConfigError } from "@caisson/kernel";
import type { TenantExecutor, Transactor } from "@caisson/tenancy-rls";

let pool: Pool | undefined;

function getPool(): Pool {
  if (pool === undefined) {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString === undefined) {
      throw new ConfigError("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

function wrapClient(client: PoolClient): TenantExecutor {
  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<{ rows: T[] }> {
      const result = await client.query<T & Record<string, unknown>>(
        sql,
        params,
      );
      return { rows: result.rows };
    },
    async exec(sql: string): Promise<unknown> {
      return client.query(sql);
    },
  };
}

/** The `Transactor` every `withTenant`/`withUser` call in this app runs against. Swap the driver
 *  (a different Postgres client, PGlite for local dev) by implementing this same interface. */
export const db: Transactor = {
  async transaction<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await fn(wrapClient(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

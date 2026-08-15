// The caller-pool-owned node-postgres Transactor (consolidation C05): one canonical
// BEGIN / COMMIT / best-effort-ROLLBACK / release adapter over the shared TenantExecutor port,
// previously copy-pasted across site, admin, the license deploy entry, the CLI, and the
// generated starter. Pool CONSTRUCTION and lifecycle stay with each caller on purpose — lazy
// init, HMR caching, error listeners, shutdown, and `pool.end()` are caller policy, not
// transaction policy.
import type { Pool, PoolClient } from "pg";
import type { TenantExecutor, Transactor } from "./rls.ts";

function nodePgExecutor(client: PoolClient): TenantExecutor {
  return {
    // `pg`'s `query<T>` constrains `T extends QueryResultRow`; `TenantExecutor.query`'s `T` has
    // no such bound (PGlite, the other driver behind this same port, carries no bound either) —
    // call untyped and cast the rows rather than narrow the shared port to a `pg`-specific
    // generic every other driver would then have to satisfy too.
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
      const res = await client.query(sql, params);
      return { rows: res.rows as T[] };
    },
    async exec(sql: string) {
      // Return the driver result (typed `Promise<unknown>` on the port): five of the seven folded
      // copies did, and PGlite — the test-double driver behind the same port — does too. Resolving
      // `undefined` only in production would be an invisible divergence behind `unknown`.
      return client.query(sql);
    },
  };
}

/**
 * Wrap a caller-owned `pg.Pool` as a `Transactor`: each `transaction(fn)` checks out one client,
 * runs BEGIN → `fn` → COMMIT, rolls back best-effort on any throw (the original error always
 * wins — the connection may already be unusable), and releases the client in every path.
 */
export function createPgTransactor(pool: Pool): Transactor {
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

// The admin platform-DB seam (ADR-0141), mirroring apps/site/lib/db.ts but for CROSS-tenant reads.
// Resolves a `Transactor` behind `CAISSON_ADMIN_DB_URL` — a node-postgres pool (the Railway PG,
// connected as a role that can `SET ROLE admin`) when set, an in-memory PGlite double when unset
// (dev / `bun test`). `readAdmin` is the one seam every business-admin view reads through: it wraps
// `withAdminRead` (the read-only `admin` role + its `TO admin USING (true)` policy), so a route sees
// every tenant's rows through that one gate and nowhere else. `CAISSON_ADMIN_DB_URL` is NEVER
// hardcoded (security floor).
//
// The PGlite double applies the real schema DDL (imported, not hand-copied — the columns-contract
// anti-drift pattern) PLUS the admin-read policies, so cross-tenant reads work in dev/test against
// empty tables. In prod the tables + the `admin` role + its policies are provisioned on the Railway
// PG at DEPLOY (buildAdminReadPolicySql output, ADR-0141) — never by this app.
import { PGlite } from "@electric-sql/pglite";
import { CREDIT_SCHEMA_SQL } from "@caisson/credits";
import {
  ENTITLEMENT_SCHEMA_SQL,
  LICENSE_GRANT_SCHEMA_SQL,
} from "@caisson/service-license";
import type { TenantExecutor, Transactor } from "@caisson/tenancy-rls";
import { Pool, type PoolClient } from "pg";

import {
  ADMIN_ROLE_BOOTSTRAP_SQL,
  buildAdminReadPolicySql,
  withAdminRead,
} from "./admin-read.ts";

export type { TenantExecutor, Transactor };
export { withAdminRead };

// The buyer `app` role the imported schema DDL grants to + writes tenant policies for — created here
// so the double can apply those schemas. (In prod the services already created it.)
const APP_ROLE_BOOTSTRAP_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
    CREATE ROLE app NOLOGIN;
  END IF;
END $$;
`;

/** The tenant tables the operator cockpit reads cross-tenant (ADR-0141 read-only surface). */
const ADMIN_READ_TABLES = [
  "credit_wallet",
  "entitlement_grant",
  "license_grant",
] as const;

function nodePgExecutor(client: PoolClient): TenantExecutor {
  return {
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
          // Best-effort — the connection may already be unusable; the original error wins.
        }
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

interface AdminDbGlobal {
  caissonAdminTransactor?: Transactor;
  caissonAdminPglite?: PGlite;
}
const globalDb = globalThis as unknown as AdminDbGlobal;

async function bootstrapPglite(): Promise<PGlite> {
  if (globalDb.caissonAdminPglite) return globalDb.caissonAdminPglite;
  const pg = new PGlite();
  await pg.exec(APP_ROLE_BOOTSTRAP_SQL);
  await pg.exec(ADMIN_ROLE_BOOTSTRAP_SQL);
  // Real schema DDL (tenant policies + GRANT app included), then the additive admin-read policies.
  await pg.exec(CREDIT_SCHEMA_SQL);
  await pg.exec(ENTITLEMENT_SCHEMA_SQL);
  await pg.exec(LICENSE_GRANT_SCHEMA_SQL);
  for (const table of ADMIN_READ_TABLES) {
    await pg.exec(buildAdminReadPolicySql(table));
  }
  globalDb.caissonAdminPglite = pg;
  return pg;
}

/**
 * Resolve the admin `Transactor`: node-postgres over `CAISSON_ADMIN_DB_URL` when set, an in-memory
 * PGlite double otherwise. The PGlite path serves `bun dev` / `bun test` with no admin DB configured
 * — it renders empty business views, never real data.
 */
export async function getAdminDb(): Promise<Transactor> {
  if (globalDb.caissonAdminTransactor) return globalDb.caissonAdminTransactor;
  const url = process.env.CAISSON_ADMIN_DB_URL;
  if (url !== undefined && url.length > 0) {
    const pool = new Pool({ connectionString: url });
    globalDb.caissonAdminTransactor = nodePgTransactor(pool);
    return globalDb.caissonAdminTransactor;
  }
  process.stderr.write(
    "[apps/admin] CAISSON_ADMIN_DB_URL unset — using an in-memory PGlite double (dev only).\n",
  );
  const pg = await bootstrapPglite();
  globalDb.caissonAdminTransactor = pg as unknown as Transactor;
  return globalDb.caissonAdminTransactor;
}

/**
 * Whether a real admin Postgres is configured. Business views show an empty/"not configured" state
 * when this is false rather than the empty PGlite double's rows.
 */
export function adminDbConfigured(): boolean {
  const url = process.env.CAISSON_ADMIN_DB_URL;
  return url !== undefined && url.length > 0;
}

/**
 * Run `fn` cross-tenant as the read-only `admin` role against the resolved admin DB (ADR-0141). The
 * ONE seam every business-admin view reads through — never query the pool/PGlite directly.
 */
export async function readAdmin<T>(
  fn: (tx: TenantExecutor) => Promise<T>,
): Promise<T> {
  const db = await getAdminDb();
  return withAdminRead(db, fn);
}

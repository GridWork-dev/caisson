// The admin platform-DB seam (ADR-0141), mirroring apps/site/lib/db.ts but for CROSS-tenant reads.
// Resolves a `Transactor` behind `CAISSON_ADMIN_DB_URL` — a node-postgres pool (the Railway PG,
// connected as a role that can `SET ROLE admin`) when set, an in-memory PGlite double when unset
// (dev / `bun test`). `readAdmin` is the one seam every business-admin view reads through: it wraps
// `withAdminRead` (the read-only `admin` role + its `TO admin USING (true)` policy), so a route sees
// every tenant's rows through that one gate and nowhere else. `CAISSON_ADMIN_DB_URL` is NEVER
// hardcoded (security floor).
//
// The PGlite double applies the REAL platform migration chain (@caisson/platform-migrations,
// CAISSON-21) — the same shared chain apps/site/lib/deploy-migrate.ts applies to a live Postgres —
// PLUS the admin-specific role/policy bootstrap layered on top, so cross-tenant reads work in
// dev/test against empty tables. A migration that lands in the shared chain now lands here too,
// automatically; this used to be a hand-mirrored SQL-constant list that already drifted once
// (CAISSON-11) and drifted again on credit_event (caught in PR #176's review) — see
// admin-db.test.ts's parity gate. In prod the tables + the `admin` role + its policies are
// provisioned on the Railway PG at DEPLOY (buildAdminReadPolicySql output, ADR-0141) — never by
// this app.
import { PGlite } from "@electric-sql/pglite";
import type { MergedMigration } from "@caisson/kernel";
import type { MigrationApplier } from "@caisson/migrate";
import { applyAll } from "@caisson/platform-migrations";
import {
  ADMIN_ACTION_LOG_SCHEMA_SQL,
  ADMIN_MUTATION_PROVISION_SQL,
} from "@caisson/service-license";
import { ADMIN_WRITE_ROLE_BOOTSTRAP_SQL } from "@caisson/org-controls";
import type { TenantExecutor, Transactor } from "@caisson/tenancy-rls";
import { Pool, type PoolClient } from "pg";

import {
  ADMIN_ROLE_BOOTSTRAP_SQL,
  buildAdminReadPolicySql,
  withAdminRead,
} from "./admin-read.ts";
import { INTEL_ADMIN_READ_GRANT_SQL, INTEL_SCHEMA_SQL } from "./intel-read.ts";

/** The DB-side `schema_version` ledger (ADR-0014) the shared chain's runner records against — same
 *  shape as `@caisson/migrate/pg`'s `pgMigrationApplier`, wired to PGlite's own query/transaction
 *  API instead of a node-postgres `Pool` (PGlite has no `.connect()`; every PGlite consumer in this
 *  repo writes its own small applier this way — see packages/compliance's integration test). */
const SCHEMA_VERSION_DDL = `CREATE TABLE IF NOT EXISTS schema_version (
  version    integer     PRIMARY KEY,
  checksum   text        NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);`;

function pgliteMigrationApplier(pg: PGlite): MigrationApplier {
  let ensured = false;
  const ensure = async (): Promise<void> => {
    if (ensured) return;
    await pg.exec(SCHEMA_VERSION_DDL);
    ensured = true;
  };
  return {
    async applied() {
      await ensure();
      const res = await pg.query<{ version: number; checksum: string }>(
        "SELECT version, checksum FROM schema_version ORDER BY version",
      );
      return res.rows;
    },
    async apply(migration: MergedMigration) {
      await ensure();
      await pg.transaction(async (tx) => {
        await tx.exec(migration.sql);
        await tx.query(
          "INSERT INTO schema_version (version, checksum) VALUES ($1, $2)",
          [migration.seq, migration.checksum],
        );
      });
    },
  };
}

// The audit-chain table (ADR-0052) the WORM dual-log half appends to, byte-mirrored from
// @caisson/audit-worm's `migrations/0001_audit_chain.sql` for the DEV DOUBLE ONLY (append-only by
// withheld UPDATE/DELETE grant). Prod provisions the real migration on the Railway PG at DEPLOY.
const AUDIT_CHAIN_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS audit_chain_entry (
  id uuid PRIMARY KEY,
  account_id text NOT NULL,
  seq integer NOT NULL,
  prev_hash text,
  payload jsonb NOT NULL,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_chain_entry_account_seq_uniq UNIQUE (account_id, seq),
  CONSTRAINT audit_chain_entry_genesis_prev_null CHECK ((seq = 0) = (prev_hash IS NULL))
);
ALTER TABLE audit_chain_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_chain_entry FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON audit_chain_entry TO app;
CREATE POLICY audit_chain_entry_tenant_isolation ON audit_chain_entry
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));
`;

export type { TenantExecutor, Transactor };
export { withAdminRead };

/** A minimal test double of better-auth's own "user" table (G29) — only the columns the tenants
 *  email-enrichment read needs (id/email). The real one is created by better-auth's getMigrations
 *  (apps/site/lib/deploy-migrate.ts) on the SAME Postgres this admin DB connects to; mirrors the
 *  identical double `services/license/src/email-notify.integration.test.ts` already uses. */
const BETTER_AUTH_USER_DOUBLE_SQL = `
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "email" text NOT NULL,
  "name" text
);
`;

/** better-auth's own "user" table carries no RLS (it holds cross-tenant identity, not tenant
 *  data — see email-notify.ts's module doc) — a plain cross-schema-style GRANT, not the
 *  `USING (true)` permissive-policy dance `buildAdminReadPolicySql` applies to RLS-forced tables. */
const USER_ADMIN_READ_GRANT_SQL = `GRANT SELECT ON "user" TO admin;`;

/** The tenant tables the operator cockpit reads cross-tenant (ADR-0141 read-only surface).
 *  `credit_event` was added (ADR-0225): the paid-revoke impact preview reuses `@caisson/credits`'
 *  `creditsGrantedBySource`/`creditsClawedForSource`, which read the per-event ledger, so the `admin`
 *  role needs a cross-tenant SELECT policy on it to compute the exact claw preview. `account_member`
 *  was added (G29): the tenants view's email-lookup join needs cross-tenant SELECT on it too. */
const ADMIN_READ_TABLES = [
  "credit_wallet",
  "credit_event",
  "entitlement_grant",
  "license_grant",
  "account_member",
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
  await pg.exec(ADMIN_ROLE_BOOTSTRAP_SQL);
  await pg.exec(ADMIN_WRITE_ROLE_BOOTSTRAP_SQL);
  // The REAL platform migration chain (CAISSON-21) — app role, credits, entitlement, license_grant,
  // ai_meter, account_member, every line-item/expiry/RLS-guard follow-up, in the SAME order
  // apps/site/lib/deploy-migrate.ts applies to a live Postgres. `ADMIN_MUTATION_PROVISION_SQL` below
  // SELECT-polices account_member (the admin existence check, CAISSON-9), which this chain creates.
  await applyAll(pgliteMigrationApplier(pg));
  // G29: the better-auth "user" table double + the tenants view's email-enrichment join.
  await pg.exec(BETTER_AUTH_USER_DOUBLE_SQL);
  await pg.exec(USER_ADMIN_READ_GRANT_SQL);
  for (const table of ADMIN_READ_TABLES) {
    await pg.exec(buildAdminReadPolicySql(table));
  }
  // ADR-0220 mutation surface: the operator action log + the WORM chain table + the cross-tenant
  // admin_write policies (applied AFTER the admin_write role exists), so dev mutations work end-to-end.
  await pg.exec(ADMIN_ACTION_LOG_SCHEMA_SQL);
  await pg.exec(AUDIT_CHAIN_SCHEMA_SQL);
  await pg.exec(ADMIN_MUTATION_PROVISION_SQL);
  // ADR-0286 admin intel page: the daemon's schema (byte-mirrored DEV/TEST DOUBLE ONLY, see
  // intel-read.ts) plus the read-only `admin` role's cross-schema SELECT grant.
  await pg.exec(INTEL_SCHEMA_SQL);
  await pg.exec(INTEL_ADMIN_READ_GRANT_SQL);
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
    pool.on("error", (err) => {
      process.stderr.write(
        `[apps/admin] idle pg client error: ${err.message}\n`,
      );
    });
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

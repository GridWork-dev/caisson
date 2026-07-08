// The platform DB seam (ADR-0115). Resolves a `Transactor` (@caisson/tenancy-rls) behind
// `DATABASE_URL` — a node-postgres pool (Railway Postgres / any TCP Postgres) when set, an
// in-memory PGlite double when unset (dev / local preview / `bun test`). `DATABASE_URL` is
// NEVER hardcoded (security floor, identity/security.md). `readScoped` is the one seam every
// `/dashboard` view reads through: it wraps `withTenant` (fail-closed RLS, ADR-0005) so a route
// that forgets to scope its read sees nothing rather than another tenant's rows.
//
// Drizzle (`drizzle-orm/node-postgres`, ADR-0115's named driver) constructs the canonical `db`
// handle over the pool — the forward seam any future Drizzle-schema read hangs off. The actual
// tenant-scoped transaction below still talks to the SAME pool via raw positional SQL
// (`query(text, params)`), because every existing `TenantExecutor` consumer in this repo
// (`@caisson/credits`, the entitlement/license-grant stores) is written against that raw
// contract, not a Drizzle query builder — and `drizzle-orm`'s `db.transaction()` callback does
// not expose the underlying `PoolClient` (only the top-level `db.$client` does), so a manual
// BEGIN/COMMIT/ROLLBACK over `pool.connect()` is the only way to hand `withTenant` a real,
// transaction-scoped `SET LOCAL ROLE` connection.
//
// The PGlite double applies the REAL platform migration chain (@caisson/platform-migrations,
// CAISSON-21) — the SAME shared chain apps/site/lib/deploy-migrate.ts applies to a live Postgres
// and apps/admin/src/lib/admin-db.ts applies to its own double — PLUS this app's own local extras
// (BYOK metadata, compliance attestations, the Ask-AI counters). This used to be a hand-copied,
// differently-ordered subset of the same schema constants (missing the 0013 RLS empty-GUC guard
// and the 0017 renewal_extension ledger entirely) — the THIRD hand-mirror of the platform chain,
// closed by routing through the same `applyAll` the other two consumers use.
import { PGlite } from "@electric-sql/pglite";
import { type MigrationFile, applyAll } from "@caisson/platform-migrations";
import { pgliteMigrationApplier } from "@caisson/platform-migrations/pglite";
import {
  type TenantExecutor,
  type Transactor,
  buildTenantPolicySql,
  withTenant,
} from "@caisson/tenancy-rls";
import { TENANT_AI_CREDENTIAL_SCHEMA_SQL } from "@caisson/ai-kit";
import { ASK_AI_QUESTION_SCHEMA_SQL } from "./ask-ai/question-log.ts";
import { ASK_AI_SPEND_SCHEMA_SQL } from "./ask-ai/spend.ts";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";

export type { TenantExecutor, Transactor };
export { withTenant };

// App-owned, tenant-scoped (FORCE RLS) tables the dashboard writes directly. In production these are
// created by the deploy migration path; the DDL here bootstraps the in-memory PGlite double for
// `bun dev` / `bun test`.
//
// BYOK display metadata (ADR-0183) — holds NO secret: the encrypted key lives in ai-kit's
// `tenant_ai_credential`; this table carries only the masked tail + version so the write-only edge
// can render status without ever reading the key back.
const BYOK_KEY_META_SCHEMA_SQL = `
CREATE TABLE byok_key_meta (
  id          text PRIMARY KEY,
  account_id  text NOT NULL,
  provider    text NOT NULL,
  last4       text NOT NULL,
  key_version integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, provider)
);
${buildTenantPolicySql("byok_key_meta")}
`;

// Compliance manual-attestation slots (ADR-0181) — a filled row = the human attested that slot for a
// framework. Presence = filled; deletion = cleared. No secret; free-text note bounded at the edge.
const COMPLIANCE_ATTESTATION_SCHEMA_SQL = `
CREATE TABLE compliance_attestation (
  id          text PRIMARY KEY,
  account_id  text NOT NULL,
  framework   text NOT NULL,
  slot_id     text NOT NULL,
  note        text NOT NULL DEFAULT '',
  attested_by text NOT NULL,
  attested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, framework, slot_id)
);
${buildTenantPolicySql("compliance_attestation")}
`;

function nodePgExecutor(client: PoolClient): TenantExecutor {
  return {
    // `pg`'s `query<T>` constrains `T extends QueryResultRow`; `TenantExecutor.query`'s `T` has
    // no such constraint (it's satisfied identically by PGlite, which carries no such generic
    // bound either) — call untyped and cast the rows, rather than narrow the shared interface to
    // a `pg`-specific constraint every other driver (PGlite) would then have to satisfy too.
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

// HMR-safe module singletons (Next dev re-evaluates this module on every edit; stashing on
// `globalThis` keeps one pool / one in-memory PGlite across reloads instead of leaking a fresh
// one per hot-reload — the same pattern every Drizzle-on-Next guide uses for the Pool itself).
interface PlatformDbGlobal {
  caissonTransactor?: Transactor;
  caissonPglite?: PGlite;
}
const globalDb = globalThis as unknown as PlatformDbGlobal;

/** This app's own local migrations, folded onto the shared chain — named `0020` and up so they land
 *  AFTER the shared chain's own `0019_order_record.sql` (see @caisson/platform-migrations's
 *  `platformMigrationsPackage` doc); nothing here depends on ordering relative to its siblings,
 *  only on the app role + tenant-policy machinery the shared chain's `0001` already established. */
const SITE_LOCAL_MIGRATIONS: readonly MigrationFile[] = [
  {
    name: "0020_tenant_ai_credential.sql",
    sql: TENANT_AI_CREDENTIAL_SCHEMA_SQL,
  },
  { name: "0021_byok_key_meta.sql", sql: BYOK_KEY_META_SCHEMA_SQL },
  {
    name: "0022_compliance_attestation.sql",
    sql: COMPLIANCE_ATTESTATION_SCHEMA_SQL,
  },
  { name: "0023_ask_ai_spend.sql", sql: ASK_AI_SPEND_SCHEMA_SQL },
  { name: "0024_ask_ai_question.sql", sql: ASK_AI_QUESTION_SCHEMA_SQL },
];

async function bootstrapPglite(): Promise<PGlite> {
  if (globalDb.caissonPglite) return globalDb.caissonPglite;
  const pg = new PGlite();
  await applyAll(pgliteMigrationApplier(pg), SITE_LOCAL_MIGRATIONS);
  globalDb.caissonPglite = pg;
  return pg;
}

/**
 * Resolve the platform `Transactor`: node-postgres over `DATABASE_URL` when set (Railway
 * Postgres in prod, or any TCP Postgres in a developer's own environment), an in-memory PGlite
 * double otherwise. The PGlite path is NEVER a production fallback by itself — `/dashboard` is
 * authed + force-dynamic (ADR-0114), so an unset `DATABASE_URL` in a real deployment means no
 * session cookie can resolve either; this only ever serves `bun dev` / `bun test` with no
 * Postgres configured.
 */
export async function getDb(): Promise<Transactor> {
  if (globalDb.caissonTransactor) return globalDb.caissonTransactor;
  const url = process.env.DATABASE_URL;
  if (url !== undefined && url.length > 0) {
    const pool = new Pool({ connectionString: url });
    pool.on("error", (err) => {
      process.stderr.write(
        `[apps/site] idle pg client error: ${err.message}\n`,
      );
    });
    // The canonical Drizzle handle (ADR-0115's named driver) — unused by the raw-SQL Transactor
    // below, kept as the forward seam for a future schema-based read. Constructing it eagerly
    // also fails fast on a malformed `DATABASE_URL` shape at boot rather than at first query.
    drizzle(pool);
    globalDb.caissonTransactor = nodePgTransactor(pool);
    return globalDb.caissonTransactor;
  }
  process.stderr.write(
    "[apps/site] DATABASE_URL unset — using an in-memory PGlite double (dev only).\n",
  );
  const pg = await bootstrapPglite();
  // PGlite satisfies `Transactor` directly (`.transaction()` matches the interface byte-for-byte)
  // — the same pattern `tooling/testing/src/pg.ts`'s `newTestPg()` uses, passing its raw `PGlite`
  // instance straight into `withTenant`.
  globalDb.caissonTransactor = pg as unknown as Transactor;
  return globalDb.caissonTransactor;
}

/**
 * Run `fn` tenant-scoped for `accountId` against the resolved platform DB (ADR-0005 fail-closed
 * RLS via `withTenant`). The ONE seam every `/dashboard` view reads through — never query the
 * pool/PGlite directly from a route.
 */
export async function readScoped<T>(
  accountId: string,
  fn: (tx: TenantExecutor) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  return withTenant(db, accountId, fn);
}

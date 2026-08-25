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
// (BYOK metadata, compliance attestations, the Ask-AI counters), now the SAME
// `SITE_LOCAL_MIGRATIONS` list `deploy-migrate.ts` applies (`./site-migrations.ts`, CAISSON-64).
// This used to be a hand-copied, differently-ordered, and (worse) DIFFERENT-CONTENT list from
// deploy-migrate.ts's — this double ran 3 migrations the real-Postgres deploy apply never learned
// about, so `byok_key_meta` was never created in prod and /dashboard/ai-keys crashed for every
// account. Routing both consumers through one shared list closes that drift class for good.
import { PGlite } from "@electric-sql/pglite";
import { applyAll } from "@caisson/platform-migrations";
import { pgliteMigrationApplier } from "@caisson/platform-migrations/pglite";
import {
  createPgPool,
  createPgTransactor,
  type TenantExecutor,
  type Transactor,
  withTenant,
} from "@caisson/tenancy-rls";
import { drizzle } from "drizzle-orm/node-postgres";
import { SITE_LOCAL_MIGRATIONS } from "./site-migrations.ts";

export type { TenantExecutor, Transactor };
export { withTenant };

// HMR-safe module singletons (Next dev re-evaluates this module on every edit; stashing on
// `globalThis` keeps one pool / one in-memory PGlite across reloads instead of leaking a fresh
// one per hot-reload — the same pattern every Drizzle-on-Next guide uses for the Pool itself).
interface PlatformDbGlobal {
  caissonTransactor?: Transactor;
  caissonPglite?: PGlite;
}
const globalDb = globalThis as unknown as PlatformDbGlobal;

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
    const pool = createPgPool(url);
    // The canonical Drizzle handle (ADR-0115's named driver) — unused by the raw-SQL Transactor
    // below, kept as the forward seam for a future schema-based read. Constructing it eagerly
    // also fails fast on a malformed `DATABASE_URL` shape at boot rather than at first query.
    drizzle(pool);
    globalDb.caissonTransactor = createPgTransactor(pool);
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

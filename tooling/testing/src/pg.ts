// PGlite fail-closed-RLS test harness (ADR-0013/0005). Embedded Postgres-in-WASM with real
// RLS + SET LOCAL + SET ROLE semantics — deterministic, no Docker. The connecting role is a
// superuser (BYPASSRLS), so tenant-scoped reads run under a non-superuser `app` role inside a
// transaction with `app.current_account` SET LOCAL — exactly the production `withTenant` shape.
// A query that forgets to set the GUC sees zero rows: fail-closed, provable.
import { PGlite } from "@electric-sql/pglite";

/** Minimal exec surface satisfied by both PGlite and its Transaction. */
export interface PgExec {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}

export interface TestPg {
  /** The raw PGlite instance (superuser — BYPASSRLS; use for schema/migrations + seeding). */
  readonly pg: PGlite;
  /** Apply schema/migration/seed SQL as the superuser. */
  exec(sql: string): Promise<void>;
  /** Query as the superuser (RLS bypassed) — for assertions about ground truth. */
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  /** Run `fn` as the non-superuser `app` role with `app.current_account` set — RLS applies. */
  asTenant<T>(accountId: string, fn: (tx: PgExec) => Promise<T>): Promise<T>;
  /** Run `fn` as `app` WITHOUT the tenant GUC — proves a missing filter fails closed. */
  asAppNoTenant<T>(fn: (tx: PgExec) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * Create an in-memory PGlite with a non-login `app` role provisioned. Apply your schema +
 * RLS policies + `GRANT ... TO app` via `exec`, then assert isolation through `asTenant` /
 * `asAppNoTenant`.
 *
 * COST — read this before putting a call in a `beforeEach`. Each call instantiates a fresh
 * Postgres-in-WASM: measured 0.8-1.6s idle on a developer box, and it grows within a process when
 * instances are held rather than closed (10 held: 718ms -> 1592ms; 10 closed: flat ~800ms). Always
 * `close()` in `afterAll`/`afterEach`.
 *
 * That cost is the reason every `bun test` script in this repo carries `--timeout 60000` instead of
 * bun's 5s default. Under the full `bun run check` graph, CPU contention pushed a single boot past
 * 5s and failed the enclosing hook: `@caisson-sh/ai-kit` flaked exactly that way while passing
 * standalone, reporting `a beforeEach/afterEach hook timed out for this test`. Nothing was hanging
 * — the budget was under 5x the idle cost of real work. The same 5s ceiling independently failed
 * `@caisson-sh/ui`, whose manifest generator takes ~4s for one pass and runs two in the determinism
 * test, so the flag is repo-wide rather than scoped to PGlite consumers.
 *
 * The bound lives on each package's test script and NOT in the root `bunfig.toml`, because bun does
 * not walk up the tree for bunfig and every package script runs with cwd inside the package —
 * verified against a deliberately-slow hook, not assumed. There is no env-var equivalent;
 * `BUN_TEST_TIMEOUT` is not a thing. A new package needs the flag on its own test script.
 */
export async function newTestPg(): Promise<TestPg> {
  const pg = new PGlite();
  await pg.exec(
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
         CREATE ROLE app NOLOGIN;
       END IF;
     END $$;`,
  );

  async function runAsApp<T>(
    accountId: string | null,
    fn: (tx: PgExec) => Promise<T>,
  ): Promise<T> {
    return pg.transaction(async (tx) => {
      if (accountId !== null) {
        await tx.query(`SELECT set_config('app.current_account', $1, true)`, [
          accountId,
        ]);
      }
      await tx.exec(`SET LOCAL ROLE app`);
      return fn(tx as unknown as PgExec);
    }) as Promise<T>;
  }

  return {
    pg,
    async exec(sql) {
      await pg.exec(sql);
    },
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
      const res = await pg.query<T>(sql, params);
      return res.rows;
    },
    asTenant(accountId, fn) {
      return runAsApp(accountId, fn);
    },
    asAppNoTenant(fn) {
      return runAsApp(null, fn);
    },
    async close() {
      await pg.close();
    },
  };
}

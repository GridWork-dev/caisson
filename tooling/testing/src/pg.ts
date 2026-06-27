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

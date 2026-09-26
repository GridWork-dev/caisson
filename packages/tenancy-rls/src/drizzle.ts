// Drizzle bridge (ADR-0266 — ORM adapter family). Feeds a Drizzle query builder's `.toSQL()`
// output through the UNMODIFIED `TenantExecutor` port (rls.ts:21) inside `withTenant`. This file
// has zero RUNTIME dependency on `drizzle-orm` — `DrizzleToSql` only needs the `{ sql, params }`
// shape drizzle's own `Query` type already carries, structurally. `drizzle-orm` is a
// devDependency here, used only by the tests, so an adopter who has never installed it pulls no
// extra package to use `withTenant`'s raw-SQL path.
import type { TenantExecutor } from "./rls.ts";

/**
 * Structural shape of a Drizzle query builder's `.toSQL()` output — matches `drizzle-orm`'s own
 * `Query` type (`{ sql: string; params: unknown[] }`, `$1`/`$2` positional placeholders on the
 * pg dialect) without importing it. A real `db.select()...`/`db.insert()...` chain satisfies
 * this structurally, as does the dialect-less `drizzle-orm/pg-core` `QueryBuilder` used in this
 * package's own tests, or any other object that shapes up the same way.
 */
export interface DrizzleToSql {
  toSQL(): { sql: string; params: unknown[] };
}

/**
 * Run a Drizzle query (a `.select()`/`.returning()` chain — anything with `.toSQL()`) through a
 * tenant-scoped `TenantExecutor` inside `withTenant`. RLS still does the isolation; this only
 * bridges SQL generation, and the caller's own generic row type comes back untouched.
 */
export async function queryDrizzle<T = Record<string, unknown>>(
  tx: TenantExecutor,
  query: DrizzleToSql,
): Promise<{ rows: T[] }> {
  const { sql, params } = query.toSQL();
  return tx.query<T>(sql, params);
}

/**
 * The exec-style convenience for a Drizzle statement whose rows don't matter (an `insert()`/
 * `update()`/`delete()` with no `.returning()`). `TenantExecutor.exec` (rls.ts:27) takes no
 * params, so this still runs the statement through `tx.query` — params intact — and discards
 * the result rather than silently dropping bound parameters to fit `exec`'s no-params shape.
 */
export async function execDrizzle(
  tx: TenantExecutor,
  query: DrizzleToSql,
): Promise<void> {
  await queryDrizzle(tx, query);
}

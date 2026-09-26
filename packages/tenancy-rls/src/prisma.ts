// Prisma bridge (ADR-0266 — ORM adapter family). Same pattern as drizzle.ts: a structurally
// typed facade over Prisma Client's raw-query surface, backed by the UNMODIFIED `TenantExecutor`
// port (rls.ts:21) inside `withTenant`. Zero runtime dependency on `@prisma/client` — an adopter's
// call sites written against `prisma.$queryRawUnsafe(sql, ...params)` /
// `prisma.$executeRawUnsafe(sql, ...params)` port over to `createPrismaBridge(tx)` with a rename,
// not a rewrite.
//
// Multi-statement tenant work: Prisma's real interactive `$transaction(async (tx) => { ... })`
// is NOT reproduced here — `withTenant`'s own callback already IS the transaction boundary
// (rls.ts:88-105), so an adopter moving multi-statement code just nests it directly inside
// `withTenant`'s callback (wrapping `tx` once with `createPrismaBridge`), never calling a second,
// nested transaction API. See the README for the worked recipe.
import type { TenantExecutor } from "./rls.ts";

/**
 * Structural shape of Prisma Client's raw-query surface — matches the real
 * `PrismaClient.$queryRawUnsafe`/`$executeRawUnsafe` signatures (variadic positional params,
 * Postgres `$1`/`$2` placeholders) without importing `@prisma/client`.
 */
export interface PrismaRawClient {
  $queryRawUnsafe<T = unknown>(
    query: string,
    ...values: unknown[]
  ): Promise<T[]>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

/**
 * Wrap a tenant-scoped `TenantExecutor` (the `withTenant` callback argument) behind Prisma's raw
 * surface.
 *
 * `$executeRawUnsafe`'s affected-row count is a best-effort `rows.length` — `TenantExecutor`
 * (LOCKED, rls.ts) exposes only the returned rows, never a driver `rowCount`, so a bare
 * `UPDATE`/`DELETE` with no `RETURNING` reports 0 even when it changed rows (unlike real Prisma,
 * which always reports the true count). Add a `RETURNING` clause to the statement (e.g.
 * `RETURNING 1`) when the caller needs an accurate count through this bridge.
 */
export function createPrismaBridge(tx: TenantExecutor): PrismaRawClient {
  return {
    async $queryRawUnsafe<T = unknown>(
      query: string,
      ...values: unknown[]
    ): Promise<T[]> {
      const { rows } = await tx.query<Record<string, unknown>>(query, values);
      return rows as T[];
    },
    async $executeRawUnsafe(
      query: string,
      ...values: unknown[]
    ): Promise<number> {
      const { rows } = await tx.query(query, values);
      return rows.length;
    },
  };
}

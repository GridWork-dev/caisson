// Round-trip test for the Drizzle bridge (ADR-0266). Uses REAL `drizzle-orm` query builders
// (devDependency here, for tests only — see drizzle.ts's header) against a stub
// `TenantExecutor` that records exactly what it was called with, proving `.toSQL()`'s sql +
// params pass through `queryDrizzle`/`execDrizzle` unmodified. Tenant-isolation itself (the RLS
// proof) lives in drizzle.integration.test.ts on the real PGlite harness.
import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { pgTable, QueryBuilder, text } from "drizzle-orm/pg-core";
import { execDrizzle, queryDrizzle, type DrizzleToSql } from "./drizzle.ts";
import type { TenantExecutor } from "./rls.ts";

const doc = pgTable("document", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  title: text("title").notNull(),
});

function stubExecutor(rows: unknown[] = []) {
  const calls: Array<{ sql: string; params: unknown[] | undefined }> = [];
  const tx: TenantExecutor = {
    async query<T>(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      return { rows: rows as T[] };
    },
    async exec(sql: string) {
      calls.push({ sql, params: undefined });
    },
  };
  return { tx, calls };
}

describe("queryDrizzle — real drizzle-orm .toSQL() bridge", () => {
  test("forwards a real Drizzle select's generated sql + params verbatim", async () => {
    const qb = new QueryBuilder();
    const query = qb.select().from(doc).where(eq(doc.accountId, "acct_a"));
    const { tx, calls } = stubExecutor([{ id: "d1" }]);

    const { rows } = await queryDrizzle<{ id: string }>(tx, query);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toBe(query.toSQL().sql);
    expect(calls[0]?.params).toEqual(["acct_a"]);
    expect(rows).toEqual([{ id: "d1" }]);
  });

  test("a plain object satisfying only .toSQL() (no drizzle-orm import) also bridges", async () => {
    // Proves the interface is structural: nothing here comes from drizzle-orm.
    const fake: DrizzleToSql = {
      toSQL: () => ({ sql: "SELECT 1 AS n", params: [] }),
    };
    const { tx } = stubExecutor([{ n: 1 }]);

    const { rows } = await queryDrizzle<{ n: number }>(tx, fake);

    expect(rows).toEqual([{ n: 1 }]);
  });
});

describe("execDrizzle — exec-style convenience", () => {
  test("forwards params and discards the (empty) result", async () => {
    const insertLike: DrizzleToSql = {
      toSQL: () => ({
        sql: `insert into "document" ("id", "account_id", "title") values ($1, $2, $3)`,
        params: ["d2", "acct_b", "T"],
      }),
    };
    const { tx, calls } = stubExecutor([]);

    const result = await execDrizzle(tx, insertLike);

    expect(result).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.params).toEqual(["d2", "acct_b", "T"]);
  });

  test("propagates the underlying TenantExecutor's rejection unmodified (e.g. RLS WITH CHECK)", async () => {
    const boom = new Error("new row violates row-level security policy");
    const tx: TenantExecutor = {
      query: async () => {
        throw boom;
      },
      exec: async () => undefined,
    };
    const query: DrizzleToSql = {
      toSQL: () => ({ sql: "insert into document values ($1)", params: ["x"] }),
    };

    await expect(execDrizzle(tx, query)).rejects.toBe(boom);
  });
});

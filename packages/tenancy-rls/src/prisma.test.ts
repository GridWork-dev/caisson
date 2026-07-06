// Contract tests for the Prisma bridge (ADR-0266), against a faithful STUB TenantExecutor —
// wiring a real PrismaClient here would need a schema.prisma + `prisma generate` + a query
// engine binary, disproportionate for what this bridge actually does (forward sql + params to
// the already-tested `TenantExecutor`). The stub asserts parameter passthrough, `$1`/`$2`
// placeholder style, and error propagation exactly. A real-Prisma integration leg is a followup
// (see the package README's "real Prisma recipe" section).
import { describe, expect, test } from "bun:test";
import { createPrismaBridge } from "./prisma.ts";
import type { TenantExecutor } from "./rls.ts";

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

describe("createPrismaBridge — contract against a stub TenantExecutor", () => {
  test("$queryRawUnsafe forwards sql + positional params exactly ($1/$2 placeholder style)", async () => {
    const { tx, calls } = stubExecutor([{ id: "d1" }]);
    const bridge = createPrismaBridge(tx);

    const rows = await bridge.$queryRawUnsafe<{ id: string }>(
      `SELECT id FROM document WHERE account_id = $1 AND title = $2`,
      "acct_a",
      "A",
    );

    expect(calls).toEqual([
      {
        sql: `SELECT id FROM document WHERE account_id = $1 AND title = $2`,
        params: ["acct_a", "A"],
      },
    ]);
    expect(rows).toEqual([{ id: "d1" }]);
  });

  test("$queryRawUnsafe with zero variadic params forwards an empty params array", async () => {
    const { tx, calls } = stubExecutor([{ n: 1 }]);
    const bridge = createPrismaBridge(tx);

    await bridge.$queryRawUnsafe(`SELECT 1 AS n`);

    expect(calls[0]?.params).toEqual([]);
  });

  test("$executeRawUnsafe forwards params identically and reports rows.length", async () => {
    const { tx, calls } = stubExecutor([{}, {}]);
    const bridge = createPrismaBridge(tx);

    const count = await bridge.$executeRawUnsafe(
      `UPDATE document SET title = $1 WHERE account_id = $2 RETURNING 1`,
      "new",
      "acct_a",
    );

    expect(calls[0]?.params).toEqual(["new", "acct_a"]);
    expect(count).toBe(2);
  });

  test("a bare statement with no RETURNING reports 0 (documented TenantExecutor limitation)", async () => {
    const { tx } = stubExecutor([]);
    const bridge = createPrismaBridge(tx);

    const count = await bridge.$executeRawUnsafe(
      `DELETE FROM document WHERE account_id = $1`,
      "acct_a",
    );

    expect(count).toBe(0);
  });

  test("$queryRawUnsafe propagates the underlying TenantExecutor's rejection unmodified", async () => {
    const boom = new Error("new row violates row-level security policy");
    const tx: TenantExecutor = {
      query: async () => {
        throw boom;
      },
      exec: async () => undefined,
    };
    const bridge = createPrismaBridge(tx);

    await expect(bridge.$queryRawUnsafe(`SELECT 1`)).rejects.toBe(boom);
  });

  test("$executeRawUnsafe propagates the underlying TenantExecutor's rejection unmodified", async () => {
    const boom = new Error("new row violates row-level security policy");
    const tx: TenantExecutor = {
      query: async () => {
        throw boom;
      },
      exec: async () => undefined,
    };
    const bridge = createPrismaBridge(tx);

    await expect(
      bridge.$executeRawUnsafe(
        `DELETE FROM document WHERE account_id = $1`,
        "acct_a",
      ),
    ).rejects.toBe(boom);
  });
});

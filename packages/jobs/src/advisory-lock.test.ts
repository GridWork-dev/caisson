import { describe, expect, test } from "bun:test";
import type { TenantExecutor } from "@caisson-sh/tenancy-rls";
import { advisoryLockId, withAdvisoryXactLock } from "./advisory-lock.ts";

/** A `TenantExecutor` that records every query instead of touching Postgres. */
function recordingTx(): TenantExecutor & {
  readonly queries: ReadonlyArray<{
    sql: string;
    params: unknown[] | undefined;
  }>;
} {
  const queries: Array<{ sql: string; params: unknown[] | undefined }> = [];
  return {
    queries,
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
      queries.push({ sql, params });
      return { rows: [] as T[] };
    },
    async exec() {
      return undefined;
    },
  };
}

describe("advisoryLockId", () => {
  test("is stable for the same key", () => {
    expect(advisoryLockId("digest:acct_a")).toBe(
      advisoryLockId("digest:acct_a"),
    );
  });

  test("separates distinct keys", () => {
    expect(advisoryLockId("digest:acct_a")).not.toBe(
      advisoryLockId("digest:acct_b"),
    );
  });

  test("is a decimal string in the signed 64-bit range (pg bigint domain)", () => {
    const id = advisoryLockId("some-key");
    expect(id).toMatch(/^-?\d+$/);
    const n = BigInt(id);
    expect(n >= -(2n ** 63n) && n < 2n ** 63n).toBe(true);
  });
});

describe("withAdvisoryXactLock", () => {
  test("issues pg_advisory_xact_lock with the derived id BEFORE fn, and returns fn's result", async () => {
    const tx = recordingTx();
    let queriesWhenFnRan = -1;
    const result = await withAdvisoryXactLock(tx, "digest:acct_a", async () => {
      queriesWhenFnRan = tx.queries.length;
      return 42;
    });

    expect(result).toBe(42);
    // The lock query had already been issued when fn ran (ordering: lock THEN critical section).
    expect(queriesWhenFnRan).toBe(1);

    const lockCalls = tx.queries.filter((q) =>
      q.sql.includes("pg_advisory_xact_lock"),
    );
    expect(lockCalls).toHaveLength(1);
    expect(lockCalls[0]?.params).toEqual([advisoryLockId("digest:acct_a")]);
  });

  test("issues no explicit unlock — the lock auto-releases at transaction end", async () => {
    const tx = recordingTx();
    await withAdvisoryXactLock(tx, "k", async () => undefined);
    expect(tx.queries.some((q) => q.sql.includes("pg_advisory_unlock"))).toBe(
      false,
    );
  });

  test("propagates a throw from fn (the lock still releases at tx end, no manual cleanup)", async () => {
    const tx = recordingTx();
    await expect(
      withAdvisoryXactLock(tx, "k", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});

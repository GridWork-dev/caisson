// Fake-Pool proofs for the canonical node-postgres Transactor (C05): BEGIN/COMMIT ordering,
// best-effort ROLLBACK with the ORIGINAL error winning, and exactly-once release on every path.
import { describe, expect, test } from "bun:test";
import type { Pool } from "pg";
import { createPgTransactor } from "./node-pg.ts";

function fakePool(opts: { failOn?: string; rollbackThrows?: boolean } = {}): {
  pool: Pool;
  log: string[];
  released: () => number;
} {
  const log: string[] = [];
  let released = 0;
  const client = {
    async query(sql: string, _params?: unknown[]) {
      log.push(sql);
      if (opts.rollbackThrows === true && sql === "ROLLBACK") {
        throw new Error("rollback-connection-dead");
      }
      if (opts.failOn !== undefined && sql === opts.failOn) {
        throw new Error(`boom:${sql}`);
      }
      return { rows: [{ ok: 1 }] };
    },
    release() {
      released += 1;
    },
  };
  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pool;
  return { pool, log, released: () => released };
}

describe("createPgTransactor", () => {
  test("commit path: BEGIN → work → COMMIT in order, released exactly once, result returned", async () => {
    const { pool, log, released } = fakePool();
    const tx = createPgTransactor(pool);
    const out = await tx.transaction(async (t) => {
      await t.exec("SELECT set_config('app.tenant_id', 'a', true)");
      const res = await t.query<{ ok: number }>("SELECT 1");
      return res.rows[0]?.ok;
    });
    expect(out).toBe(1);
    expect(log).toEqual([
      "BEGIN",
      "SELECT set_config('app.tenant_id', 'a', true)",
      "SELECT 1",
      "COMMIT",
    ]);
    expect(released()).toBe(1);
  });

  test("a throw inside fn rolls back, propagates the original error, releases exactly once", async () => {
    const { pool, log, released } = fakePool({ failOn: "SELECT 1" });
    const tx = createPgTransactor(pool);
    await expect(
      tx.transaction(async (t) => t.query("SELECT 1")),
    ).rejects.toThrow("boom:SELECT 1");
    expect(log).toEqual(["BEGIN", "SELECT 1", "ROLLBACK"]);
    expect(released()).toBe(1);
  });

  test("ROLLBACK itself failing never masks the original error (best-effort)", async () => {
    const { pool, released } = fakePool({
      failOn: "SELECT 1",
      rollbackThrows: true,
    });
    const tx = createPgTransactor(pool);
    // The discriminating arm: without the inner try/catch around ROLLBACK, this rejects with
    // "rollback-connection-dead" instead of the original failure.
    await expect(
      tx.transaction(async (t) => t.query("SELECT 1")),
    ).rejects.toThrow("boom:SELECT 1");
    expect(released()).toBe(1);
  });

  test("a COMMIT failure propagates and still attempts the best-effort ROLLBACK", async () => {
    const { pool, log, released } = fakePool({ failOn: "COMMIT" });
    const tx = createPgTransactor(pool);
    await expect(tx.transaction(async () => "done")).rejects.toThrow(
      "boom:COMMIT",
    );
    expect(log).toEqual(["BEGIN", "COMMIT", "ROLLBACK"]);
    expect(released()).toBe(1);
  });
});

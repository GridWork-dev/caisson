// Integration proof for the ai-meter store (ADR-0060/0014/0005/0006): the four metering tables apply with
// FORCE-RLS policies; `usage_event` is append-only + idempotent per call; `tenant_spend_window`
// mutates atomically via `UPDATE … RETURNING` and stays tenant-isolated; `spend_policy` /
// `spend_breaker` enforce their CHECK invariants. PGlite + the production `withTenant` shape — no
// live DB, no network (the un-exercised live transport stays out of CI).
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { withTenant } from "@caisson-sh/tenancy-rls";
import {
  AI_METER_SCHEMA_SQL,
  SPEND_BREAKER_TABLE,
  SPEND_POLICY_TABLE,
  TENANT_SPEND_WINDOW_TABLE,
  USAGE_EVENT_TABLE,
} from "./schema.ts";

let tp: TestPg;
const A = "acct_a";
const B = "acct_b";
const ALL_TABLES = [
  USAGE_EVENT_TABLE,
  TENANT_SPEND_WINDOW_TABLE,
  SPEND_POLICY_TABLE,
  SPEND_BREAKER_TABLE,
];

async function freshSchema(): Promise<void> {
  await tp.exec(
    ALL_TABLES.map((t) => `DROP TABLE IF EXISTS ${t} CASCADE;`).join("\n"),
  );
  await tp.exec(AI_METER_SCHEMA_SQL);
}

beforeEach(async () => {
  if (!tp) tp = await newTestPg();
  await freshSchema();
});

afterAll(async () => {
  await tp.close();
});

const inA = <T>(fn: Parameters<typeof withTenant<T>>[2]): Promise<T> =>
  withTenant(tp.pg, A, fn);
const inB = <T>(fn: Parameters<typeof withTenant<T>>[2]): Promise<T> =>
  withTenant(tp.pg, B, fn);

/** Insert one usage_event under the active tenant; returns the minted id. */
async function insertUsage(
  fn: typeof inA,
  accountId: string,
  callId: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await fn((tx) =>
    tx.query(
      `INSERT INTO ${USAGE_EVENT_TABLE}
         (id, account_id, call_id, prompt_version_id, lane, provider, model,
          input_tokens, output_tokens, cached_input_tokens, cost_micro_usd, credits)
       VALUES ($1, $2, $3, NULL, 'default', 'openai', 'gpt-x',
          100, 50, 0, 1234, 13)`,
      [id, accountId, callId],
    ),
  );
  return id;
}

describe("schema applies — tables + FORCE-RLS policies", () => {
  test("all four tables exist with rowsecurity ENABLED + FORCED", async () => {
    const rows = await tp.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class WHERE relname = ANY($1) ORDER BY relname`,
      [ALL_TABLES],
    );
    expect(rows.map((r) => r.relname).sort()).toEqual([...ALL_TABLES].sort());
    for (const r of rows) {
      expect(r.relrowsecurity).toBe(true);
      expect(r.relforcerowsecurity).toBe(true);
    }
  });

  test("each table carries its tenant-isolation policy", async () => {
    const rows = await tp.query<{ tablename: string; policyname: string }>(
      `SELECT tablename, policyname FROM pg_policies WHERE tablename = ANY($1)`,
      [ALL_TABLES],
    );
    const byTable = new Map(rows.map((r) => [r.tablename, r.policyname]));
    for (const t of ALL_TABLES) {
      expect(byTable.get(t)).toBe(`${t}_tenant_isolation`);
    }
  });
});

describe("usage_event — append-only + tenant-isolated + idempotent", () => {
  test("a tenant sees only its own usage rows; an unscoped reader sees none", async () => {
    await insertUsage(inA, A, "call_1");
    await insertUsage(inB, B, "call_1");

    const aRows = await inA((tx) =>
      tx.query<{ account_id: string }>(
        `SELECT account_id FROM ${USAGE_EVENT_TABLE}`,
      ),
    );
    expect(aRows.rows).toHaveLength(1);
    expect(aRows.rows[0]?.account_id).toBe(A);

    // No GUC bound → fail-closed: zero rows even as the app role.
    const unscoped = await tp.asAppNoTenant((tx) =>
      tx.query(`SELECT * FROM ${USAGE_EVENT_TABLE}`),
    );
    expect(unscoped.rows).toHaveLength(0);
  });

  test("UPDATE and DELETE are rejected for the tenant role (append-only)", async () => {
    const id = await insertUsage(inA, A, "call_1");
    await expect(
      inA((tx) =>
        tx.query(`UPDATE ${USAGE_EVENT_TABLE} SET credits = 0 WHERE id = $1`, [
          id,
        ]),
      ),
    ).rejects.toThrow();
    await expect(
      inA((tx) =>
        tx.query(`DELETE FROM ${USAGE_EVENT_TABLE} WHERE id = $1`, [id]),
      ),
    ).rejects.toThrow();
    // The row is untouched.
    const still = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE id = $1`,
      [id],
    );
    expect(still[0]?.credits).toBe(13);
  });

  test("the (account, call_id) UNIQUE rejects a duplicate actuals row (idempotent reconcile)", async () => {
    await insertUsage(inA, A, "call_dup");
    await expect(insertUsage(inA, A, "call_dup")).rejects.toThrow();
  });

  test("a cross-tenant INSERT is refused by the WITH CHECK policy", async () => {
    // Under tenant A's GUC, claiming account_id = B violates the policy WITH CHECK.
    await expect(insertUsage(inA, B, "call_x")).rejects.toThrow();
  });
});

describe("tenant_spend_window — atomic counter, tenant-isolated", () => {
  beforeEach(async () => {
    await inA((tx) =>
      tx.query(
        `INSERT INTO ${TENANT_SPEND_WINDOW_TABLE} (account_id, scope, unit, window_key, spent)
         VALUES ($1, 'account', 'micro_usd', '2026-06', 0)`,
        [A],
      ),
    );
  });

  test("an atomic UPDATE … RETURNING increments and returns the new total", async () => {
    const r1 = await inA((tx) =>
      tx.query<{ spent: number }>(
        `UPDATE ${TENANT_SPEND_WINDOW_TABLE}
           SET spent = spent + $1, updated_at = now()
         WHERE account_id = $2 AND scope = 'account' AND unit = 'micro_usd'
           AND window_key = '2026-06'
         RETURNING spent`,
        [1500, A],
      ),
    );
    expect(r1.rows[0]?.spent).toBe(1500);

    const r2 = await inA((tx) =>
      tx.query<{ spent: number }>(
        `UPDATE ${TENANT_SPEND_WINDOW_TABLE}
           SET spent = spent + $1 WHERE account_id = $2 AND scope = 'account'
           AND unit = 'micro_usd' AND window_key = '2026-06'
         RETURNING spent`,
        [250, A],
      ),
    );
    expect(r2.rows[0]?.spent).toBe(1750);
  });

  test("tenant B cannot read or mutate tenant A's window row", async () => {
    const seen = await inB((tx) =>
      tx.query(`SELECT * FROM ${TENANT_SPEND_WINDOW_TABLE}`),
    );
    expect(seen.rows).toHaveLength(0);

    // RLS filters A's row out of B's UPDATE scope → zero rows affected, A's total unchanged.
    const upd = await inB((tx) =>
      tx.query(
        `UPDATE ${TENANT_SPEND_WINDOW_TABLE} SET spent = spent + 9999
         WHERE scope = 'account' AND unit = 'micro_usd' AND window_key = '2026-06'
         RETURNING spent`,
      ),
    );
    expect(upd.rows).toHaveLength(0);
    const truth = await tp.query<{ spent: number }>(
      `SELECT spent FROM ${TENANT_SPEND_WINDOW_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(truth[0]?.spent).toBe(0);
  });

  test("the non-negative CHECK rejects a negative running total", async () => {
    await expect(
      inA((tx) =>
        tx.query(
          `UPDATE ${TENANT_SPEND_WINDOW_TABLE} SET spent = spent - 1
           WHERE account_id = $1 AND scope = 'account' AND unit = 'micro_usd'
             AND window_key = '2026-06'`,
          [A],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("spend_policy — cap invariants", () => {
  test("a soft cap above the hard cap is rejected", async () => {
    await expect(
      inA((tx) =>
        tx.query(
          `INSERT INTO ${SPEND_POLICY_TABLE}
             (account_id, scope, unit, window_granularity, soft_limit, hard_limit)
           VALUES ($1, 'account', 'micro_usd', 'month', 5000, 1000)`,
          [A],
        ),
      ),
    ).rejects.toThrow();
  });

  test("a hard-only policy (soft NULL) is allowed and tenant-isolated", async () => {
    await inA((tx) =>
      tx.query(
        `INSERT INTO ${SPEND_POLICY_TABLE}
           (account_id, scope, unit, window_granularity, soft_limit, hard_limit)
         VALUES ($1, 'account', 'micro_usd', 'month', NULL, 1000)`,
        [A],
      ),
    );
    const bSees = await inB((tx) =>
      tx.query(`SELECT * FROM ${SPEND_POLICY_TABLE}`),
    );
    expect(bSees.rows).toHaveLength(0);
  });

  test("a negative limit is rejected", async () => {
    await expect(
      inA((tx) =>
        tx.query(
          `INSERT INTO ${SPEND_POLICY_TABLE}
             (account_id, scope, unit, window_granularity, soft_limit, hard_limit)
           VALUES ($1, 'account', 'micro_usd', 'month', NULL, -1)`,
          [A],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("spend_breaker — state invariants", () => {
  test("an invalid state value is rejected", async () => {
    await expect(
      inA((tx) =>
        tx.query(
          `INSERT INTO ${SPEND_BREAKER_TABLE} (account_id, scope, state)
           VALUES ($1, 'account', 'half-open')`,
          [A],
        ),
      ),
    ).rejects.toThrow();
  });

  test("open without a trip timestamp violates the open-iff-tripped CHECK", async () => {
    await expect(
      inA((tx) =>
        tx.query(
          `INSERT INTO ${SPEND_BREAKER_TABLE} (account_id, scope, state, tripped_at)
           VALUES ($1, 'account', 'open', NULL)`,
          [A],
        ),
      ),
    ).rejects.toThrow();
  });

  test("a closed breaker (no trip) and a tripped open breaker both satisfy the CHECK", async () => {
    await inA((tx) =>
      tx.query(
        `INSERT INTO ${SPEND_BREAKER_TABLE} (account_id, scope, state)
         VALUES ($1, 'account', 'closed')`,
        [A],
      ),
    );
    await inA((tx) =>
      tx.query(
        `UPDATE ${SPEND_BREAKER_TABLE}
           SET state = 'open', tripped_at = now(), reason = 'hard cap'
         WHERE account_id = $1 AND scope = 'account'`,
        [A],
      ),
    );
    const row = await inA((tx) =>
      tx.query<{ state: string; reason: string }>(
        `SELECT state, reason FROM ${SPEND_BREAKER_TABLE} WHERE scope = 'account'`,
      ),
    );
    expect(row.rows[0]?.state).toBe("open");
    expect(row.rows[0]?.reason).toBe("hard cap");
  });
});

// Proves the harness itself enforces fail-closed RLS. The canonical base-package proof lives in
// @caisson-sh/tenancy-rls; this is the smoke test that the PGlite `app`-role + SET LOCAL machinery
// behaves as ADR-0005 requires, so every package that builds on it can trust it.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "./index.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(`
    CREATE TABLE note (id int PRIMARY KEY, account_id text NOT NULL, body text NOT NULL);
    ALTER TABLE note ENABLE ROW LEVEL SECURITY;
    ALTER TABLE note FORCE ROW LEVEL SECURITY;
    CREATE POLICY note_tenant ON note
      USING (account_id = current_setting('app.current_account', true));
    GRANT SELECT, INSERT ON note TO app;
    INSERT INTO note VALUES (1, 'acct_a', 'a-secret'), (2, 'acct_b', 'b-secret');
  `);
});

afterAll(async () => {
  await tp.close();
});

describe("PGlite RLS harness", () => {
  test("superuser bypasses RLS (ground truth = 2 rows)", async () => {
    const rows = await tp.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM note`,
    );
    expect(rows[0]?.n).toBe(2);
  });

  test("app role WITHOUT SET LOCAL fails closed (0 rows)", async () => {
    const n = await tp.asAppNoTenant(async (tx) => {
      const r = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM note`,
      );
      return r.rows[0]?.n;
    });
    expect(n).toBe(0);
  });

  test("app role scoped to a tenant sees only that tenant", async () => {
    const rows = await tp.asTenant("acct_a", async (tx) => {
      const r = await tx.query<{ id: number; body: string }>(
        `SELECT id, body FROM note ORDER BY id`,
      );
      return r.rows;
    });
    expect(rows).toEqual([{ id: 1, body: "a-secret" }]);
  });

  test("a tenant cannot read another tenant's rows even with an explicit filter", async () => {
    const n = await tp.asTenant("acct_a", async (tx) => {
      const r = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM note WHERE account_id = 'acct_b'`,
      );
      return r.rows[0]?.n;
    });
    expect(n).toBe(0);
  });
});

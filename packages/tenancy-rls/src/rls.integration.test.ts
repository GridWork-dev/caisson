// The P1 exit-gate proof (ADR-0005): RLS fails closed under a missing filter. Runs the real
// `withTenant` against PGlite — the same SET ROLE + SET LOCAL path production uses.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { TenancyError } from "@caisson-sh/kernel";
import { buildTenantPolicySql, withTenant } from "./index.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(`
    CREATE TABLE document (
      id text PRIMARY KEY,
      account_id text NOT NULL,
      title text NOT NULL
    );
    ${buildTenantPolicySql("document")}
    INSERT INTO document VALUES
      ('d1', 'acct_a', 'A-private'),
      ('d2', 'acct_a', 'A-second'),
      ('d3', 'acct_b', 'B-private');
  `);
});

afterAll(async () => {
  await tp.close();
});

describe("withTenant + fail-closed RLS", () => {
  test("scopes a SELECT to the active account", async () => {
    const rows = await withTenant(tp.pg, "acct_a", async (tx) => {
      const r = await tx.query<{ id: string }>(
        `SELECT id FROM document ORDER BY id`,
      );
      return r.rows.map((x) => x.id);
    });
    expect(rows).toEqual(["d1", "d2"]);
  });

  test("a query that FORGETS its WHERE still returns only the tenant's rows", async () => {
    // The whole point of RLS: the app layer can omit the filter and not leak.
    const count = await withTenant(tp.pg, "acct_b", async (tx) => {
      const r = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM document`,
      );
      return r.rows[0]?.n;
    });
    expect(count).toBe(1); // only d3, never the acct_a rows
  });

  test("code that forgets withTenant entirely sees nothing (no GUC bound)", async () => {
    const count = await tp.asAppNoTenant(async (tx) => {
      const r = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM document`,
      );
      return r.rows[0]?.n;
    });
    expect(count).toBe(0);
  });

  test("a tenant cannot read another tenant even by explicit id", async () => {
    const count = await withTenant(tp.pg, "acct_a", async (tx) => {
      const r = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM document WHERE account_id = 'acct_b'`,
      );
      return r.rows[0]?.n;
    });
    expect(count).toBe(0);
  });

  test("a tenant cannot INSERT a row for another tenant (WITH CHECK)", async () => {
    await expect(
      withTenant(tp.pg, "acct_a", async (tx) => {
        await tx.query(`INSERT INTO document VALUES ('x', 'acct_b', 'forged')`);
      }),
    ).rejects.toThrow();
  });

  test("withTenant refuses an empty account id", async () => {
    await expect(
      withTenant(tp.pg, "", async () => undefined),
    ).rejects.toBeInstanceOf(TenancyError);
  });
});

describe("role pre-flight guard (ADR-0005 hardening)", () => {
  // Each test gets its OWN TestPg — the guard's WeakSet cache is keyed per-Transactor
  // instance, so a fresh instance guarantees the check actually runs (never masked by an
  // earlier test's cached "app is safe" result on the shared `tp` above).

  test("a SUPERUSER app role is rejected before it ever touches data", async () => {
    const misconfigured = await newTestPg();
    await misconfigured.exec(`ALTER ROLE app SUPERUSER`);
    await expect(
      withTenant(misconfigured.pg, "acct_a", async () => undefined),
    ).rejects.toBeInstanceOf(TenancyError);
    await misconfigured.close();
  });

  test("a BYPASSRLS app role is rejected before it ever touches data", async () => {
    const misconfigured = await newTestPg();
    await misconfigured.exec(`ALTER ROLE app BYPASSRLS`);
    await expect(
      withTenant(misconfigured.pg, "acct_a", async () => undefined),
    ).rejects.toBeInstanceOf(TenancyError);
    await misconfigured.close();
  });
});

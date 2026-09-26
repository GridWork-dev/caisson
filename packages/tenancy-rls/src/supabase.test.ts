// Round-trip test for the Supabase `Transactor` driver (ADR-0174). Never connects to a real
// Supabase project — the connection-string/config assertions run offline, and the actual
// transaction path is proven by injecting a PGlite-backed `Transactor` (the same double the
// port-conformance harness in transactor-conformance.test.ts uses).
import { describe, expect, test } from "bun:test";
import { ConfigError } from "@caisson-sh/kernel";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { buildTenantPolicySql, withTenant } from "./index.ts";
import { createSupabaseTransactor } from "./supabase.ts";

describe("createSupabaseTransactor — fail-closed config", () => {
  test("throws ConfigError on an empty connectionString", () => {
    expect(() => createSupabaseTransactor({ connectionString: "" })).toThrow(
      ConfigError,
    );
  });

  test("throws ConfigError on an unparseable connectionString", () => {
    expect(() =>
      createSupabaseTransactor({ connectionString: "not a url" }),
    ).toThrow(ConfigError);
  });

  test("throws ConfigError on Supabase's transaction-mode pooler (port 6543)", () => {
    expect(() =>
      createSupabaseTransactor({
        connectionString:
          "postgresql://postgres.proj:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
      }),
    ).toThrow(ConfigError);
  });

  test("does not throw for a session-mode pooler (port 5432) with an injected driver", () => {
    // No real socket opens here — `driver` short-circuits the factory before it ever
    // constructs a `pg.Pool`, so this stays offline despite the well-formed connection string.
    const transactor = createSupabaseTransactor({
      connectionString:
        "postgresql://postgres.proj:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
      driver: {
        transaction: (fn) =>
          fn({
            query: async () => ({ rows: [] }),
            exec: async () => undefined,
          }),
      },
    });
    expect(typeof transactor.transaction).toBe("function");
  });

  test("does not throw for a direct connection (no port) with an injected driver", () => {
    const transactor = createSupabaseTransactor({
      connectionString: "postgresql://postgres:pw@db.proj.supabase.co/postgres",
      driver: {
        transaction: (fn) =>
          fn({
            query: async () => ({ rows: [] }),
            exec: async () => undefined,
          }),
      },
    });
    expect(typeof transactor.transaction).toBe("function");
  });
});

describe("createSupabaseTransactor — withTenant over an injected transaction", () => {
  let tp: TestPg;

  test("scopes a query to the active account through a real transaction + SET LOCAL", async () => {
    tp = await newTestPg();
    try {
      await tp.exec(`
        CREATE TABLE supabase_driver_doc (
          id text PRIMARY KEY,
          account_id text NOT NULL,
          title text NOT NULL
        );
        ${buildTenantPolicySql("supabase_driver_doc")}
        INSERT INTO supabase_driver_doc VALUES
          ('d1', 'acct_a', 'A'),
          ('d2', 'acct_b', 'B');
      `);

      const transactor = createSupabaseTransactor({
        connectionString:
          "postgresql://postgres.proj:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
        driver: tp.pg,
      });

      const rows = await withTenant(transactor, "acct_a", async (tx) => {
        const r = await tx.query<{ id: string }>(
          `SELECT id FROM supabase_driver_doc ORDER BY id`,
        );
        return r.rows.map((x) => x.id);
      });
      expect(rows).toEqual(["d1"]);
    } finally {
      await tp.close();
    }
  });
});

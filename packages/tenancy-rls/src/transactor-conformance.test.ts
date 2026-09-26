// Shared `Transactor` port-conformance harness (ADR-0174). Every driver behind the port —
// PGlite (structural, no wrapper needed), the Supabase driver, and any future driver — registers
// itself in `drivers` below instead of re-proving the same "does withTenant's SET LOCAL survive a
// real transaction" fact in a bespoke per-driver test. Runs entirely offline: PGlite is the one
// real transaction underneath every entry (injected where a driver takes one), so this never
// opens a socket to a real Postgres/Supabase/Neon.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { buildTenantPolicySql, withTenant, type Transactor } from "./index.ts";
import { createSupabaseTransactor } from "./supabase.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(`
    CREATE TABLE conformance_doc (
      id text PRIMARY KEY,
      account_id text NOT NULL,
      title text NOT NULL
    );
    ${buildTenantPolicySql("conformance_doc")}
    INSERT INTO conformance_doc VALUES
      ('d1', 'acct_a', 'A'),
      ('d2', 'acct_b', 'B');
  `);
});

afterAll(async () => {
  await tp.close();
});

describe("Transactor port conformance", () => {
  // Lazy factories (not values) — `tp` isn't constructed until `beforeAll` runs.
  const drivers: ReadonlyArray<[name: string, make: () => Transactor]> = [
    ["PGlite (raw — satisfies Transactor structurally)", () => tp.pg],
    [
      "Supabase driver (injected PGlite as the underlying transaction)",
      () =>
        createSupabaseTransactor({
          connectionString:
            "postgresql://postgres.proj:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
          driver: tp.pg,
        }),
    ],
  ];

  for (const [name, make] of drivers) {
    test(`${name} satisfies the one-method Transactor port`, () => {
      const transactor = make();
      expect(typeof transactor.transaction).toBe("function");
    });

    test(`${name} — withTenant scopes a read to the active account`, async () => {
      const rows = await withTenant(make(), "acct_a", async (tx) => {
        const r = await tx.query<{ id: string }>(
          `SELECT id FROM conformance_doc ORDER BY id`,
        );
        return r.rows.map((x) => x.id);
      });
      expect(rows).toEqual(["d1"]);
    });

    test(`${name} — a query that forgets its WHERE still returns only the tenant's rows`, async () => {
      const count = await withTenant(make(), "acct_b", async (tx) => {
        const r = await tx.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM conformance_doc`,
        );
        return r.rows[0]?.n;
      });
      expect(count).toBe(1);
    });
  }
});

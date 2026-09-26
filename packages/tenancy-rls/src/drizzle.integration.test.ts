// Tenant-isolation conformance THROUGH the Drizzle bridge (ADR-0266), on the same real PGlite
// harness rls.integration.test.ts uses. Proves the bridge doesn't dilute the fail-closed
// guarantee: a Drizzle-generated SELECT with no WHERE clause, run through `queryDrizzle` inside
// `withTenant`, still returns only the active tenant's rows — RLS does the isolation, not the
// ORM's query shape. drizzle-orm is a devDependency (see drizzle.ts's header).
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
import { pgTable, QueryBuilder, text } from "drizzle-orm/pg-core";
import { buildTenantPolicySql, queryDrizzle, withTenant } from "./index.ts";

const drizzleDoc = pgTable("drizzle_doc", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  title: text("title").notNull(),
});

const qb = new QueryBuilder();

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(`
    CREATE TABLE drizzle_doc (
      id text PRIMARY KEY,
      account_id text NOT NULL,
      title text NOT NULL
    );
    ${buildTenantPolicySql("drizzle_doc")}
    INSERT INTO drizzle_doc VALUES
      ('d1', 'acct_a', 'A-private'),
      ('d2', 'acct_a', 'A-second'),
      ('d3', 'acct_b', 'B-private');
  `);
});

afterAll(async () => {
  await tp.close();
});

describe("withTenant + queryDrizzle — RLS holds through the Drizzle bridge", () => {
  test("a Drizzle select scoped by withTenant returns only the active tenant's rows", async () => {
    const query = qb.select().from(drizzleDoc);
    const { rows } = await withTenant(tp.pg, "acct_a", (tx) =>
      queryDrizzle<{ id: string }>(tx, query),
    );
    expect(rows.map((r) => r.id).sort()).toEqual(["d1", "d2"]);
  });

  test("a Drizzle select with NO where clause still fails closed to the other tenant", async () => {
    // The whole point of RLS: the query builder never filtered by account_id at all.
    const query = qb.select().from(drizzleDoc);
    const { rows } = await withTenant(tp.pg, "acct_b", (tx) =>
      queryDrizzle<{ id: string }>(tx, query),
    );
    expect(rows.map((r) => r.id)).toEqual(["d3"]);
  });

  test("cross-tenant reads through the bridge return zero rows, same as the raw path", async () => {
    const query = qb.select().from(drizzleDoc);
    const acctARows = await withTenant(tp.pg, "acct_a", (tx) =>
      queryDrizzle<{ id: string }>(tx, query),
    );
    expect(acctARows.rows.every((r) => r.id !== "d3")).toBe(true);
    expect(acctARows.rows).toHaveLength(2);
  });
});

// FORCE RLS proven at the Postgres catalog, not just at the SQL-text level (the
// standards-gate's `checkRlsEquivalence` already checks that a migration's SQL TEXT matches the
// generator's output — this is the runtime companion: a `pg_class` introspection that the FORCE
// flag actually took effect once the SQL runs). Also pins the existence-leak guard: a tenancy
// denial must surface as `TenancyError`, which is already httpStatus-404/`not_found` in
// `@caisson-sh/kernel` (never 403 — a 403 would leak that the row exists in another tenant).
import { describe, expect, test } from "bun:test";
import { newTestPg } from "@caisson-sh/testing";
import { TenancyError } from "@caisson-sh/kernel";
import { buildTenantPolicySql, withTenant } from "./rls.ts";

interface PgClassRow {
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
}

async function rlsFlags(
  tp: Awaited<ReturnType<typeof newTestPg>>,
  table: string,
): Promise<PgClassRow | undefined> {
  const rows = await tp.query<PgClassRow>(
    `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1`,
    [table],
  );
  return rows[0];
}

describe("FORCE ROW LEVEL SECURITY — pg_class introspection", () => {
  test("a table provisioned via buildTenantPolicySql has both flags set in pg_class", async () => {
    const tp = await newTestPg();
    await tp.exec(
      `CREATE TABLE widget (id text PRIMARY KEY, account_id text NOT NULL);`,
    );
    await tp.exec(buildTenantPolicySql("widget"));
    expect(await rlsFlags(tp, "widget")).toEqual({
      relrowsecurity: true,
      relforcerowsecurity: true,
    });
    await tp.close();
  });

  test("negative control: a table that skips the generator has both flags unset", async () => {
    // Proves the introspection actually distinguishes guarded from unguarded — without this, the
    // positive test above could pass vacuously (e.g. pg_class always reporting `true`).
    const tp = await newTestPg();
    await tp.exec(
      `CREATE TABLE unguarded (id text PRIMARY KEY, account_id text NOT NULL);`,
    );
    expect(await rlsFlags(tp, "unguarded")).toEqual({
      relrowsecurity: false,
      relforcerowsecurity: false,
    });
    await tp.close();
  });
});

describe("existence-leak guard — tenancy denial is 404, never 403 (ADR-0019/0005)", () => {
  test("TenancyError is pinned to 404/not_found at the class level", () => {
    // Duplicates one line of @caisson-sh/kernel's own pin deliberately — this file's job is the
    // INTEGRATION pin below; this line just documents the invariant the integration test relies on.
    const err = new TenancyError();
    expect(err.httpStatus).toBe(404);
    expect(err.code).toBe("not_found");
  });

  test("withTenant's fail-closed refusal surfaces as that same 404-shaped error, not a 403", async () => {
    const tp = await newTestPg();
    await expect(
      withTenant(tp.pg, "", async () => undefined),
    ).rejects.toMatchObject({
      httpStatus: 404,
      code: "not_found",
    });
    await tp.close();
  });
});

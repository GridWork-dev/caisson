// The security proof for the cross-tenant admin read (ADR-0141): the `admin` role sees every
// tenant, WITHOUT widening what the buyer `app` role sees. If the `TO admin` scoping ever regressed
// to leak into `app`, the "app still sees only its own tenant" assertion below fails.
import { test, expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { buildTenantPolicySql } from "@caisson/tenancy-rls";

import {
  ADMIN_ROLE_BOOTSTRAP_SQL,
  buildAdminReadPolicySql,
} from "./admin-read.ts";
import { readAdmin } from "./admin-db.ts";
import {
  readCredits,
  readEntitlements,
  readLicenses,
  readTenants,
} from "./business-reads.ts";

interface Row {
  id: string;
  account_id: string;
}

/** A PGlite with `app` + `admin` roles, one tenant table carrying BOTH policies, seeded for 2 tenants. */
async function seededPg(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN CREATE ROLE app NOLOGIN; END IF;
  END $$;`);
  await pg.exec(ADMIN_ROLE_BOOTSTRAP_SQL);
  await pg.exec(
    `CREATE TABLE thing (id text PRIMARY KEY, account_id text NOT NULL, val text);`,
  );
  await pg.exec(buildTenantPolicySql("thing"));
  await pg.exec(buildAdminReadPolicySql("thing"));
  await pg.exec(
    `INSERT INTO thing (id, account_id, val) VALUES
       ('1', 'tenant-a', 'a1'), ('2', 'tenant-a', 'a2'), ('3', 'tenant-b', 'b1');`,
  );
  return pg;
}

async function asApp<T>(
  pg: PGlite,
  accountId: string | null,
  fn: (tx: { query: PGlite["query"] }) => Promise<T>,
): Promise<T> {
  return pg.transaction(async (tx) => {
    if (accountId !== null) {
      await tx.query(`SELECT set_config('app.current_account', $1, true)`, [
        accountId,
      ]);
    }
    await tx.exec(`SET LOCAL ROLE app`);
    return fn(tx as unknown as { query: PGlite["query"] });
  }) as Promise<T>;
}

async function asAdmin<T>(
  pg: PGlite,
  fn: (tx: { query: PGlite["query"] }) => Promise<T>,
): Promise<T> {
  return pg.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE admin`);
    return fn(tx as unknown as { query: PGlite["query"] });
  }) as Promise<T>;
}

test("app role stays tenant-scoped; the admin policy does not leak into it", async () => {
  const pg = await seededPg();
  const a = await asApp(pg, "tenant-a", (tx) =>
    tx.query<Row>(`SELECT id, account_id FROM thing`),
  );
  expect(a.rows.map((r) => r.account_id).sort()).toEqual([
    "tenant-a",
    "tenant-a",
  ]);
  // The critical no-leak check: tenant-a must NOT see tenant-b even though a permissive
  // `USING (true)` admin policy now exists on the table — it is `TO admin`, not `TO app`.
  expect(a.rows.some((r) => r.account_id === "tenant-b")).toBe(false);
  await pg.close();
});

test("app role with no tenant GUC sees nothing (fail-closed)", async () => {
  const pg = await seededPg();
  const none = await asApp(pg, null, (tx) =>
    tx.query<Row>(`SELECT id FROM thing`),
  );
  expect(none.rows).toHaveLength(0);
  await pg.close();
});

test("admin role reads across every tenant", async () => {
  const pg = await seededPg();
  const all = await asAdmin(pg, (tx) =>
    tx.query<Row>(`SELECT id, account_id FROM thing`),
  );
  expect(all.rows).toHaveLength(3);
  expect(new Set(all.rows.map((r) => r.account_id))).toEqual(
    new Set(["tenant-a", "tenant-b"]),
  );
  await pg.close();
});

test("admin role is read-only: INSERT is refused", async () => {
  const pg = await seededPg();
  await expect(
    asAdmin(pg, (tx) =>
      tx.query(
        `INSERT INTO thing (id, account_id, val) VALUES ('x','tenant-a','x')`,
      ),
    ),
  ).rejects.toThrow();
  await pg.close();
});

test("business readers run cross-tenant through the admin seam (empty double)", async () => {
  // Exercises the real schema DDL + admin policies + reader SQL end-to-end on the empty PGlite
  // double: proves the seam wires up and every reader's SQL is valid (a column rename would throw).
  const [tenants, entitlements, credits, licenses] = await Promise.all([
    readAdmin(readTenants),
    readAdmin(readEntitlements),
    readAdmin(readCredits),
    readAdmin(readLicenses),
  ]);
  expect(tenants).toEqual([]);
  expect(entitlements).toEqual([]);
  expect(credits).toEqual([]);
  expect(licenses).toEqual([]);
});

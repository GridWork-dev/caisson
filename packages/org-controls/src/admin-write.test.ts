// The security proof for the cross-tenant admin WRITE seam (ADR-0220, Fork AM-2 = B), moved here with
// the seam it tests (ADR-0257 §1.3). The `admin_write` role can INSERT/UPDATE any tenant's row, while
// the buyer `app` role stays fail-closed tenant-isolated — DB-level separation, not app convention. If
// the `TO admin_write` scoping ever regressed into `app`, the "app cannot cross tenants" assertions
// below fail. `buildTenantPolicySql` + `withTenant` are the still-open @caisson-sh/tenancy-rls floor; the
// admin-write builders + `withAdminWrite` are the commercial carve under test (./admin-write.ts).
import { test, expect } from "bun:test";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import {
  buildTenantPolicySql,
  withTenant,
  type Transactor,
} from "@caisson-sh/tenancy-rls";
import {
  ADMIN_WRITE_ROLE_BOOTSTRAP_SQL,
  buildAdminSelectPolicySql,
  buildAdminWritePolicySql,
  withAdminWrite,
} from "./admin-write.ts";

interface Row {
  id: string;
  account_id: string;
  val: string;
}

/** A PGlite (via the shared harness — `app` already provisioned) with `admin_write` added and one
 * tenant table carrying BOTH the `app` isolation policy and the `admin_write` cross-tenant policy. */
async function seeded(): Promise<TestPg> {
  const tp = await newTestPg();
  await tp.exec(ADMIN_WRITE_ROLE_BOOTSTRAP_SQL);
  await tp.exec(
    `CREATE TABLE thing (id text PRIMARY KEY, account_id text NOT NULL, val text);`,
  );
  await tp.exec(buildTenantPolicySql("thing"));
  await tp.exec(buildAdminWritePolicySql("thing"));
  await tp.exec(
    `INSERT INTO thing (id, account_id, val) VALUES
       ('a1', 'tenant-a', 'seed-a'), ('b1', 'tenant-b', 'seed-b');`,
  );
  return tp;
}

test("app role CANNOT write another tenant's row (WITH CHECK is fail-closed)", async () => {
  const tp = await seeded();
  const db = tp.pg as unknown as Transactor;
  // Bound to tenant-a, an attempt to insert a tenant-b row is refused by the app policy WITH CHECK.
  await expect(
    withTenant(db, "tenant-a", (tx) =>
      tx.query(
        `INSERT INTO thing (id, account_id, val) VALUES ('x', 'tenant-b', 'evil')`,
      ),
    ),
  ).rejects.toThrow();
  // Ground truth: nothing landed under tenant-b beyond the seed.
  const rows = await tp.query<Row>(
    `SELECT id FROM thing WHERE account_id = 'tenant-b'`,
  );
  expect(rows.map((r) => r.id)).toEqual(["b1"]);
  await tp.close();
});

test("admin_write role CAN write across tenants (cross-tenant policy allows it)", async () => {
  const tp = await seeded();
  const db = tp.pg as unknown as Transactor;
  // One withAdminWrite call writes to TWO different tenants — the locked cross-tenant policy.
  await withAdminWrite(db, async (tx) => {
    await tx.query(
      `INSERT INTO thing (id, account_id, val) VALUES ('g1', 'tenant-a', 'comp-a')`,
    );
    await tx.query(
      `INSERT INTO thing (id, account_id, val) VALUES ('g2', 'tenant-b', 'comp-b')`,
    );
    await tx.query(`UPDATE thing SET val = 'touched' WHERE id = 'b1'`);
  });
  const rows = await tp.query<Row>(
    `SELECT id, account_id, val FROM thing ORDER BY id`,
  );
  expect(rows).toEqual([
    { id: "a1", account_id: "tenant-a", val: "seed-a" },
    { id: "b1", account_id: "tenant-b", val: "touched" },
    { id: "g1", account_id: "tenant-a", val: "comp-a" },
    { id: "g2", account_id: "tenant-b", val: "comp-b" },
  ]);
  await tp.close();
});

test("admin_write reads across every tenant; app stays scoped to its own", async () => {
  const tp = await seeded();
  const db = tp.pg as unknown as Transactor;
  const seenByAdmin = await withAdminWrite(db, (tx) =>
    tx.query<Row>(`SELECT account_id FROM thing ORDER BY account_id`),
  );
  expect(new Set(seenByAdmin.rows.map((r) => r.account_id))).toEqual(
    new Set(["tenant-a", "tenant-b"]),
  );
  const seenByApp = await withTenant(db, "tenant-a", (tx) =>
    tx.query<Row>(`SELECT account_id FROM thing`),
  );
  expect(seenByApp.rows.every((r) => r.account_id === "tenant-a")).toBe(true);
  await tp.close();
});

test("buildAdminSelectPolicySql grants admin_write cross-tenant SELECT but NOT write", async () => {
  const tp = await newTestPg();
  await tp.exec(ADMIN_WRITE_ROLE_BOOTSTRAP_SQL);
  await tp.exec(
    `CREATE TABLE thing (id text PRIMARY KEY, account_id text NOT NULL, val text);`,
  );
  await tp.exec(buildTenantPolicySql("thing"));
  // The SELECT-only variant, not buildAdminWritePolicySql — the blast-radius fix under test.
  await tp.exec(buildAdminSelectPolicySql("thing"));
  await tp.exec(
    `INSERT INTO thing (id, account_id, val) VALUES ('a1', 'tenant-a', 'seed-a');`,
  );
  const db = tp.pg as unknown as Transactor;
  // admin_write CAN read cross-tenant under the SELECT-only policy.
  const seen = await withAdminWrite(db, (tx) =>
    tx.query<{ account_id: string }>(`SELECT account_id FROM thing`),
  );
  expect(seen.rows).toEqual([{ account_id: "tenant-a" }]);
  // admin_write CANNOT write under it — no INSERT grant, no WITH CHECK policy for this role.
  await expect(
    withAdminWrite(db, (tx) =>
      tx.query(
        `INSERT INTO thing (id, account_id, val) VALUES ('x', 'tenant-b', 'evil')`,
      ),
    ),
  ).rejects.toThrow();
  const rows = await tp.query<Row>(`SELECT id FROM thing`);
  expect(rows.map((r) => r.id)).toEqual(["a1"]);
  await tp.close();
});

test("org-controls' own role guard vets admin_write even after tenancy-rls vetted app on the same db", async () => {
  // Regression guard for the carve: `withTenant` (tenancy-rls) and `withAdminWrite` (org-controls) now
  // keep INDEPENDENT per-role guard WeakMaps. This pins that withAdminWrite still vets `admin_write`
  // after withTenant vetted `app` on the SAME db — the two guards never share state, so neither can
  // skip the other's role. Both roles are non-privileged here, so both simply succeed.
  const tp = await seeded();
  const db = tp.pg as unknown as Transactor;
  await withTenant(db, "tenant-a", (tx) => tx.query(`SELECT 1`));
  const ok = await withAdminWrite(db, (tx) =>
    tx.query<{ n: number }>(`SELECT 1 AS n`),
  );
  expect(ok.rows[0]?.n).toBe(1);
  await tp.close();
});

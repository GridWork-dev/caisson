// The /dashboard/members entitlement gate (ADR-0257 §1.3) over real PGlite RLS. Proves the deny/allow
// matrix: no grant → deny · a REVOKED org-controls grant → deny · an ACTIVE org-controls grant →
// allow · an active OTHER entitlement → deny. Rows are seeded as the PGlite superuser (BYPASSRLS);
// the gate reads back under the non-superuser `app` role via withTenant, exactly the dashboard path.
//
// PGlite is flaky under parallel workers — run apps/site with `--concurrency=1`.
import { afterEach, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "@caisson/testing";
import { ENTITLEMENT_SCHEMA_SQL } from "@caisson/service-license";
import type { Transactor } from "@caisson/tenancy-rls";
import { accountHoldsOrgControls } from "./members-gate.ts";

let tp: TestPg;

afterEach(async () => {
  await tp.close();
});

async function freshDb(): Promise<Transactor> {
  tp = await newTestPg();
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  return tp.pg as unknown as Transactor;
}

/** Seed one grant as the superuser (bypasses the FORCE-RLS write policy). */
async function seedGrant(opts: {
  accountId: string;
  entitlementId: string;
  status: "active" | "revoked";
}): Promise<void> {
  const revokedAt = opts.status === "revoked" ? "now()" : "NULL";
  await tp.exec(
    `INSERT INTO entitlement_grant
       (id, account_id, entitlement_id, source_kind, purchase_id, source_event_id, status, granted_at, revoked_at)
     VALUES
       ('${opts.entitlementId}-${opts.status}', '${opts.accountId}', '${opts.entitlementId}',
        'one_time', 'pi_${opts.entitlementId}', 'evt_${opts.entitlementId}', '${opts.status}', now(), ${revokedAt});`,
  );
}

describe("accountHoldsOrgControls — deny/allow matrix", () => {
  test("DENY: no grants at all", async () => {
    const db = await freshDb();
    expect(await accountHoldsOrgControls(db, "acct_a")).toBe(false);
  });

  test("DENY: only a different active entitlement", async () => {
    const db = await freshDb();
    await seedGrant({
      accountId: "acct_a",
      entitlementId: "compliance",
      status: "active",
    });
    expect(await accountHoldsOrgControls(db, "acct_a")).toBe(false);
  });

  test("DENY: a REVOKED org-controls grant does not count", async () => {
    const db = await freshDb();
    await seedGrant({
      accountId: "acct_a",
      entitlementId: "org-controls",
      status: "revoked",
    });
    expect(await accountHoldsOrgControls(db, "acct_a")).toBe(false);
  });

  test("ALLOW: an ACTIVE org-controls grant", async () => {
    const db = await freshDb();
    await seedGrant({
      accountId: "acct_a",
      entitlementId: "org-controls",
      status: "active",
    });
    expect(await accountHoldsOrgControls(db, "acct_a")).toBe(true);
  });

  test("tenant-scoped: acct_b's org-controls grant does not entitle acct_a", async () => {
    const db = await freshDb();
    await seedGrant({
      accountId: "acct_b",
      entitlementId: "org-controls",
      status: "active",
    });
    expect(await accountHoldsOrgControls(db, "acct_a")).toBe(false);
    expect(await accountHoldsOrgControls(db, "acct_b")).toBe(true);
  });
});

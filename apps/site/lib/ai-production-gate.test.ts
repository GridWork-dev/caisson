// The /dashboard/ai-keys entitlement gate (CAISSON-64 P1) over real PGlite RLS. Mirrors
// compliance-gate.test.ts's deny/allow matrix: no grant → deny · the ai-production bundle →
// allow · everything → allow · a REVOKED grant of either → deny · tenant isolation holds · a
// member module purchase alone (e.g. just `credits`) does NOT grant BYOK.
//
// PGlite is flaky under parallel workers — run apps/site with `--concurrency=1`.
import { afterEach, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "@caisson/testing";
import { ENTITLEMENT_SCHEMA_SQL } from "@caisson/service-license";
import type { Transactor } from "@caisson/tenancy-rls";
import { accountHoldsAiProduction } from "./ai-production-gate.ts";

let tp: TestPg | undefined;

afterEach(async () => {
  try {
    await tp?.close();
  } catch {
    /* already closed */
  }
});

async function freshDb(): Promise<Transactor> {
  tp = await newTestPg();
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  return tp.pg as unknown as Transactor;
}

async function seedGrant(opts: {
  accountId: string;
  entitlementId: string;
  status: "active" | "revoked";
}): Promise<void> {
  if (tp === undefined) throw new Error("seedGrant called before freshDb");
  const revokedAt = opts.status === "revoked" ? "now()" : "NULL";
  await tp.exec(
    `INSERT INTO entitlement_grant
       (id, account_id, entitlement_id, source_kind, purchase_id, source_event_id, status, granted_at, revoked_at)
     VALUES
       ('${opts.entitlementId}-${opts.status}', '${opts.accountId}', '${opts.entitlementId}',
        'one_time', 'pi_${opts.entitlementId}', 'evt_${opts.entitlementId}', '${opts.status}', now(), ${revokedAt});`,
  );
}

describe("accountHoldsAiProduction — deny/allow matrix", () => {
  test("DENY: no grants at all", async () => {
    const db = await freshDb();
    expect(await accountHoldsAiProduction(db, "acct_a")).toBe(false);
  });

  test("DENY: only a different active entitlement", async () => {
    const db = await freshDb();
    await seedGrant({
      accountId: "acct_a",
      entitlementId: "compliance-core",
      status: "active",
    });
    expect(await accountHoldsAiProduction(db, "acct_a")).toBe(false);
  });

  test("DENY: owning just one ai-production MEMBER module (e.g. credits) does not grant BYOK", async () => {
    const db = await freshDb();
    await seedGrant({
      accountId: "acct_a",
      entitlementId: "credits",
      status: "active",
    });
    expect(await accountHoldsAiProduction(db, "acct_a")).toBe(false);
  });

  test("ALLOW: an ACTIVE ai-production bundle grant", async () => {
    const db = await freshDb();
    await seedGrant({
      accountId: "acct_a",
      entitlementId: "ai-production",
      status: "active",
    });
    expect(await accountHoldsAiProduction(db, "acct_a")).toBe(true);
  });

  test("DENY: a REVOKED ai-production grant does not count", async () => {
    const db = await freshDb();
    await seedGrant({
      accountId: "acct_a",
      entitlementId: "ai-production",
      status: "revoked",
    });
    expect(await accountHoldsAiProduction(db, "acct_a")).toBe(false);
  });

  test("ALLOW: an ACTIVE everything grant (bundle coverage)", async () => {
    const db = await freshDb();
    await seedGrant({
      accountId: "acct_a",
      entitlementId: "everything",
      status: "active",
    });
    expect(await accountHoldsAiProduction(db, "acct_a")).toBe(true);
  });

  test("tenant-scoped: acct_b's ai-production grant does not entitle acct_a", async () => {
    const db = await freshDb();
    await seedGrant({
      accountId: "acct_b",
      entitlementId: "ai-production",
      status: "active",
    });
    expect(await accountHoldsAiProduction(db, "acct_a")).toBe(false);
    expect(await accountHoldsAiProduction(db, "acct_b")).toBe(true);
  });
});

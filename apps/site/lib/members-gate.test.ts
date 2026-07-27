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

let tp: TestPg | undefined;

afterEach(async () => {
  // Idempotent: the assumption-pin test at the bottom runs without a fresh PGlite, so the previous
  // test's already-closed handle must not throw here.
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

/** Seed one grant as the superuser (bypasses the FORCE-RLS write policy). */
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

  test("ALLOW: an ACTIVE everything grant (bundle coverage, audit F4)", async () => {
    // Stored grants are PURCHASED ids — the $2,259 Everything buyer's row says "everything", never
    // a pre-expanded member list; the gate must honor the by-construction full-catalog rule.
    const db = await freshDb();
    await seedGrant({
      accountId: "acct_a",
      entitlementId: "everything",
      status: "active",
    });
    expect(await accountHoldsOrgControls(db, "acct_a")).toBe(true);
  });

  test("DENY: an undrained legacy 'bundle' grant no longer resolves (ADR-0270)", async () => {
    // The dissolved-edition aliases were purged (ADR-0270): legacy rows are drained to canonical
    // ids at deploy behind a prove-empty gate, so a raw 'bundle' row surviving in the DB is an
    // operational error — the gate under-grants (fail-closed), never silently expands it.
    const db = await freshDb();
    await seedGrant({
      accountId: "acct_a",
      entitlementId: "bundle",
      status: "active",
    });
    expect(await accountHoldsOrgControls(db, "acct_a")).toBe(false);
  });

  test("DENY: a REVOKED everything grant does not count", async () => {
    const db = await freshDb();
    await seedGrant({
      accountId: "acct_a",
      entitlementId: "everything",
      status: "revoked",
    });
    expect(await accountHoldsOrgControls(db, "acct_a")).toBe(false);
  });
});

test("gate assumption pin: org-controls belongs to NO persona bundle", async () => {
  // The gate short-circuits bundle coverage to the Everything grant only. That is correct exactly
  // while org-controls sits in no persona bundle (its pricing row carries `bundles: []`, which the
  // catalog-parity gate pins against the registry index members maps). If this test fails, expand
  // grants against the index in members-gate.ts instead of widening the shortcut.
  const { MODULE_PRICES } = await import("./pricing.ts");
  const orgControls = MODULE_PRICES.find((m) => m.id === "org-controls");
  expect(orgControls).toBeDefined();
  expect(orgControls?.bundles).toEqual([]);
});

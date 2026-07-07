// readUpdatesWindows on PGlite + real withTenant RLS — proves the platform-reads mirror matches
// services/license's computeUpdatesWindows (ADR-0244/0255) bound-for-bound: this is the read the
// buyer dashboard now uses instead of decoding the last-issued license token (which goes stale
// after a renewal extends the DB row without a re-issue). Fixtures are built through the real
// `@caisson/service-license` grant/extend functions (a devDependency here, same as
// columns-contract.test.ts's DDL import) so the setup exercises the same write path production
// does; the read under test never imports that package.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { type TestPg, newTestPg } from "@caisson/testing";
import {
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  extendUpdatesWindow,
  grantEntitlements,
} from "@caisson/service-license";
import { withTenant } from "@caisson/tenancy-rls";
import { readUpdatesWindows } from "./index.ts";

setDefaultTimeout(30_000);

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  await tp.exec(ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL);
});

afterAll(async () => {
  await tp.close();
});

const sub = (subscriptionId: string) =>
  ({ kind: "subscription", subscriptionId }) as const;
const onetime = (purchaseId: string) =>
  ({ kind: "one_time", purchaseId }) as const;

/** Pin a grant's granted_at (superuser bypasses RLS) for deterministic baseline math. */
const pinGrantedAt = (acct: string, iso: string) =>
  tp.query(
    `UPDATE entitlement_grant SET granted_at = $2 WHERE account_id = $1`,
    [acct, iso],
  );

describe("readUpdatesWindows (ADR-0244/0255 mirror)", () => {
  test("unknown account -> empty map", async () => {
    expect(
      await withTenant(tp.pg, "acct_pr_unknown", (tx) =>
        readUpdatesWindows(tx, "acct_pr_unknown"),
      ),
    ).toEqual({});
  });

  test("one_time grant -> window = granted_at + 12 months, keyed by entitlement_id", async () => {
    const acct = "acct_pr_base";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_pr_1",
        source: onetime("pay_pr_1"),
      }),
    );
    await pinGrantedAt(acct, "2026-01-05T00:00:00.000Z");
    expect(
      await withTenant(tp.pg, acct, (tx) => readUpdatesWindows(tx, acct)),
    ).toEqual({ compliance: "2027-01-05T00:00:00.000Z" });
  });

  test("an extension row wins over the base bound", async () => {
    const acct = "acct_pr_extend";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_pr_2",
        source: onetime("pay_pr_2"),
      }),
    );
    await pinGrantedAt(acct, "2026-01-05T00:00:00.000Z");
    const baseline = await withTenant(tp.pg, acct, (tx) =>
      readUpdatesWindows(tx, acct),
    );
    await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_pr_renew_1",
      }),
    );
    const extended = await withTenant(tp.pg, acct, (tx) =>
      readUpdatesWindows(tx, acct),
    );
    expect(new Date(extended.compliance!).getTime()).toBeGreaterThan(
      new Date(baseline.compliance!).getTime(),
    );
  });

  test("a subscription-sourced grant yields NO window entry", async () => {
    const acct = "acct_pr_sub";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_pr_1",
        source: sub("sub_pr_1"),
      }),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readUpdatesWindows(tx, acct)),
    ).toEqual({});
  });

  test("multiple one_time grants for the same id -> most-favorable (max) bound", async () => {
    const acct = "acct_pr_multi";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_pr_3a",
        source: onetime("pay_pr_3a"),
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_pr_3b",
        source: onetime("pay_pr_3b"),
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = $2
         WHERE account_id = $1 AND purchase_id = $3`,
      [acct, "2025-01-01T00:00:00.000Z", "pay_pr_3a"],
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = $2
         WHERE account_id = $1 AND purchase_id = $3`,
      [acct, "2026-06-01T00:00:00.000Z", "pay_pr_3b"],
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readUpdatesWindows(tx, acct)),
    ).toEqual({ compliance: "2027-06-01T00:00:00.000Z" });
  });
});

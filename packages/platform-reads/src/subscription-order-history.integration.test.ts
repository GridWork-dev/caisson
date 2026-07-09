// readSubscriptionStatuses / readOrderRecords (ADR-0293 G13/G14/G26) on PGlite + real withTenant RLS.
// Fixtures are built through the real `@caisson/service-license` write functions (a devDependency
// here, same as columns-contract.test.ts's DDL import and updates-window.integration.test.ts's
// pattern) so the setup exercises the same write path apply-billing-event.ts does; the reads under
// test never import that package.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  cancelSubscriptionStatus,
  insertOrderRecord,
  ORDER_RECORD_SCHEMA_SQL,
  ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL,
  refundOrderRecord,
  SUBSCRIPTION_STATUS_SCHEMA_SQL,
  upsertSubscriptionStatus,
} from "@caisson/service-license";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import { readOrderRecords, readSubscriptionStatuses } from "./index.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(SUBSCRIPTION_STATUS_SCHEMA_SQL);
  await tp.exec(ORDER_RECORD_SCHEMA_SQL);
  await tp.exec(ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL);
});

afterAll(async () => {
  await tp.close();
});

describe("readSubscriptionStatuses (ADR-0293 G13/G14)", () => {
  test("unknown account -> empty list", async () => {
    expect(
      await withTenant(tp.pg, "acct_sub_unknown", (tx) =>
        readSubscriptionStatuses(tx, "acct_sub_unknown"),
      ),
    ).toEqual([]);
  });

  test("a granted zero-entitlement (Developer) subscription reads back ACTIVE", async () => {
    const acct = "acct_sub_dev";
    await withTenant(tp.pg, acct, (tx) =>
      upsertSubscriptionStatus(tx, {
        accountId: acct,
        subscriptionId: "sub_dev_1",
        priceId: "pri_developer",
        planTag: "developer",
      }),
    );
    const rows = await withTenant(tp.pg, acct, (tx) =>
      readSubscriptionStatuses(tx, acct),
    );
    expect(rows).toEqual([
      {
        subscriptionId: "sub_dev_1",
        priceId: "pri_developer",
        planTag: "developer",
        status: "active",
        updatedAt: expect.any(String) as unknown as string,
      },
    ]);
  });

  test("cancel flips the row to CANCELED — an account with no subscription stays absent, never true", async () => {
    const acct = "acct_sub_cancel";
    await withTenant(tp.pg, acct, (tx) =>
      upsertSubscriptionStatus(tx, {
        accountId: acct,
        subscriptionId: "sub_cancel_1",
        priceId: "pri_developer",
        planTag: "developer",
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      cancelSubscriptionStatus(tx, acct, "sub_cancel_1"),
    );
    const rows = await withTenant(tp.pg, acct, (tx) =>
      readSubscriptionStatuses(tx, acct),
    );
    expect(rows[0]?.status).toBe("canceled");
  });

  test("cancelSubscriptionStatus with no prior row writes a canceled TOMBSTONE, never throws", async () => {
    // The tombstone (empty price/plan sentinels) is the cancel-before-grant ordering-race fix:
    // a late granting invoice's liveness check must find the cancel even when the subscription
    // never granted. Every "owned"/cancel-control consumer filters on status === 'active', so a
    // tombstone never renders as a plan nor resolves a price.
    await withTenant(tp.pg, "acct_sub_noop", (tx) =>
      cancelSubscriptionStatus(tx, "acct_sub_noop", "sub_never_existed"),
    );
    const rows = await withTenant(tp.pg, "acct_sub_noop", (tx) =>
      readSubscriptionStatuses(tx, "acct_sub_noop"),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("canceled");
    expect(rows[0]?.subscriptionId).toBe("sub_never_existed");
    expect(rows[0]?.priceId).toBe(""); // sentinel — can never collide with a real price id
  });

  test("cancel is scoped by account — cannot flip another account's row of the same subscription id", async () => {
    await withTenant(tp.pg, "acct_sub_a", (tx) =>
      upsertSubscriptionStatus(tx, {
        accountId: "acct_sub_a",
        subscriptionId: "sub_shared",
        priceId: "pri_developer",
        planTag: "developer",
      }),
    );
    // A DIFFERENT account cancels a subscription id it never owns — a no-op on account A's row.
    await withTenant(tp.pg, "acct_sub_b", (tx) =>
      cancelSubscriptionStatus(tx, "acct_sub_b", "sub_shared"),
    );
    const rows = await withTenant(tp.pg, "acct_sub_a", (tx) =>
      readSubscriptionStatuses(tx, "acct_sub_a"),
    );
    expect(rows[0]?.status).toBe("active");
  });

  test("a re-grant on the SAME subscription id re-activates a canceled row (Paddle resume)", async () => {
    const acct = "acct_sub_resume";
    const grant = () =>
      withTenant(tp.pg, acct, (tx) =>
        upsertSubscriptionStatus(tx, {
          accountId: acct,
          subscriptionId: "sub_resume_1",
          priceId: "pri_developer",
          planTag: "developer",
        }),
      );
    await grant();
    await withTenant(tp.pg, acct, (tx) =>
      cancelSubscriptionStatus(tx, acct, "sub_resume_1"),
    );
    await grant();
    const rows = await withTenant(tp.pg, acct, (tx) =>
      readSubscriptionStatuses(tx, acct),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("active");
  });
});

describe("readOrderRecords (ADR-0293 G26)", () => {
  test("unknown account -> empty list", async () => {
    expect(
      await withTenant(tp.pg, "acct_ord_unknown", (tx) =>
        readOrderRecords(tx, "acct_ord_unknown"),
      ),
    ).toEqual([]);
  });

  test("renders a granting invoice + a one-time purchase, newest first", async () => {
    const acct = "acct_ord_history";
    await withTenant(tp.pg, acct, (tx) =>
      insertOrderRecord(tx, {
        accountId: acct,
        sourceEventId: "in_ord_1",
        kind: "subscription",
        priceId: "pri_developer",
        label: "developer",
        amount: 49_900,
        currency: "usd",
      }),
    );
    // Two same-instant inserts tie on created_at (the reader's only sort key) and the tie order
    // is unspecified — backdate the first row so "newest first" is deterministic to assert.
    await tp.query(
      `UPDATE order_record SET created_at = created_at - interval '1 minute'
        WHERE source_event_id = 'in_ord_1'`,
    );
    await withTenant(tp.pg, acct, (tx) =>
      insertOrderRecord(tx, {
        accountId: acct,
        sourceEventId: "pay_ord_1",
        kind: "purchase",
        priceId: "pri_compliance",
        label: "compliance",
        amount: 79_900,
        currency: "usd",
      }),
    );
    const rows = await withTenant(tp.pg, acct, (tx) =>
      readOrderRecords(tx, acct),
    );
    expect(rows.map((r) => r.sourceEventId)).toEqual(["pay_ord_1", "in_ord_1"]);
    expect(rows.every((r) => r.status === "paid")).toBe(true);
  });

  test("a whole-transaction refund flips the purchase row to refunded, never a subscription invoice row", async () => {
    const acct = "acct_ord_refund";
    await withTenant(tp.pg, acct, (tx) =>
      insertOrderRecord(tx, {
        accountId: acct,
        sourceEventId: "pay_ord_2",
        kind: "purchase",
        priceId: "pri_compliance",
        label: "compliance",
        amount: 79_900,
        currency: "usd",
      }),
    );
    await withTenant(tp.pg, acct, (tx) => refundOrderRecord(tx, "pay_ord_2"));
    const rows = await withTenant(tp.pg, acct, (tx) =>
      readOrderRecords(tx, acct),
    );
    expect(rows[0]?.status).toBe("refunded");
  });

  test("a redelivered invoice/transaction id inserts nothing a second time (idempotent)", async () => {
    const acct = "acct_ord_idem";
    const insert = () =>
      withTenant(tp.pg, acct, (tx) =>
        insertOrderRecord(tx, {
          accountId: acct,
          sourceEventId: "in_ord_idem",
          kind: "subscription",
          priceId: "pri_developer",
          label: "developer",
          amount: 49_900,
          currency: "usd",
        }),
      );
    await insert();
    await insert();
    const rows = await withTenant(tp.pg, acct, (tx) =>
      readOrderRecords(tx, acct),
    );
    expect(rows).toHaveLength(1);
  });
});

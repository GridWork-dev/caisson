// ADR-0315 affiliate store, end to end on PGlite: the minted-code registry round-trips, and the
// commission report joins order_record.discount_id → affiliate_code, groups per affiliate, computes
// integer commission (30% = 3000bps), flags refunded orders as clawbacks (alert-only), and honestly
// buckets a discount id with no registered affiliate. order_record rows are seeded through the real
// insertOrderRecord (RLS-scoped withTenant); the report reads cross-tenant as the superuser (PGlite's
// connecting role BYPASSRLS — the production caller runs it as the `admin` role, an admin-provisioning
// concern out of this store's scope).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { withTenant, type TenantExecutor } from "@caisson/tenancy-rls";
import { type TestPg, newTestPg } from "@caisson/testing";
import {
  ORDER_RECORD_SCHEMA_SQL,
  ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL,
  ORDER_RECORD_DISCOUNT_MIGRATION_SQL,
  insertOrderRecord,
  refundOrderRecord,
} from "./subscription-history-store.ts";
import {
  AFFILIATE_CODE_SCHEMA_SQL,
  AFFILIATE_COMMISSION_BPS,
  AFFILIATE_DISCOUNT_PCT,
  insertAffiliateCode,
  readAffiliateCodes,
  readAffiliateReport,
} from "./affiliate-store.ts";
import { ENTITLEMENT_SCHEMA_SQL } from "./entitlement-store.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(ORDER_RECORD_SCHEMA_SQL);
  await tp.exec(ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL);
  await tp.exec(ORDER_RECORD_DISCOUNT_MIGRATION_SQL);
  // The report's partial-refund alert reads entitlement_grant (SHIP-audit fix below).
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  // The admin roles do not exist in this harness — the schema's role-guarded grants no-op cleanly,
  // proving the DDL is safe in the platform migration chain before admin provisioning.
  await tp.exec(AFFILIATE_CODE_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

/** Seed a paid order for `acct` carrying `discountId` (or null) through the real RLS-scoped insert. */
async function seedOrder(
  acct: string,
  sourceEventId: string,
  amount: number,
  discountId: string | null,
): Promise<void> {
  await withTenant(tp.pg, acct, (tx) =>
    insertOrderRecord(tx, {
      accountId: acct,
      sourceEventId,
      kind: "purchase",
      priceId: "price_x",
      label: "compliance",
      amount,
      currency: "usd",
      discountId,
    }),
  );
}

/** Read the report cross-tenant as the superuser (BYPASSRLS) — stands in for the `admin` role. */
function report() {
  return readAffiliateReport(tp.pg as unknown as TenantExecutor);
}

describe("affiliate_code registry round-trip", () => {
  test("insertAffiliateCode stamps the LOCKED program constants; readAffiliateCodes returns them", async () => {
    // insert/read run as the superuser owner (no RLS on affiliate_code) — the production caller
    // scopes them to admin_write/admin; this store is role-agnostic.
    await insertAffiliateCode(tp.pg as unknown as TenantExecutor, {
      code: "CAISSONAFF1",
      discountId: "dsc_reg_1",
      affiliateName: "Jane Doe",
      createdBy: "admin@caisson.sh",
    });
    const rows = await readAffiliateCodes(tp.pg as unknown as TenantExecutor);
    const jane = rows.find((r) => r.discountId === "dsc_reg_1");
    expect(jane).toBeDefined();
    expect(jane?.code).toBe("CAISSONAFF1");
    expect(jane?.affiliateName).toBe("Jane Doe");
    expect(jane?.commissionBps).toBe(AFFILIATE_COMMISSION_BPS); // 3000, never caller input
    expect(jane?.discountPct).toBe(AFFILIATE_DISCOUNT_PCT); // 10
    expect(jane?.createdBy).toBe("admin@caisson.sh");
  });

  test("a duplicate discount_id is rejected (UNIQUE)", async () => {
    await expect(
      insertAffiliateCode(tp.pg as unknown as TenantExecutor, {
        code: "CAISSONAFF1DUP",
        discountId: "dsc_reg_1", // already registered above
        affiliateName: "Impostor",
        createdBy: "admin@caisson.sh",
      }),
    ).rejects.toThrow();
  });
});

describe("readAffiliateReport — join, commission math, clawback, unattributed", () => {
  test("groups attributed orders per affiliate and computes exact integer commission (3000bps)", async () => {
    await insertAffiliateCode(tp.pg as unknown as TenantExecutor, {
      code: "AFFJANE",
      discountId: "dsc_jane",
      affiliateName: "Jane",
      createdBy: "op",
    });
    // Two discounted buyers on Jane's code, spanning two tenant accounts (cross-tenant read).
    await seedOrder("acct_buyer_1", "pay_j1", 8910, "dsc_jane"); // 30% → 2673
    await seedOrder("acct_buyer_2", "pay_j2", 8910, "dsc_jane"); // 30% → 2673

    const rep = await report();
    const jane = rep.affiliates.find((a) => a.discountId === "dsc_jane");
    expect(jane).toBeDefined();
    expect(jane?.affiliateName).toBe("Jane");
    expect(jane?.code).toBe("AFFJANE");
    expect(jane?.commissionBps).toBe(3000);
    expect(jane?.orders).toHaveLength(2);
    expect(jane?.grossCents).toBe(17820); // 8910 + 8910
    expect(jane?.commissionCents).toBe(5346); // 2673 + 2673 (exact — the task's proof)
    expect(jane?.clawbackCents).toBe(0);
    expect(jane?.orders.every((o) => !o.clawback)).toBe(true);
  });

  test("a refunded attributed order is FLAGGED as a clawback and excluded from payable commission", async () => {
    await insertAffiliateCode(tp.pg as unknown as TenantExecutor, {
      code: "AFFBOB",
      discountId: "dsc_bob",
      affiliateName: "Bob",
      createdBy: "op",
    });
    await seedOrder("acct_buyer_3", "pay_b1", 8910, "dsc_bob"); // stays paid
    await seedOrder("acct_buyer_4", "pay_b2", 8910, "dsc_bob"); // refunded below
    await withTenant(tp.pg, "acct_buyer_4", (tx) =>
      refundOrderRecord(tx, "pay_b2"),
    );

    const rep = await report();
    const bob = rep.affiliates.find((a) => a.discountId === "dsc_bob");
    expect(bob?.orders).toHaveLength(2);
    // Payable commission counts only the still-paid order; the refunded one is a clawback ALERT.
    expect(bob?.grossCents).toBe(8910);
    expect(bob?.commissionCents).toBe(2673);
    expect(bob?.clawbackCents).toBe(2673);
    const refunded = bob?.orders.find((o) => o.orderId === "pay_b2");
    expect(refunded?.status).toBe("refunded");
    expect(refunded?.clawback).toBe(true);
  });

  test("a discount_id matching NO affiliate_code lands in the unattributed bucket (honest display)", async () => {
    await seedOrder("acct_buyer_5", "pay_u1", 5000, "dsc_manual_unknown");
    const rep = await report();
    expect(
      rep.affiliates.some((a) => a.discountId === "dsc_manual_unknown"),
    ).toBe(false);
    const orphan = rep.unattributed.find((o) => o.orderId === "pay_u1");
    expect(orphan).toBeDefined();
    expect(orphan?.amountCents).toBe(5000);
  });

  test("orders WITHOUT a discount_id are ignored entirely (not attributed, not unattributed)", async () => {
    await seedOrder("acct_buyer_6", "pay_none", 4900, null);
    const rep = await report();
    expect(rep.unattributed.some((o) => o.orderId === "pay_none")).toBe(false);
    for (const a of rep.affiliates) {
      expect(a.orders.some((o) => o.orderId === "pay_none")).toBe(false);
    }
  });
});

describe("partial-refund alert (SHIP-audit)", () => {
  test("a still-'paid' order with a REVOKED line grant is flagged partialRefund; commission stays payable", async () => {
    await insertAffiliateCode(tp.pg as unknown as TenantExecutor, {
      code: "AFFEVE",
      discountId: "dsc_eve",
      affiliateName: "Eve",
      createdBy: "op",
    });
    await seedOrder("acct_buyer_7", "pay_e1", 8910, "dsc_eve"); // gets a revoked grant below
    await seedOrder("acct_buyer_8", "pay_e2", 8910, "dsc_eve"); // control: active grant only
    // The per-line refund shape: the order stays 'paid' but one of its line grants is revoked.
    await tp.exec(
      `INSERT INTO entitlement_grant (id, account_id, entitlement_id, source_kind, purchase_id, source_event_id, status, revoked_at)
       VALUES ('g-e1', 'acct_buyer_7', 'compliance', 'one_time', 'pay_e1', 'pay_e1', 'revoked', now()),
              ('g-e2', 'acct_buyer_8', 'compliance', 'one_time', 'pay_e2', 'pay_e2', 'active', NULL)`,
    );

    const rep = await report();
    const eve = rep.affiliates.find((a) => a.discountId === "dsc_eve");
    const flagged = eve?.orders.find((o) => o.orderId === "pay_e1");
    const clean = eve?.orders.find((o) => o.orderId === "pay_e2");
    expect(flagged?.partialRefund).toBe(true);
    expect(flagged?.clawback).toBe(false); // not a whole-order refund — a review flag, not a claw
    expect(clean?.partialRefund).toBe(false);
    // ALERT-ONLY: the flagged order's commission is still in the payable sum (never auto-netted).
    expect(eve?.grossCents).toBe(17820);
    expect(eve?.commissionCents).toBe(5346);
  });
});

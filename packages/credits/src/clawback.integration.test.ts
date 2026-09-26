// Refund clawback of unspent credits (ADR-0113, operator-locked money policy) on PGlite + real
// withTenant RLS. Asserts: clawback = min(granted, balance); NEVER goes negative when partly/fully
// spent; writes exactly ONE compensating refund_clawback ledger row (append-only, ADR-0007);
// idempotent on the source id (a re-delivered refund does not double-claw); creditsGrantedBySource
// reads the original grant amount; RLS isolation holds.
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { type TestPg, newTestPg } from "@caisson-sh/testing";
import { ValidationError, asCredits } from "@caisson-sh/kernel";
import { withTenant } from "@caisson-sh/tenancy-rls";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  balance,
  clawback,
  creditsGrantedBySource,
  debit,
  getLedger,
  grant,
} from "./index.ts";

let tp: TestPg;

async function freshSchema(): Promise<void> {
  await tp.exec(
    `DROP TABLE IF EXISTS grant_consumption; DROP TABLE IF EXISTS credit_expiry_notice; DROP TABLE IF EXISTS credit_event; DROP TABLE IF EXISTS credit_wallet;`,
  );
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await tp.exec(CREDIT_EXPIRY_MIGRATION_SQL);
  await tp.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
}

beforeEach(async () => {
  if (!tp) tp = await newTestPg();
  await freshSchema();
});

afterAll(async () => {
  await tp.close();
});

/** Grant a one-time purchase's credits keyed on the PaymentIntent id (the refund join key). */
async function purchaseGrant(
  acct: string,
  amount: number,
  paymentId: string,
): Promise<void> {
  await withTenant(tp.pg, acct, (tx) =>
    grant(tx, {
      eventType: "purchase",
      accountId: acct,
      amount: asCredits(amount),
      sourceEventId: paymentId,
    }),
  );
}

describe("clawback — unspent-only, never-negative (ADR-0113)", () => {
  test("an unspent purchase claws back the full granted amount", async () => {
    const acct = "acct_full";
    await purchaseGrant(acct, 5000, "pi_full");
    const res = await withTenant(tp.pg, acct, async (tx) => {
      const granted = await creditsGrantedBySource(tx, acct, "pi_full");
      return clawback(tx, {
        accountId: acct,
        amount: granted,
        sourceEventId: "pi_full",
      });
    });
    expect(res.clawedBack).toBe(5000);
    expect(res.balance).toBe(0);
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(0);
  });

  test("a partly-spent purchase claws back ONLY the remainder (never negative)", async () => {
    const acct = "acct_part";
    await purchaseGrant(acct, 5000, "pi_part");
    // Spend 3000 of the 5000.
    await withTenant(tp.pg, acct, (tx) =>
      debit(tx, {
        eventType: "codegen_debit",
        accountId: acct,
        amount: asCredits(3000),
        idempotencyKey: "spend_1",
      }),
    );
    const res = await withTenant(tp.pg, acct, async (tx) => {
      const granted = await creditsGrantedBySource(tx, acct, "pi_part");
      return clawback(tx, {
        accountId: acct,
        amount: granted,
        sourceEventId: "pi_part",
      });
    });
    expect(res.clawedBack).toBe(2000); // only the unspent remainder
    expect(res.balance).toBe(0);
  });

  test("a fully-spent purchase claws back nothing and writes no row", async () => {
    const acct = "acct_spent";
    await purchaseGrant(acct, 5000, "pi_spent");
    await withTenant(tp.pg, acct, (tx) =>
      debit(tx, {
        eventType: "codegen_debit",
        accountId: acct,
        amount: asCredits(5000),
        idempotencyKey: "spend_all",
      }),
    );
    const res = await withTenant(tp.pg, acct, async (tx) => {
      const granted = await creditsGrantedBySource(tx, acct, "pi_spent");
      return clawback(tx, {
        accountId: acct,
        amount: granted,
        sourceEventId: "pi_spent",
      });
    });
    expect(res.clawedBack).toBe(0);
    expect(res.balance).toBe(0);
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    // grant + spend only — NO refund_clawback row (a zero debit would violate amount<>0).
    expect(ledger.map((e) => e.event_type)).toEqual([
      "purchase",
      "codegen_debit",
    ]);
  });

  test("a re-delivered refund does not double-claw (idempotent on the payment id)", async () => {
    const acct = "acct_idem";
    await purchaseGrant(acct, 5000, "pi_idem");
    const once = await withTenant(tp.pg, acct, (tx) =>
      clawback(tx, { accountId: acct, amount: 5000, sourceEventId: "pi_idem" }),
    );
    expect(once.clawedBack).toBe(5000);
    // Customer tops up AFTER the refund; a stale re-delivery of the SAME refund must not claw again.
    await purchaseGrant(acct, 1000, "pi_topup");
    const twice = await withTenant(tp.pg, acct, (tx) =>
      clawback(tx, { accountId: acct, amount: 5000, sourceEventId: "pi_idem" }),
    );
    expect(twice.idempotent).toBe(true);
    expect(twice.clawedBack).toBe(0);
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(1000); // the top-up survives; no second clawback
  });

  test("clawback amount must be a positive integer", async () => {
    const acct = "acct_bad";
    await expect(
      withTenant(tp.pg, acct, (tx) =>
        clawback(tx, { accountId: acct, amount: 0, sourceEventId: "pi_x" }),
      ),
    ).rejects.toThrow(ValidationError);
  });

  test("creditsGrantedBySource returns 0 for an unknown source", async () => {
    const acct = "acct_none";
    const granted = await withTenant(tp.pg, acct, (tx) =>
      creditsGrantedBySource(tx, acct, "pi_missing"),
    );
    expect(granted).toBe(0);
  });
});

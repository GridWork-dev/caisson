// Golden parity for the credits poke's mirror (ADR-0378 lock 2). The real grant()/debit() are
// DB-bound, so this test runs the REAL @caisson/credits functions against PGlite (@caisson/testing,
// the same harness credits.integration.test.ts uses) and asserts the pure mirror in credits-logic.ts
// produces byte-identical OBSERVABLES: the balance after every debit and the typed 402
// (InsufficientCreditsError required/balance) on an overdraw. It also pins the mirrored constants
// (GRANT_EVENT_TYPES / DEBIT_EVENT_TYPES) and the mirrored error class against the real packages.
// The mirror can never show a balance or a 402 the real ledger would not compute.
//
// Only the order-INDEPENDENT observables are compared against the DB (balance-after + the 402's
// required/balance), both provably independent of FIFO tie-break order, so a same-microsecond
// created_at tie in PGlite can never make this flaky. The FIFO ATTRIBUTION (which grant drained) is
// self-checked separately against the mirror's own documented oldest-first order.
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { newTestPg, type TestPg } from "@caisson/testing";
import {
  InsufficientCreditsError as RealInsufficientCreditsError,
  asCredits,
} from "@caisson/kernel";
import { withTenant } from "@caisson/tenancy-rls";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  DEBIT_EVENT_TYPES as REAL_DEBIT_EVENT_TYPES,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  GRANT_EVENT_TYPES as REAL_GRANT_EVENT_TYPES,
  balance as realBalanceRead,
  debit as realDebit,
  grant as realGrant,
} from "@caisson/credits";

import {
  DEBIT_EVENT_TYPES,
  GRANT_EVENT_TYPES,
  InsufficientCreditsError,
  OVERDRAW_PRESET,
  SAMPLE_GRANTS,
  applyDebit,
  balance,
  debit,
  initialWallet,
  remaining,
  verdictLine,
} from "./credits-logic.ts";

const ACCT = "acct_credits_poke";

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

beforeAll(async () => {
  tp = await newTestPg();
});

afterAll(async () => {
  await tp.close();
});

beforeEach(freshSchema);

/** Grant the exact SAMPLE_GRANTS lines into the DB, each in its own transaction (FIFO by created_at). */
async function grantSample(): Promise<void> {
  await withTenant(tp.pg, ACCT, (tx) =>
    realGrant(tx, {
      accountId: ACCT,
      amount: asCredits(120),
      eventType: "purchase",
      sourceEventId: "seed_1",
    }),
  );
  await withTenant(tp.pg, ACCT, (tx) =>
    realGrant(tx, {
      accountId: ACCT,
      amount: asCredits(40),
      eventType: "sub_allotment",
      sourceEventId: "seed_2",
    }),
  );
  await withTenant(tp.pg, ACCT, (tx) =>
    realGrant(tx, {
      accountId: ACCT,
      amount: asCredits(15),
      eventType: "topup",
      sourceEventId: "seed_3",
    }),
  );
  await withTenant(tp.pg, ACCT, (tx) =>
    realGrant(tx, {
      accountId: ACCT,
      amount: asCredits(25),
      eventType: "feature_grant",
      feature: "evidence_pack",
      sourceEventId: "seed_4",
    }),
  );
}

// The real DebitInput union requires a feature tag on `feature_debit`; the poke only ever issues the
// tag-free spendable debits against the real package, so this helper is typed to that pair.
type TagFreeDebitType = "codegen_debit" | "ai_feature_debit";

const realDebitStep = (
  amount: number,
  eventType: TagFreeDebitType,
  idem: string,
) =>
  withTenant(tp.pg, ACCT, (tx) =>
    realDebit(tx, {
      accountId: ACCT,
      amount: asCredits(amount),
      eventType,
      idempotencyKey: idem,
    }),
  );

const readRealBalance = () =>
  withTenant(tp.pg, ACCT, (tx) => realBalanceRead(tx, ACCT));

describe("constant parity vs the real @caisson/credits package", () => {
  test("GRANT_EVENT_TYPES mirror is identical", () => {
    expect([...GRANT_EVENT_TYPES]).toEqual([...REAL_GRANT_EVENT_TYPES]);
  });

  test("DEBIT_EVENT_TYPES mirror is identical", () => {
    expect([...DEBIT_EVENT_TYPES]).toEqual([...REAL_DEBIT_EVENT_TYPES]);
  });

  test("SAMPLE_GRANTS uses one line per grant type and totals 200 integer credits", () => {
    expect(SAMPLE_GRANTS.map((g) => g.eventType)).toEqual([
      "purchase",
      "sub_allotment",
      "topup",
      "feature_grant",
    ]);
    expect(SAMPLE_GRANTS.reduce((s, g) => s + g.amount, 0)).toBe(200);
    expect(SAMPLE_GRANTS.every((g) => Number.isInteger(g.amount))).toBe(true);
    expect(
      SAMPLE_GRANTS.find((g) => g.eventType === "feature_grant")?.feature,
    ).toBe("evidence_pack");
  });
});

describe("InsufficientCreditsError mirror parity vs the real kernel error", () => {
  test("code, httpStatus, default message, name, and details shape all match", () => {
    const real = new RealInsufficientCreditsError(500, 20);
    const mirror = new InsufficientCreditsError(500, 20);
    expect(mirror.code).toBe(real.code);
    expect(mirror.code).toBe("insufficient_credits");
    expect(mirror.httpStatus).toBe(real.httpStatus);
    expect(mirror.httpStatus).toBe(402);
    expect(mirror.message).toBe(real.message);
    expect(mirror.name).toBe(real.name);
    expect(mirror.details).toEqual({ required: 500, balance: 20 });
    expect(real.details).toEqual({ required: 500, balance: 20 });
    expect(real.details).toEqual(mirror.details);
    expect(mirror instanceof Error).toBe(true);
  });
});

describe("golden parity: the mirror tracks the REAL DB-bound debit", () => {
  test("balance after every FIFO debit matches the real ledger", async () => {
    await grantSample();
    let wallet = initialWallet();

    expect(balance(wallet)).toBe(200);
    expect(await readRealBalance()).toBe(200);

    const script: {
      amount: number;
      eventType: TagFreeDebitType;
      idem: string;
    }[] = [
      { amount: 30, eventType: "codegen_debit", idem: "d1" },
      { amount: 90, eventType: "ai_feature_debit", idem: "d2" },
      { amount: 60, eventType: "codegen_debit", idem: "d3" },
    ];

    for (const step of script) {
      const real = await realDebitStep(step.amount, step.eventType, step.idem);
      wallet = debit(wallet, step.amount, step.eventType);
      expect(balance(wallet)).toBe(real.balance);
    }
    expect(balance(wallet)).toBe(20);
    expect(await readRealBalance()).toBe(20);
  });

  test("overdrawing the drained wallet 402s identically (required=500, balance=20) and records nothing", async () => {
    await grantSample();
    let wallet = initialWallet();
    for (const step of [
      [30, "codegen_debit", "d1"],
      [90, "ai_feature_debit", "d2"],
      [60, "codegen_debit", "d3"],
    ] as const) {
      await realDebitStep(step[0], step[1], step[2]);
      wallet = debit(wallet, step[0], step[1]);
    }

    const outcome = applyDebit(
      wallet,
      OVERDRAW_PRESET.amount,
      OVERDRAW_PRESET.eventType,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBeInstanceOf(InsufficientCreditsError);
    expect(outcome.error?.details).toEqual({ required: 500, balance: 20 });
    // Mirror wallet unchanged (debit-before-spend).
    expect(balance(outcome.wallet)).toBe(20);

    let realErr: unknown;
    try {
      await realDebitStep(500, "codegen_debit", "over");
    } catch (e) {
      realErr = e;
    }
    expect(realErr).toBeInstanceOf(RealInsufficientCreditsError);
    expect((realErr as RealInsufficientCreditsError).details).toEqual({
      required: 500,
      balance: 20,
    });
    // Real wallet unchanged too.
    expect(await readRealBalance()).toBe(20);
  });

  test("a debit larger than a full fresh wallet 402s with balance = the full 200 sample", async () => {
    await grantSample();
    const outcome = applyDebit(initialWallet(), 500, "codegen_debit");
    expect(outcome.error?.details).toEqual({ required: 500, balance: 200 });

    let realErr: unknown;
    try {
      await realDebitStep(500, "codegen_debit", "o1");
    } catch (e) {
      realErr = e;
    }
    expect((realErr as RealInsufficientCreditsError).details).toEqual({
      required: 500,
      balance: 200,
    });
  });

  test("draining exactly to zero succeeds, then a 1-credit debit 402s with balance 0", async () => {
    await grantSample();
    const real1 = await realDebitStep(200, "codegen_debit", "drain");
    const wallet = debit(initialWallet(), 200, "codegen_debit");
    expect(real1.balance).toBe(0);
    expect(balance(wallet)).toBe(0);

    const outcome = applyDebit(wallet, 1, "codegen_debit");
    expect(outcome.error?.details).toEqual({ required: 1, balance: 0 });

    let realErr: unknown;
    try {
      await realDebitStep(1, "codegen_debit", "over0");
    } catch (e) {
      realErr = e;
    }
    expect((realErr as RealInsufficientCreditsError).details).toEqual({
      required: 1,
      balance: 0,
    });
  });
});

describe("FIFO attribution + verdictLine (runnable self-check, no DB)", () => {
  test("debits drain the grant lines oldest-first, splitting across lines", () => {
    let w = initialWallet();

    w = debit(w, 30, "codegen_debit");
    expect(w.ledger[0]?.consumption).toEqual([{ grantId: "g1", taken: 30 }]);

    w = debit(w, 90, "ai_feature_debit");
    expect(w.ledger[0]?.consumption).toEqual([{ grantId: "g1", taken: 90 }]);
    const g1 = w.grants.find((g) => g.id === "g1");
    expect(g1?.consumed).toBe(120);
    expect(g1 ? remaining(g1) : -1).toBe(0);

    w = debit(w, 60, "codegen_debit");
    expect(w.ledger[0]?.consumption).toEqual([
      { grantId: "g2", taken: 40 },
      { grantId: "g3", taken: 15 },
      { grantId: "g4", taken: 5 },
    ]);
    expect(balance(w)).toBe(20);
  });

  test("verdictLine reports ok with the FIFO trace and fail with the typed 402", () => {
    const ok = verdictLine(applyDebit(initialWallet(), 30, "codegen_debit"));
    expect(ok.state).toBe("ok");
    expect(ok.text).toContain("Balance 170");
    expect(ok.text).toContain("g1 (30)");

    const fail = verdictLine(applyDebit(initialWallet(), 500, "codegen_debit"));
    expect(fail.state).toBe("fail");
    expect(fail.text).toContain("insufficient_credits (402)");
    expect(fail.text).toContain("required 500, balance 200");
  });

  test("a failed debit returns the wallet unchanged (debit-before-spend)", () => {
    const w = initialWallet();
    const outcome = applyDebit(w, 500, "codegen_debit");
    expect(outcome.wallet).toBe(w);
    expect(outcome.wallet.ledger.length).toBe(0);
  });

  test("assertPositiveInt rejects zero, negatives, and non-integers", () => {
    expect(() => debit(initialWallet(), 0, "codegen_debit")).toThrow();
    expect(() => debit(initialWallet(), -5, "codegen_debit")).toThrow();
    expect(() => debit(initialWallet(), 1.5, "codegen_debit")).toThrow();
  });
});

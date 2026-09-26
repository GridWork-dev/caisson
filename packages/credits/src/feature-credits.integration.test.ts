// ADR-0074 exit-gate proof: the generic feature_debit/feature_grant envelope meters a new action via
// a registered `feature` tag — integer + idempotent like every other credit event; an unregistered
// tag fails closed with NO ledger write (threat TM-D); legacy specific event types are unchanged.
// PGlite + withTenant, same shape as credits.integration.test.ts.
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
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { ValidationError, asCredits } from "@caisson-sh/kernel";
import { withTenant } from "@caisson-sh/tenancy-rls";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  type DebitInput,
  balance,
  debit,
  getLedger,
  grant,
} from "./index.ts";

let tp: TestPg;
const A = "acct_feature";

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

const inA = <T>(fn: Parameters<typeof withTenant<T>>[2]): Promise<T> =>
  withTenant(tp.pg, A, fn);

describe("ADR-0074 generic feature meter", () => {
  test("a registered tag debits integer credits idempotently + persists the tag", async () => {
    await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: asCredits(100),
        eventType: "purchase",
        sourceEventId: "evt_buy",
      }),
    );

    const first = await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(7),
        eventType: "feature_debit",
        feature: "evidence_pack",
        idempotencyKey: "ev_1",
      }),
    );
    const retry = await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(7),
        eventType: "feature_debit",
        feature: "evidence_pack",
        idempotencyKey: "ev_1",
      }),
    );

    expect(first).toEqual({ balance: 93, idempotent: false });
    expect(retry).toEqual({ balance: 93, idempotent: true }); // feature is payload, not idem key
    expect(await inA((tx) => balance(tx, A))).toBe(93);

    const ledger = await inA((tx) => getLedger(tx, A));
    const feat = ledger.find((e) => e.event_type === "feature_debit");
    expect(feat?.amount).toBe(-7); // integer, signed
    expect(feat?.feature).toBe("evidence_pack"); // tag persisted on the payload column
    expect(ledger.length).toBe(2); // grant + the single feature_debit
  });

  test("a feature_grant adds credits carrying its registered tag", async () => {
    const r = await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: asCredits(40),
        eventType: "feature_grant",
        feature: "inference_call",
        sourceEventId: "evt_promo",
      }),
    );
    expect(r).toEqual({ balance: 40, idempotent: false });
    const ledger = await inA((tx) => getLedger(tx, A));
    expect(ledger[0]?.feature).toBe("inference_call");
    expect(ledger[0]?.amount).toBe(40);
  });

  test("an unregistered tag fails closed with NO ledger write", async () => {
    await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: asCredits(100),
        eventType: "purchase",
        sourceEventId: "evt_g",
      }),
    );
    await expect(
      inA((tx) =>
        debit(tx, {
          accountId: A,
          amount: asCredits(5),
          eventType: "feature_debit",
          // @ts-expect-error — an unregistered tag is not a FeatureTag; the runtime fail-closed path is under test
          feature: "totally_made_up",
          idempotencyKey: "bad_1",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(await inA((tx) => balance(tx, A))).toBe(100); // untouched
    expect((await inA((tx) => getLedger(tx, A))).length).toBe(1); // only the grant — no debit row
  });

  test("a feature event with a MISSING tag fails closed", async () => {
    // The discriminated union makes this a compile error; the cast feeds the malformed input past the
    // type guard to prove featureColumn's RUNTIME defensive branch (feature === undefined) fails closed.
    const missingTag = {
      accountId: A,
      amount: asCredits(5),
      eventType: "feature_debit",
      idempotencyKey: "no_tag",
    } as unknown as DebitInput;
    await expect(inA((tx) => debit(tx, missingTag))).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect((await inA((tx) => getLedger(tx, A))).length).toBe(0);
  });

  test("a legacy specific type carrying a feature tag is rejected (iff invariant)", async () => {
    await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: asCredits(50),
        eventType: "purchase",
        sourceEventId: "evt_h",
      }),
    );
    await expect(
      inA((tx) =>
        debit(tx, {
          accountId: A,
          amount: asCredits(5),
          eventType: "codegen_debit",
          // @ts-expect-error — a legacy specific type must NOT carry a feature tag (feature?: never)
          feature: "codegen_run",
          idempotencyKey: "leg_bad",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await inA((tx) => getLedger(tx, A))).length).toBe(1); // only the grant
  });

  test("legacy codegen_debit / ai_feature_debit are unchanged (feature is null)", async () => {
    await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: asCredits(100),
        eventType: "purchase",
        sourceEventId: "evt_l",
      }),
    );
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(30),
        eventType: "codegen_debit",
        idempotencyKey: "c1",
      }),
    );
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(10),
        eventType: "ai_feature_debit",
        idempotencyKey: "a1",
      }),
    );
    expect(await inA((tx) => balance(tx, A))).toBe(60);
    const ledger = await inA((tx) => getLedger(tx, A));
    expect(ledger.map((e) => e.event_type)).toEqual([
      "purchase",
      "codegen_debit",
      "ai_feature_debit",
    ]);
    // every legacy row carries a null feature (the iff CHECK + featureColumn agree)
    expect(ledger.every((e) => e.feature === null)).toBe(true);
  });
});

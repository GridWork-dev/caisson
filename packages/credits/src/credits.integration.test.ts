// P1 exit-gate proof (ADR-0007/0023): a credit debit is atomic + idempotent; an empty balance is
// 402; the ledger is append-only; the wallet is tenant-isolated. Composes withTenant + credits.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "@caisson/testing";
import { InsufficientCreditsError, ValidationError } from "@caisson/kernel";
import { withTenant } from "@caisson/tenancy-rls";
import {
  CREDIT_SCHEMA_SQL,
  balance,
  debit,
  getLedger,
  grant,
} from "./index.ts";

let tp: TestPg;
const A = "acct_a";
const B = "acct_b";

async function freshSchema(): Promise<void> {
  await tp.exec(
    `DROP TABLE IF EXISTS credit_event; DROP TABLE IF EXISTS credit_wallet;`,
  );
  await tp.exec(CREDIT_SCHEMA_SQL);
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

describe("credit wallet", () => {
  test("grant then debit moves the integer balance", async () => {
    expect(
      (
        await inA((tx) =>
          grant(tx, {
            accountId: A,
            amount: 100,
            eventType: "purchase",
            sourceEventId: "evt_buy",
          }),
        )
      ).balance,
    ).toBe(100);
    expect(
      (
        await inA((tx) =>
          debit(tx, {
            accountId: A,
            amount: 30,
            eventType: "codegen_debit",
            idempotencyKey: "gen_1",
          }),
        )
      ).balance,
    ).toBe(70);
    expect(await inA((tx) => balance(tx, A))).toBe(70);
  });

  test("an over-debit returns 402 and records nothing (debit-before-spend)", async () => {
    await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: 70,
        eventType: "topup",
        sourceEventId: "evt_top",
      }),
    );
    await expect(
      inA((tx) =>
        debit(tx, {
          accountId: A,
          amount: 100,
          eventType: "ai_feature_debit",
          idempotencyKey: "spend_x",
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(await inA((tx) => balance(tx, A))).toBe(70); // unchanged
    expect((await inA((tx) => getLedger(tx, A))).length).toBe(1); // only the grant
  });

  test("a retried grant (same source event) never double-grants", async () => {
    const first = await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: 50,
        eventType: "purchase",
        sourceEventId: "evt_dup",
      }),
    );
    const retry = await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: 50,
        eventType: "purchase",
        sourceEventId: "evt_dup",
      }),
    );
    expect(first.idempotent).toBe(false);
    expect(retry.idempotent).toBe(true);
    expect(await inA((tx) => balance(tx, A))).toBe(50);
    expect((await inA((tx) => getLedger(tx, A))).length).toBe(1);
  });

  test("a retried debit (same idempotency key) never double-debits", async () => {
    await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: 100,
        eventType: "purchase",
        sourceEventId: "evt_g",
      }),
    );
    const first = await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: 40,
        eventType: "codegen_debit",
        idempotencyKey: "k1",
      }),
    );
    const retry = await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: 40,
        eventType: "codegen_debit",
        idempotencyKey: "k1",
      }),
    );
    expect(first.balance).toBe(60);
    expect(retry).toEqual({ balance: 60, idempotent: true });
  });

  test("the ledger is append-only: sum(amount) equals the balance", async () => {
    await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: 100,
        eventType: "purchase",
        sourceEventId: "g1",
      }),
    );
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: 25,
        eventType: "codegen_debit",
        idempotencyKey: "d1",
      }),
    );
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: 15,
        eventType: "ai_feature_debit",
        idempotencyKey: "d2",
      }),
    );
    const ledger = await inA((tx) => getLedger(tx, A));
    const sum = ledger.reduce((acc, e) => acc + e.amount, 0);
    expect(sum).toBe(60);
    expect(await inA((tx) => balance(tx, A))).toBe(60);
    expect(ledger.map((e) => e.amount)).toEqual([100, -25, -15]);
  });

  test("one tenant cannot see another tenant's wallet (RLS)", async () => {
    await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: 100,
        eventType: "purchase",
        sourceEventId: "x",
      }),
    );
    const seenByB = await withTenant(tp.pg, B, (tx) => balance(tx, A));
    expect(seenByB).toBe(0); // B sees no wallet for A
  });

  test("rejects non-integer / non-positive amounts and bad idempotency", async () => {
    await expect(
      inA((tx) =>
        grant(tx, {
          accountId: A,
          amount: 0,
          eventType: "purchase",
          sourceEventId: "z1",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      inA((tx) =>
        grant(tx, {
          accountId: A,
          amount: 1.5,
          eventType: "purchase",
          sourceEventId: "z2",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    // neither idempotency source
    await expect(
      inA((tx) =>
        grant(tx, { accountId: A, amount: 10, eventType: "purchase" }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    // both idempotency sources
    await expect(
      inA((tx) =>
        grant(tx, {
          accountId: A,
          amount: 10,
          eventType: "purchase",
          sourceEventId: "s",
          idempotencyKey: "k",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

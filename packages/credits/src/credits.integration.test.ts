// P1 exit-gate proof (ADR-0007/0023): a credit debit is atomic + idempotent; an empty balance is
// 402; the ledger is append-only; the wallet is tenant-isolated. Composes withTenant + credits.
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
import {
  InsufficientCreditsError,
  ValidationError,
  asCredits,
} from "@caisson-sh/kernel";
import { withTenant } from "@caisson-sh/tenancy-rls";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
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

describe("credit wallet", () => {
  test("grant then debit moves the integer balance", async () => {
    expect(
      (
        await inA((tx) =>
          grant(tx, {
            accountId: A,
            amount: asCredits(100),
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
            amount: asCredits(30),
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
        amount: asCredits(70),
        eventType: "topup",
        sourceEventId: "evt_top",
      }),
    );
    await expect(
      inA((tx) =>
        debit(tx, {
          accountId: A,
          amount: asCredits(100),
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
        amount: asCredits(50),
        eventType: "purchase",
        sourceEventId: "evt_dup",
      }),
    );
    const retry = await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: asCredits(50),
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
        amount: asCredits(100),
        eventType: "purchase",
        sourceEventId: "evt_g",
      }),
    );
    const first = await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(40),
        eventType: "codegen_debit",
        idempotencyKey: "k1",
      }),
    );
    const retry = await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(40),
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
        amount: asCredits(100),
        eventType: "purchase",
        sourceEventId: "g1",
      }),
    );
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(25),
        eventType: "codegen_debit",
        idempotencyKey: "d1",
      }),
    );
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(15),
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
        amount: asCredits(100),
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
          amount: asCredits(0),
          eventType: "purchase",
          sourceEventId: "z1",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      inA((tx) =>
        grant(tx, {
          accountId: A,
          amount: asCredits(1.5),
          eventType: "purchase",
          sourceEventId: "z2",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    // neither idempotency source
    await expect(
      inA((tx) =>
        grant(tx, {
          accountId: A,
          amount: asCredits(10),
          eventType: "purchase",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    // both idempotency sources
    await expect(
      inA((tx) =>
        grant(tx, {
          accountId: A,
          amount: asCredits(10),
          eventType: "purchase",
          sourceEventId: "s",
          idempotencyKey: "k",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("rounding provenance (ADR-0212)", () => {
  type ProvenanceRow = {
    amount: number;
    rounding_raw: number | null;
    rounding_mode: string | null;
  };
  const rowsFor = (idem: string) =>
    tp.query<ProvenanceRow>(
      `SELECT amount, rounding_raw, rounding_mode FROM credit_event
       WHERE account_id = $1 AND idempotency_key = $2`,
      [A, idem],
    );

  test("a debit with a rounding record persists {raw, mode} beside the integer amount", async () => {
    await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: asCredits(100),
        eventType: "purchase",
        sourceEventId: "prov_seed",
      }),
    );
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(8),
        eventType: "ai_feature_debit",
        idempotencyKey: "prov_d1",
        rounding: { raw: 750, mode: "up", result: asCredits(8) },
      }),
    );
    const rows = await rowsFor("prov_d1");
    expect(rows).toEqual([
      { amount: -8, rounding_raw: 750, rounding_mode: "up" },
    ]);
  });

  test("a grant with a round-down record persists it; one without persists NULL/NULL", async () => {
    await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: asCredits(3),
        eventType: "topup",
        idempotencyKey: "prov_g1",
        rounding: { raw: 1, mode: "down", result: asCredits(3) },
      }),
    );
    await inA((tx) =>
      grant(tx, {
        accountId: A,
        amount: asCredits(50),
        eventType: "purchase",
        idempotencyKey: "prov_g2", // no rounding — an exact table integer (ADR-0089 §5)
      }),
    );
    expect(await rowsFor("prov_g1")).toEqual([
      { amount: 3, rounding_raw: 1, rounding_mode: "down" },
    ]);
    expect(await rowsFor("prov_g2")).toEqual([
      { amount: 50, rounding_raw: null, rounding_mode: null },
    ]);
  });

  test("the DB CHECKs reject a half-set pair and an unknown mode", async () => {
    // raw without mode → biconditional CHECK fails.
    await expect(
      tp.exec(
        `INSERT INTO credit_event (id, account_id, event_type, amount, source_event_id, rounding_raw)
         VALUES ('chk1', '${A}', 'topup', 1, 'chk_src_1', 5)`,
      ),
    ).rejects.toThrow(/credit_event_rounding_iff/);
    // an unknown mode → enum CHECK fails.
    await expect(
      tp.exec(
        `INSERT INTO credit_event (id, account_id, event_type, amount, source_event_id, rounding_raw, rounding_mode)
         VALUES ('chk2', '${A}', 'topup', 1, 'chk_src_2', 5, 'sideways')`,
      ),
    ).rejects.toThrow(/credit_event_rounding_mode/);
  });
});

// ADR-0245/0252 exit-gate proof: grant-level expiry + materialized FIFO burn. A debit walks
// unexpired grants oldest-first (`created_at, expires_at, id`), writes grant_consumption rows,
// splits across grants, and never draws from an expired grant; the sweep burns expired residue
// exactly once; the T-30d notice fires exactly once per grant; the badge read sums unexpired
// remaining inside the window.
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
import { InsufficientCreditsError, asCredits } from "@caisson-sh/kernel";
import { withTenant, type Transactor } from "@caisson-sh/tenancy-rls";
import { createInMemoryQueue } from "@caisson-sh/jobs";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  balance,
  clawback,
  debit,
  expiringSoon,
  getLedger,
  grant,
  spendableBalance,
  sweepExpiredGrants,
  sweepExpiryNotices,
} from "./index.ts";
import {
  CREDIT_EXPIRY_NOTICE_TASK,
  defineCreditExpiryNoticeTask,
  enqueueCreditExpiryNotice,
} from "./expiry-task.ts";

let tp: TestPg;
const A = "acct_a";

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number): Date => new Date(Date.now() + n * DAY);

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

/** Superuser read of the consumption trail for one grant (bypasses RLS — ground truth). */
const consumptionFor = (grantId: string) =>
  tp.query<{ amount: number }>(
    `SELECT amount FROM grant_consumption WHERE grant_event_id = $1 ORDER BY created_at, id`,
    [grantId],
  );

async function grantWithExpiry(
  amount: number,
  key: string,
  expiresAt?: Date,
): Promise<string> {
  await inA((tx) =>
    grant(tx, {
      accountId: A,
      amount: asCredits(amount),
      eventType: "topup",
      idempotencyKey: key,
      ...(expiresAt ? { expiresAt } : {}),
    }),
  );
  const r = await tp.query<{ id: string }>(
    `SELECT id FROM credit_event WHERE account_id = $1 AND idempotency_key = $2`,
    [A, key],
  );
  const id = r[0]?.id;
  if (id === undefined) throw new Error("grant row missing");
  return id;
}

describe("grant expiry stamping", () => {
  test("a grant defaults expires_at to ~12 months out; an override wins", async () => {
    const g1 = await grantWithExpiry(10, "g_default");
    const g2 = await grantWithExpiry(10, "g_override", inDays(5));
    const rows = await tp.query<{ id: string; expires_at: Date }>(
      `SELECT id, expires_at FROM credit_event WHERE account_id = $1 AND amount > 0`,
      [A],
    );
    const byId = new Map(rows.map((r) => [r.id, r.expires_at]));
    const months =
      (byId.get(g1)!.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000);
    expect(months).toBeGreaterThan(11);
    expect(months).toBeLessThan(13);
    const overrideDelta = byId.get(g2)!.getTime() - inDays(5).getTime();
    expect(Math.abs(overrideDelta)).toBeLessThan(60 * 1000);
  });
});

describe("FIFO burn (ADR-0252 Decision 2/3)", () => {
  test("a debit draws from the oldest grant first and records consumption", async () => {
    const g1 = await grantWithExpiry(50, "fifo_g1");
    // A later grant (strictly later created_at — separate transactions).
    const g2 = await grantWithExpiry(50, "fifo_g2");
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(30),
        eventType: "codegen_debit",
        idempotencyKey: "fifo_d1",
      }),
    );
    expect((await consumptionFor(g1)).map((r) => r.amount)).toEqual([30]);
    expect(await consumptionFor(g2)).toEqual([]);
  });

  test("a debit splits across grants when the oldest remainder cannot cover it", async () => {
    const g1 = await grantWithExpiry(20, "split_g1");
    const g2 = await grantWithExpiry(50, "split_g2");
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(35),
        eventType: "codegen_debit",
        idempotencyKey: "split_d1",
      }),
    );
    expect((await consumptionFor(g1)).map((r) => r.amount)).toEqual([20]);
    expect((await consumptionFor(g2)).map((r) => r.amount)).toEqual([15]);
    expect(await inA((tx) => balance(tx, A))).toBe(35);
  });

  test("on an issue-time tie the sooner-expiring grant burns first (multi-line cart case)", async () => {
    // Two grants in ONE transaction — byte-identical created_at (pg now() is tx-constant).
    await inA(async (tx) => {
      await grant(tx, {
        accountId: A,
        amount: asCredits(10),
        eventType: "topup",
        idempotencyKey: "tie_late",
        expiresAt: inDays(300),
      });
      await grant(tx, {
        accountId: A,
        amount: asCredits(10),
        eventType: "topup",
        idempotencyKey: "tie_soon",
        expiresAt: inDays(20),
      });
    });
    const ids = await tp.query<{ id: string; idempotency_key: string }>(
      `SELECT id, idempotency_key FROM credit_event WHERE account_id = $1 AND amount > 0`,
      [A],
    );
    const soon = ids.find((r) => r.idempotency_key === "tie_soon")!.id;
    const late = ids.find((r) => r.idempotency_key === "tie_late")!.id;
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(5),
        eventType: "codegen_debit",
        idempotencyKey: "tie_d1",
      }),
    );
    expect((await consumptionFor(soon)).map((r) => r.amount)).toEqual([5]);
    expect(await consumptionFor(late)).toEqual([]);
  });

  test("a debit NEVER draws from an expired grant: 402 even when the wallet aggregate covers it", async () => {
    await grantWithExpiry(100, "exp_g1", new Date(Date.now() - DAY)); // already expired
    await grantWithExpiry(10, "exp_g2"); // spendable
    // Wallet aggregate is 110 (the sweep hasn't run), but only 10 is spendable.
    expect(await inA((tx) => balance(tx, A))).toBe(110);
    await expect(
      inA((tx) =>
        debit(tx, {
          accountId: A,
          amount: asCredits(50),
          eventType: "codegen_debit",
          idempotencyKey: "exp_d1",
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);
    // Rollback left no trace: no debit row, no consumption rows.
    expect((await inA((tx) => getLedger(tx, A))).length).toBe(2);
    // A debit within the unexpired remaining still works.
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(10),
        eventType: "codegen_debit",
        idempotencyKey: "exp_d2",
      }),
    );
    expect(await inA((tx) => balance(tx, A))).toBe(100);
  });

  test("a retried debit stays idempotent and writes no second consumption trail", async () => {
    const g1 = await grantWithExpiry(50, "idem_g1");
    for (const _ of [1, 2]) {
      await inA((tx) =>
        debit(tx, {
          accountId: A,
          amount: asCredits(20),
          eventType: "codegen_debit",
          idempotencyKey: "idem_d1",
        }),
      );
    }
    expect((await consumptionFor(g1)).map((r) => r.amount)).toEqual([20]);
    expect(await inA((tx) => balance(tx, A))).toBe(30);
  });
});

describe("expiry sweep (ADR-0252 Decision 5)", () => {
  test("expired residue is burned once via an expiry_debit event; replay is a no-op", async () => {
    const g1 = await grantWithExpiry(100, "sw_g1", new Date(Date.now() - DAY));
    await grantWithExpiry(40, "sw_g2");
    const first = await inA((tx) => sweepExpiredGrants(tx, A));
    expect(first).toEqual({ grantsExpired: 1, creditsExpired: 100 });
    expect(await inA((tx) => balance(tx, A))).toBe(40);
    expect((await consumptionFor(g1)).map((r) => r.amount)).toEqual([100]);
    const ledger = await inA((tx) => getLedger(tx, A));
    expect(ledger.filter((e) => e.event_type === "expiry_debit").length).toBe(
      1,
    );
    expect(ledger.reduce((acc, e) => acc + e.amount, 0)).toBe(40); // sum == balance
    // Replay: nothing left to burn.
    const second = await inA((tx) => sweepExpiredGrants(tx, A));
    expect(second).toEqual({ grantsExpired: 0, creditsExpired: 0 });
    expect(await inA((tx) => balance(tx, A))).toBe(40);
  });

  test("a partially spent expired grant only burns its residue", async () => {
    await grantWithExpiry(50, "part_g1", inDays(1));
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(30),
        eventType: "codegen_debit",
        idempotencyKey: "part_d1",
      }),
    );
    // Force the grant past expiry (test-only ground-truth mutation, superuser).
    await tp.exec(
      `UPDATE credit_event SET expires_at = now() - interval '1 hour' WHERE amount > 0`,
    );
    const swept = await inA((tx) => sweepExpiredGrants(tx, A));
    expect(swept).toEqual({ grantsExpired: 1, creditsExpired: 20 });
    expect(await inA((tx) => balance(tx, A))).toBe(0);
  });

  test("a clawback-drained wallet bounds the burn and never goes negative", async () => {
    await grantWithExpiry(100, "cl_g1", new Date(Date.now() - DAY));
    await inA((tx) =>
      clawback(tx, {
        accountId: A,
        amount: 70,
        sourceEventId: "cl_refund",
      }),
    );
    expect(await inA((tx) => balance(tx, A))).toBe(30);
    const swept = await inA((tx) => sweepExpiredGrants(tx, A));
    expect(swept).toEqual({ grantsExpired: 1, creditsExpired: 30 });
    expect(await inA((tx) => balance(tx, A))).toBe(0);
    // Replay after the drain: the idempotency key is spent — no double burn.
    const again = await inA((tx) => sweepExpiredGrants(tx, A));
    expect(again).toEqual({ grantsExpired: 0, creditsExpired: 0 });
  });
});

describe("expiring-soon badge read (ADR-0252 Decision 6a)", () => {
  test("sums unexpired remaining within the window only", async () => {
    await grantWithExpiry(100, "b_soon", inDays(10)); // in window
    await grantWithExpiry(50, "b_far", inDays(200)); // out of window
    await grantWithExpiry(25, "b_expired", new Date(Date.now() - DAY)); // expired
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(40),
        eventType: "codegen_debit",
        idempotencyKey: "b_d1",
      }),
    );
    // FIFO: the debit consumed 40 of b_soon (oldest, and expired grants are never drawn).
    const badge = await inA((tx) => expiringSoon(tx, A, 30));
    expect(badge.credits).toBe(60);
    expect(badge.soonestExpiresAt).not.toBeNull();
    const empty = await inA((tx) => expiringSoon(tx, A, 5));
    expect(empty).toEqual({ credits: 0, soonestExpiresAt: null });
  });
});

describe("spendableBalance (G37 — the dashboard balance tile stops overstating post-expiry)", () => {
  test("excludes an expired-but-unswept grant the raw wallet aggregate still counts", async () => {
    await grantWithExpiry(100, "spend_g_expired", new Date(Date.now() - DAY)); // expired, not yet swept
    await grantWithExpiry(40, "spend_g_live", inDays(200)); // spendable

    // Ground truth: the raw aggregate lags — it still carries the expired grant's 100 because the
    // once-daily sweep hasn't run. This IS the ~24h overstatement G37 fixes for the display.
    expect(await inA((tx) => balance(tx, A))).toBe(140);
    // spendableBalance reads the FIFO remaining-sum instead — matches what debit() can actually cover.
    expect(await inA((tx) => spendableBalance(tx, A))).toBe(40);
  });

  test("matches the raw aggregate once nothing has expired", async () => {
    await grantWithExpiry(30, "spend_g_a", inDays(100));
    await grantWithExpiry(20, "spend_g_b", inDays(200));
    expect(await inA((tx) => spendableBalance(tx, A))).toBe(50);
    expect(await inA((tx) => balance(tx, A))).toBe(50);
  });

  test("reflects partial consumption the same way the FIFO badge read does", async () => {
    await grantWithExpiry(50, "spend_g_partial", inDays(100));
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(20),
        eventType: "codegen_debit",
        idempotencyKey: "spend_d1",
      }),
    );
    expect(await inA((tx) => spendableBalance(tx, A))).toBe(30);
  });

  test("after the sweep runs, spendableBalance and the raw aggregate converge again", async () => {
    await grantWithExpiry(100, "spend_g_sweepme", new Date(Date.now() - DAY));
    await grantWithExpiry(40, "spend_g_keep", inDays(200));
    expect(await inA((tx) => spendableBalance(tx, A))).toBe(40);
    await inA((tx) => sweepExpiredGrants(tx, A));
    expect(await inA((tx) => balance(tx, A))).toBe(40);
    expect(await inA((tx) => spendableBalance(tx, A))).toBe(40);
  });

  test("a refund clawback on a partially-spent grant never leaves spendableBalance above the wallet (WR-01)", async () => {
    // clawback() writes NO grant_consumption row (it reverses a grant's value, not a FIFO spend —
    // see clawback's own doc comment), so the grant's naive FIFO remaining can outlive the wallet.
    await grantWithExpiry(100, "claw_g1", inDays(200));
    await inA((tx) =>
      debit(tx, {
        accountId: A,
        amount: asCredits(30),
        eventType: "codegen_debit",
        idempotencyKey: "claw_d1",
      }),
    );
    expect(await inA((tx) => balance(tx, A))).toBe(70);
    expect(await inA((tx) => spendableBalance(tx, A))).toBe(70); // pre-refund, both floors agree

    // A refund claws back the grant's ORIGINAL amount; clawback bounds to the CURRENT balance
    // (70), draining the wallet to 0 while the grant's own consumption trail is untouched.
    await inA((tx) =>
      clawback(tx, { accountId: A, amount: 100, sourceEventId: "claw_refund" }),
    );
    expect(await inA((tx) => balance(tx, A))).toBe(0);

    // The FIFO remaining-sum alone would still say 70 (100 granted - 30 consumed) — not spendable.
    // spendableBalance must report the WALLET floor (0), the same floor debit() would 402 against.
    expect(await inA((tx) => spendableBalance(tx, A))).toBe(0);
  });
});

describe("T-30d notice sweep (ADR-0252 Decision 6b)", () => {
  const captureEmailer = () => {
    const sent: {
      to: string;
      template: string;
      data: Record<string, unknown>;
    }[] = [];
    return {
      sent,
      async send(msg: {
        to: string;
        template: string;
        data: Record<string, unknown>;
      }): Promise<void> {
        sent.push(msg);
      },
    };
  };

  test("notifies once per grant; a replayed sweep sends nothing", async () => {
    await grantWithExpiry(120, "n_g1", inDays(10));
    await grantWithExpiry(50, "n_far", inDays(200));
    const emailer = captureEmailer();
    const input = {
      recipient: "buyer@example.com",
      emailer,
      dashboardUrl: "https://caisson.sh/dashboard/credits",
    };
    const sent1 = await inA((tx) => sweepExpiryNotices(tx, A, input));
    expect(sent1).toBe(1);
    expect(emailer.sent.length).toBe(1);
    const msg = emailer.sent[0]!;
    expect(msg.to).toBe("buyer@example.com");
    expect(msg.template).toBe("credits-expiring");
    expect(msg.data.credits).toBe(120);
    expect(typeof msg.data.expiresOn).toBe("string");
    const sent2 = await inA((tx) => sweepExpiryNotices(tx, A, input));
    expect(sent2).toBe(0);
    expect(emailer.sent.length).toBe(1);
  });

  test("the jobs task is driver-gated: a null emailer is an honest no-op", async () => {
    await grantWithExpiry(10, "n_gate", inDays(5));
    const queue = createInMemoryQueue([
      defineCreditExpiryNoticeTask({
        db: tp.pg as unknown as Transactor,
        emailer: null,
        recipientFor: () => Promise.resolve("buyer@example.com"),
        dashboardUrl: "https://caisson.sh/dashboard/credits",
      }),
    ]);
    await enqueueCreditExpiryNotice(queue, { accountId: A });
    // No marker was written — the notice is still owed once email is configured.
    const marks = await tp.query<{ grant_event_id: string }>(
      `SELECT grant_event_id FROM credit_expiry_notice`,
    );
    expect(marks.length).toBe(0);
  });

  test("the jobs task sends through the queue boundary with a strict payload", async () => {
    await grantWithExpiry(10, "n_task", inDays(5));
    const emailer = captureEmailer();
    const queue = createInMemoryQueue([
      defineCreditExpiryNoticeTask({
        db: tp.pg as unknown as Transactor,
        emailer,
        recipientFor: () => Promise.resolve("buyer@example.com"),
        dashboardUrl: "https://caisson.sh/dashboard/credits",
      }),
    ]);
    await enqueueCreditExpiryNotice(queue, { accountId: A });
    expect(emailer.sent.length).toBe(1);
    // An extra payload field is rejected at the .strict() queue boundary.
    await expect(
      queue.enqueue(CREDIT_EXPIRY_NOTICE_TASK, { accountId: A, extra: 1 }),
    ).rejects.toThrow();
  });
});

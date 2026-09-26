// Integration proof for the meter money path (ADR-0060/0007/0005). PGlite + the production
// `withTenant` shape, deterministic price book + clock, zero network: the reservation debits BEFORE
// the (mock) call; a short wallet 402s and writes nothing; reconcile trues the charge to actuals
// (refund or shortfall); a same-call retry settles once; a hard cap trips the breaker so the next
// reserve 402s. The live provider transport stays the only un-exercised path.
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
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  balance,
  grant,
} from "@caisson-sh/credits";
import {
  InsufficientCreditsError,
  asCredits,
  asMicroUsdPerCredit,
} from "@caisson-sh/kernel";
import { withTenant } from "@caisson-sh/tenancy-rls";
import {
  AI_METER_SCHEMA_SQL,
  SPEND_BREAKER_TABLE,
  SPEND_POLICY_TABLE,
  SpendCapError,
  TENANT_SPEND_WINDOW_TABLE,
  USAGE_EVENT_TABLE,
  reconcile,
  reserve,
  type MeterConfig,
} from "./index.ts";

let tp: TestPg;
const A = "acct_meter_a";

// A fixed price book + denomination + clock makes the integer math + window key deterministic.
// 1 input token = $1/MTok (1_000_000 micro/MTok); output 2×; 1 credit = 100 micro-USD.
const CFG: MeterConfig = {
  priceBook: {
    "test/model": {
      inputPerMTok: 1_000_000,
      cachedInputPerMTok: 500_000,
      outputPerMTok: 2_000_000,
    },
  },
  conversion: { microUsdPerCredit: asMicroUsdPerCredit(100) },
  now: new Date("2026-06-27T12:00:00Z"),
};
// content length 800 → ceil(800/4) = 200 input tokens; maxOutputTokens 100.
// estimate micro = 200(input) + 200(output) = 400 → ceil(400/100) = 4 reserved credits.
const MESSAGES = [{ role: "user", content: "x".repeat(800) }];

interface ActualUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

async function freshSchema(): Promise<void> {
  await tp.exec(
    [
      USAGE_EVENT_TABLE,
      TENANT_SPEND_WINDOW_TABLE,
      SPEND_POLICY_TABLE,
      SPEND_BREAKER_TABLE,
      "grant_consumption",
      "credit_expiry_notice",
      "credit_event",
      "credit_wallet",
    ]
      .map((t) => `DROP TABLE IF EXISTS ${t} CASCADE;`)
      .join("\n"),
  );
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await tp.exec(CREDIT_EXPIRY_MIGRATION_SQL);
  await tp.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
  await tp.exec(AI_METER_SCHEMA_SQL);
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

function reserveInput(callId: string) {
  return {
    accountId: A,
    callId,
    provider: "test",
    model: "model",
    lane: "default",
    messages: MESSAGES,
    maxOutputTokens: 100,
    config: CFG,
  };
}

function reconcileInput(
  callId: string,
  reservedCredits: number,
  usage: ActualUsage,
) {
  return {
    accountId: A,
    callId,
    provider: "test",
    model: "model",
    lane: "default",
    reservedCredits,
    usage,
    config: CFG,
  };
}

async function seed(amount: number): Promise<void> {
  await inA((tx) =>
    grant(tx, {
      accountId: A,
      amount: asCredits(amount),
      eventType: "purchase",
      sourceEventId: "seed",
    }),
  );
}

const SHORTFALL: ActualUsage = {
  inputTokens: 200,
  cachedInputTokens: 0,
  outputTokens: 300, // micro = 200 + 600 = 800 → 8 credits (> reserved 4)
};
const OVER_RESERVED: ActualUsage = {
  inputTokens: 100,
  cachedInputTokens: 0,
  outputTokens: 50, // micro = 100 + 100 = 200 → 2 credits (< reserved 4)
};

describe("reserve → reconcile money path", () => {
  test("the reservation debits BEFORE the call; reconcile trues a shortfall up to actual", async () => {
    await seed(1000);

    const r = await inA((tx) => reserve(tx, reserveInput("call_1")));
    expect(r.reservedCredits).toBe(4);
    expect(r.idempotent).toBe(false);
    expect(r.balance).toBe(996); // debited up front, before any provider call
    expect(await inA((tx) => balance(tx, A))).toBe(996);

    const rc = await inA((tx) =>
      reconcile(tx, reconcileInput("call_1", r.reservedCredits, SHORTFALL)),
    );
    expect(rc.actualCredits).toBe(8);
    expect(rc.costMicroUsd).toBe(800);
    expect(rc.deltaCredits).toBe(4);
    expect(rc.chargedCredits).toBe(4);
    expect(rc.refundedCredits).toBe(0);
    expect(rc.balance).toBe(992); // 1000 − actual 8
    expect(await inA((tx) => balance(tx, A))).toBe(992);

    const rows = await tp.query<{ credits: number; cost_micro_usd: number }>(
      `SELECT credits, cost_micro_usd FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.credits).toBe(8);
    expect(rows[0]?.cost_micro_usd).toBe(800);

    // ADR-0212: both meter ledger rows persist rounding provenance — the reserve debit carries the
    // ESTIMATE's ceil (400 micro-USD → 4 credits), the reconcile shortfall carries the ACTUAL's
    // (800 micro-USD → 8 credits). Both record this book's fixed direction, "up".
    const ledger = await tp.query<{
      idempotency_key: string;
      amount: number;
      rounding_raw: number | null;
      rounding_mode: string | null;
    }>(
      `SELECT idempotency_key, amount, rounding_raw, rounding_mode FROM credit_event
       WHERE account_id = $1 AND idempotency_key IS NOT NULL ORDER BY idempotency_key`,
      [A],
    );
    expect(ledger).toEqual([
      {
        idempotency_key: "call_1:reconcile",
        amount: -4,
        rounding_raw: 800,
        rounding_mode: "up",
      },
      {
        idempotency_key: "call_1:reserve",
        amount: -4,
        rounding_raw: 400,
        rounding_mode: "up",
      },
    ]);
  });

  test("reconcile refunds an over-reservation via feature_grant", async () => {
    await seed(1000);
    const r = await inA((tx) => reserve(tx, reserveInput("call_r")));
    expect(r.balance).toBe(996);

    const rc = await inA((tx) =>
      reconcile(tx, reconcileInput("call_r", r.reservedCredits, OVER_RESERVED)),
    );
    expect(rc.actualCredits).toBe(2);
    expect(rc.deltaCredits).toBe(-2);
    expect(rc.refundedCredits).toBe(2);
    expect(rc.chargedCredits).toBe(0);
    expect(rc.balance).toBe(998); // 1000 − actual 2
    expect(await inA((tx) => balance(tx, A))).toBe(998);
  });
});

describe("fail-closed credit gate", () => {
  test("a short wallet → 402 (InsufficientCreditsError) and the reservation writes nothing", async () => {
    await seed(3); // < reserved 4

    await expect(
      inA((tx) => reserve(tx, reserveInput("call_short"))),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    expect(await inA((tx) => balance(tx, A))).toBe(3); // untouched
    const usage = await tp.query(
      `SELECT 1 FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(usage).toHaveLength(0);
    const win = await tp.query(
      `SELECT 1 FROM ${TENANT_SPEND_WINDOW_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(win).toHaveLength(0);
    const debits = await tp.query(
      `SELECT 1 FROM credit_event WHERE account_id = $1 AND event_type = 'feature_debit'`,
      [A],
    );
    expect(debits).toHaveLength(0); // only the seed grant survived
  });
});

describe("idempotency — settle exactly once", () => {
  test("a same-call reserve retry does not double-debit or double-count the window", async () => {
    await seed(1000);
    const first = await inA((tx) => reserve(tx, reserveInput("call_dup")));
    const retry = await inA((tx) => reserve(tx, reserveInput("call_dup")));
    expect(first.idempotent).toBe(false);
    expect(retry.idempotent).toBe(true);
    expect(retry.balance).toBe(996); // debited once
    expect(await inA((tx) => balance(tx, A))).toBe(996);

    const win = await tp.query<{ spent: number }>(
      `SELECT spent FROM ${TENANT_SPEND_WINDOW_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(win).toHaveLength(1);
    expect(win[0]?.spent).toBe(4); // bumped once, not twice
  });

  test("a same-call reconcile retry settles once (one usage row, one settlement)", async () => {
    await seed(1000);
    const r = await inA((tx) => reserve(tx, reserveInput("call_rc")));
    const first = await inA((tx) =>
      reconcile(tx, reconcileInput("call_rc", r.reservedCredits, SHORTFALL)),
    );
    const retry = await inA((tx) =>
      reconcile(tx, reconcileInput("call_rc", r.reservedCredits, SHORTFALL)),
    );
    expect(first.idempotent).toBe(false);
    expect(retry.idempotent).toBe(true);
    expect(first.balance).toBe(992);
    expect(retry.balance).toBe(992); // no double charge
    expect(await inA((tx) => balance(tx, A))).toBe(992);

    const rows = await tp.query(
      `SELECT 1 FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1); // single append-only actuals row
    const settle = await tp.query(
      `SELECT 1 FROM credit_event WHERE account_id = $1 AND idempotency_key = 'call_rc:reconcile'`,
      [A],
    );
    expect(settle).toHaveLength(1);
  });
});

describe("soft cap → warning without tripping the breaker", () => {
  test("crossing the soft cap while staying under the hard cap warns but does not throw or trip", async () => {
    await seed(1000);
    await inA((tx) =>
      tx.query(
        `INSERT INTO ${SPEND_POLICY_TABLE}
           (account_id, scope, unit, window_granularity, soft_limit, hard_limit)
         VALUES ($1, 'account', 'credits', 'day', 4, 100)`,
        [A],
      ),
    );

    // One reserve costs 4 credits (see MESSAGES/CFG above): spent lands exactly on soft_limit 4,
    // far under hard_limit 100 — a warning signal, not a block.
    const r = await inA((tx) => reserve(tx, reserveInput("soft_1")));
    expect(r.spent).toBe(4);
    expect(r.softExceeded).toBe(true);
    expect(r.breakerTripped).toBe(false);

    // The breaker never tripped — no row exists (absence of a row is "closed", per readBreaker).
    const brk = await tp.query(
      `SELECT 1 FROM ${SPEND_BREAKER_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(brk).toHaveLength(0);
  });
});

describe("hard cap → circuit breaker", () => {
  test("crossing a hard spend cap trips the breaker; the next reserve returns 402", async () => {
    await seed(1000);
    await inA((tx) =>
      tx.query(
        `INSERT INTO ${SPEND_POLICY_TABLE}
           (account_id, scope, unit, window_granularity, soft_limit, hard_limit)
         VALUES ($1, 'account', 'credits', 'day', NULL, 8)`,
        [A],
      ),
    );

    const r1 = await inA((tx) => reserve(tx, reserveInput("cap_1")));
    expect(r1.spent).toBe(4);
    expect(r1.breakerTripped).toBe(false);

    const r2 = await inA((tx) => reserve(tx, reserveInput("cap_2")));
    expect(r2.spent).toBe(8);
    expect(r2.breakerTripped).toBe(true); // 8 >= hard 8 → trips

    const brk = await tp.query<{ state: string }>(
      `SELECT state FROM ${SPEND_BREAKER_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(brk[0]?.state).toBe("open");

    const balBefore = await inA((tx) => balance(tx, A));
    let caught: unknown;
    try {
      await inA((tx) => reserve(tx, reserveInput("cap_3")));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SpendCapError);
    expect((caught as SpendCapError).httpStatus).toBe(402);
    // the blocked reserve never debited
    expect(await inA((tx) => balance(tx, A))).toBe(balBefore);
  });
});

describe("BYOK lane — $0 wallet, metering still runs (ADR-0182)", () => {
  test("a BYOK reserve+reconcile never moves the wallet, but records usage and advances the window/cap", async () => {
    await seed(1000);
    // A day-granularity policy whose hard cap the BYOK actual will cross — the cap must still evaluate.
    await inA((tx) =>
      tx.query(
        `INSERT INTO ${SPEND_POLICY_TABLE}
           (account_id, scope, unit, window_granularity, soft_limit, hard_limit)
         VALUES ($1, 'account', 'credits', 'day', NULL, 8)`,
        [A],
      ),
    );

    const r = await inA((tx) =>
      reserve(tx, { ...reserveInput("byok_1"), keySource: "tenant" }),
    );
    expect(r.reservedCredits).toBe(4);
    expect(r.balance).toBe(1000); // BYOK: wallet untouched at reserve
    expect(r.spent).toBe(0); // BYOK does not pre-count at reserve — it accrues at reconcile
    expect(await inA((tx) => balance(tx, A))).toBe(1000);

    const rc = await inA((tx) =>
      reconcile(tx, {
        ...reconcileInput("byok_1", r.reservedCredits, SHORTFALL),
        keySource: "tenant",
        windowKey: r.windowKey,
      }),
    );
    expect(rc.actualCredits).toBe(8);
    expect(rc.deltaCredits).toBe(4);
    expect(rc.chargedCredits).toBe(0); // BYOK: no wallet movement at reconcile either
    expect(rc.refundedCredits).toBe(0);
    expect(rc.balance).toBe(1000); // wallet STILL untouched after reconcile
    expect(rc.spent).toBe(8); // window trued to actual — cap accounting advanced
    expect(rc.breakerTripped).toBe(true); // the cap still evaluates (8 >= hard 8)
    expect(await inA((tx) => balance(tx, A))).toBe(1000);

    // The usage_event is recorded with the REAL token cost — metering is not the billing signal.
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.credits).toBe(8);

    // No wallet ledger row was written for the BYOK call (neither a debit nor a grant).
    const ledger = await tp.query(
      `SELECT 1 FROM credit_event
         WHERE account_id = $1 AND event_type IN ('feature_debit', 'feature_grant')`,
      [A],
    );
    expect(ledger).toHaveLength(0);
  });

  test("a same-callId BYOK reserve retry does not double-count the spend window", async () => {
    await seed(1000);
    // Hard cap 4: a double-counted BYOK reserve (4 + 4 = 8) would falsely trip it; a correct one never does.
    await inA((tx) =>
      tx.query(
        `INSERT INTO ${SPEND_POLICY_TABLE}
           (account_id, scope, unit, window_granularity, soft_limit, hard_limit)
         VALUES ($1, 'account', 'credits', 'day', NULL, 4)`,
        [A],
      ),
    );

    const first = await inA((tx) =>
      reserve(tx, { ...reserveInput("byok_retry"), keySource: "tenant" }),
    );
    const second = await inA((tx) =>
      reserve(tx, { ...reserveInput("byok_retry"), keySource: "tenant" }),
    );

    // BYOK moves nothing at reserve, so a retried callId cannot bump the window or trip the cap.
    expect(first.spent).toBe(0);
    expect(second.spent).toBe(0);
    expect(second.breakerTripped).toBe(false);
    expect(await inA((tx) => balance(tx, A))).toBe(1000); // wallet untouched by either reserve

    const win = await tp.query<{ spent: number }>(
      `SELECT spent FROM ${TENANT_SPEND_WINDOW_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(win[0]?.spent ?? 0).toBe(0);
  });
});

describe("window bucket is fixed at reserve (no boundary misattribution)", () => {
  test("a call reserving before a day boundary and reconciling after trues into the RESERVE bucket", async () => {
    await seed(1000);
    await inA((tx) =>
      tx.query(
        `INSERT INTO ${SPEND_POLICY_TABLE}
           (account_id, scope, unit, window_granularity, soft_limit, hard_limit)
         VALUES ($1, 'account', 'credits', 'day', NULL, 8)`,
        [A],
      ),
    );

    const reserveCfg: MeterConfig = {
      ...CFG,
      now: new Date("2026-06-27T23:59:59Z"),
    };
    const reconcileCfg: MeterConfig = {
      ...CFG,
      now: new Date("2026-06-28T00:00:01Z"),
    };

    const r = await inA((tx) =>
      reserve(tx, { ...reserveInput("bnd_1"), config: reserveCfg }),
    );
    expect(r.windowKey).toBe("2026-06-27");
    expect(r.spent).toBe(4);

    // Reconcile the NEXT day. Threading the reserve bucket keeps the delta in 2026-06-27; recomputing
    // it from the reconcile clock would split the spend across two buckets and undercount the cap.
    const rc = await inA((tx) =>
      reconcile(tx, {
        ...reconcileInput("bnd_1", r.reservedCredits, SHORTFALL),
        config: reconcileCfg,
        windowKey: r.windowKey,
      }),
    );
    expect(rc.spent).toBe(8); // 4 reserve + 4 delta, all in the reserve-day bucket
    expect(rc.breakerTripped).toBe(true); // the cap sees the FULL 8, not a split 4 / 4

    const buckets = await tp.query<{ window_key: string; spent: number }>(
      `SELECT window_key, spent FROM ${TENANT_SPEND_WINDOW_TABLE}
         WHERE account_id = $1 ORDER BY window_key`,
      [A],
    );
    expect(buckets).toHaveLength(1); // one bucket — the spend never split across the day boundary
    expect(buckets[0]?.window_key).toBe("2026-06-27");
    expect(buckets[0]?.spent).toBe(8);
  });
});

describe("concurrent reserves — atomic spend window", () => {
  test("N concurrent reserve() calls on one account/scope/window land every increment (no lost updates)", async () => {
    const N = 10;
    await seed(1000); // covers N * 4 reserved credits below

    // Distinct callIds (so none short-circuits as an idempotent replay) but the SAME
    // account/scope/window — every reserve contends on the one tenant_spend_window row.
    // NOTE: PGlite is a single in-process connection that serializes these transactions, so this
    // proves the atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` SQL is correct under
    // interleaving (no lost increment from a read-modify-write), NOT a true multi-process
    // OS-level race — same caveat as the I5 clawback / rate-limit-store concurrent tests.
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        inA((tx) => reserve(tx, reserveInput(`concurrent_${i}`))),
      ),
    );

    const totalReserved = results.reduce(
      (sum, r) => sum + r.reservedCredits,
      0,
    );
    expect(totalReserved).toBe(N * 4);

    const win = await tp.query<{ spent: number }>(
      `SELECT spent FROM ${TENANT_SPEND_WINDOW_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(win).toHaveLength(1);
    expect(win[0]?.spent).toBe(totalReserved); // every concurrent increment landed
  });
});

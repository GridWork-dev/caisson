// The credits poke's checkable claims, now that it drives the REAL @caisson-sh/credits FIFO planner
// and the hand-ported mirror (credits-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — proven by a STATIC SOURCE-GRAPH WALK, never by a
//      build (a bundler does not fail on a node builtin, it SUBSTITUTES a polyfill, exit 0).
//   2. The database half of the money seam (credits.ts, tenancy-rls, jobs, the schema DDL) is
//      unreachable from the client entry — the entry exists to keep it out.
//   3. The sample wallet's vocabulary is the package's own GRANT_EVENT_TYPES / DEBIT_EVENT_TYPES.
//   4. The FIFO attribution the UI renders IS `planFifoDebit`'s output, not a restated waterfall.
//   5. Golden parity against the REAL DB-bound `debit()` on PGlite: the same script of debits
//      leaves the same balance, and the same overdraw produces the same typed 402 (required /
//      balance), with nothing recorded on either side. This is the load-bearing one — it proves
//      the pure half and the database half still agree after the carve.
//
// Only order-INDEPENDENT observables are compared against the DB (balance-after and the 402's
// required/balance), so a same-microsecond created_at tie in PGlite can never make this flaky.
import { join } from "node:path";
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
import {
  nodeBuiltinTaint,
  nodeGlobalTaint,
} from "@caisson-sh/testing/module-graph";
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
  DEBIT_EVENT_TYPES,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  GRANT_EVENT_TYPES,
  balance as realBalanceRead,
  debit as realDebit,
  grant as realGrant,
} from "@caisson-sh/credits";
import { planFifoDebit } from "@caisson-sh/credits/browser";

import {
  DEBIT_PRESETS,
  OVERDRAW_PRESET,
  SAMPLE_GRANTS,
  applyDebit,
  initialWallet,
  remaining,
  verdictLine,
  walletBalance,
  type SpendableDebitType,
  type Wallet,
} from "./credits-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "credits-poke.tsx");
const ACCT = "acct_credits_poke";

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
  });

  test("no edge was silently skipped — every declined edge would land in `unresolved`", () => {
    expect(walk.unresolved).toEqual([]);
  });

  test("no package or poke module introduces an untracked node global", () => {
    expect(
      nodeGlobalTaint(walk.files, { workspaceRoot: WORKSPACE_ROOT }),
    ).toEqual([{ file: "packages/kernel/src/config.ts", spec: "process" }]);
  });

  test("the walk really crossed into the packages, past the first hop", () => {
    expect(walk.files).toContain("packages/credits/src/fifo.ts");
    expect(walk.files).toContain("packages/kernel/src/errors.ts");
  });

  test("the database half of the money seam never enters the client graph", () => {
    expect(walk.files).not.toContain("packages/credits/src/credits.ts");
    expect(walk.files).not.toContain("packages/credits/src/schema.ts");
    expect(walk.files.some((f) => f.startsWith("packages/tenancy-rls/"))).toBe(
      false,
    );
    expect(walk.files.some((f) => f.startsWith("packages/jobs/"))).toBe(false);
    expect(
      walk.files
        .filter((file) => file.startsWith("packages/credits/src/"))
        .sort(),
    ).toEqual([
      "packages/credits/src/browser.ts",
      "packages/credits/src/fifo.ts",
    ]);
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // A new entry here means a non-workspace dependency joined the client graph — a review event,
    // not a silent hole in the proof.
    expect(walk.external).toEqual(["react", "zod"]);
  });

  test("positive control: the same walker reports real builtins on a tainted entry", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/credits/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(
      tainted.offenders.some(
        (o) =>
          o.file === "packages/credits/src/credits.ts" &&
          o.spec === "node:crypto",
      ),
    ).toBe(true);
  });
});

describe("the sample wallet speaks the package's own vocabulary", () => {
  test("every sample grant line is a real GRANT_EVENT_TYPES member, one per member", () => {
    expect(SAMPLE_GRANTS.map((g) => g.eventType)).toEqual([
      ...GRANT_EVENT_TYPES,
    ]);
  });

  test("every preset debit type is a real DEBIT_EVENT_TYPES member", () => {
    const types: readonly string[] = DEBIT_EVENT_TYPES;
    for (const preset of [...DEBIT_PRESETS, OVERDRAW_PRESET]) {
      expect(types).toContain(preset.eventType);
    }
  });

  test("the sample wallet is 200 integer credits with the feature grant tagged", () => {
    expect(SAMPLE_GRANTS.reduce((s, g) => s + g.amount, 0)).toBe(200);
    expect(SAMPLE_GRANTS.every((g) => Number.isInteger(g.amount))).toBe(true);
    expect(
      SAMPLE_GRANTS.find((g) => g.eventType === "feature_grant")?.feature,
    ).toBe("evidence_pack");
  });
});

describe("the rendered FIFO attribution IS the package's plan, not a restated one", () => {
  test("applyDebit's ledger draws are exactly planFifoDebit's draws", () => {
    let wallet = initialWallet();
    for (const preset of DEBIT_PRESETS) {
      const expected = planFifoDebit(
        wallet.grants.map((g) => ({ id: g.id, remaining: remaining(g) })),
        preset.amount,
      );
      const outcome = applyDebit(wallet, preset.amount, preset.eventType);
      expect(outcome.line?.draws).toEqual(expected.draws);
      wallet = outcome.wallet;
    }
  });

  test("debits drain the grant lines oldest-first, splitting across lines", () => {
    let w = initialWallet();

    w = applyDebit(w, 30, "codegen_debit").wallet;
    expect(w.ledger[0]?.draws).toEqual([{ grantId: "g1", taken: 30 }]);

    w = applyDebit(w, 90, "ai_feature_debit").wallet;
    expect(w.ledger[0]?.draws).toEqual([{ grantId: "g1", taken: 90 }]);
    const g1 = w.grants.find((g) => g.id === "g1");
    expect(g1?.consumed).toBe(120);
    expect(g1 ? remaining(g1) : -1).toBe(0);

    w = applyDebit(w, 60, "codegen_debit").wallet;
    expect(w.ledger[0]?.draws).toEqual([
      { grantId: "g2", taken: 40 },
      { grantId: "g3", taken: 15 },
      { grantId: "g4", taken: 5 },
    ]);
    expect(walletBalance(w)).toBe(20);
  });

  test("a drained grant line contributes no draw (the DB CHECK forbids a zero-credit row)", () => {
    const drained = applyDebit(initialWallet(), 120, "codegen_debit").wallet;
    const next = applyDebit(drained, 10, "codegen_debit");
    expect(next.line?.draws).toEqual([{ grantId: "g2", taken: 10 }]);
  });

  test("the real planner rejects a non-integer or non-positive amount", () => {
    for (const bad of [0, -5, 1.5]) {
      expect(() => applyDebit(initialWallet(), bad, "codegen_debit")).toThrow();
    }
  });

  test("a malformed demo remainder fails before it can mutate the wallet", () => {
    const wallet = initialWallet();
    const malformed: Wallet = {
      ...wallet,
      grants: wallet.grants.map((grant, index) =>
        index === 0 ? { ...grant, consumed: Number.NaN } : grant,
      ),
    };
    expect(() => applyDebit(malformed, 1, "codegen_debit")).toThrow(
      ValidationError,
    );
    expect(malformed.ledger).toEqual([]);
  });

  test("a failed debit returns the wallet unchanged (debit-before-spend)", () => {
    const w = initialWallet();
    const outcome = applyDebit(w, 500, "codegen_debit");
    expect(outcome.wallet).toBe(w);
    expect(outcome.wallet.ledger.length).toBe(0);
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

  test("the 402 the UI renders is the real kernel error, carrying the plan's own numbers", () => {
    const outcome = applyDebit(initialWallet(), 500, "codegen_debit");
    expect(outcome.error).toBeInstanceOf(InsufficientCreditsError);
    expect(outcome.error?.code).toBe("insufficient_credits");
    expect(outcome.error?.httpStatus).toBe(402);
    expect(outcome.error?.details).toEqual({ required: 500, balance: 200 });
  });
});

describe("golden parity: the poke tracks the REAL DB-bound debit", () => {
  let tp: TestPg;

  beforeAll(async () => {
    tp = await newTestPg();
  });

  afterAll(async () => {
    await tp.close();
  });

  async function freshSchema(): Promise<void> {
    await tp.exec(
      `DROP TABLE IF EXISTS grant_consumption; DROP TABLE IF EXISTS credit_expiry_notice; DROP TABLE IF EXISTS credit_event; DROP TABLE IF EXISTS credit_wallet;`,
    );
    await tp.exec(CREDIT_SCHEMA_SQL);
    await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
    await tp.exec(CREDIT_EXPIRY_MIGRATION_SQL);
    await tp.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
  }

  beforeEach(freshSchema);

  /** Grant the exact SAMPLE_GRANTS lines, each in its own transaction (FIFO by created_at). */
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

  const realDebitStep = (
    amount: number,
    eventType: SpendableDebitType,
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

  test("balance after every preset debit matches the real ledger", async () => {
    await grantSample();
    let wallet: Wallet = initialWallet();

    expect(walletBalance(wallet)).toBe(200);
    expect(await readRealBalance()).toBe(200);

    let step = 0;
    for (const preset of DEBIT_PRESETS) {
      step += 1;
      const real = await realDebitStep(
        preset.amount,
        preset.eventType,
        `d${step}`,
      );
      const outcome = applyDebit(wallet, preset.amount, preset.eventType);
      expect(outcome.ok).toBe(true);
      wallet = outcome.wallet;
      expect(walletBalance(wallet)).toBe(real.balance);
    }
    expect(walletBalance(wallet)).toBe(20);
    expect(await readRealBalance()).toBe(20);
  });

  test("overdrawing the drained wallet 402s identically and records nothing", async () => {
    await grantSample();
    let wallet: Wallet = initialWallet();
    let step = 0;
    for (const preset of DEBIT_PRESETS) {
      step += 1;
      await realDebitStep(preset.amount, preset.eventType, `d${step}`);
      wallet = applyDebit(wallet, preset.amount, preset.eventType).wallet;
    }

    const outcome = applyDebit(
      wallet,
      OVERDRAW_PRESET.amount,
      OVERDRAW_PRESET.eventType,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.error?.details).toEqual({ required: 500, balance: 20 });
    expect(walletBalance(outcome.wallet)).toBe(20);

    const realErr: unknown = await realDebitStep(
      500,
      "codegen_debit",
      "over",
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect(realErr).toBeInstanceOf(InsufficientCreditsError);
    expect((realErr as InsufficientCreditsError).details).toEqual({
      required: 500,
      balance: 20,
    });
    expect(await readRealBalance()).toBe(20);
  });

  test("a debit larger than a full fresh wallet 402s with balance = the full 200 sample", async () => {
    await grantSample();
    const outcome = applyDebit(initialWallet(), 500, "codegen_debit");
    expect(outcome.error?.details).toEqual({ required: 500, balance: 200 });

    const realErr: unknown = await realDebitStep(
      500,
      "codegen_debit",
      "o1",
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect((realErr as InsufficientCreditsError).details).toEqual({
      required: 500,
      balance: 200,
    });
  });

  test("draining exactly to zero succeeds, then a 1-credit debit 402s with balance 0", async () => {
    await grantSample();
    const real1 = await realDebitStep(200, "codegen_debit", "drain");
    const wallet = applyDebit(initialWallet(), 200, "codegen_debit").wallet;
    expect(real1.balance).toBe(0);
    expect(walletBalance(wallet)).toBe(0);

    const outcome = applyDebit(wallet, 1, "codegen_debit");
    expect(outcome.error?.details).toEqual({ required: 1, balance: 0 });

    const realErr: unknown = await realDebitStep(
      1,
      "codegen_debit",
      "over0",
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect((realErr as InsufficientCreditsError).details).toEqual({
      required: 1,
      balance: 0,
    });
  });
});

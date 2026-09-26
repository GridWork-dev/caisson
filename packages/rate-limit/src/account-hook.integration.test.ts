// The per-account `checkRateLimit` hook. Proves the three outcomes the mcp-server seam relies on:
// an under-limit account resolves (allow); an over-limit account throws RateLimitError (429, the
// ONLY blocking path); and a STORE ERROR fails OPEN — the hook resolves (the tool would run) AND
// signals an alert through the operator sink, never locking out an adopter.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { RateLimitError } from "@caisson-sh/kernel";
import { type TestPg, newTestPg } from "@caisson-sh/testing";
import type { Transactor } from "@caisson-sh/tenancy-rls";
import { RATE_LIMIT_SCHEMA_SQL } from "./account-store.ts";
import { createRateLimitHook } from "./account-hook.ts";

let tp: TestPg;
const T0 = 1_700_000_000_000;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(RATE_LIMIT_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

describe("createRateLimitHook", () => {
  test("an under-limit account resolves (allow)", async () => {
    const hook = createRateLimitHook({
      db: tp.pg,
      config: { capacity: 2, refillAmount: 2, refillIntervalMs: 1000 },
      now: () => T0,
    });
    // First call within a fresh 2-token bucket → resolves, no throw.
    await expect(hook("acct_hook_ok")).resolves.toBeUndefined();
  });

  test("an over-limit account throws RateLimitError (429) with a retry-after", async () => {
    const hook = createRateLimitHook({
      db: tp.pg,
      config: { capacity: 1, refillAmount: 1, refillIntervalMs: 60_000 },
      now: () => T0,
    });
    const acct = "acct_hook_deny";
    await hook(acct); // consumes the single token
    let thrown: unknown;
    try {
      await hook(acct); // bucket empty → deny
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(RateLimitError);
    const rle = thrown as RateLimitError;
    expect(rle.httpStatus).toBe(429);
    expect(typeof rle.details?.retryAfterMs).toBe("number");
    expect(rle.details?.retryAfterMs as number).toBeGreaterThan(0);
  });

  test("a STORE ERROR fails OPEN — resolves and signals an alert (never throws)", async () => {
    const alerts: { accountId: string }[] = [];
    // A db whose transaction always throws — simulates an unreachable / failing store.
    const brokenDb: Transactor = {
      transaction: async () => {
        throw new Error("db unreachable");
      },
    };
    const hook = createRateLimitHook({
      db: brokenDb,
      onStoreError: (_err, accountId) => alerts.push({ accountId }),
      now: () => T0,
    });
    // FAIL-OPEN: resolves (the tool would run) — a store fault must not lock out an adopter.
    await expect(hook("acct_failopen")).resolves.toBeUndefined();
    // …and it raised an alert through the operator sink (not console.log).
    expect(alerts).toEqual([{ accountId: "acct_failopen" }]);
  });

  test("a store error with NO sink still fails open silently (no throw)", async () => {
    const brokenDb: Transactor = {
      transaction: async () => {
        throw new Error("db unreachable");
      },
    };
    const hook = createRateLimitHook({ db: brokenDb, now: () => T0 });
    await expect(hook("acct_failopen_silent")).resolves.toBeUndefined();
  });
});

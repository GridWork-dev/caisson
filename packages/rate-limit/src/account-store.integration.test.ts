// rate_limit token-bucket store on PGlite + real withTenant RLS. Asserts: a bucket consumes tokens
// to zero then denies (with a retry-after); lazy refill restores tokens after elapsed time (injected
// clock); the atomic UPDATE is race-safe (two concurrent consumes on one token → exactly one winner);
// a per-account override changes the limit; and RLS isolates accounts (a forged cross-tenant write is
// refused by the policy WITH CHECK). Each test uses its own account id so no cross-test cleanup is
// needed. Token counts are integers; `now` is injected epoch-ms.
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
import { type TestPg, newTestPg } from "@caisson-sh/testing";
import { withTenant } from "@caisson-sh/tenancy-rls";
import {
  RATE_LIMIT_SCHEMA_SQL,
  checkRateLimit,
  setAccountRateLimit,
} from "./account-store.ts";

let tp: TestPg;

// A small fixed bucket for deterministic assertions: 2 tokens, refill 2 every 1000ms.
const SMALL = { capacity: 2, refillAmount: 2, refillIntervalMs: 1000 };
const T0 = 1_700_000_000_000; // a fixed epoch-ms baseline

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(RATE_LIMIT_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

describe("rate_limit token-bucket store (RLS)", () => {
  test("consumes tokens to zero then denies — with a retry-after", async () => {
    const acct = "acct_drain";
    // Seed an explicit small override so the default 120 bucket doesn't mask the drain.
    await withTenant(tp.pg, acct, (tx) =>
      setAccountRateLimit(tx, acct, SMALL, T0),
    );
    // Two consumes at T0 → both allowed, remaining 1 then 0.
    const d1 = await withTenant(tp.pg, acct, (tx) =>
      checkRateLimit(tx, acct, T0, SMALL),
    );
    expect(d1).toMatchObject({ allowed: true, remaining: 1, retryAfterMs: 0 });
    const d2 = await withTenant(tp.pg, acct, (tx) =>
      checkRateLimit(tx, acct, T0, SMALL),
    );
    expect(d2).toMatchObject({ allowed: true, remaining: 0, retryAfterMs: 0 });
    // Third at the same instant → denied, retry-after = the full interval (next boundary at T0+1000).
    const d3 = await withTenant(tp.pg, acct, (tx) =>
      checkRateLimit(tx, acct, T0, SMALL),
    );
    expect(d3.allowed).toBe(false);
    expect(d3.remaining).toBe(0);
    expect(d3.retryAfterMs).toBe(1000);
  });

  test("lazy refill restores tokens after elapsed time (injected clock)", async () => {
    const acct = "acct_refill";
    await withTenant(tp.pg, acct, (tx) =>
      setAccountRateLimit(tx, acct, SMALL, T0),
    );
    // Drain both tokens at T0.
    await withTenant(tp.pg, acct, (tx) => checkRateLimit(tx, acct, T0, SMALL));
    await withTenant(tp.pg, acct, (tx) => checkRateLimit(tx, acct, T0, SMALL));
    // Denied while still inside the interval.
    const mid = await withTenant(tp.pg, acct, (tx) =>
      checkRateLimit(tx, acct, T0 + 500, SMALL),
    );
    expect(mid.allowed).toBe(false);
    // One full interval later → 2 tokens refilled; this consume succeeds, leaving 1.
    const after = await withTenant(tp.pg, acct, (tx) =>
      checkRateLimit(tx, acct, T0 + 1000, SMALL),
    );
    expect(after).toMatchObject({ allowed: true, remaining: 1 });
  });

  test("refill is clamped to capacity (a long idle does not over-fill)", async () => {
    const acct = "acct_clamp";
    await withTenant(tp.pg, acct, (tx) =>
      setAccountRateLimit(tx, acct, SMALL, T0),
    );
    // Drain, then idle 100 intervals — refill must clamp to capacity (2), not 200.
    await withTenant(tp.pg, acct, (tx) => checkRateLimit(tx, acct, T0, SMALL));
    await withTenant(tp.pg, acct, (tx) => checkRateLimit(tx, acct, T0, SMALL));
    const far = T0 + 100 * 1000;
    const a = await withTenant(tp.pg, acct, (tx) =>
      checkRateLimit(tx, acct, far, SMALL),
    );
    expect(a).toMatchObject({ allowed: true, remaining: 1 }); // 2 refilled (clamped) − 1 consumed
    const b = await withTenant(tp.pg, acct, (tx) =>
      checkRateLimit(tx, acct, far, SMALL),
    );
    expect(b).toMatchObject({ allowed: true, remaining: 0 });
    const c = await withTenant(tp.pg, acct, (tx) =>
      checkRateLimit(tx, acct, far, SMALL),
    );
    expect(c.allowed).toBe(false); // clamp held — no hidden surplus
  });

  test("an overflow-prone config (tiny interval + long idle) does not throw and still clamps", async () => {
    // Regression for the int8 overflow guard: a pathological operator config (1ms interval, a huge
    // refill_amount) over a long idle makes the RAW period count enormous, so an UNCAPPED
    // `periods * refill_amount` would exceed int8 → "bigint out of range" → which the hook swallows as
    // fail-open, silently disabling the throttle for that account. The period count is capped at
    // `capacity` before the multiply, so the product stays bounded and the refill still clamps to
    // capacity. (See REFILLED_TOKENS in account-store.ts.)
    const acct = "acct_overflow";
    const BIG = {
      capacity: 5,
      refillAmount: 2_000_000_000,
      refillIntervalMs: 1,
    };
    // Seed at T0 so the watermark lags the check below by a huge gap.
    await withTenant(tp.pg, acct, (tx) =>
      setAccountRateLimit(tx, acct, BIG, T0),
    );
    // ~58 days later: raw periods = 5e9 / 1 = 5e9; uncapped 5e9 * 2e9 = 1e19 > int8 max (9.22e18).
    const far = T0 + 5_000_000_000;
    const d = await withTenant(tp.pg, acct, (tx) =>
      checkRateLimit(tx, acct, far, BIG),
    );
    // No throw, refill clamped to capacity (5), one consumed → 4 remaining.
    expect(d).toMatchObject({ allowed: true, remaining: 4 });
  });

  test("the atomic UPDATE is race-safe — two concurrent consumes on one token, exactly one wins", async () => {
    const acct = "acct_race";
    // Seed a bucket of exactly ONE token (capacity 1) so two consumes contend for it.
    const ONE = { capacity: 1, refillAmount: 1, refillIntervalMs: 60_000 };
    await withTenant(tp.pg, acct, (tx) =>
      setAccountRateLimit(tx, acct, ONE, T0),
    );
    // Fire both at the SAME instant. NOTE: PGlite is a single in-process connection that serializes
    // these, so this proves the WHERE-guarded conditional-update CORRECTNESS (no double-spend even if
    // both observe the token), NOT OS-level backend contention — the cross-backend exactly-one-winner
    // guarantee rests on Postgres READ COMMITTED EvalPlanQual re-evaluating the inlined guard.
    const [r1, r2] = await Promise.all([
      withTenant(tp.pg, acct, (tx) => checkRateLimit(tx, acct, T0, ONE)),
      withTenant(tp.pg, acct, (tx) => checkRateLimit(tx, acct, T0, ONE)),
    ]);
    const allowed = [r1, r2].filter((d) => d.allowed).length;
    expect(allowed).toBe(1); // no double-spend of the single token
  });

  test("a per-account override changes the limit", async () => {
    const acct = "acct_override";
    // Override to a single-token bucket; the first consume succeeds, the second is denied —
    // proving the override (not the global 120 default) is in force.
    await withTenant(tp.pg, acct, (tx) =>
      setAccountRateLimit(
        tx,
        acct,
        { capacity: 1, refillAmount: 1, refillIntervalMs: 60_000 },
        T0,
      ),
    );
    const first = await withTenant(tp.pg, acct, (tx) =>
      checkRateLimit(tx, acct, T0),
    );
    expect(first.allowed).toBe(true);
    const second = await withTenant(tp.pg, acct, (tx) =>
      checkRateLimit(tx, acct, T0),
    );
    expect(second.allowed).toBe(false);
  });

  test("a fresh account auto-provisions a full DEFAULT bucket", async () => {
    const acct = "acct_default";
    // No setAccountRateLimit — checkRateLimit lazily inserts a full default (120) bucket.
    const d = await withTenant(tp.pg, acct, (tx) =>
      checkRateLimit(tx, acct, T0),
    );
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(119); // 120 default − 1 consumed
  });

  test("RLS isolates accounts — a forged cross-tenant write is refused (fail-closed)", async () => {
    const owner = "acct_rl_owner";
    const attacker = "acct_rl_attacker";
    // Under the attacker's tenant scope, try to seed a row for the owner — the policy WITH CHECK
    // (account_id = GUC = attacker) rejects it.
    await expect(
      withTenant(tp.pg, attacker, (tx) =>
        setAccountRateLimit(tx, owner, SMALL, T0),
      ),
    ).rejects.toThrow();
    // Nothing landed under the owner (ground-truth read as superuser).
    const rows = await tp.query<{ account_id: string }>(
      `SELECT account_id FROM rate_limit WHERE account_id = $1`,
      [owner],
    );
    expect(rows).toEqual([]);
  });
});

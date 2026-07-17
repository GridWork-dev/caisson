// demo-run store: F5 budget reserve/release/status (incl. the CONCURRENT LAST-SLOT race), lead
// telemetry, and the pure IP/config helpers. The budget + leads tables are global (non-tenant), so
// they run against `tp.pg` directly (a Transactor); the concurrency race is asserted on PGlite exactly
// as @caisson/rate-limit's account-store integration test asserts its own single-winner guarantee.
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
import { type TestPg, newTestPg } from "@caisson/testing";
import {
  DEMO_RUN_BUDGET_SCHEMA_SQL,
  DEMO_RUN_LEADS_SCHEMA_SQL,
  hashIp,
  ipKeys,
  rateConfigForKey,
  readDemoRunStatus,
  recordDemoLead,
  releaseDemoRun,
  reserveDemoRun,
} from "./store.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(DEMO_RUN_BUDGET_SCHEMA_SQL);
  await tp.exec(DEMO_RUN_LEADS_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

beforeEach(async () => {
  await tp.exec("DELETE FROM demo_run_budget");
  await tp.exec("DELETE FROM demo_run_leads");
});

const HIGH = { dailyCap: 1000, concurrencyCap: 4 };

describe("F5 demo_run_budget reserve", () => {
  test("admits under the caps and increments the day's counters", async () => {
    const r = await reserveDemoRun(tp.pg, HIGH);
    expect(r.ok).toBe(true);
    const rows = await tp.query<{ runs_started: number; concurrency: number }>(
      "SELECT runs_started, concurrency FROM demo_run_budget",
    );
    expect(rows[0]).toMatchObject({ runs_started: 1, concurrency: 1 });
  });

  test("trips to daily-cap once the run-count ceiling is hit", async () => {
    const caps = { dailyCap: 2, concurrencyCap: 10 };
    expect((await reserveDemoRun(tp.pg, caps)).ok).toBe(true);
    expect((await reserveDemoRun(tp.pg, caps)).ok).toBe(true);
    const third = await reserveDemoRun(tp.pg, caps);
    expect(third).toEqual({ ok: false, reason: "daily-cap" });
  });

  test("the disabled latch fails closed with reason 'disabled'", async () => {
    await reserveDemoRun(tp.pg, HIGH); // create today's row
    await tp.exec("UPDATE demo_run_budget SET disabled = true");
    const r = await reserveDemoRun(tp.pg, HIGH);
    expect(r).toEqual({ ok: false, reason: "disabled" });
  });

  // The PLAN's exit-criterion race: N parallel admissions at cap-1 ⇒ exactly one admitted.
  test("CONCURRENT LAST-SLOT: N parallel admissions at cap-1 ⇒ exactly one wins", async () => {
    // Fill 3 of 4 concurrency slots sequentially, then race 8 admissions for the last slot.
    for (let i = 0; i < 3; i++)
      expect((await reserveDemoRun(tp.pg, HIGH)).ok).toBe(true);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => reserveDemoRun(tp.pg, HIGH)),
    );
    const admitted = results.filter((r) => r.ok).length;
    expect(admitted).toBe(1);
    for (const r of results) {
      if (!r.ok) expect(r.reason).toBe("daily-cap");
    }
    const rows = await tp.query<{ concurrency: number }>(
      "SELECT concurrency FROM demo_run_budget",
    );
    expect(Number(rows[0]?.concurrency)).toBe(4);
  });
});

describe("F5 release + status", () => {
  test("release frees exactly one concurrency slot, floored at 0", async () => {
    const r = await reserveDemoRun(tp.pg, HIGH);
    if (!r.ok) throw new Error("expected reserve");
    await releaseDemoRun(tp.pg, r.day);
    let rows = await tp.query<{ concurrency: number }>(
      "SELECT concurrency FROM demo_run_budget",
    );
    expect(Number(rows[0]?.concurrency)).toBe(0);
    // A double-release can never go negative.
    await releaseDemoRun(tp.pg, r.day);
    rows = await tp.query<{ concurrency: number }>(
      "SELECT concurrency FROM demo_run_budget",
    );
    expect(Number(rows[0]?.concurrency)).toBe(0);
  });

  test("status: fresh=enabled, daily-cap and disabled=grey", async () => {
    expect(await readDemoRunStatus(tp.pg, HIGH)).toEqual({ enabled: true });

    const caps = { dailyCap: 1, concurrencyCap: 10 };
    await reserveDemoRun(tp.pg, caps); // runs_started → 1 == dailyCap
    expect(await readDemoRunStatus(tp.pg, caps)).toEqual({
      enabled: false,
      reason: "daily-cap",
    });

    await tp.exec("UPDATE demo_run_budget SET disabled = true");
    expect(await readDemoRunStatus(tp.pg, caps)).toEqual({
      enabled: false,
      reason: "disabled",
    });
  });
});

describe("F3 lead telemetry", () => {
  test("records a lead once, idempotent on run_id", async () => {
    await recordDemoLead(tp.pg, {
      runId: "run-1",
      email: "buyer@example.com",
      ipHash: hashIp("1.2.3.4"),
    });
    await recordDemoLead(tp.pg, {
      runId: "run-1",
      email: "other@example.com",
      ipHash: hashIp("9.9.9.9"),
    });
    const rows = await tp.query<{ email: string; ip_hash: string }>(
      "SELECT email, ip_hash FROM demo_run_leads",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("buyer@example.com"); // first write wins (ON CONFLICT DO NOTHING)
    expect(rows[0]?.ip_hash).not.toBe("1.2.3.4"); // stored hashed, never raw
  });
});

describe("pure helpers", () => {
  test("ipKeys: IPv4 → one full-IP key; IPv6 → full + /64 prefix key", () => {
    expect(ipKeys("1.2.3.4")).toEqual(["demo-ip:1.2.3.4"]);
    const v6 = ipKeys("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    expect(v6[0]).toBe("demo-ip:2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    expect(v6[1]).toBe("demo-ip64:2001:db8:1:2");
    // A compressed IPv6 still buckets to the same /64.
    expect(ipKeys("2001:db8:1:2::1")[1]).toBe("demo-ip64:2001:db8:1:2");
    // Empty / unknown collapses to one shared bucket.
    expect(ipKeys("")).toEqual(["demo-ip:unknown"]);
  });

  test("hashIp is a deterministic 64-hex digest, never the raw IP", () => {
    const h = hashIp("1.2.3.4");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashIp("1.2.3.4"));
    expect(h).not.toContain("1.2.3.4");
  });

  test("rateConfigForKey gives the /64 key more headroom than a single IP", () => {
    const ip = rateConfigForKey("demo-ip:1.2.3.4", {});
    const ip64 = rateConfigForKey("demo-ip64:2001:db8:1:2", {});
    expect(ip.capacity).toBe(20);
    expect(ip64.capacity).toBe(60);
    expect(ip.refillAmount).toBe(ip.capacity); // full window restores the bucket
    expect(ip.refillIntervalMs).toBeGreaterThan(0);
  });
});

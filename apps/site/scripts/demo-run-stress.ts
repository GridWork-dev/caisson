#!/usr/bin/env bun
/**
 * Abuse / cost stress proof for the sandbox demo-run route (CAISSON-110, ADR-0350 F5 / ADR-0352 —
 * exit criterion 3). A LOCAL route-level harness, never CI, never production: it drives the REAL
 * `handleDemoRun` against a REAL Postgres (PGlite via @caisson/testing — the same lane the store +
 * account-store integration tests use) with the REAL rate-limit account-store, the REAL F5 budget
 * reserve/release, and the REAL lead telemetry wired in. Only two seams are faked, and only because
 * they are covered elsewhere and are orthogonal to abuse/cost: Turnstile (fail-closed 403 is proven
 * in lib/demo-run/handler.test.ts) is forced-pass so every request reaches the quota gates, and the
 * in-process generator (proven in lib/demo-run/run.test.ts) returns a fixed tiny artifact so the
 * proof isolates admission control, not scaffold construction.
 *
 * Proves, with numbers:
 *   A. per-IP rate limit → 429 once a single IP exhausts its token bucket (Retry-After present).
 *   B. F5 daily cap is ATOMIC — a concurrent burst of >= 3x the cap admits EXACTLY the cap (never
 *      over-admitted: demo_run_budget.runs_started lands on the cap, not cap+1), the rest 503
 *      daily-cap, and every concurrency slot is released (gauge back to 0).
 *   C. kill switch → 503 disabled with zero work done (no budget row, no reserve).
 *   D. the run-path kill switch and the excerpts visibility flag are TWO INDEPENDENT env keys
 *      (ADR-0352 F2) — darkening the run path leaves the excerpts section lit.
 *
 * Run:  bun apps/site/scripts/demo-run-stress.ts
 * Exit: 0 on all invariants held, non-zero (thrown assertion) otherwise.
 */
import assert from "node:assert/strict";
import { RATE_LIMIT_SCHEMA_SQL, checkRateLimit } from "@caisson/rate-limit";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import { type DemoRunDeps, handleDemoRun } from "../lib/demo-run/handler.ts";
import type { DemoRunResult } from "../lib/demo-run/run.ts";
import {
  DEMO_RUN_BUDGET_SCHEMA_SQL,
  DEMO_RUN_LEADS_SCHEMA_SQL,
  type DemoRunCaps,
  demoRunEnabled,
  hashIp,
  rateConfigForKey,
  recordDemoLead,
  releaseDemoRun,
  reserveDemoRun,
} from "../lib/demo-run/store.ts";

const FAKE_RESULT: DemoRunResult = {
  tree: [{ path: "README.md", bytes: 6 }],
  files: { "README.md": "# demo" },
  moduleSummary: { total: 2, oss: 1, paid: 1, modules: [] },
  generatedInMs: 1,
};
const VALID = {
  email: "buyer@example.com",
  projectName: "my-demo",
  turnstileToken: "tok",
};

interface Opts {
  caps: DemoRunCaps;
  env: Record<string, string | undefined>;
  enabled: boolean;
}

/** Build the real deps for ONE request (route.ts builds deps per request — the `release` closure must
 *  decrement the SAME reservation `reserve` made). Turnstile + generate are the only fakes; every
 *  quota/DB seam is the production code path against `pg`. */
function makeDeps(pg: TestPg["pg"], opts: Opts): DemoRunDeps {
  let reservedDay: string | undefined;
  return {
    enabled: () => opts.enabled,
    verifyTurnstile: async () => true, // fail-closed 403 is covered in handler.test.ts
    checkRate: async (key) => {
      const dec = await withTenant(pg, key, (tx) =>
        checkRateLimit(tx, key, Date.now(), rateConfigForKey(key, opts.env)),
      );
      return {
        allowed: dec.allowed,
        retryAfterSec: Math.ceil(dec.retryAfterMs / 1000),
      };
    },
    reserve: async () => {
      const r = await reserveDemoRun(pg, opts.caps);
      if (r.ok) {
        reservedDay = r.day;
        return { ok: true };
      }
      return { ok: false, reason: r.reason };
    },
    release: async () => {
      if (reservedDay !== undefined) await releaseDemoRun(pg, reservedDay);
    },
    generate: () => FAKE_RESULT, // scaffold construction is covered in run.test.ts
    recordLead: async (email, runId, ip) => {
      await recordDemoLead(pg, { runId, email, ipHash: hashIp(ip) });
    },
  };
}

function req(ip: string): Request {
  return new Request("https://caisson.sh/api/demo/run", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: JSON.stringify(VALID),
  });
}

interface Outcome {
  status: number;
  reason: string | undefined;
  retryAfter: string | null;
}

async function fire(
  pg: TestPg["pg"],
  ip: string,
  opts: Opts,
): Promise<Outcome> {
  const res = await handleDemoRun(req(ip), makeDeps(pg, opts));
  const body = (await res.json().catch(() => ({}))) as { reason?: string };
  return {
    status: res.status,
    reason: body.reason,
    retryAfter: res.headers.get("Retry-After"),
  };
}

function tally(outcomes: Outcome[]): Record<number, number> {
  const t: Record<number, number> = {};
  for (const o of outcomes) t[o.status] = (t[o.status] ?? 0) + 1;
  return t;
}

async function resetBudget(tp: TestPg): Promise<void> {
  await tp.exec("DELETE FROM demo_run_budget");
  await tp.exec("DELETE FROM demo_run_leads");
  await tp.exec("DELETE FROM rate_limit");
}

async function budgetRow(
  tp: TestPg,
): Promise<{ runs_started: number; concurrency: number } | undefined> {
  const rows = await tp.query<{ runs_started: number; concurrency: number }>(
    "SELECT runs_started, concurrency FROM demo_run_budget",
  );
  return rows[0];
}

// The excerpts visibility predicate, verbatim from apps/site/app/(marketing)/demo/page.tsx
// (EXCERPTS_ENABLED). It reads NEXT_PUBLIC_DEMO_EXCERPTS_ENABLED — a DIFFERENT env key from the
// run-path kill switch DEMO_RUN_ENABLED (demoRunEnabled), which is the whole point of ADR-0352 F2.
function excerptsEnabled(env: Record<string, string | undefined>): boolean {
  return env.NEXT_PUBLIC_DEMO_EXCERPTS_ENABLED !== "false";
}

function line(): void {
  console.log("-".repeat(72));
}

async function main(): Promise<void> {
  const tp = await newTestPg();
  await tp.exec(RATE_LIMIT_SCHEMA_SQL);
  await tp.exec(DEMO_RUN_BUDGET_SCHEMA_SQL);
  await tp.exec(DEMO_RUN_LEADS_SCHEMA_SQL);

  console.log(
    "demo-run abuse/cost stress proof — CAISSON-110 (ADR-0350 F5 / ADR-0352)",
  );
  console.log(`run at ${new Date().toISOString()}`);
  line();

  // --- A. per-IP rate limit → 429 -------------------------------------------------------------
  // One IP, capacity 5, a 1h window (no refill mid-burst), F5 caps set high so the rate limit is the
  // sole binding gate. 20 sequential attempts ⇒ 5 admitted, 15 rate-limited.
  await resetBudget(tp);
  const A_ENV = {
    DEMO_RUN_IP_CAPACITY: "5",
    DEMO_RUN_RATE_WINDOW_MS: "3600000",
  };
  const A_OPTS: Opts = {
    caps: { dailyCap: 1000, concurrencyCap: 1000 },
    env: A_ENV,
    enabled: true,
  };
  const aAttempts = 20;
  const aOut: Outcome[] = [];
  for (let i = 0; i < aAttempts; i++)
    aOut.push(await fire(tp.pg, "203.0.113.7", A_OPTS));
  const aT = tally(aOut);
  const a200 = aT[200] ?? 0;
  const a429 = aT[429] ?? 0;
  console.log(
    `A. per-IP rate limit (capacity 5, 1 IP)   attempted=${aAttempts}  admitted(200)=${a200}  rate-limited(429)=${a429}`,
  );
  assert.equal(a200, 5, "exactly capacity=5 admitted before the bucket drains");
  assert.equal(a429, 15, "the remaining 15 are rate-limited");
  assert.ok(
    aOut.filter((o) => o.status === 429).every((o) => o.retryAfter !== null),
    "every 429 carries a Retry-After header",
  );

  // --- B. F5 daily cap, ATOMIC under a concurrent >=3x burst ----------------------------------
  // Distinct IPs (rate limit set high so it never binds) + a high concurrency cap so the DAILY cap
  // is the sole binding gate. dailyCap=10, burst=35 (3.5x). All fired concurrently: exactly 10 win.
  await resetBudget(tp);
  const DAILY_CAP = 10;
  const B_OPTS: Opts = {
    caps: { dailyCap: DAILY_CAP, concurrencyCap: 100 },
    env: { DEMO_RUN_IP_CAPACITY: "1000" },
    enabled: true,
  };
  const bAttempts = 35;
  const bOut = await Promise.all(
    Array.from({ length: bAttempts }, (_, i) =>
      fire(tp.pg, `198.51.100.${i + 1}`, B_OPTS),
    ),
  );
  const bT = tally(bOut);
  const b200 = bT[200] ?? 0;
  const b503 = bT[503] ?? 0;
  const row = await budgetRow(tp);
  console.log(
    `B. F5 daily cap (cap=${DAILY_CAP}, 35 concurrent)  attempted=${bAttempts}  admitted(200)=${b200}  daily-cap(503)=${b503}  runs_started=${row?.runs_started}  concurrency=${row?.concurrency}`,
  );
  assert.equal(b200, DAILY_CAP, "EXACTLY the daily cap is admitted");
  assert.equal(b503, bAttempts - DAILY_CAP, "everything past the cap is 503");
  assert.ok(
    bOut.filter((o) => o.status === 503).every((o) => o.reason === "daily-cap"),
    "every over-cap 503 reports reason=daily-cap",
  );
  assert.equal(
    Number(row?.runs_started),
    DAILY_CAP,
    "ATOMIC: runs_started never exceeds the cap (no over-admission race)",
  );
  assert.equal(
    Number(row?.concurrency),
    0,
    "every admitted run released its concurrency slot",
  );
  assert.ok(bAttempts >= 3 * DAILY_CAP, "burst is >= 3x the daily cap");

  // --- C. kill switch → 503 disabled, zero work ----------------------------------------------
  await resetBudget(tp);
  const cOut = await fire(tp.pg, "192.0.2.5", {
    caps: { dailyCap: 10, concurrencyCap: 4 },
    env: {},
    enabled: false,
  });
  const cRow = await budgetRow(tp);
  console.log(
    `C. kill switch off                        status=${cOut.status}  reason=${cOut.reason}  budget-row=${cRow === undefined ? "none" : "present"}`,
  );
  assert.equal(cOut.status, 503, "kill switch → 503");
  assert.equal(cOut.reason, "disabled", "reason=disabled");
  assert.equal(cRow, undefined, "no reserve happened — no budget row written");

  // --- D. two independent flags (F2): run dark, excerpts lit ----------------------------------
  const darkRunEnv = { DEMO_RUN_ENABLED: "false" }; // excerpts key deliberately unset
  const runDark = demoRunEnabled(darkRunEnv);
  const excerptsUp = excerptsEnabled(darkRunEnv);
  console.log(
    `D. flag independence (DEMO_RUN_ENABLED=false)  runPathEnabled=${runDark}  excerptsEnabled=${excerptsUp}`,
  );
  assert.equal(runDark, false, "the run path is dark");
  assert.equal(
    excerptsUp,
    true,
    "the excerpts section stays lit — a DIFFERENT env key (ADR-0352 F2)",
  );
  // And the converse: darkening excerpts does not darken the run path.
  assert.equal(
    demoRunEnabled({ NEXT_PUBLIC_DEMO_EXCERPTS_ENABLED: "false" }),
    true,
  );
  assert.equal(
    excerptsEnabled({ NEXT_PUBLIC_DEMO_EXCERPTS_ENABLED: "false" }),
    false,
  );

  line();
  console.log(
    "ALL INVARIANTS HELD — 429 rate limit, atomic exactly-cap, 503 daily-cap + kill switch, flag independence.",
  );
  await tp.close();
}

await main();

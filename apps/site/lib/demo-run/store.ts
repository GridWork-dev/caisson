// The apps/site demo-run persistence + config layer (CAISSON-110, ADR-0350 F5 / ADR-0352). Three
// concerns share one file because they share the site's single platform `Transactor` and the same
// non-tenant posture:
//   - `demo_run_budget`: the F5 hard daily cap (run-count + live concurrency), an ATOMIC reserve a
//     concurrent last-slot burst cannot race past. Modeled directly on `lib/ask-ai/spend.ts`'s
//     `reserveSpendMicro` (a single guarded conditional `UPDATE … WHERE … RETURNING` inside
//     `db.transaction` — NOT `withTenant`, because this is a global, non-tenant aggregate) — the SAME
//     race-closing shape, extended to two ceilings. Count-then-insert is BANNED for this cap
//     (ADR-0352).
//   - `demo_run_leads`: F3 email-capture telemetry. Email is attribution ONLY — never a quota key or
//     security principal (ADR-0352 rider 1). Global, no RLS, same posture as `ask_ai_question`.
//   - IP-key derivation + hashing for the `@caisson/rate-limit` PG account-store per-IP / per-/64 gate.
// Schemas register in `lib/site-migrations.ts` (the ONE apps/site-local migration list) next to
// `ASK_AI_SPEND_SCHEMA_SQL`, so the dev PGlite double AND the real-Postgres deploy both get them.
import { createHash } from "node:crypto";
import { z } from "zod";
import type { RateLimitConfig } from "@caisson/rate-limit";
import type { Transactor } from "@caisson/tenancy-rls";

// ---------------------------------------------------------------------------------------------------
// Schemas (registered in lib/site-migrations.ts). Global, non-tenant — no RLS, same as ask_ai_spend.
// ---------------------------------------------------------------------------------------------------

/** The F5 daily budget counter — one row per UTC day, holding the cumulative run-count, the live
 *  concurrency gauge, and an auto-disable/kill latch. Accessed via `db.transaction`, never `withTenant`. */
export const DEMO_RUN_BUDGET_SCHEMA_SQL = `
CREATE TABLE demo_run_budget (
  day           date PRIMARY KEY,
  runs_started  integer NOT NULL DEFAULT 0,
  concurrency   integer NOT NULL DEFAULT 0,
  disabled      boolean NOT NULL DEFAULT false,
  CONSTRAINT demo_run_budget_runs_nonneg CHECK (runs_started >= 0),
  CONSTRAINT demo_run_budget_conc_nonneg CHECK (concurrency >= 0)
);
`;

/** F3 lead telemetry — email is attribution/telemetry ONLY (rider 1). IP is stored HASHED, never raw. */
export const DEMO_RUN_LEADS_SCHEMA_SQL = `
CREATE TABLE demo_run_leads (
  run_id      text PRIMARY KEY,
  email       text NOT NULL,
  ip_hash     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
`;

// ---------------------------------------------------------------------------------------------------
// Config (env-tunable ceilings, safe defaults — a misconfigured var can never mean "unlimited",
// mirroring spend.ts's resolveDailyCapMicro).
// ---------------------------------------------------------------------------------------------------

export interface DemoRunCaps {
  /** Max admitted runs per UTC day. */
  readonly dailyCap: number;
  /** Max in-flight in-process generations at once. */
  readonly concurrencyCap: number;
}

function envPositiveInt(
  name: string,
  fallback: number,
  env: Record<string, string | undefined>,
): number {
  return z.coerce
    .number()
    .int()
    .positive()
    .catch(fallback)
    .parse(env[name] ?? String(fallback));
}

export function resolveDemoRunCaps(
  env: Record<string, string | undefined> = process.env,
): DemoRunCaps {
  return {
    dailyCap: envPositiveInt("DEMO_RUN_DAILY_CAP", 200, env),
    concurrencyCap: envPositiveInt("DEMO_RUN_CONCURRENCY", 4, env),
  };
}

/** The `DEMO_RUN_ENABLED` kill switch — default ON; only an explicit `false` (any case) disables it. */
export function demoRunEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (env.DEMO_RUN_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

export const IP_KEY_PREFIX = "demo-ip:";
export const IP64_KEY_PREFIX = "demo-ip64:";

/** The token-bucket config for a rate-limit account key, by prefix: a tighter per-IP budget and a
 *  looser per-/64 budget (a single IPv6 assignment is a whole /64, so the prefix gets more headroom).
 *  `refillAmount === capacity` so a full window fully restores the bucket. Namespaced keys keep these
 *  demo buckets from ever colliding with a real buyer account row in the shared `rate_limit` table. */
export function rateConfigForKey(
  key: string,
  env: Record<string, string | undefined> = process.env,
): RateLimitConfig {
  const per64 = key.startsWith(IP64_KEY_PREFIX);
  const capacity = envPositiveInt(
    per64 ? "DEMO_RUN_IP64_CAPACITY" : "DEMO_RUN_IP_CAPACITY",
    per64 ? 60 : 20,
    env,
  );
  const refillIntervalMs = envPositiveInt(
    "DEMO_RUN_RATE_WINDOW_MS",
    3_600_000,
    env,
  );
  return { capacity, refillAmount: capacity, refillIntervalMs };
}

// ---------------------------------------------------------------------------------------------------
// IP helpers (pure).
// ---------------------------------------------------------------------------------------------------

// ponytail: textual /64 bucketing (first 4 hextets after a light `::`-expansion), not full RFC-5952
// canonicalization — good enough to bucket a client rotating host bits within its /64; swap in a
// real IPv6 parser only if an evasion via non-canonical forms is ever observed.
function ipv6Prefix64(ip: string): string | undefined {
  if (!ip.includes(":")) return undefined; // IPv4 or "unknown"
  const lower = ip.toLowerCase();
  const [head = "", tail] = lower.split("::");
  const headParts = head.length > 0 ? head.split(":") : [];
  if (tail === undefined) return headParts.slice(0, 4).join(":"); // no "::" — already 8 groups
  const tailParts = tail.length > 0 ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  const full =
    missing < 0
      ? headParts
      : [...headParts, ...Array<string>(missing).fill("0"), ...tailParts];
  return full.slice(0, 4).join(":");
}

/** The rate-limit account keys to charge for one request: always the full-IP key, plus the /64 key
 *  for IPv6. `unknown`/empty collapses onto one shared, conservatively-throttled bucket. */
export function ipKeys(ip: string): string[] {
  const clean = ip.trim() || "unknown";
  const keys = [`${IP_KEY_PREFIX}${clean}`];
  const prefix64 = ipv6Prefix64(clean);
  if (prefix64 !== undefined) keys.push(`${IP64_KEY_PREFIX}${prefix64}`);
  return keys;
}

/** SHA-256 of the client IP — the only form stored (never the raw IP), same discipline as any PII hash. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

// ---------------------------------------------------------------------------------------------------
// F5 budget: reserve / release / status.
// ---------------------------------------------------------------------------------------------------

/** The current UTC day key (`YYYY-MM-DD`) — the budget's primary key. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export type ReserveResult =
  | { readonly ok: true; readonly day: string }
  | { readonly ok: false; readonly reason: "daily-cap" | "disabled" };

/**
 * Atomically admit one run against today's budget: increment BOTH the daily run-count and the live
 * concurrency gauge in ONE guarded `UPDATE … RETURNING`. The WHERE clause row-locks the day's row for
 * the statement, so a concurrent last-slot burst serializes and only as many as fit under the tighter
 * of the two ceilings are ever granted (never count-then-insert — ADR-0352). On a miss, one extra read
 * distinguishes the kill/auto-disable latch (`disabled`) from a tripped ceiling for the 503 reason —
 * a concurrency-exhausted miss maps to `daily-cap` (the F5 cap tripping; the fixed contract carries
 * only `daily-cap | disabled`).
 *
 * NOTE (queue depth): the run path is synchronous + in-process (no async job/queue between admission
 * and generation), so "queue depth" collapses into the concurrency ceiling — the same quantity a
 * separate queue bound would gate. A real async queue (rider 4 says that reopens the isolation fork
 * and needs a new ADR) would add a third column here.
 */
export async function reserveDemoRun(
  db: Transactor,
  caps: DemoRunCaps,
): Promise<ReserveResult> {
  const day = todayUtc();
  return db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO demo_run_budget (day) VALUES ($1) ON CONFLICT (day) DO NOTHING`,
      [day],
    );
    const res = await tx.query<{ runs_started: number }>(
      `UPDATE demo_run_budget
         SET runs_started = runs_started + 1, concurrency = concurrency + 1
         WHERE day = $1
           AND NOT disabled
           AND runs_started < $2
           AND concurrency < $3
         RETURNING runs_started`,
      [day, caps.dailyCap, caps.concurrencyCap],
    );
    if (res.rows.length > 0) return { ok: true, day };
    const r = await tx.query<{ disabled: boolean }>(
      `SELECT disabled FROM demo_run_budget WHERE day = $1`,
      [day],
    );
    return {
      ok: false,
      reason: r.rows[0]?.disabled === true ? "disabled" : "daily-cap",
    };
  });
}

/** Release one concurrency slot on run completion (best-effort — the caller swallows failures so a
 *  metering write never fails the user's response). Floored at 0 so a double-release can't go negative. */
export async function releaseDemoRun(
  db: Transactor,
  day: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE demo_run_budget SET concurrency = GREATEST(0, concurrency - 1) WHERE day = $1`,
      [day],
    );
  });
}

export type DemoRunStatus = {
  readonly enabled: boolean;
  readonly reason?: "daily-cap" | "disabled";
};

/** The current run-path availability for the UI (proactive grey-out). DB-only — the env kill switch is
 *  composed by the caller. The daily counter IS the auto-disable: once `runs_started >= dailyCap` the
 *  surface reads unavailable, fail-closed, until the day rolls over. Transient concurrency exhaustion
 *  does NOT grey the CTA (it's a momentary capacity signal, surfaced only as a 503 on submit). */
export async function readDemoRunStatus(
  db: Transactor,
  caps: DemoRunCaps,
): Promise<DemoRunStatus> {
  return db.transaction(async (tx) => {
    const r = await tx.query<{ disabled: boolean; runs_started: number }>(
      `SELECT disabled, runs_started FROM demo_run_budget WHERE day = $1`,
      [todayUtc()],
    );
    const row = r.rows[0];
    if (row === undefined) return { enabled: true };
    if (row.disabled === true) return { enabled: false, reason: "disabled" };
    if (Number(row.runs_started) >= caps.dailyCap) {
      return { enabled: false, reason: "daily-cap" };
    }
    return { enabled: true };
  });
}

// ---------------------------------------------------------------------------------------------------
// F3 lead telemetry.
// ---------------------------------------------------------------------------------------------------

/** Record an admitted run's lead — telemetry/attribution only. Idempotent on `run_id`; best-effort at
 *  the call site (a telemetry-write failure never reaches the user). */
export async function recordDemoLead(
  db: Transactor,
  lead: {
    readonly runId: string;
    readonly email: string;
    readonly ipHash: string;
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO demo_run_leads (run_id, email, ip_hash) VALUES ($1, $2, $3)
       ON CONFLICT (run_id) DO NOTHING`,
      [lead.runId, lead.email, lead.ipHash],
    );
  });
}

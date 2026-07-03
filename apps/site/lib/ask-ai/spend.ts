// The per-lane hard spend cap (ADR-0234 F2 rider, extended to both lanes — a session RELAXES the
// ceiling, per F1, it never removes it: a public unauth route AND an authed premium route are both
// directly monetizable abuse). Every generated answer's authoritative USD cost (OpenRouter usage.cost)
// is accrued into a lane-scoped daily counter; once a lane is over ITS cap, that lane fails CLOSED to
// the contact/Discord CTA. Integer micro-dollars only (ADR-0007 — never floats). Persisted in Postgres
// so the ceiling survives restarts. NOT tenant-scoped: neither lane has a tenant (the public lane is
// anonymous; the premium lane's session is not entitlement-scoped here), so this is a pair of global
// per-lane counters accessed via `db.transaction` (NOT `withTenant`) — no RLS policy, owner-role access.
//
// HARD ceiling, not check-then-charge: a plain "read total, compare, generate, then add" has a TOCTOU
// race — two concurrent requests can both read a total under the cap and both proceed, blowing past it.
// `reserveSpendMicro` closes that race: it atomically reserves a fixed worst-case cost BEFORE any paid
// work, gated by a guarded UPDATE whose WHERE clause Postgres row-locks for the statement's duration —
// concurrent reservations against the same (day, lane) serialize, so only as many as fit under the cap
// can ever be granted. `settleSpendMicro` trues the reservation to the real cost afterward (in `finally`
// — a metering write must never fail the user's response).
import { z } from "zod";
import type { Transactor } from "@caisson/tenancy-rls";

export type AskLane = "public" | "premium";

/** The per-lane daily spend counters. No RLS: a non-tenant, app-owned aggregate the route reads/writes
 * outside `withTenant`. Applied to the PGlite dev double (lib/db.ts) and the prod DB (deploy-migrate). */
export const ASK_AI_SPEND_SCHEMA_SQL = `
CREATE TABLE ask_ai_spend (
  day        date NOT NULL,
  lane       text NOT NULL,
  micro_usd  bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, lane)
);
`;

/** Convert a USD amount to integer micro-dollars ($1 = 1_000_000). Rounds to the nearest micro. */
export function dollarsToMicro(usd: number): number {
  return Math.round(usd * 1_000_000);
}

/** The current UTC day key (`YYYY-MM-DD`) — half the counter's primary key. The cap is a per-UTC-day
 *  budget, per lane. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// Fixed worst-case reservation held per in-flight request, shared across both lanes. 800 max_tokens
// (openrouter.ts) bounds a single completion well under this at either lane's per-token pricing (the
// public Gemini-flash lane and the premium Claude-Sonnet lane both cost low-cents per request in
// practice — see handler.test.ts's ~$0.002-0.003 fixtures). ponytail: one shared ceiling is simplest and
// has ample headroom for both current lanes; split per-lane only if a lane's real cost ever approaches
// it (resolveDailyCapMicro already has the per-lane plumbing to hang a per-lane reserve off of).
const RESERVE_MICRO_USD = 50_000; // $0.05

const CAP_ENV: Record<
  AskLane,
  { readonly envVar: string; readonly defaultUsd: number }
> = {
  public: { envVar: "ASK_AI_PUBLIC_DAILY_CAP_USD", defaultUsd: 10 },
  // ADR-0234 F1: a session relaxes limits, never removes them — the premium lane gets its OWN higher
  // ceiling, metered the same way, not an unlimited lane.
  premium: { envVar: "ASK_AI_PREMIUM_DAILY_CAP_USD", defaultUsd: 50 },
};

/**
 * Resolve `lane`'s daily cap in micro-dollars from its env var (`ASK_AI_PUBLIC_DAILY_CAP_USD` default
 * $10, `ASK_AI_PREMIUM_DAILY_CAP_USD` default $50). A missing or invalid value falls back to the safe
 * default — a spend cap fails to the SAFE (bounded) budget, so a misconfigured var can never mean
 * "unlimited".
 */
export function resolveDailyCapMicro(
  lane: AskLane,
  env: Record<string, string | undefined> = process.env,
): number {
  const { envVar, defaultUsd } = CAP_ENV[lane];
  const usd = z.coerce
    .number()
    .positive()
    .catch(defaultUsd)
    .parse(env[envVar] ?? String(defaultUsd));
  return dollarsToMicro(usd);
}

/** Today's accrued spend for one lane, in micro-dollars (0 when no row yet). Read-only introspection —
 *  the request path itself never reads this directly, it goes through `reserveSpendMicro`. */
export async function readTodaySpendMicro(
  db: Transactor,
  lane: AskLane,
): Promise<number> {
  return db.transaction(async (tx) => {
    const res = await tx.query<{ micro_usd: string | number | bigint }>(
      "SELECT micro_usd FROM ask_ai_spend WHERE day = $1 AND lane = $2",
      [todayUtc(), lane],
    );
    const row = res.rows[0];
    // node-postgres returns bigint columns as strings; PGlite as numbers — Number() normalizes both.
    return row === undefined ? 0 : Number(row.micro_usd);
  });
}

/**
 * Atomically reserve one request's worst-case cost against `lane`'s today counter, IF the resulting
 * total stays at or under `capMicro`. Returns `false` — and reserves nothing — when the reservation
 * itself would breach the cap; the caller must escalate WITHOUT any paid work (retrieval, generation).
 * Returns `true` when the reservation is held; the caller MUST settle it via `settleSpendMicro`.
 */
export async function reserveSpendMicro(
  db: Transactor,
  lane: AskLane,
  capMicro: number,
): Promise<boolean> {
  const day = todayUtc();
  return db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO ask_ai_spend (day, lane, micro_usd) VALUES ($1, $2, 0)
       ON CONFLICT (day, lane) DO NOTHING`,
      [day, lane],
    );
    const res = await tx.query<{ micro_usd: string | number | bigint }>(
      `UPDATE ask_ai_spend SET micro_usd = micro_usd + $3
       WHERE day = $1 AND lane = $2 AND micro_usd + $3 <= $4
       RETURNING micro_usd`,
      [day, lane, RESERVE_MICRO_USD, capMicro],
    );
    return res.rows.length > 0;
  });
}

/**
 * Settle a reservation granted by `reserveSpendMicro` with the real generation cost, in micro-dollars:
 * releases the fixed reservation and accrues the actual cost, atomically, floored at 0 (pass
 * `actualMicro: 0` to fully release a reservation when no generation happened at all — e.g. retrieval
 * failed after the reservation was granted). Best-effort by contract: the caller swallows a settle
 * failure rather than fail the user's response.
 */
export async function settleSpendMicro(
  db: Transactor,
  lane: AskLane,
  actualMicro: number,
): Promise<void> {
  const delta = actualMicro - RESERVE_MICRO_USD;
  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE ask_ai_spend SET micro_usd = GREATEST(0, micro_usd + $3)
       WHERE day = $1 AND lane = $2`,
      [todayUtc(), lane, delta],
    );
  });
}

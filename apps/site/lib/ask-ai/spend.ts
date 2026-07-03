// The public-lane hard spend cap (ADR-0234 F2 rider: $10/day, fail-closed to escalation). A public,
// unauth LLM route is directly monetizable abuse, so every generated answer's authoritative USD cost
// (OpenRouter usage.cost) is accrued into a global daily counter; once the day is over the cap the
// public lane fails CLOSED to the contact/Discord CTA. Integer micro-dollars only (ADR-0007 — never
// floats). Persisted in Postgres so the ceiling survives restarts. NOT tenant-scoped: the anonymous
// public lane has no tenant, so this is a single global counter accessed via `db.transaction` (NOT
// `withTenant`) — no RLS policy, owner-role access.
import { z } from "zod";
import type { Transactor } from "@caisson/tenancy-rls";

/** The global daily spend counter. No RLS: a non-tenant, app-owned aggregate the route reads/writes
 * outside `withTenant`. Applied to the PGlite dev double (lib/db.ts) and the prod DB (deploy-migrate). */
export const ASK_AI_SPEND_SCHEMA_SQL = `
CREATE TABLE ask_ai_spend (
  day        date PRIMARY KEY,
  micro_usd  bigint NOT NULL DEFAULT 0
);
`;

/** Convert a USD amount to integer micro-dollars ($1 = 1_000_000). Rounds to the nearest micro. */
export function dollarsToMicro(usd: number): number {
  return Math.round(usd * 1_000_000);
}

/** The current UTC day key (`YYYY-MM-DD`) — the counter's primary key. The cap is a per-UTC-day budget. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Resolve the daily cap in micro-dollars from `ASK_AI_PUBLIC_DAILY_CAP_USD` (default $10). A missing or
 * invalid value falls back to the safe $10 default — a spend cap fails to the SAFE (bounded) budget, so
 * a misconfigured var can never mean "unlimited".
 */
export function resolveDailyCapMicro(
  env: Record<string, string | undefined> = process.env,
): number {
  const usd = z.coerce
    .number()
    .positive()
    .catch(10)
    .parse(env.ASK_AI_PUBLIC_DAILY_CAP_USD ?? "10");
  return dollarsToMicro(usd);
}

/** Today's accrued public-lane spend in micro-dollars (0 when no row yet). */
export async function readTodaySpendMicro(db: Transactor): Promise<number> {
  return db.transaction(async (tx) => {
    const res = await tx.query<{ micro_usd: string | number | bigint }>(
      "SELECT micro_usd FROM ask_ai_spend WHERE day = $1",
      [todayUtc()],
    );
    const row = res.rows[0];
    // node-postgres returns bigint columns as strings; PGlite as numbers — Number() normalizes both.
    return row === undefined ? 0 : Number(row.micro_usd);
  });
}

/**
 * Accrue `micro` micro-dollars against today's counter (atomic read-modify-write via UPSERT). A
 * non-positive or non-integer amount is a no-op. Called AFTER a generation with the real usage.cost.
 */
export async function addSpendMicro(
  db: Transactor,
  micro: number,
): Promise<void> {
  if (!Number.isInteger(micro) || micro <= 0) return;
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO ask_ai_spend (day, micro_usd) VALUES ($1, $2)
       ON CONFLICT (day) DO UPDATE SET micro_usd = ask_ai_spend.micro_usd + EXCLUDED.micro_usd`,
      [todayUtc(), micro],
    );
  });
}

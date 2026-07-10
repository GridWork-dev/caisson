// ADR-0105/0206/0316 W-SUPPORT — the admin reader for support-bot escalations. The Discord
// support-bot (services/support-bot) persists every escalated question as a `support_ticket` row
// (its `ai_brief` carrier, ADR-0009). This is the admin cockpit's read of that table, through the
// SAME read-only `admin` role every business-admin view uses (`readAdmin`, ADR-0141).
//
// `support_ticket` carries NO account_id (it's operator-facing support state, not tenant data), so —
// like `intel.findings` and the better-auth `"user"` table — it has no RLS: the `admin` role reads it
// via a plain cross-role GRANT SELECT, not the `USING (true)` permissive-policy dance. That grant is
// an operator-gated DEPLOY step (the bot's own migration owns the CREATE TABLE, escalation.py's
// SUPPORT_TICKET_SCHEMA), so in an environment where the table is missing (42P01) or the grant
// hasn't run (42501) this read throws — the /support page guards BOTH into an honest EmptyState,
// mirroring the `readAdminActionLog` 42P01 degrade on /business.
import type { TenantExecutor } from "@caisson/tenancy-rls";

/** Bound the escalation list — an operator triage view, never an unbounded export. */
export const SUPPORT_TICKET_LIMIT = 100;

export interface SupportTicketRow {
  id: string;
  question: string;
  status: string;
  priority: boolean;
  /** bigint in Postgres → string here (node-pg maps bigint to string; never lose snowflake precision). */
  discordThreadId: string | null;
  createdAt: string;
  /** `ai_brief ->> 'summary'` — the "why escalated" line, when the brief carried one. */
  summary: string | null;
}

/**
 * Read the most recent escalations, priority-first then newest, through `readAdmin` (the read-only
 * `admin` role, ADR-0141). Throws the raw Postgres error when the table/grant is absent — callers
 * classify it via `supportTableUnavailable`.
 */
export async function readSupportTickets(
  tx: TenantExecutor,
): Promise<SupportTicketRow[]> {
  const { rows } = await tx.query<{
    id: string;
    question: string;
    status: string;
    priority: boolean;
    discord_thread_id: unknown;
    created_at: unknown;
    summary: string | null;
  }>(
    `SELECT id, question, status, priority, discord_thread_id, created_at,
            ai_brief ->> 'summary' AS summary
       FROM support_ticket
      ORDER BY priority DESC, created_at DESC
      LIMIT ${String(SUPPORT_TICKET_LIMIT)}`,
  );
  return rows.map((r) => ({
    id: r.id,
    question: r.question,
    status: r.status,
    priority: Boolean(r.priority),
    discordThreadId:
      r.discord_thread_id === null || r.discord_thread_id === undefined
        ? null
        : String(r.discord_thread_id),
    createdAt: String(r.created_at),
    summary: r.summary,
  }));
}

/** Postgres SQLSTATEs the /support read can hit before its DEPLOY DDL/grant lands — same shape on
 *  node-postgres and PGlite errors. 42P01 = table missing; 42501 = grant missing. */
const PG_UNDEFINED_TABLE = "42P01";
const PG_INSUFFICIENT_PRIVILEGE = "42501";

export type SupportTableUnavailable = "missing" | "forbidden";

/**
 * Classify a read error as a KNOWN not-provisioned condition (→ EmptyState), or null for anything
 * else (a transient DB error, which must NOT render as "not provisioned yet"). CAISSON-10 pattern:
 * only a genuine 42P01/42501 is the deploy-order condition; a timeout is a different failure.
 */
export function supportTableUnavailable(
  err: unknown,
): SupportTableUnavailable | null {
  if (typeof err !== "object" || err === null || !("code" in err)) return null;
  const code = (err as { code?: unknown }).code;
  if (code === PG_UNDEFINED_TABLE) return "missing";
  if (code === PG_INSUFFICIENT_PRIVILEGE) return "forbidden";
  return null;
}

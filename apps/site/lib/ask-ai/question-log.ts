// Ask-AI question-text capture (ADR-0236, operator-locked). Questions — never answers, never
// identity — are stored for product insight, with a visible consent notice in the widget. The record
// is anonymous BY CONSTRUCTION, not by scrubbing: no IP, no user id, no session key, no Turnstile
// token, no answer text. Retention is a 90-day rolling window enforced by an opportunistic hard
// DELETE on each insert (low volume makes per-insert sweep the simplest correct mechanism — no cron).
// Best-effort by contract: the route swallows a capture failure rather than fail the user's response.
import type { Transactor } from "@caisson/tenancy-rls";

export type AskOutcome = "answered" | "escalated";

/** Global (non-tenant) capture table — accessed outside `withTenant`, no RLS, same posture as
 * `ask_ai_spend`. Applied to the PGlite dev double (lib/db.ts) and the prod DB (deploy-migrate). */
export const ASK_AI_QUESTION_SCHEMA_SQL = `
CREATE TABLE ask_ai_question (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  lane       text NOT NULL,
  question   text NOT NULL,
  outcome    text NOT NULL
);
CREATE INDEX ask_ai_question_created_at_idx ON ask_ai_question (created_at);
`;

const RETENTION_DAYS = 90;

/**
 * Record one asked question with its terminal outcome, and sweep rows past the 90-day retention
 * window (ADR-0236: a hard DELETE, not a soft flag). One transaction; throws propagate to the
 * caller, which treats capture as best-effort.
 */
export async function logQuestion(
  db: Transactor,
  lane: string,
  question: string,
  outcome: AskOutcome,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO ask_ai_question (lane, question, outcome) VALUES ($1, $2, $3)",
      [lane, question, outcome],
    );
    await tx.query(
      `DELETE FROM ask_ai_question WHERE created_at < now() - make_interval(days => $1)`,
      [RETENTION_DAYS],
    );
  });
}

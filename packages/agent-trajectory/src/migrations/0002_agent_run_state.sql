-- 0002_agent_run_state.sql — the durable run-state table (ADR-0360 U-3), separate from the
-- append-only trajectory log: parked/awaiting-approval status, the pending toolCallId, the resume
-- seq pointer, and an opaque resumable snapshot a caller needs to continue a parked run after a
-- process restart.
--
-- NOT part of the append-only trajectory contract (AR-4's digest-only payload discipline binds the
-- TRAJECTORY EVENT LOG specifically — the substrate meant to be safely persisted/replayed/anchored
-- without leaking bodies, per schema.ts). This table is operational run state, never replayed or
-- scored by `project()`, so `parked_state` may carry the caller's real (opaque-to-this-package)
-- resumable payload — the run-state CAS mutates in place, unlike the trajectory log.
--
-- Status transitions are ALWAYS compare-and-swap `UPDATE … WHERE …` (never read-modify-write):
--   park:        INSERT (first time) or UPDATE running->parked WHERE decision is settled+claimed
--   approve/deny: UPDATE parked->running|finished WHERE status='parked' AND pending_tool_call_id=$id
--                 AND decision IS NULL — idempotent: a second approve/deny of the SAME toolCallId
--                 after the first committed is detected by re-reading `decision`, never re-mutated.
--   claimResume: UPDATE WHERE pending_tool_call_id=$id AND decision='approved' AND claimed=false —
--                so two concurrent resumes can never both execute the approved tool.
--   finish:      UPDATE (any status) — the loop's own terminal bookkeeping.
--
-- RLS is the PLAIN generated form (this table is mutable, not append-only — no withheld grant):
-- byte-identical to `buildTenantPolicySql('agent_run_state')`, pinned by
-- run-state.pg.integration.test.ts against drift.

CREATE TABLE IF NOT EXISTS agent_run_state (
  run_id             text        PRIMARY KEY,
  account_id         text        NOT NULL,
  status             text        NOT NULL,
  pending_tool_call_id text,
  decision           text,
  claimed            boolean     NOT NULL DEFAULT false,
  resume_seq         integer     NOT NULL,
  parked_state       jsonb,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_run_state_status_chk CHECK (status IN ('running', 'parked', 'finished')),
  CONSTRAINT agent_run_state_decision_chk CHECK (decision IN ('approved', 'denied')),
  CONSTRAINT agent_run_state_resume_seq_nonneg CHECK (resume_seq >= 0)
);

ALTER TABLE agent_run_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_run_state FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_run_state TO app;
CREATE POLICY agent_run_state_tenant_isolation ON agent_run_state
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));

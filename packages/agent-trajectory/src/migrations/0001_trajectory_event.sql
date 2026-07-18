-- 0001_trajectory_event.sql — the PG-backed, append-only trajectory event log (ADR-0360 U-3).
--
-- The persisted sibling of `createMemoryTrajectoryStore` (store.ts): one row per `TrajectoryEvent`,
-- keyed `(run_id, seq)` UNIQUE so the append-only invariant (no gaps, no rewrites, idempotent
-- byte-identical re-append) is enforced by the SAME mechanism ai-meter's `usage_event` and
-- audit-worm's `audit_chain_entry` use — a withheld GRANT:
--   1. WITHHELD GRANT — the `app` role gets SELECT + INSERT only; UPDATE/DELETE are never granted
--      (and are explicitly REVOKEd), so a compromised or buggy app query can append but never rewrite.
--   2. FORCE RLS — tenant isolation holds even for the table owner (ADR-0005, fail-closed).
-- Application-level gap/rewrite/idempotent-retry semantics (which the memory store's tests pin as
-- the contract) are enforced by `store.pg.ts`, not by this DDL alone.
--
-- The RLS block below (ENABLE + FORCE + the GUC-bound isolation policy) is byte-identical to
-- `buildTenantPolicySql('trajectory_event')` from @caisson/tenancy-rls, MINUS its
-- `GRANT … UPDATE, DELETE` — store.pg.integration.test.ts pins that correspondence so the two can
-- never drift (the same drift-guard field-crypto/audit-worm use).

CREATE TABLE IF NOT EXISTS trajectory_event (
  id          uuid        PRIMARY KEY,
  account_id  text        NOT NULL,
  run_id      text        NOT NULL,
  seq         integer     NOT NULL,
  event       jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- One append-only log per run: `seq` is a dense 0-based sequence, no gaps, no rewrites.
  CONSTRAINT trajectory_event_run_seq_uniq UNIQUE (run_id, seq),
  CONSTRAINT trajectory_event_seq_nonneg CHECK (seq >= 0)
);

ALTER TABLE trajectory_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE trajectory_event FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON trajectory_event TO app;
REVOKE UPDATE, DELETE ON trajectory_event FROM app;
CREATE POLICY trajectory_event_tenant_isolation ON trajectory_event
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));

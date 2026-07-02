-- 0001_impersonation_session.sql — the support-impersonation session table (ADR-0187, ADR-0005).
--
-- One row per time-bounded, reason-required support session against a tenant. The row is the
-- fail-closed liveness source of truth (`requireActive` in session.ts reads ended_at/expires_at);
-- the evidentiary dual trail itself lives in the tenant's `audit_chain_entry` chain (ADR-0052),
-- never here. `account_id` is text like every other tenant table — the RLS policy compares it
-- against the text `app.current_account` GUC (a uuid column would break that comparison).
--
-- Begin/end is the WHOLE app write surface: the `app` role gets SELECT + INSERT + a COLUMN-SCOPED
-- UPDATE (ended_at) and is NEVER granted DELETE or a full-row UPDATE — the append-only spirit of
-- the audit chain applied at the GRANT level, so a compromised or buggy app query can open and
-- close sessions but can never rewrite an operator id, a reason, or an expiry (no history rewrite).
--
-- The RLS block below (ENABLE + FORCE + the GUC-bound isolation policy) is byte-identical to
-- `buildTenantPolicySql('impersonation_session')` from @caisson/tenancy-rls, MINUS its blanket
-- GRANT — the session integration test pins that correspondence so the two can never drift.

CREATE TABLE IF NOT EXISTS impersonation_session (
  id             uuid        PRIMARY KEY,
  account_id     text        NOT NULL,
  operator_id    text        NOT NULL,
  operator_email text,
  reason         text        NOT NULL,
  started_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  ended_at       timestamptz
);

ALTER TABLE impersonation_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_session FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE (ended_at) ON impersonation_session TO app;
CREATE POLICY impersonation_session_tenant_isolation ON impersonation_session
  USING (account_id = current_setting('app.current_account', true))
  WITH CHECK (account_id = current_setting('app.current_account', true));

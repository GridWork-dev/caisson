-- 0001_alert_audit.sql — plain-Postgres audit-LOGGING table for the alerting pipeline (ADR-0135).
--
-- Explicitly NOT hash-chained WORM (see ADR-0135 "Genericness — explicitly NOT a WORM/audit-chain
-- upgrade"): this backs the `AlertAuditSink` port (audit.ts) with structured logging, not the
-- tamper-evident audit-chain @caisson/audit-worm owns. Do not import audit-worm/audit-chain here,
-- and do not add a belt trigger or hash chain to this table — that would blur the two products this
-- ADR keeps deliberately distinct.
--
-- One row per `processAlert()` outcome (delivered/suppressed/held/digested). Tenant-scoped via the
-- same RLS pattern the rest of the compliance surface uses (ADR-0005, fail-closed): the `app` role
-- gets SELECT + INSERT — ordinary audit-trail hygiene, not an immutability guarantee.

CREATE TABLE IF NOT EXISTS alert_audit_log (
  id          uuid        PRIMARY KEY,
  account_id  text        NOT NULL,
  event_id    text        NOT NULL,
  type        text        NOT NULL,
  severity    text        NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  recipient   text        NOT NULL,
  outcome     text        NOT NULL CHECK (outcome IN ('delivered', 'suppressed', 'held', 'digested')),
  -- Array of { channel, ok, error? } — the DeliveryResult[] shape from channels.ts, verbatim.
  channels    jsonb       NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_audit_log_account_created_idx
  ON alert_audit_log (account_id, created_at DESC);

ALTER TABLE alert_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_audit_log FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alert_audit_log TO app;
CREATE POLICY alert_audit_log_tenant_isolation ON alert_audit_log
  USING (account_id = current_setting('app.current_account', true))
  WITH CHECK (account_id = current_setting('app.current_account', true));

-- 0002_retention_audit_rls.sql — tenant isolation for retention_audit (ADR-0005, ADR-0135).
--
-- 0001 shipped `retention_audit` with no RLS at all — the only migration in the audited domain
-- missing tenant isolation at the DB layer. Migrations are append-only (ADR-0006), so this is a
-- follow-up ALTER rather than an edit to 0001. Same shape as `alert_audit_log` (@caisson/alerting
-- 0001_alert_audit.sql): plain audit-LOGGING, not WORM/hash-chained, so the `app` role gets
-- SELECT + INSERT only — ordinary audit-trail hygiene, not an immutability guarantee. Fail-closed
-- (ADR-0005): FORCE RLS means a query that never bound `app.current_account` sees zero rows, not
-- every tenant's.

ALTER TABLE retention_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_audit FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON retention_audit TO app;
CREATE POLICY retention_audit_tenant_isolation ON retention_audit
  USING (tenant_id = current_setting('app.current_account', true))
  WITH CHECK (tenant_id = current_setting('app.current_account', true));

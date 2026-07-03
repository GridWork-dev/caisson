-- 0003_retention_audit_rls_nullif.sql — pgbouncer/pooler RLS hardening (ADR-0005, ADR-0006).
--
-- 0002's policy compared the GUC read bare. A pooled connection that resets custom GUCs to `''`
-- instead of fully unsetting them (a known transaction-pooling behavior) would then compare
-- `tenant_id = ''` — a coincidental deny only for as long as no row's tenant column is literally
-- the empty string. Migrations are append-only (ADR-0006): 0002 already shipped, so this is a
-- follow-up DROP+CREATE POLICY rather than an edit to 0002. Byte-identical in shape to
-- `buildTenantPolicySql('retention_audit')` (@caisson/tenancy-rls), which now wraps the same GUC
-- read in `NULLIF(..., '')`.

DROP POLICY retention_audit_tenant_isolation ON retention_audit;
CREATE POLICY retention_audit_tenant_isolation ON retention_audit
  USING (tenant_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_account', true), ''));

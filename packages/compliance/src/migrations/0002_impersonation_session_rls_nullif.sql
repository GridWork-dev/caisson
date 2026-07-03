-- 0002_impersonation_session_rls_nullif.sql — pgbouncer/pooler RLS hardening (ADR-0005, ADR-0006).
--
-- 0001's policy compared the GUC read bare. A pooled connection that resets custom GUCs to `''`
-- instead of fully unsetting them (a known transaction-pooling behavior) would then compare
-- `account_id = ''` — a coincidental deny only for as long as no row's tenant column is literally
-- the empty string. Migrations are append-only (ADR-0006): 0001 already shipped, so this is a
-- follow-up DROP+CREATE POLICY rather than an edit to 0001. Byte-identical in shape to
-- `buildTenantPolicySql('impersonation_session')` (@caisson/tenancy-rls), which now wraps the same
-- GUC read in `NULLIF(..., '')`.

DROP POLICY impersonation_session_tenant_isolation ON impersonation_session;
CREATE POLICY impersonation_session_tenant_isolation ON impersonation_session
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));

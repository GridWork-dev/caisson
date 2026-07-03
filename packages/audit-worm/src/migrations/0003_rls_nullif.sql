-- 0003_rls_nullif.sql — pgbouncer/pooler RLS hardening (ADR-0005, ADR-0006).
--
-- 0001 and 0002's policies compared the GUC read bare. A pooled connection that resets custom GUCs
-- to `''` instead of fully unsetting them (a known transaction-pooling behavior) would then compare
-- `account_id = ''` — a coincidental deny only for as long as no row's tenant column is literally
-- the empty string. Migrations are append-only (ADR-0006): 0001/0002 already shipped, so this is a
-- follow-up DROP+CREATE POLICY rather than an edit to either. Byte-identical in shape to
-- `buildTenantPolicySql(<table>)` (@caisson/tenancy-rls), which now wraps the same GUC read in
-- `NULLIF(..., '')`.

DROP POLICY audit_chain_entry_tenant_isolation ON audit_chain_entry;
CREATE POLICY audit_chain_entry_tenant_isolation ON audit_chain_entry
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));

DROP POLICY locked_version_tenant_isolation ON locked_version;
CREATE POLICY locked_version_tenant_isolation ON locked_version
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));

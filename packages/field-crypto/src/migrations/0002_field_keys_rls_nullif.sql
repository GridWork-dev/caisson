-- 0002_field_keys_rls_nullif.sql — pgbouncer/pooler RLS hardening (ADR-0005, ADR-0006).
--
-- 0001's policies compared the GUC read bare. A pooled connection that resets custom GUCs to `''`
-- instead of fully unsetting them (a known transaction-pooling behavior) would then compare
-- `account_id = ''` — a coincidental deny only for as long as no row's tenant column is literally
-- the empty string. Migrations are append-only (ADR-0006): 0001 already shipped, so this is a
-- follow-up DROP+CREATE POLICY rather than an edit to 0001. Byte-identical in shape to
-- `buildTenantPolicySql(<table>)` (@caisson/tenancy-rls), which now wraps the same GUC read in
-- `NULLIF(..., '')`.

DROP POLICY field_key_version_tenant_isolation ON field_key_version;
CREATE POLICY field_key_version_tenant_isolation ON field_key_version
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));

DROP POLICY field_wrapped_dek_tenant_isolation ON field_wrapped_dek;
CREATE POLICY field_wrapped_dek_tenant_isolation ON field_wrapped_dek
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));

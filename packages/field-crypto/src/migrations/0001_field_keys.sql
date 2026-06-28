-- 0001_field_keys.sql — DB-backed, append-only per-tenant key-version + wrapped-DEK tables
-- (ADR-0055, ADR-0043, ADR-0014). The persistence behind `PgKeyVersionStore` (the current key
-- version per tenant) and `PgWrappedKeyStore` (each version's KEK-wrapped DEK for the KMS provider).
--
-- field-crypto stays KERNEL-ONLY (ADR-0043/0003): the runtime store NEVER imports @caisson/tenancy-rls
-- and takes a pre-tenant-scoped executor, so the ENABLE+FORCE-RLS policy is hand-authored HERE rather
-- than emitted from `buildTenantPolicySql`. The RLS block below is byte-identical to
-- `buildTenantPolicySql('<table>')` MINUS its `GRANT … UPDATE, DELETE` — the integration test pins
-- that correspondence so the two can never drift.
--
-- APPEND-ONLY per version (ADR-0046 lazy re-encrypt): a (tenant, key_version) → wrapped-DEK mapping,
-- once written, is immutable. Rewriting or dropping a version's wrapped DEK would brick every field
-- encrypted under it, so immutability is enforced THREE ways so no single bug defeats it:
--   1. WITHHELD GRANT — the `app` role gets SELECT + INSERT only; UPDATE/DELETE are never granted
--      (and are explicitly REVOKEd), so a compromised or buggy app query can append but never rewrite.
--   2. BELT TRIGGER — a BEFORE UPDATE/DELETE trigger RAISEs unconditionally, so the tables stay
--      immutable even against a role that DOES hold UPDATE/DELETE (the table owner / superuser):
--      triggers are not bypassed by superuser the way column privileges and RLS can be.
--   3. FORCE RLS — tenant isolation holds even for the table owner (ADR-0005, fail-closed).
-- Old versions therefore stay decryptable forever; rotation only appends a higher version. Erasure is
-- a KMS-side crypto-shred of the KEK (ADR-0055 / T8), never a row mutation here.

-- The current key version per tenant. One row per (tenant, version); "current" is DERIVED as the
-- greatest recorded version (versions mint monotonically), never stored as a mutable pointer.
CREATE TABLE IF NOT EXISTS field_key_version (
  id          uuid        PRIMARY KEY,
  account_id  text        NOT NULL,
  key_version integer     NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- A version is recorded at most once per tenant (idempotent set); the uint16 envelope bound (ADR-0046).
  CONSTRAINT field_key_version_account_kv_uniq UNIQUE (account_id, key_version),
  CONSTRAINT field_key_version_kv_uint16 CHECK (key_version BETWEEN 1 AND 65535)
);

-- The KEK-wrapped DEK for each (tenant, version). The plaintext DEK NEVER lands here — only its
-- wrapped form (KmsClient unwraps it transiently on read). bytea, append-only.
CREATE TABLE IF NOT EXISTS field_wrapped_dek (
  id          uuid        PRIMARY KEY,
  account_id  text        NOT NULL,
  key_version integer     NOT NULL,
  wrapped     bytea       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Exactly one immutable wrapped DEK per (tenant, version) — a re-wrap of an existing version is
  -- refused (23505 → ConflictError) so a minted DEK can never be silently overwritten.
  CONSTRAINT field_wrapped_dek_account_kv_uniq UNIQUE (account_id, key_version),
  CONSTRAINT field_wrapped_dek_kv_uint16 CHECK (key_version BETWEEN 1 AND 65535)
);

-- Belt trigger (shared): append-only even against a role that holds UPDATE/DELETE (superuser included).
CREATE OR REPLACE FUNCTION field_keys_block_mutation()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER field_key_version_no_update
  BEFORE UPDATE ON field_key_version
  FOR EACH ROW EXECUTE FUNCTION field_keys_block_mutation();
CREATE TRIGGER field_key_version_no_delete
  BEFORE DELETE ON field_key_version
  FOR EACH ROW EXECUTE FUNCTION field_keys_block_mutation();
CREATE TRIGGER field_wrapped_dek_no_update
  BEFORE UPDATE ON field_wrapped_dek
  FOR EACH ROW EXECUTE FUNCTION field_keys_block_mutation();
CREATE TRIGGER field_wrapped_dek_no_delete
  BEFORE DELETE ON field_wrapped_dek
  FOR EACH ROW EXECUTE FUNCTION field_keys_block_mutation();

-- RLS: byte-identical to buildTenantPolicySql('field_key_version') minus its UPDATE/DELETE grant.
ALTER TABLE field_key_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_key_version FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON field_key_version TO app;
REVOKE UPDATE, DELETE ON field_key_version FROM app;
CREATE POLICY field_key_version_tenant_isolation ON field_key_version
  USING (account_id = current_setting('app.current_account', true))
  WITH CHECK (account_id = current_setting('app.current_account', true));

-- RLS: byte-identical to buildTenantPolicySql('field_wrapped_dek') minus its UPDATE/DELETE grant.
ALTER TABLE field_wrapped_dek ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_wrapped_dek FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON field_wrapped_dek TO app;
REVOKE UPDATE, DELETE ON field_wrapped_dek FROM app;
CREATE POLICY field_wrapped_dek_tenant_isolation ON field_wrapped_dek
  USING (account_id = current_setting('app.current_account', true))
  WITH CHECK (account_id = current_setting('app.current_account', true));

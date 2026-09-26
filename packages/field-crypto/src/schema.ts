// Production-composable field-key schema. This is the effective final state of the shipped
// migrations/0001 + 0002 chain, expressed as one fresh-install migration for host applications that
// fold package DDL into their own forward-only ledger. The shipped SQL files remain immutable.
//
// Append-only is enforced at three layers: the app role has SELECT+INSERT only, explicit REVOKEs
// remove mutation privileges, and a trigger rejects UPDATE/DELETE even for the table owner. RLS is
// FORCEd and uses the pooler-hardened NULLIF GUC comparison from @caisson-sh/tenancy-rls.
export const FIELD_CRYPTO_KEY_SCHEMA_SQL = `
CREATE TABLE field_key_version (
  id          uuid        PRIMARY KEY,
  account_id  text        NOT NULL,
  key_version integer     NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_key_version_account_kv_uniq UNIQUE (account_id, key_version),
  CONSTRAINT field_key_version_kv_uint16 CHECK (key_version BETWEEN 1 AND 65535)
);

CREATE TABLE field_wrapped_dek (
  id          uuid        PRIMARY KEY,
  account_id  text        NOT NULL,
  key_version integer     NOT NULL,
  wrapped     bytea       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_wrapped_dek_account_kv_uniq UNIQUE (account_id, key_version),
  CONSTRAINT field_wrapped_dek_kv_uint16 CHECK (key_version BETWEEN 1 AND 65535)
);

CREATE FUNCTION field_keys_block_mutation()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER field_key_version_no_mutation
  BEFORE UPDATE OR DELETE ON field_key_version
  FOR EACH ROW EXECUTE FUNCTION field_keys_block_mutation();
CREATE TRIGGER field_wrapped_dek_no_mutation
  BEFORE UPDATE OR DELETE ON field_wrapped_dek
  FOR EACH ROW EXECUTE FUNCTION field_keys_block_mutation();

ALTER TABLE field_key_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_key_version FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON field_key_version TO app;
REVOKE UPDATE, DELETE ON field_key_version FROM app;
CREATE POLICY field_key_version_tenant_isolation ON field_key_version
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));

ALTER TABLE field_wrapped_dek ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_wrapped_dek FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON field_wrapped_dek TO app;
REVOKE UPDATE, DELETE ON field_wrapped_dek FROM app;
CREATE POLICY field_wrapped_dek_tenant_isolation ON field_wrapped_dek
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));
`;

-- 0004_artifact_versions.sql — durable exact provider identities for WORM artifacts.
--
-- A versioned object store's key is a mutable "current" pointer: replacement versions and delete
-- markers can hide the immutable version originally returned by put(). This append-only ledger binds
-- each tenant-scoped WORM key to that exact opaque provider identity so every later read can address
-- the originally committed bytes. Legacy/non-versioned backends simply have no row.

CREATE TABLE IF NOT EXISTS worm_artifact_version (
  id          uuid        PRIMARY KEY,
  account_id  text        NOT NULL,
  artifact_key text       NOT NULL,
  version_id  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worm_artifact_version_key_uniq UNIQUE (account_id, artifact_key),
  CONSTRAINT worm_artifact_version_nonempty CHECK (length(version_id) > 0)
);

CREATE OR REPLACE FUNCTION worm_artifact_version_block_mutation()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'worm_artifact_version is append-only: % is not permitted', TG_OP;
END;
$$;

CREATE TRIGGER worm_artifact_version_no_update
  BEFORE UPDATE ON worm_artifact_version
  FOR EACH ROW EXECUTE FUNCTION worm_artifact_version_block_mutation();

CREATE TRIGGER worm_artifact_version_no_delete
  BEFORE DELETE ON worm_artifact_version
  FOR EACH ROW EXECUTE FUNCTION worm_artifact_version_block_mutation();

ALTER TABLE worm_artifact_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE worm_artifact_version FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON worm_artifact_version TO app;
REVOKE UPDATE, DELETE ON worm_artifact_version FROM app;
CREATE POLICY worm_artifact_version_tenant_isolation ON worm_artifact_version
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));

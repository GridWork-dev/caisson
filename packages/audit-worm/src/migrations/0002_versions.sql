-- 0002_versions.sql — append-only locked-version table + DERIVED current (ADR-0053, ADR-0014).
--
-- A locked artifact is NEVER mutated (ADR-0006): a change mints a NEW row that supersedes the prior
-- via `supersedes_id`, and "current" is DERIVED — a version is current iff nothing supersedes it —
-- never stored. version-store.ts reads this table through kernel/versioning.ts (validateVersionSet /
-- currentVersions / versionChain) verbatim, so the pure model and the SQL predicate can never drift.
--
-- Immutability is enforced THREE ways so no single bug defeats it (TM-D):
--   1. WITHHELD GRANT — the `app` role gets SELECT + INSERT only; UPDATE/DELETE are never granted
--      (and are explicitly REVOKEd), so a compromised or buggy app query can append but never rewrite.
--   2. BELT TRIGGER — a BEFORE UPDATE/DELETE trigger RAISEs unconditionally, so the table stays
--      immutable even against a role that DOES hold UPDATE/DELETE (incl. the table owner): triggers
--      are not bypassed by superuser the way column privileges and RLS can be.
--   3. FORCE RLS — tenant isolation holds even for the table owner (ADR-0005).
--
-- No-fork is structural: UNIQUE(account_id, supersedes_id) lets a prior be superseded AT MOST once
-- (NULLs are distinct, so many roots/lineages per tenant are fine); the composite FK
-- (account_id, supersedes_id) → (account_id, id) keeps every supersede WITHIN one tenant.
--
-- The RLS block (ENABLE + FORCE + the GUC-bound policy) is byte-identical to
-- buildTenantPolicySql('locked_version') MINUS its UPDATE/DELETE grant — the integration test pins
-- that correspondence so the two can never drift.

CREATE TABLE IF NOT EXISTS locked_version (
  id            uuid        PRIMARY KEY,
  account_id    text        NOT NULL,
  artifact_id   text        NOT NULL,
  supersedes_id uuid,
  provenance    jsonb       NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- The (account_id, id) target the composite FK below references → a supersede stays in-tenant.
  CONSTRAINT locked_version_account_id_uniq UNIQUE (account_id, id),
  -- A prior version is superseded by AT MOST one successor → no fork (NULLs distinct ⇒ many roots OK).
  CONSTRAINT locked_version_one_successor_uniq UNIQUE (account_id, supersedes_id),
  -- The superseded version must exist within the SAME tenant — never cross-tenant.
  CONSTRAINT locked_version_supersedes_fk
    FOREIGN KEY (account_id, supersedes_id)
    REFERENCES locked_version (account_id, id),
  -- A version cannot supersede itself.
  CONSTRAINT locked_version_no_self_supersede
    CHECK (supersedes_id IS NULL OR supersedes_id <> id)
);

-- Belt trigger: append-only even against a role that holds UPDATE/DELETE (superuser included).
CREATE OR REPLACE FUNCTION locked_version_block_mutation()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'locked_version is append-only: % is not permitted', TG_OP;
END;
$$;

CREATE TRIGGER locked_version_no_update
  BEFORE UPDATE ON locked_version
  FOR EACH ROW EXECUTE FUNCTION locked_version_block_mutation();

CREATE TRIGGER locked_version_no_delete
  BEFORE DELETE ON locked_version
  FOR EACH ROW EXECUTE FUNCTION locked_version_block_mutation();

ALTER TABLE locked_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE locked_version FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON locked_version TO app;
REVOKE UPDATE, DELETE ON locked_version FROM app;
CREATE POLICY locked_version_tenant_isolation ON locked_version
  USING (account_id = current_setting('app.current_account', true))
  WITH CHECK (account_id = current_setting('app.current_account', true));

// The prompt-registry schema (ADR-0061/0014). Two tables, fail-closed tenant-isolated:
//
//   - `prompt_version` — APPEND-ONLY immutable versions. A change mints a NEW row that supersedes
//     the prior one via `supersedes_id` (the kernel `versioning` chain, ADR-0006); "current" is
//     DERIVED (nothing supersedes it), never stored. The app role gets SELECT + INSERT only — UPDATE
//     and DELETE are REVOKED, so a version can never be mutated in place.
//   - `prompt_alias` — a MUTABLE pointer (`prod`/`canary`/…) → a specific version. Promotion is an
//     UPDATE of the pointer alone; the version rows are never touched, so a live prompt swaps with
//     no redeploy.
//
// Both tables are FORCE-RLS via `buildTenantPolicySql` (@caisson-sh/tenancy-rls) so a query that forgets
// its tenant filter — or its `withTenant` scope entirely — sees nothing. In prod this is a numbered
// forward-only migration (ADR-0014/0070); the DDL is owned here and applied verbatim in tests.
import { buildTenantPolicySql } from "@caisson-sh/tenancy-rls";

export const PROMPT_VERSION_TABLE = "prompt_version";
export const PROMPT_ALIAS_TABLE = "prompt_alias";

export const PROMPT_REGISTRY_SCHEMA_SQL = `
CREATE TABLE ${PROMPT_VERSION_TABLE} (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  name text NOT NULL,
  version integer NOT NULL,
  -- The version this one supersedes, or NULL for the root of a lineage (ADR-0006). A self-FK keeps
  -- the chain referentially intact; FK checks bypass RLS, so the link holds under FORCE-RLS.
  supersedes_id text REFERENCES ${PROMPT_VERSION_TABLE}(id),
  messages jsonb NOT NULL,
  -- The variable declaration (name -> scalar type), compiled to a strict Zod schema at render time.
  var_spec jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prompt_version_version_pos CHECK (version > 0),
  CONSTRAINT prompt_version_name_version_uniq UNIQUE (account_id, name, version)
);

CREATE TABLE ${PROMPT_ALIAS_TABLE} (
  account_id text NOT NULL,
  name text NOT NULL,
  alias text NOT NULL,
  version_id text NOT NULL REFERENCES ${PROMPT_VERSION_TABLE}(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prompt_alias_pk PRIMARY KEY (account_id, name, alias)
);

${buildTenantPolicySql(PROMPT_VERSION_TABLE)}
-- Append-only (ADR-0006/0061): the registry mints a new version, never mutates or deletes one.
REVOKE UPDATE, DELETE ON ${PROMPT_VERSION_TABLE} FROM app;

${buildTenantPolicySql(PROMPT_ALIAS_TABLE)}
`;

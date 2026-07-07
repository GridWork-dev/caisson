-- provision-role.sql — the least-privilege runtime role for the intel daemon (ADR-0286).
--
-- Run this ONCE, as the database owner/superuser, BEFORE the daemon's first boot — and BEFORE
-- 0001_intel_schema.sql, in the same connecting session (ALTER DEFAULT PRIVILEGES below only
-- applies to objects the CURRENT role subsequently creates; running both files back-to-back as
-- the same owner role is what makes intel_role automatically inherit rights on the tables
-- 0001_intel_schema.sql creates, with no ownership hand-off step required).
--
-- WHY THIS IS A SEPARATE FILE: 0001_intel_schema.sql is pure schema DDL (CREATE SCHEMA/TABLE/
-- INDEX, all IF NOT EXISTS — safe to re-run, safe for a constrained role to execute once granted
-- CREATE). Role provisioning (CREATE ROLE, GRANT, REVOKE) needs privileges well beyond that — a
-- re-run of the schema migration should never require re-elevating. Splitting them means the
-- schema migration can even run AS intel_role after this file has provisioned it (CREATE was
-- granted on the schema below), while this file itself always needs the owner/superuser.
--
-- Change REPLACE_ME_PASSWORD before running against a real database. This file is safe to
-- commit — it contains no secret, only a placeholder.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'intel_role') THEN
    CREATE ROLE intel_role LOGIN PASSWORD 'REPLACE_ME_PASSWORD';
  END IF;
END
$$;

-- Idempotent even if this runs before 0001_intel_schema.sql ever has — the grants below need the
-- schema to exist regardless of which migration file ran first.
CREATE SCHEMA IF NOT EXISTS intel;

GRANT USAGE, CREATE ON SCHEMA intel TO intel_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA intel TO intel_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA intel TO intel_role;

-- Future tables/sequences created in `intel` BY THE ROLE RUNNING THIS SCRIPT (the owner) inherit
-- these grants automatically — this is what lets 0001_intel_schema.sql run afterward, as the
-- same owner, without a second grant pass.
ALTER DEFAULT PRIVILEGES IN SCHEMA intel GRANT ALL PRIVILEGES ON TABLES TO intel_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA intel GRANT ALL PRIVILEGES ON SEQUENCES TO intel_role;

-- THE CONTAINMENT: every commerce/license/entitlement table lives in `public`. A fresh role has
-- no privileges by default, but some databases widen PUBLIC's own implicit CONNECT/USAGE on the
-- `public` schema — revoke both that implicit path and any direct grant to intel_role, so this
-- holds even on a database whose defaults were widened before this script ran.
REVOKE ALL ON SCHEMA public FROM intel_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM intel_role;

-- Verify (run manually after provisioning, connected AS intel_role):
--   SELECT 1 FROM public.accounts;  -- must fail: permission denied for schema public
--   INSERT INTO intel.findings (...) VALUES (...);  -- must succeed
-- server.ts's checkRoleIsolation() automates the first check as an opt-in boot-time self-check
-- (gated behind INTEL_MIGRATE_ON_BOOT=false, the production posture).

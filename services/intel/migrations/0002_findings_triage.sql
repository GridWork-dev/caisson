-- 0002_findings_triage.sql — triage workflow state for intel.findings (ADR-0316 fork F5).
--
-- Additive and idempotent (IF NOT EXISTS on every ALTER), same posture as 0001. Findings
-- accumulate append-only with no way to mark one handled, so the /intel operator can never clear
-- the wall. Three columns give a finding a lifecycle: `status` (open -> reviewed | dismissed) plus
-- who/when last triaged it. Apply against INTEL_DATABASE_URL as the DDL-owning role (same role that
-- ran 0001).
--
-- The admin control-plane UPDATEs `status` cross-schema as the read/write `admin_write` role
-- (apps/admin, ADR-0220 dual-log). This grants it, GUARDED for role absence — the same
-- migrate-before-role-provisioned pattern `affiliate_code` uses: on a fresh DB where `admin_write`
-- does not exist yet the grant is skipped, and re-applied at the operator-gated admin DEPLOY step;
-- on the live DB (role present) it applies here. `admin` (read-only) already has USAGE + SELECT
-- from the daemon's admin-read grant.

ALTER TABLE intel.findings
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'dismissed'));
ALTER TABLE intel.findings ADD COLUMN IF NOT EXISTS triaged_at timestamptz;
ALTER TABLE intel.findings ADD COLUMN IF NOT EXISTS triaged_by text;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin_write') THEN
    GRANT USAGE ON SCHEMA intel TO admin_write;
    GRANT SELECT, UPDATE ON intel.findings TO admin_write;
  END IF;
END $$;

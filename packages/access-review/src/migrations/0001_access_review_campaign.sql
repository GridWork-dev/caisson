-- 0001_access_review_campaign.sql — the access-review campaign roster table (ADR-0371, ADR-0005).
--
-- One row per open/closed review campaign: the reviewer, the frozen reviewee roster (jsonb array,
-- snapshotted at open time — a later membership change never mutates an in-flight campaign), the
-- review window, and whether it has closed. The evidentiary decision trail itself lives ONLY on
-- the tenant's existing `audit_chain_entry` chain (@caisson/audit-worm, ADR-0052) — never here.
--
-- `closed_at` is the WHOLE app write surface after insert: the `app` role gets SELECT + INSERT + a
-- COLUMN-SCOPED UPDATE (closed_at) and is NEVER granted DELETE or a full-row UPDATE — a compromised
-- or buggy app query can open and close campaigns but can never rewrite a reviewer, a roster, or a
-- deadline (no history rewrite). Same shape as `impersonation_session`
-- (@caisson/compliance/src/migrations/0001_impersonation_session.sql).
--
-- The RLS block below (ENABLE + FORCE + the pooler-hardened NULLIF GUC read) is byte-identical to
-- `buildTenantPolicySql('access_review_campaign')` MINUS its blanket GRANT — the integration test
-- pins that correspondence so the two can never drift.

CREATE TABLE IF NOT EXISTS access_review_campaign (
  id           uuid        PRIMARY KEY,
  account_id   text        NOT NULL,
  reviewer_id  text        NOT NULL,
  reviewees    jsonb       NOT NULL,
  opened_at    timestamptz NOT NULL DEFAULT now(),
  deadline_at  timestamptz NOT NULL,
  closed_at    timestamptz
);

ALTER TABLE access_review_campaign ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_review_campaign FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE (closed_at) ON access_review_campaign TO app;
CREATE POLICY access_review_campaign_tenant_isolation ON access_review_campaign
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));

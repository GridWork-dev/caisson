-- 0001_retention_audit.sql — plain-Postgres, reason-tagged erasure audit log (ADR-0135, ADR-0152).
--
-- Audit-LOGGING only — explicitly NOT WORM / hash-chained (ADR-0135 Genericness section). One row
-- per `runErasure()` call: `reason` carries the trigger (auto_90d | ccpa_request | operator_manual),
-- `results` is the per-target outcome array (`TargetResult[]`) as written by the in-memory/pg
-- `RetentionAuditSink` driver, and `at` is the injected run timestamp (epoch ms, matches
-- `RetentionRunResult.at` — never `now()` at write time, so the row reflects when the run itself
-- happened, not when it was persisted).

CREATE TABLE IF NOT EXISTS retention_audit (
  id          uuid        PRIMARY KEY,
  tenant_id   text        NOT NULL,
  subject_id  text        NOT NULL,
  reason      text        NOT NULL
    CHECK (reason IN ('auto_90d', 'ccpa_request', 'operator_manual')),
  results     jsonb       NOT NULL,
  at          bigint      NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Lookup by subject within a tenant (e.g. "was subject X already erased?").
CREATE INDEX IF NOT EXISTS retention_audit_tenant_subject_idx
  ON retention_audit (tenant_id, subject_id);

-- Lookup by trigger (e.g. auditing the recurring auto_90d sweep separately from CCPA requests).
CREATE INDEX IF NOT EXISTS retention_audit_reason_idx
  ON retention_audit (reason);

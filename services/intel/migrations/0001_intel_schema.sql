-- 0001_intel_schema.sql — the operator intelligence schema.
--
-- Additive and self-contained: it creates one schema and three tables and references NOTHING
-- in the commerce/public schema. Apply it against INTEL_DATABASE_URL as the role that DSN
-- uses; that role owns these objects and holds DML on this schema and nothing else (least
-- privilege). No row-level security: this is a single-operator control-plane store, not a
-- multi-tenant surface, so the tenant-isolation policy the commerce tables carry does not apply.

CREATE SCHEMA IF NOT EXISTS intel;

-- The append-with-dedup incident store. A finding is inserted once per distinct dedup_key;
-- re-observing the same signal reinforces the existing row (bumps last_seen + seen_count)
-- rather than duplicating it. Nothing here is ever deleted by the daemon.
CREATE TABLE IF NOT EXISTS intel.findings (
  id          uuid        PRIMARY KEY,
  source      text        NOT NULL,
  kind        text        NOT NULL,
  severity    text        NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title       text        NOT NULL,
  body        text        NOT NULL,
  dedup_key   text        NOT NULL UNIQUE,
  seen_count  integer     NOT NULL DEFAULT 1,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  run_id      uuid        NOT NULL,
  payload     jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS findings_source_last_seen_idx
  ON intel.findings (source, last_seen DESC);

-- The deterministic-detection memory: last version / content hash / count per source key.
-- Survives daemon restarts, so "changed since last run" holds across a redeploy.
CREATE TABLE IF NOT EXISTS intel.watch_state (
  key         text        PRIMARY KEY,
  value       text        NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per watcher invocation — a thin run ledger for observability.
CREATE TABLE IF NOT EXISTS intel.runs (
  id             uuid        PRIMARY KEY,
  watcher        text        NOT NULL,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  status         text        NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'error')),
  findings_count integer     NOT NULL DEFAULT 0,
  error          text
);

CREATE INDEX IF NOT EXISTS runs_watcher_started_idx
  ON intel.runs (watcher, started_at DESC);

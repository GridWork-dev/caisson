// ADR-0286 — the admin intel findings reader. The standing intel daemon
// (`services/intel`, `@caisson/service-intel`) writes to a dedicated `intel` Postgres schema on
// the SAME admin database (its own least-privilege `intel_role` DSN — see
// `services/intel/migrations/provision-role.sql`); this module is the OTHER half named in that
// service's own README ("the admin control-plane app reads the `intel` schema ... a separate,
// later piece of work"). Reads run through the SAME read-only `admin` role every other
// business-admin view uses (`readAdmin`, ADR-0141) — `intel.findings` carries no row-level
// security (it's a single-operator control-plane store, not multi-tenant data), so the grant
// below is a plain cross-schema SELECT, not the `USING (true)` permissive-policy dance
// `buildAdminReadPolicySql` applies to RLS-enabled tenant tables.
import type { TenantExecutor } from "@caisson/tenancy-rls";

/** Byte-mirror of `@caisson/service-intel`'s `finding.ts` `SEVERITIES` — this app has no
 *  dependency on that service package (it is a daemon, not a library this app composes), so the
 *  small closed vocabulary is duplicated here rather than adding a new workspace dependency for
 *  two string arrays. KEEP IN SYNC WITH services/intel/src/finding.ts. */
export const INTEL_SEVERITIES = ["info", "warning", "critical"] as const;
export type IntelSeverity = (typeof INTEL_SEVERITIES)[number];

/** Byte-mirror of `@caisson/service-intel`'s `FINDING_SOURCES` — see the note above. KEEP IN SYNC
 *  WITH services/intel/src/finding.ts. */
export const INTEL_SOURCES = [
  "compliance",
  "soc2",
  "competitor",
  "github",
  "analytics",
  "error",
] as const;
export type IntelSource = (typeof INTEL_SOURCES)[number];

export function isIntelSeverity(v: string): v is IntelSeverity {
  return (INTEL_SEVERITIES as readonly string[]).includes(v);
}
export function isIntelSource(v: string): v is IntelSource {
  return (INTEL_SOURCES as readonly string[]).includes(v);
}

/**
 * Byte-mirror of `services/intel/migrations/0001_intel_schema.sql` — DEV/TEST DOUBLE ONLY (same
 * "byte-mirror the sibling service's migration for the PGlite double" pattern `admin-db.ts`
 * already applies to `@caisson/audit-worm`'s `AUDIT_CHAIN_SCHEMA_SQL`). Production applies the
 * real migration file, as the DDL-owning role, per that service's own Deploying steps — this app
 * never runs DDL against `intel` in prod, only the read-only GRANT below.
 */
export const INTEL_SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS intel;

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
`;

/**
 * Grant the read-only `admin` role plain cross-schema SELECT on `intel.findings` — additive,
 * idempotent (`GRANT` is safe to re-run). Applied in the PGlite dev double (below) and, for real
 * Railway Postgres, as an operator-gated DEPLOY step alongside the daemon's own provisioning
 * (mirrors how `ADMIN_MUTATION_PROVISION_SQL` is applied after the `admin_write` role exists).
 */
export const INTEL_ADMIN_READ_GRANT_SQL = `
GRANT USAGE ON SCHEMA intel TO admin;
GRANT SELECT ON intel.findings TO admin;
`;

export interface IntelFindingRow {
  id: string;
  source: string;
  kind: string;
  severity: string;
  title: string;
  body: string;
  seenCount: number;
  firstSeen: string;
  lastSeen: string;
}

export interface IntelFindingFilter {
  severity?: IntelSeverity;
  source?: IntelSource;
}

/** Bound every list read — this is an operator dashboard, never an unbounded export. */
const FINDINGS_LIMIT = 200;

/**
 * Read the most-recently-seen findings, newest first, optionally narrowed to one severity and/or
 * one source. Runs through `readAdmin` (the read-only `admin` role, ADR-0141) — the one seam
 * every business-admin view reads through.
 */
export async function readIntelFindings(
  tx: TenantExecutor,
  filter: IntelFindingFilter = {},
): Promise<IntelFindingRow[]> {
  const conditions: string[] = [];
  const params: string[] = [];
  if (filter.severity !== undefined) {
    params.push(filter.severity);
    conditions.push(`severity = $${String(params.length)}`);
  }
  if (filter.source !== undefined) {
    params.push(filter.source);
    conditions.push(`source = $${String(params.length)}`);
  }
  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await tx.query<{
    id: string;
    source: string;
    kind: string;
    severity: string;
    title: string;
    body: string;
    seen_count: number;
    first_seen: unknown;
    last_seen: unknown;
  }>(
    `SELECT id, source, kind, severity, title, body, seen_count, first_seen, last_seen
       FROM intel.findings
       ${where}
      ORDER BY last_seen DESC
      LIMIT ${String(FINDINGS_LIMIT)}`,
    params,
  );
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    kind: r.kind,
    severity: r.severity,
    title: r.title,
    body: r.body,
    seenCount: Number(r.seen_count),
    firstSeen: String(r.first_seen),
    lastSeen: String(r.last_seen),
  }));
}

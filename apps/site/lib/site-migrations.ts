// The ONE apps/site-local migration list (CAISSON-64 P0 fix) — folded onto the shared
// @caisson/platform-migrations chain by BOTH consumers that need it: the deploy-time applier
// (deploy-migrate.ts, real Railway Postgres) and the dev PGlite double (db.ts). These used to be
// two hand-maintained arrays that drifted: db.ts's dev double additionally ran
// 0020_tenant_ai_credential / 0021_byok_key_meta / 0022_compliance_attestation, which
// deploy-migrate.ts's real-Postgres apply never learned about — `byok_key_meta` was never created
// in production, so /dashboard/ai-keys crashed for every account (readKeyStatuses selects from a
// table that doesn't exist). ONE list, imported by both, closes that drift class for good — a new
// apps/site-local migration now lands for both consumers or neither.
//
// Ordering note: `assembleMigrations` (kernel, via @caisson/platform-migrations's
// `platformMigrationsPackage`/`applyAll`) sorts a package's migrations by FILENAME, not array
// position — so the array order below is cosmetic; only the numeric filename prefix determines
// apply order. `0011`/`0012` keep their PROD-CANONICAL names: the live, name-keyed
// `schema_version` ledger already recorded them under those names, and the chain is forward-only
// (ADR-0006) — renaming them would make a real deployment try to re-apply them as "new"
// migrations. `0020`-`0022` are net-new (never applied anywhere but this app's dev PGlite double,
// under those exact names already) and sort after `0011`/`0012` and after the shared chain's own
// highest migration (`0019_order_record.sql`) by construction — no renumbering needed, no gap in
// the ledger, and the dev PGlite double (which rebuilds fresh on every process boot) loses nothing
// by dropping its old `0023`/`0024` aliases for the two ask_ai_* tables.
import { TENANT_AI_CREDENTIAL_SCHEMA_SQL } from "@caisson/ai-kit";
import type { MigrationFile } from "@caisson/platform-migrations";
import { RATE_LIMIT_SCHEMA_SQL } from "@caisson/rate-limit";
import { buildTenantPolicySql } from "@caisson/tenancy-rls";
import { ASK_AI_QUESTION_SCHEMA_SQL } from "./ask-ai/question-log.ts";
import { ASK_AI_SPEND_SCHEMA_SQL } from "./ask-ai/spend.ts";
import {
  DEMO_RUN_BUDGET_SCHEMA_SQL,
  DEMO_RUN_LEADS_SCHEMA_SQL,
} from "./demo-run/store.ts";

// BYOK display metadata (ADR-0183) — holds NO secret: the encrypted key lives in ai-kit's
// `tenant_ai_credential`; this table carries only the masked tail + version so the write-only edge
// can render status without ever reading the key back.
const BYOK_KEY_META_SCHEMA_SQL = `
CREATE TABLE byok_key_meta (
  id          text PRIMARY KEY,
  account_id  text NOT NULL,
  provider    text NOT NULL,
  last4       text NOT NULL,
  key_version integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, provider)
);
${buildTenantPolicySql("byok_key_meta")}
`;

// Compliance manual-attestation slots (ADR-0181) — a filled row = the human attested that slot for a
// framework. Presence = filled; deletion = cleared. No secret; free-text note bounded at the edge.
const COMPLIANCE_ATTESTATION_SCHEMA_SQL = `
CREATE TABLE compliance_attestation (
  id          text PRIMARY KEY,
  account_id  text NOT NULL,
  framework   text NOT NULL,
  slot_id     text NOT NULL,
  note        text NOT NULL DEFAULT '',
  attested_by text NOT NULL,
  attested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, framework, slot_id)
);
${buildTenantPolicySql("compliance_attestation")}
`;

/** The apps/site-local migration set, PROD-CANONICAL names first — the one list every consumer
 *  (real-Postgres deploy apply, dev PGlite double) must import instead of hand-maintaining its own. */
export const SITE_LOCAL_MIGRATIONS: readonly MigrationFile[] = [
  // ADR-0234: the Ask-AI per-lane (public + premium) daily spend counters. Global (non-tenant), no
  // RLS — accessed outside withTenant.
  { name: "0011_ask_ai_spend.sql", sql: ASK_AI_SPEND_SCHEMA_SQL },
  // ADR-0236: consent-noticed question-text capture. Global (non-tenant), no RLS — same posture
  // as 0011. Anonymous by construction (no IP / user id / answer text); 90-day retention is a
  // hard DELETE swept on insert (question-log.ts), not a schema concern.
  { name: "0012_ask_ai_question.sql", sql: ASK_AI_QUESTION_SCHEMA_SQL },
  // ADR-0162/0183: the encrypted per-tenant BYOK key store (ai-kit) + this app's display-metadata
  // shadow table. CAISSON-64: these were dev-PGlite-only before this fix — never applied to a real
  // deployment, which is why /dashboard/ai-keys crashed for every account in prod.
  {
    name: "0020_tenant_ai_credential.sql",
    sql: TENANT_AI_CREDENTIAL_SCHEMA_SQL,
  },
  { name: "0021_byok_key_meta.sql", sql: BYOK_KEY_META_SCHEMA_SQL },
  // ADR-0181: compliance manual-attestation slots. Also CAISSON-64-affected, though masked in
  // prod by the compliance-core entitlement gate short-circuiting before any table read.
  {
    name: "0022_compliance_attestation.sql",
    sql: COMPLIANCE_ATTESTATION_SCHEMA_SQL,
  },
  // CAISSON-110 (ADR-0350 F5). The shared @caisson/rate-limit account-store table backs the
  // sandbox demo-run's per-IP / per-/64 quotas (the site DB had no `rate_limit` table before — it is
  // "boot-ensured by services/license" on ITS own DB, per platform-migrations' policy-guard comment;
  // the site owns a distinct DB and must create it here). RLS-scoped, so it lands after the app-role
  // migration in the shared chain.
  { name: "0023_rate_limit.sql", sql: RATE_LIMIT_SCHEMA_SQL },
  // CAISSON-110 (ADR-0350 F5 / ADR-0352). The demo-run daily budget counter + lead telemetry — both
  // global (non-tenant), no RLS, same posture as the ask_ai_* counters (0011/0012).
  { name: "0024_demo_run_budget.sql", sql: DEMO_RUN_BUDGET_SCHEMA_SQL },
  { name: "0025_demo_run_leads.sql", sql: DEMO_RUN_LEADS_SCHEMA_SQL },
];

// scripts/provision-admin-mutation-surface.ts — the CAISSON-17 DEPLOY provisioning (ADR-0220 +
// ADR-0141), operator-run against the live Railway Postgres:
//
//   DATABASE_URL=<public PG url> bun apps/admin/scripts/provision-admin-mutation-surface.ts [admin-db-user]
//
// Idempotent and re-runnable. Applies, in the PGlite-bootstrap order (apps/admin/src/lib/admin-db.ts
// is the parity reference; the base tenant tables themselves are deploy-migrate's job and are NOT
// applied here): the read-only `admin` role + its cross-tenant read policies, the `admin_write`
// role, the entitlement `admin_comp` CHECK widening, the `admin_action_log` DDL, the audit-chain
// table (audit-worm migration 0001), and `ADMIN_MUTATION_PROVISION_SQL`; then grants the connecting
// user (or the optional [admin-db-user] argument — the `CAISSON_ADMIN_DB_URL` user) membership in
// `admin`, `admin_write`, and `app`. Never prints a connection string.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ADMIN_ACTION_LOG_ACTION_MIGRATION_SQL,
  ADMIN_ACTION_LOG_SCHEMA_SQL,
  ADMIN_MUTATION_PROVISION_SQL,
  ENTITLEMENT_ADMIN_COMP_MIGRATION_SQL,
} from "@caisson/service-license";
import { ADMIN_WRITE_ROLE_BOOTSTRAP_SQL } from "@caisson/org-controls";
import { Pool } from "pg";
import {
  ADMIN_ROLE_BOOTSTRAP_SQL,
  buildAdminReadPolicySql,
} from "../src/lib/admin-read.ts";

/** The cross-tenant read surface (ADR-0141) — keep in sync with admin-db.ts ADMIN_READ_TABLES.
 *  `account_member` (G29): the tenants view's email-lookup join needs cross-tenant SELECT on it. */
const ADMIN_READ_TABLES = [
  "credit_wallet",
  "credit_event", // ADR-0225 revoke-preview claw math reads the per-event ledger
  "entitlement_grant",
  "license_grant",
  "account_member",
  "order_record", // ADR-0316 W-COMMERCE ledger + ADR-0320 affiliate commission report
  "subscription_status", // ADR-0316 W-COMMERCE subscription timeline
  "grant_consumption", // ADR-0316 W-COMMERCE expiring-soon panel
] as const;

/** better-auth's own "user" table carries no RLS — a plain GRANT, not a policy (G29 email lookup;
 *  the table itself is created by better-auth's own migrator, already live on this Postgres). */
const USER_ADMIN_READ_GRANT_SQL = `GRANT SELECT ON "user" TO admin;`;

/** support_ticket (ADR-0316 W-SUPPORT) also carries no RLS — a plain GRANT. The table is created
 *  by the support-bot's own ensure_schema (escalation.py), which may not have run yet on a fresh
 *  DB — guard on existence so provisioning stays order-independent and re-runnable. */
const SUPPORT_TICKET_ADMIN_READ_GRANT_SQL = `
DO $$ BEGIN
  IF to_regclass('public.support_ticket') IS NOT NULL THEN
    GRANT SELECT ON support_ticket TO admin;
  END IF;
END $$;`;

/**
 * The Postgres unquoted-identifier shape — the only role-name shape this script ever legitimately
 * accepts (e.g. `admin_app`). Postgres has no `GRANT ... TO $1` parameter binding for a role name, so
 * this regex IS the parameterization: reject anything that doesn't match before it ever reaches the
 * `GRANT ... TO ${grantee};` template string.
 */
export const PG_IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

export function auditWormMigrationSteps(): Array<[string, string]> {
  const migrationRoot = join(
    import.meta.dir,
    "../../../packages/audit-worm/src/migrations",
  );
  return [
    [
      "audit-chain table (audit-worm 0001)",
      readFileSync(join(migrationRoot, "0001_audit_chain.sql"), "utf8"),
    ],
    [
      "artifact-version ledger (audit-worm 0004)",
      readFileSync(join(migrationRoot, "0004_artifact_versions.sql"), "utf8"),
    ],
  ];
}

async function main(): Promise<void> {
  // The role to grant admin/admin_write/app membership to — the CAISSON_ADMIN_DB_URL user. Defaults
  // to the connecting user so a single-credential deploy stays correct. FOOTGUN (hit live
  // 2026-07-03): running with the superuser DATABASE_URL and no arg grants to `postgres`, leaving
  // the service's `admin_app` role unable to SET ROLE — pass the service role name explicitly.
  const rawGrantee = process.argv[2]?.trim();
  const grantee =
    rawGrantee !== undefined && rawGrantee.length > 0
      ? rawGrantee
      : "CURRENT_USER";
  // Validate BEFORE anything else (env checks, Pool construction) — an untrusted argv value must
  // never reach the `GRANT ... TO ${grantee};` interpolation below. "CURRENT_USER" is the hardcoded
  // fallback literal (a Postgres pseudo-constant keyword), not attacker-controlled input, so it's
  // exempt from the identifier shape check.
  if (grantee !== "CURRENT_USER" && !PG_IDENTIFIER_RE.test(grantee)) {
    throw new Error(
      `invalid grantee "${grantee}" — must be a bare Postgres identifier matching ${PG_IDENTIFIER_RE.toString()}; refusing to interpolate into GRANT SQL`,
    );
  }
  const url = process.env.DATABASE_URL ?? "";
  if (url.length === 0) {
    throw new Error(
      "DATABASE_URL is required (the admin provisioning needs the live Postgres) — refusing to run.",
    );
  }
  if (grantee === "CURRENT_USER") {
    process.stdout.write(
      "[provision-admin] WARNING: no grantee arg — granting to the CONNECTING user. If this URL is\n" +
        "[provision-admin] the superuser, the service role gets nothing; pass it explicitly (e.g. admin_app).\n",
    );
  }
  const pool = new Pool({ connectionString: url });
  const steps: Array<[string, string]> = [
    ["admin role bootstrap", ADMIN_ROLE_BOOTSTRAP_SQL],
    ["admin_write role bootstrap", ADMIN_WRITE_ROLE_BOOTSTRAP_SQL],
    ...ADMIN_READ_TABLES.map((t): [string, string] => [
      `admin read policy: ${t}`,
      buildAdminReadPolicySql(t),
    ]),
    ["admin read grant: user (G29)", USER_ADMIN_READ_GRANT_SQL],
    [
      "admin read grant: support_ticket (ADR-0316, existence-guarded)",
      SUPPORT_TICKET_ADMIN_READ_GRANT_SQL,
    ],
    [
      "entitlement admin_comp CHECK widening",
      ENTITLEMENT_ADMIN_COMP_MIGRATION_SQL,
    ],
    ["admin_action_log DDL", ADMIN_ACTION_LOG_SCHEMA_SQL],
    // The action-enum CHECK widening (idempotent DROP IF EXISTS -> ADD): a LIVE DB skips the DDL
    // step above on 42P07, so a newly registered action only reaches the live CHECK through this.
    [
      "admin_action_log action CHECK widening",
      ADMIN_ACTION_LOG_ACTION_MIGRATION_SQL,
    ],
    ...auditWormMigrationSteps(),
    ["admin mutation provision", ADMIN_MUTATION_PROVISION_SQL],
    [
      `role grants to ${grantee === "CURRENT_USER" ? "current user" : grantee}`,
      `GRANT admin, admin_write, app TO ${grantee};`,
    ],
  ];
  try {
    for (const [label, sql] of steps) {
      try {
        await pool.query(sql);
        process.stdout.write(`[provision-admin] applied: ${label}\n`);
      } catch (err) {
        // 42710 duplicate_object / 42P07 duplicate_table: the step (or its tail) was provisioned by
        // an earlier deploy and its DDL has no IF-NOT-EXISTS guard — converged already, skip and
        // continue (a rerun must still reach the role-grant step at the end).
        const code = (err as { code?: string }).code;
        if (code === "42710" || code === "42P07") {
          process.stdout.write(`[provision-admin] already present: ${label}\n`);
        } else {
          throw err;
        }
      }
    }
    // Verify — roles + every required table exist, and the action CHECK knows the v1 actions.
    const roles = await pool.query(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('admin','admin_write','app') ORDER BY rolname",
    );
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name IN ('admin_action_log','audit_chain_entry','worm_artifact_version') ORDER BY table_name",
    );
    process.stdout.write(
      `[provision-admin] roles: ${roles.rows.map((r) => r.rolname as string).join(", ")}\n` +
        `[provision-admin] tables: ${tables.rows.map((r) => r.table_name as string).join(", ")}\n`,
    );
    if (roles.rows.length !== 3 || tables.rows.length !== 3) {
      throw new Error("verification failed: expected 3 roles + 3 tables");
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.main) {
  await main();
}

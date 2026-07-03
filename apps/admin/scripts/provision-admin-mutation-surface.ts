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
  ADMIN_ACTION_LOG_SCHEMA_SQL,
  ADMIN_MUTATION_PROVISION_SQL,
  ENTITLEMENT_ADMIN_COMP_MIGRATION_SQL,
} from "@caisson/service-license";
import { ADMIN_WRITE_ROLE_BOOTSTRAP_SQL } from "@caisson/tenancy-rls";
import { Pool } from "pg";
import {
  ADMIN_ROLE_BOOTSTRAP_SQL,
  buildAdminReadPolicySql,
} from "../src/lib/admin-read.ts";

/** The cross-tenant read surface (ADR-0141) — keep in sync with admin-db.ts ADMIN_READ_TABLES. */
const ADMIN_READ_TABLES = [
  "credit_wallet",
  "entitlement_grant",
  "license_grant",
] as const;

function auditChainMigrationSql(): string {
  return readFileSync(
    join(
      import.meta.dir,
      "../../../packages/audit-worm/src/migrations/0001_audit_chain.sql",
    ),
    "utf8",
  );
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "";
  if (url.length === 0) {
    throw new Error(
      "DATABASE_URL is required (the admin provisioning needs the live Postgres) — refusing to run.",
    );
  }
  // The role to grant admin/admin_write/app membership to — the CAISSON_ADMIN_DB_URL user. Defaults
  // to the connecting user so a single-credential deploy stays correct.
  const grantee = process.argv[2]?.trim() || "CURRENT_USER";
  const pool = new Pool({ connectionString: url });
  const steps: Array<[string, string]> = [
    ["admin role bootstrap", ADMIN_ROLE_BOOTSTRAP_SQL],
    ["admin_write role bootstrap", ADMIN_WRITE_ROLE_BOOTSTRAP_SQL],
    ...ADMIN_READ_TABLES.map((t): [string, string] => [
      `admin read policy: ${t}`,
      buildAdminReadPolicySql(t),
    ]),
    [
      "entitlement admin_comp CHECK widening",
      ENTITLEMENT_ADMIN_COMP_MIGRATION_SQL,
    ],
    ["admin_action_log DDL", ADMIN_ACTION_LOG_SCHEMA_SQL],
    ["audit-chain table (audit-worm 0001)", auditChainMigrationSql()],
    ["admin mutation provision", ADMIN_MUTATION_PROVISION_SQL],
    [
      `role grants to ${grantee === "CURRENT_USER" ? "current user" : grantee}`,
      `GRANT admin, admin_write, app TO ${grantee};`,
    ],
  ];
  try {
    for (const [label, sql] of steps) {
      await pool.query(sql);
      process.stdout.write(`[provision-admin] applied: ${label}\n`);
    }
    // Verify — roles + tables exist, and the action CHECK knows the v1 actions.
    const roles = await pool.query(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('admin','admin_write','app') ORDER BY rolname",
    );
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name IN ('admin_action_log','audit_chain_entry') ORDER BY table_name",
    );
    process.stdout.write(
      `[provision-admin] roles: ${roles.rows.map((r) => r.rolname as string).join(", ")}\n` +
        `[provision-admin] tables: ${tables.rows.map((r) => r.table_name as string).join(", ")}\n`,
    );
    if (roles.rows.length !== 3 || tables.rows.length !== 2) {
      throw new Error("verification failed: expected 3 roles + 2 tables");
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.main) {
  await main();
}

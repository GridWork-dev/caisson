// @caisson/platform-migrations — the ONE ordered platform migration chain.
// apps/site/lib/deploy-migrate.ts's `platformPackage()` used to be the
// sole owner of this chain; apps/admin's PGlite bootstrap hand-mirrored it by SQL-constant name, and
// that hand-mirror drifted more than once (missed line-item columns, then a missed
// credit_event table). Both consumers now assemble/apply the SAME ordered array —
// `platformMigrationsPackage()` for the raw shape, `applyAll()` for the assemble+run in one call — so
// a new migration lands for both or neither.
//
// The two ADR-0234/0236 `ask_ai_*` migrations are deliberately NOT here: their SQL constants live in
// apps/site/lib/ask-ai/*.ts, and a package may never depend "up" on an app (ADR-0003 / standards-gate
// Gate 3). Site's own `platformPackage()` folds them back in via `platformMigrationsPackage`'s `extra`
// param, at their original filenames (0011/0012). `assembleMigrations` sorts one package's migrations
// by filename before renumbering (packages/kernel/src/migration-assembly.ts), so folding them into
// the SAME single `PackageMigrations.migrations` array reproduces the exact pre-extraction merged
// sequence, checksums, and global `schema_version` numbering — proven byte-identical in
// index.test.ts against a digest pinned from the pre-extraction code.
import { AI_METER_SCHEMA_SQL } from "@caisson/ai-meter";
import { ACCOUNT_MEMBER_SCHEMA_SQL } from "@caisson/auth";
import { PROCESSED_EVENT_SCHEMA_SQL } from "@caisson/billing-orchestration";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_LINE_ITEM_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
} from "@caisson/credits";
import {
  type MergedMigration,
  type MigrationFile,
  type PackageMigrations,
  assembleMigrations,
} from "@caisson/kernel";
import {
  type MigrationApplier,
  type MigrationRunResult,
  runMigrations,
} from "@caisson/migrate";
import {
  AFFILIATE_CODE_SCHEMA_SQL,
  CHECKOUT_ABANDONMENT_NOTICE_SCHEMA_SQL,
  CHECKOUT_ABANDONMENT_SCHEMA_SQL,
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  LICENSE_GRANT_SCHEMA_SQL,
  ORDER_RECORD_DISCOUNT_MIGRATION_SQL,
  ORDER_RECORD_SCHEMA_SQL,
  ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL,
  RENEWAL_EXTENSION_SCHEMA_SQL,
  SUBSCRIPTION_STATUS_SCHEMA_SQL,
} from "@caisson/service-license";

export type {
  MigrationFile,
  PackageMigrations,
  MergedMigration,
  MigrationApplier,
  MigrationRunResult,
};

// Byte-identical to the pre-extraction constant (apps/site/lib/deploy-migrate.ts
// `APP_ROLE_MIGRATION_SQL`) — the `app` RLS role every tenant table's tenant-policy SQL GRANTs to.
const APP_ROLE_MIGRATION_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
    CREATE ROLE app NOLOGIN;
  END IF;
END $$;
GRANT app TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO app;
`;

/** The 9 standard-shape tenant tables (policy `<table>_tenant_isolation`, column account_id). */
const NULLIF_GUARD_TABLES = [
  "credit_wallet",
  "credit_event",
  "entitlement_grant",
  "license_grant",
  "usage_event",
  "tenant_spend_window",
  "spend_policy",
  "spend_breaker",
  "billing_processed_event",
] as const;

// Byte-identical to the pre-extraction constant (apps/site/lib/deploy-migrate.ts
// `RLS_EMPTY_GUC_GUARD_SQL`) — do not hand-edit; a policy change ships as a NEW migration (ADR-0006).
const RLS_EMPTY_GUC_GUARD_SQL = `
${NULLIF_GUARD_TABLES.map(
  (t) => `DROP POLICY IF EXISTS ${t}_tenant_isolation ON ${t};
CREATE POLICY ${t}_tenant_isolation ON ${t}
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));`,
).join("\n")}
-- account_member keeps its dual-GUC shape (ADR-0176); both GUC reads gain the guard. The source
-- constant in @caisson/auth is intentionally untouched (editing it would drift pinned 0006).
DROP POLICY IF EXISTS account_member_isolation ON account_member;
CREATE POLICY account_member_isolation ON account_member
  USING (
    account_id = NULLIF(current_setting('app.current_account', true), '')
    OR user_id = NULLIF(current_setting('app.current_user', true), '')
  )
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));
-- rate_limit is boot-ensured by services/license (not ledger-created) — guard for absence so a
-- fresh DB migrating before the service's first boot doesn't fail on a missing relation.
DO $$ BEGIN
  IF to_regclass('rate_limit') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS rate_limit_tenant_isolation ON rate_limit';
    EXECUTE 'CREATE POLICY rate_limit_tenant_isolation ON rate_limit
      USING (account_id = NULLIF(current_setting(''app.current_account'', true), ''''))
      WITH CHECK (account_id = NULLIF(current_setting(''app.current_account'', true), ''''))';
  END IF;
END $$;
`;

/**
 * The shared platform migration set — every `platformPackage()` migration EXCEPT the two
 * apps/site-local `ask_ai_*` entries (0011/0012, see the module doc). Every filename + SQL byte here
 * is unchanged from the pre-extraction apps/site/lib/deploy-migrate.ts.
 */
const PLATFORM_MIGRATIONS: readonly MigrationFile[] = [
  { name: "0001_app_role.sql", sql: APP_ROLE_MIGRATION_SQL },
  { name: "0002_credits.sql", sql: CREDIT_SCHEMA_SQL },
  {
    name: "0003_entitlement_grant.sql",
    sql: `${ENTITLEMENT_SCHEMA_SQL}\n${ENTITLEMENT_GRANT_MIGRATION_SQL}`,
  },
  { name: "0004_license_grant.sql", sql: LICENSE_GRANT_SCHEMA_SQL },
  { name: "0005_ai_meter.sql", sql: AI_METER_SCHEMA_SQL },
  { name: "0006_account_member.sql", sql: ACCOUNT_MEMBER_SCHEMA_SQL },
  { name: "0007_credit_rounding.sql", sql: CREDIT_ROUNDING_MIGRATION_SQL },
  {
    name: "0008_entitlement_line_item.sql",
    sql: ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  },
  { name: "0009_credit_line_item.sql", sql: CREDIT_LINE_ITEM_MIGRATION_SQL },
  {
    name: "0010_billing_processed_event.sql",
    sql: PROCESSED_EVENT_SCHEMA_SQL,
  },
  { name: "0013_rls_empty_guc_guard.sql", sql: RLS_EMPTY_GUC_GUARD_SQL },
  { name: "0014_credit_expiry.sql", sql: CREDIT_EXPIRY_MIGRATION_SQL },
  {
    name: "0015_grant_consumption.sql",
    sql: GRANT_CONSUMPTION_MIGRATION_SQL,
  },
  {
    name: "0016_entitlement_updates_window.sql",
    sql: ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  },
  { name: "0017_renewal_extension.sql", sql: RENEWAL_EXTENSION_SCHEMA_SQL },
  {
    name: "0018_subscription_status.sql",
    sql: SUBSCRIPTION_STATUS_SCHEMA_SQL,
  },
  { name: "0019_order_record.sql", sql: ORDER_RECORD_SCHEMA_SQL },
  // Post-extraction append (the first since the package was carved out): apps/site's own extras
  // claimed 0020–0022 (see site-migrations.ts), so the shared chain resumes at 0023 — a
  // sort-by-filename TAIL append either way, leaving every applied slot + checksum untouched.
  {
    name: "0023_order_record_subscription_link.sql",
    sql: ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL,
  },
  // The abandoned-checkout email feature (2026-07-10 lock) — the first append since 0023, landing
  // at 0024 per this module's own convention for a caller with no historical slot to preserve.
  {
    name: "0024_checkout_abandonment.sql",
    sql: `${CHECKOUT_ABANDONMENT_SCHEMA_SQL}\n${CHECKOUT_ABANDONMENT_NOTICE_SCHEMA_SQL}`,
  },
  // ADR-0315 affiliate production flip — a nullable attribution column on order_record (0025), then
  // the admin-scoped affiliate_code registry (0026). TAIL appends, same convention: every applied
  // slot + checksum above is untouched. 0026's admin-role grants are self-guarded (see the schema
  // constant) so this migration succeeds whether or not the admin roles exist yet.
  {
    name: "0025_order_record_discount.sql",
    sql: ORDER_RECORD_DISCOUNT_MIGRATION_SQL,
  },
  {
    name: "0026_affiliate_code.sql",
    sql: AFFILIATE_CODE_SCHEMA_SQL,
  },
];

/**
 * The full `caisson-platform` `PackageMigrations`: the shared chain plus any caller-local additions
 * (apps/site's two `ask_ai_*` migrations), combined into ONE array so `assembleMigrations` sorts them
 * together by filename — same slug, same shape, as the pre-extraction `platformPackage()`.
 *
 * `extra` entries' `name`s must NOT collide with the shared chain's own names above (`0001`–`0019`
 * plus `0023`–`0026`) — a duplicate name is two migrations racing for the same renumbered slot, not
 * a merge. Effective apply order is `assembleMigrations`'s sort-by-filename over the COMBINED
 * array, not this function's array-position: an `extra` entry's numeric prefix decides where it
 * lands, not where it sits in the array you pass in (apps/site/lib/deploy-migrate.ts deliberately
 * uses `0011`/`0012` to reproduce their pre-extraction slot — see its own module doc). apps/site's
 * extras have since claimed `0020`–`0022` and `0027`–`0029` (CAISSON-110 demo-run), and the shared
 * chain `0025`–`0026` (ADR-0315); the next free prefix — for THIS chain or any caller with no
 * historical slot to preserve — is `0030_*.sql` and up. A mid-chain landing renumbers every later
 * migration's positional seq and fails the next real deploy closed on checksum drift (the
 * 2026-07-17 caisson-license failure); apps/site's `site-migrations.test.ts` golden-pins the
 * assembled ledger append-only.
 */
export function platformMigrationsPackage(
  extra: readonly MigrationFile[] = [],
): PackageMigrations {
  return {
    slug: "caisson-platform",
    dependsOn: [],
    migrations: [...PLATFORM_MIGRATIONS, ...extra],
  };
}

/**
 * Assemble + apply the platform chain through an injected `MigrationApplier` (ADR-0090) — the same
 * DB-agnostic port `@caisson/migrate` defines, so ONE helper works against a real Postgres
 * (`pgMigrationApplier` from `@caisson/migrate/pg`) or a PGlite double (the caller writes a small
 * applier over PGlite's own query/transaction API — the same shape every other PGlite consumer in
 * this repo already uses, e.g. packages/compliance's integration test).
 */
export async function applyAll(
  applier: MigrationApplier,
  extra: readonly MigrationFile[] = [],
): Promise<MigrationRunResult> {
  return runMigrations(
    assembleMigrations([platformMigrationsPackage(extra)]),
    applier,
  );
}

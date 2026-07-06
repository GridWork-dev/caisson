// Fail-closed multi-tenant RLS (ADR-0005). `withTenant` is the SOLE entry to tenant data: it
// opens a transaction, drops to the non-superuser `app` role, and binds `app.current_account`
// for the life of the transaction. RLS policies read that GUC, so a query that forgets its
// `WHERE account_id = …` still returns only the caller's rows — and a code path that forgets
// `withTenant` entirely has no GUC bound and sees nothing. Fail-closed, by construction.
import { TenancyError } from "@caisson/kernel";

/** The Postgres GUC that carries the active account id into RLS policies. */
export const TENANT_GUC = "app.current_account";

/**
 * The Postgres GUC that carries the active USER id into RLS policies. Used only for the
 * identity→account resolution bootstrap (ADR-0176): "which accounts does this user belong to?" is a
 * cross-account read keyed by user, which the tenant GUC cannot express. A table that participates
 * in that lookup (e.g. `account_member`) carries a policy clause `user_id = current_setting(USER_GUC)`
 * ORed with the tenant clause. `withUser` binds this GUC and leaves the tenant GUC null (and vice
 * versa), so the two access paths never widen each other.
 */
export const USER_GUC = "app.current_user";

/** Minimal query surface — satisfied by PGlite, a PGlite transaction, and a pg/Drizzle client. */
export interface TenantExecutor {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}

/** A client that can open a transaction (PGlite, node-postgres pool, Drizzle db). */
export interface Transactor {
  transaction<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T>;
}

/**
 * One-time, fail-closed role pre-flight (ADR-0005 hardening): `withTenant`/`withUser` trust the
 * role they `SET LOCAL ROLE` into is genuinely unprivileged. A SUPERUSER or BYPASSRLS role
 * silently no-ops `FORCE ROW LEVEL SECURITY`, reopening the cross-tenant leak with zero runtime
 * signal — this throws before that role is ever assumed. Never warns; a missing role is
 * refused too (fail-closed, not fail-open on a typo).
 */
async function assertRoleNotPrivileged(
  tx: TenantExecutor,
  role: string,
): Promise<void> {
  const { rows } = await tx.query<{
    rolsuper: boolean;
    rolbypassrls: boolean;
  }>(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1`, [role]);
  const row = rows[0];
  if (!row || row.rolsuper || row.rolbypassrls) {
    throw new TenancyError(
      `Refusing to use role "${role}" for tenant isolation: it must exist and be neither SUPERUSER nor BYPASSRLS`,
    );
  }
}

/**
 * Runs once per distinct `(Transactor, role)` pair — the guard costs one extra catalog query per
 * role per `Transactor`, not per call. Keyed per-ROLE (not just per-db) so `withAdminWrite`'s
 * `admin_write` guard is never skipped just because `withTenant` already vetted `app` on the same
 * `db` (a shared-db bug that a plain WeakSet<Transactor> would hide). A failed check is never
 * cached: fixing the misconfig un-wedges the very next call with no restart.
 */
const roleGuardChecked = new WeakMap<Transactor, Set<string>>();

async function ensureRoleGuard(
  db: Transactor,
  tx: TenantExecutor,
  role: string,
): Promise<void> {
  const seen = roleGuardChecked.get(db);
  if (seen?.has(role) === true) return;
  await assertRoleNotPrivileged(tx, role);
  if (seen === undefined) {
    roleGuardChecked.set(db, new Set([role]));
  } else {
    seen.add(role);
  }
}

/**
 * Run `fn` inside a transaction scoped to `accountId`: `SET LOCAL ROLE app` +
 * `set_config('app.current_account', accountId, true)`. The account id must come from a verified
 * session/JWT (ADR-0015) — never from request params. An empty id is refused outright (never run
 * unscoped).
 */
export async function withTenant<T>(
  db: Transactor,
  accountId: string,
  fn: (tx: TenantExecutor) => Promise<T>,
): Promise<T> {
  if (accountId.length === 0) {
    throw new TenancyError(
      "Refusing to run a tenant query without an account id",
    );
  }
  return db.transaction(async (tx) => {
    // Bind the GUC first (as the privileged role), then drop to `app` for the actual work.
    await tx.query(`SELECT set_config($1, $2, true)`, [TENANT_GUC, accountId]);
    await ensureRoleGuard(db, tx, "app");
    await tx.exec(`SET LOCAL ROLE app`);
    return fn(tx);
  });
}

/**
 * Run `fn` inside a transaction scoped to a USER (not an account): binds `app.current_user` +
 * `SET LOCAL ROLE app`. The ONLY sanctioned use is the identity→account bootstrap (ADR-0176) — a
 * signed-in user reading their own `account_member` rows across accounts to resolve which accounts
 * they belong to. Fail-closed like `withTenant`: an empty user id is refused, and a table without a
 * matching `user_id` policy clause returns nothing. The user id must come from a verified session,
 * never a request param.
 */
export async function withUser<T>(
  db: Transactor,
  userId: string,
  fn: (tx: TenantExecutor) => Promise<T>,
): Promise<T> {
  if (userId.length === 0) {
    throw new TenancyError(
      "Refusing to run a user-scoped query without a user id",
    );
  }
  return db.transaction(async (tx) => {
    await tx.query(`SELECT set_config($1, $2, true)`, [USER_GUC, userId]);
    await ensureRoleGuard(db, tx, "app");
    await tx.exec(`SET LOCAL ROLE app`);
    return fn(tx);
  });
}

export interface TenantPolicyOptions {
  /** The tenant-key column. Default `account_id`. */
  column?: string;
  /** The role policies apply to (it must NOT be a superuser / BYPASSRLS). Default `app`. */
  role?: string;
}

/**
 * SQL that makes `table` fail-closed tenant-isolated: ENABLE + **FORCE** RLS, GRANT CRUD to the
 * app role, and a policy that admits a row only when its tenant column equals the bound GUC.
 * Emitted into the table's migration (ADR-0014) so a tenant table can never ship without it.
 *
 * The GUC read is wrapped in `NULLIF(..., '')` (pgbouncer/pooler hardening): a pooled connection
 * that resets custom GUCs to `''` instead of fully unsetting them (a known transaction-pooling
 * behavior — some poolers' reset query converges a custom parameter to its declared default rather
 * than removing it) would otherwise compare `column = ''` — a coincidental deny only for as long as
 * no row's tenant column is literally the empty string. `NULLIF` folds `''` to `NULL` first, so the
 * comparison is always `NULL` (deny) regardless of what any row's column value happens to be.
 */
export function buildTenantPolicySql(
  table: string,
  { column = "account_id", role = "app" }: TenantPolicyOptions = {},
): string {
  const guc = `NULLIF(current_setting('${TENANT_GUC}', true), '')`;
  return [
    `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${role};`,
    `CREATE POLICY ${table}_tenant_isolation ON ${table}`,
    `  USING (${column} = ${guc})`,
    `  WITH CHECK (${column} = ${guc});`,
  ].join("\n");
}

// --- Admin WRITE seam ---------------------------------------------------------------------------
//
// An operator control plane must CHANGE state across tenants (comp a grant, correct a wallet) —
// the exact inverse of the buyer `app` role's fail-closed tenant isolation. Reads use a dedicated
// SELECT-only `admin` role elsewhere in the stack, untouched here; this is its WRITE twin,
// DB-separated on purpose: admin writes NEVER run as the buyer `app` role, so a bug in the buyer
// runtime can never reach cross-tenant write privilege and vice-versa. RLS stays the single
// mechanism — a second, ROLE-SCOPED permissive policy (`TO admin_write USING/CHECK (true)`) lets
// only this role write any tenant's row; `app`'s `TO app` isolation is unchanged (a
// `TO admin_write` policy never matches the `app` role). The one-account-per-call bound is the
// APP layer (each mutation takes exactly one target account id + the writer filters on it) plus
// the caller's own authentication gate + a dual audit log — not a GUC, because the locked
// cross-tenant policy is `WITH CHECK (true)`. The `admin_write` role, like `app`, must be neither
// SUPERUSER nor BYPASSRLS (the shared `ensureRoleGuard`, keyed per-role, refuses a privileged one
// — fail-closed).

/** The write-capable, cross-tenant Postgres role the operator mutation surface writes as. Never a superuser. */
export const ADMIN_WRITE_ROLE = "admin_write";

/** Idempotent `CREATE ROLE admin_write` — for the PGlite dev/test double; prod provisions it at DEPLOY. */
export const ADMIN_WRITE_ROLE_BOOTSTRAP_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${ADMIN_WRITE_ROLE}') THEN
    CREATE ROLE ${ADMIN_WRITE_ROLE} NOLOGIN;
  END IF;
END $$;
`;

export interface AdminWritePolicyOptions {
  /** The write role the cross-tenant policy is scoped to. Default `admin_write`. */
  role?: string;
}

/**
 * SQL that lets the `admin_write` role INSERT/UPDATE/SELECT every row of `table` cross-tenant,
 * WITHOUT widening what any other role sees. Emitted ALONGSIDE the table's existing
 * `buildTenantPolicySql` output (which stays the `app` tenant-isolation floor): a
 * `GRANT SELECT, INSERT, UPDATE ... TO admin_write` (no DELETE — the mutation surface soft-revokes,
 * never hard-deletes) plus a `TO admin_write USING (true) WITH CHECK (true)` policy. RLS
 * OR-combines permissive policies, but each is role-scoped, so `admin_write` sees/writes every
 * tenant while `app` never matches this policy and stays isolated. Applied to the production
 * database at deploy time, mirroring the read-only counterpart policy builder.
 */
export function buildAdminWritePolicySql(
  table: string,
  { role = ADMIN_WRITE_ROLE }: AdminWritePolicyOptions = {},
): string {
  return [
    // Idempotent so re-running DEPLOY provisioning never errors: GRANT is a no-op when already held,
    // and DROP POLICY IF EXISTS clears any prior policy before CREATE (Postgres has no
    // CREATE POLICY IF NOT EXISTS). The policy body is fixed, so drop-then-create is safe to repeat.
    `GRANT SELECT, INSERT, UPDATE ON ${table} TO ${role};`,
    `DROP POLICY IF EXISTS ${table}_admin_write ON ${table};`,
    `CREATE POLICY ${table}_admin_write ON ${table}`,
    `  TO ${role}`,
    `  USING (true)`,
    `  WITH CHECK (true);`,
  ].join("\n");
}

/**
 * SQL that lets the `admin_write` role cross-tenant SELECT `table`, WITHOUT the INSERT/UPDATE grant
 * `buildAdminWritePolicySql` also carries. Use this for a table the operator mutation
 * surface only ever READS (e.g. an existence check on the base auth `account_member` table) — the
 * blast radius of a bug in that surface then stops at a cross-tenant read, never a cross-tenant
 * write, on a table it has no legitimate reason to mutate. Same idempotent
 * drop-then-create shape as the write variant — and it also DROPs the write-variant policy and
 * REVOKEs INSERT/UPDATE, so re-provisioning a database that previously ran
 * `buildAdminWritePolicySql` for the same table converges to SELECT-only instead of keeping the
 * stale write grant.
 */
export function buildAdminSelectPolicySql(
  table: string,
  { role = ADMIN_WRITE_ROLE }: AdminWritePolicyOptions = {},
): string {
  return [
    `GRANT SELECT ON ${table} TO ${role};`,
    `REVOKE INSERT, UPDATE ON ${table} FROM ${role};`,
    `DROP POLICY IF EXISTS ${table}_admin_write ON ${table};`,
    `DROP POLICY IF EXISTS ${table}_admin_select ON ${table};`,
    `CREATE POLICY ${table}_admin_select ON ${table}`,
    `  FOR SELECT`,
    `  TO ${role}`,
    `  USING (true);`,
  ].join("\n");
}

/**
 * Run `fn` cross-tenant as the `admin_write` role: opens a transaction and `SET LOCAL ROLE
 * admin_write` for its life. No account GUC is bound — the `TO admin_write USING/CHECK (true)`
 * policy admits every tenant's rows, so the one-account bound is the caller's responsibility (pass
 * exactly one target account id; the writer filters on it). Mirrors `withAdminRead`, but for
 * WRITES, and — like `withTenant` — refuses a SUPERUSER/BYPASSRLS role via the shared role guard
 * (fail-closed). The one seam every operator mutation writes through; never the pool directly.
 */
export async function withAdminWrite<T>(
  db: Transactor,
  fn: (tx: TenantExecutor) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await ensureRoleGuard(db, tx, ADMIN_WRITE_ROLE);
    await tx.exec(`SET LOCAL ROLE ${ADMIN_WRITE_ROLE}`);
    return fn(tx);
  });
}

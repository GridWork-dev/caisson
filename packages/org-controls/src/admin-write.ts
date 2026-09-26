// The cross-tenant admin-WRITE RLS layer (ADR-0220), carved out of the open @caisson-sh/tenancy-rls into
// this commercial package (ADR-0257 §1.3, resolving the ADR-0249 G6 ambiguity: all six exports move).
//
// An operator control plane must CHANGE state across tenants (comp a grant, correct a wallet) — the
// exact inverse of the buyer `app` role's fail-closed tenant isolation. Reads use a dedicated
// SELECT-only `admin` role elsewhere in the stack; this is its WRITE twin, DB-separated on purpose:
// admin writes NEVER run as the buyer `app` role, so a bug in the buyer runtime can never reach
// cross-tenant write privilege and vice-versa. RLS stays the single mechanism — a second, ROLE-SCOPED
// permissive policy (`TO admin_write USING/CHECK (true)`) lets only this role write any tenant's row;
// `app`'s `TO app` isolation is unchanged (a `TO admin_write` policy never matches the `app` role). The
// one-account-per-call bound is the APP layer (each mutation takes exactly one target account id + the
// writer filters on it) plus the caller's own authentication gate + a dual audit log — not a GUC,
// because the locked cross-tenant policy is `WITH CHECK (true)`.
//
// ROLE-GUARD DUPLICATION (ADR-0257 §1.3 seam decision): `withAdminWrite` needs the same fail-closed
// "the role I SET LOCAL into is genuinely unprivileged (not SUPERUSER/BYPASSRLS)" pre-flight that
// `withTenant`/`withUser` use. That guard is FILE-PRIVATE inside @caisson-sh/tenancy-rls. Rather than
// widen the open tenancy-rls PUBLIC API with a new export just for this commercial consumer, the guard
// is DUPLICATED here (~35 LOC, self-contained). Chosen over exporting a public helper because the
// instruction is to keep the open tenancy-rls surface as small as the choice allows — and the smallest
// possible surface is the UNCHANGED one. The two copies are independent WeakMaps keyed per
// (Transactor, role); a security fix to the privileged-role check must be applied in BOTH homes (the
// one cost of the duplication, accepted here for the API-minimality benefit).
import { TenancyError } from "@caisson-sh/kernel";
import type { TenantExecutor, Transactor } from "@caisson-sh/tenancy-rls";

/**
 * Fail-closed role pre-flight (ADR-0005 hardening) — DUPLICATED from @caisson-sh/tenancy-rls (see the
 * seam note above). A SUPERUSER or BYPASSRLS role silently no-ops `FORCE ROW LEVEL SECURITY`,
 * reopening the cross-tenant leak with zero runtime signal — this throws before that role is ever
 * assumed. A missing role is refused too (fail-closed, not fail-open on a typo).
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
 * Runs once per distinct `(Transactor, role)` pair — the guard costs one extra catalog query per role
 * per `Transactor`, not per call. Keyed per-ROLE so `admin_write` is vetted independently. A failed
 * check is never cached: fixing the misconfig un-wedges the very next call with no restart. This is a
 * SEPARATE WeakMap from tenancy-rls's own (the two packages never share the guard state, by design of
 * the carve).
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
 * WRITES, and — like `withTenant` — refuses a SUPERUSER/BYPASSRLS role via the role guard
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

// The cross-tenant admin READ primitive (ADR-0141). The buyer surface reads one tenant at a time
// through `withTenant` (fail-closed RLS, ADR-0005); the operator cockpit must read ACROSS tenants —
// the exact thing tenant isolation forbids. Rather than a BYPASSRLS superuser (a bug in the admin
// app would have unbounded WRITE reach across every tenant), this uses a dedicated read-only `admin`
// Postgres role: RLS stays the single mechanism, and a second, ROLE-SCOPED permissive SELECT policy
// (`TO admin USING (true)`) lets that one role — and only that role — see every row. The buyer `app`
// role is untouched: the admin policy is `TO admin`, so it can never widen what `app` sees.
//
// This lives in apps/admin (not @caisson/tenancy-rls) on purpose: Stream A does not own that package
// (the parallel-merge tree partition), so the primitive is local and imports the shared types +
// `TENANT_GUC`-free contract read-only.
import type { Transactor, TenantExecutor } from "@caisson/tenancy-rls";

/** The read-only Postgres role the operator cockpit reads cross-tenant as. Never a superuser. */
export const ADMIN_ROLE = "admin";

/** Idempotent `CREATE ROLE admin` — for the PGlite dev/test double; prod provisions it at DEPLOY. */
export const ADMIN_ROLE_BOOTSTRAP_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${ADMIN_ROLE}') THEN
    CREATE ROLE ${ADMIN_ROLE} NOLOGIN;
  END IF;
END $$;
`;

export interface AdminReadPolicyOptions {
  /** The read-only role the permissive SELECT policy is scoped to. Default `admin`. */
  role?: string;
}

/**
 * SQL that lets the read-only `admin` role SELECT every row of `table`, WITHOUT widening what any
 * other role sees. Emitted ALONGSIDE the table's existing `buildTenantPolicySql` output (which stays
 * the tenant-isolation floor for the `app` role): a `GRANT SELECT ... TO admin` plus a
 * `FOR SELECT TO admin USING (true)` policy. RLS OR-combines permissive policies, so the `admin`
 * role sees `(account_id = GUC) OR (true) = every row`; the `app` role never matches the `TO admin`
 * policy, so its isolation is unchanged. Applied to the Railway PG at DEPLOY (ADR-0141).
 */
export function buildAdminReadPolicySql(
  table: string,
  { role = ADMIN_ROLE }: AdminReadPolicyOptions = {},
): string {
  return [
    `GRANT SELECT ON ${table} TO ${role};`,
    `CREATE POLICY ${table}_admin_read ON ${table}`,
    `  FOR SELECT TO ${role}`,
    `  USING (true);`,
  ].join("\n");
}

/**
 * Run `fn` cross-tenant as the read-only `admin` role: opens a transaction and `SET LOCAL ROLE
 * admin` for its life. No account GUC is bound — the `TO admin USING (true)` policy admits every
 * tenant's rows. Read-only by construction: the `admin` role holds only SELECT grants and only a
 * `FOR SELECT` policy, so a stray write fails at both the grant and the policy. The one seam every
 * business-admin read goes through — never query the pool directly from a route.
 */
export async function withAdminRead<T>(
  db: Transactor,
  fn: (tx: TenantExecutor) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE ${ADMIN_ROLE}`);
    return fn(tx);
  });
}

// Fail-closed multi-tenant RLS (ADR-0005). `withTenant` is the SOLE entry to tenant data: it
// opens a transaction, drops to the non-superuser `app` role, and binds `app.current_account`
// for the life of the transaction. RLS policies read that GUC, so a query that forgets its
// `WHERE account_id = …` still returns only the caller's rows — and a code path that forgets
// `withTenant` entirely has no GUC bound and sees nothing. Fail-closed, by construction.
import { TenancyError } from "@stack/kernel";

/** The Postgres GUC that carries the active account id into RLS policies. */
export const TENANT_GUC = "app.current_account";

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
 */
export function buildTenantPolicySql(
  table: string,
  { column = "account_id", role = "app" }: TenantPolicyOptions = {},
): string {
  return [
    `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${role};`,
    `CREATE POLICY ${table}_tenant_isolation ON ${table}`,
    `  USING (${column} = current_setting('${TENANT_GUC}', true))`,
    `  WITH CHECK (${column} = current_setting('${TENANT_GUC}', true));`,
  ].join("\n");
}

// The `@caisson/tenancy-rls` `Transactor` — the canonical node-postgres adapter
// (`createPgTransactor`) over a Pool this app owns. The pool is constructed lazily (on first
// `.transaction()` call, not at import time) so a missing `DATABASE_URL` never breaks a
// build/typecheck, only a real query at runtime.
import { Pool } from "pg";
import { ConfigError } from "@caisson/kernel";
import {
  createPgTransactor,
  type TenantExecutor,
  type Transactor,
} from "@caisson/tenancy-rls";

let pool: Pool | undefined;

function getPool(): Pool {
  if (pool === undefined) {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString === undefined) {
      throw new ConfigError("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

/** The `Transactor` every `withTenant`/`withUser` call in this app runs against. Swap the driver
 *  (a different Postgres client, PGlite for local dev) by implementing this same interface. */
export const db: Transactor = {
  transaction<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T> {
    return createPgTransactor(getPool()).transaction(fn);
  },
};

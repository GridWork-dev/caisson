// The reference app's LOCAL backend: an embedded PGlite (Postgres-in-WASM) with the production
// fail-closed-RLS shape. The connecting role is a superuser (BYPASSRLS) used only for schema +
// seeding; every tenant read/write goes through `withTenant`, which drops to the non-login `app`
// role with `app.current_account` bound — exactly the production shape (ADR-0005/0014). A buyer
// swaps this for a real Postgres pool (any `Transactor`); the gateway code above it is unchanged.
//
// This keeps the demo zero-dependency-on-a-running-DB: no Docker, no network, deterministic.
import { PGlite } from "@electric-sql/pglite";
import { CREDIT_SCHEMA_SQL } from "@caisson/credits";
import { AI_METER_SCHEMA_SQL } from "@caisson/ai-meter";
import { PROMPT_REGISTRY_SCHEMA_SQL } from "@caisson/prompt-registry";

/**
 * Provision a fresh in-memory store with the `app` role + the three P3 schemas (credits ledger,
 * the ai-meter usage/spend tables, the prompt registry) applied with FORCE-RLS. Returns the PGlite
 * instance, which satisfies `@caisson/tenancy-rls`'s `Transactor` directly.
 */
export async function createEmbeddedStore(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
         CREATE ROLE app NOLOGIN;
       END IF;
     END $$;`,
  );
  await pg.exec(CREDIT_SCHEMA_SQL);
  await pg.exec(AI_METER_SCHEMA_SQL);
  await pg.exec(PROMPT_REGISTRY_SCHEMA_SQL);
  return pg;
}

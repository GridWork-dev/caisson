// lib/harness.ts — the reference app's substrate wiring (P2-19a, ADR-0044). Stands up the exact
// stack the Compliance leg runs against, with NO live cloud (HOUSE RULE): an embedded PGlite (the
// sanctioned in-process Postgres double — real FORCE-RLS / SET ROLE / advisory locks) as the tenant
// DB, a `LocalArtifactStore` over a throwaway temp dir as the WORM object store, the derived per-
// tenant field-key provider, and an in-memory `EventSink`. The migration set is the REAL, composed
// `assembleComplianceMigrations()` output (field-crypto key tables → audit-worm chain + version),
// applied in order — so the app exercises the same schema a generated buyer app would, not a
// hand-rolled one. The only un-exercised path is the live S3/KMS transport, by design.
//
// The harness is intentionally framework-agnostic: it imports no React and no Next. Both the
// integration test (`leg.test.ts`, the end-to-end exit-gate proof under `bun test`) and the App
// Router route handler (`app/api/leg/route.ts`) build their deps through here, so the leg they run
// is byte-for-byte the same wiring.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { InMemoryEventSink } from "@caisson/kernel";
import { buildTenantPolicySql } from "@caisson/tenancy-rls";
import { DerivedKeyProvider } from "@caisson/field-crypto";
import { LocalArtifactStore } from "@caisson/audit-worm";
import { assembleComplianceMigrations } from "@caisson/compliance";

/** The SEC/HIPAA demo table the leg encrypts into — a client-minted UUID PK (so the row-bound AAD
 *  has a stable id pre-INSERT, ADR-0055) + an encrypted-at-rest column, fail-closed tenant-isolated. */
export const PHI_TABLE = "phi_record" as const;

/** Every tenant-scoped table the leg inspects for FORCE-RLS posture (the composed migration set + the
 *  app's own PHI table). A FIXED, ordered list so the RLS-posture evidence is deterministic. */
export const TENANT_TABLES = [
  "field_key_version",
  "field_wrapped_dek",
  "audit_chain_entry",
  "locked_version",
  "impersonation_session",
  PHI_TABLE,
] as const;

// Deterministic, NON-secret demo key material (32-byte master + salt). Real deployments source these
// from an env-var / secrets manager of your choice, or a KMS provider; a fixed demo seed keeps the
// leg reproducible (the salt is non-secret; this master is a throwaway demo value, never a production key).
const DEMO_MASTER_KEY = Buffer.alloc(32, 0x2c);
const DEMO_FIELD_SALT = Buffer.alloc(32, 0x55);

/** The live substrate the leg composes — all test-doubled, no live cloud. */
export interface LegHarness {
  /** Embedded Postgres (PGlite) — a `Transactor` with real FORCE-RLS + SET ROLE semantics. */
  readonly db: PGlite;
  /** WORM object store over a temp dir (write-once; retention echoed, not time-locked — dev only). */
  readonly store: LocalArtifactStore;
  /** Per-tenant derived field-key provider backing `withTenantCrypto`. */
  readonly provider: DerivedKeyProvider;
  /** In-memory operational `EventSink` capturing the redacted ops mirror. */
  readonly sink: InMemoryEventSink;
  /** Tear down the DB connection and remove the temp WORM dir. */
  cleanup(): Promise<void>;
}

/**
 * Provision the leg substrate: a fresh PGlite with a non-login `app` role, the composed compliance
 * migrations applied in order, and the SEC/HIPAA demo table created with its FORCE-RLS policy. Every
 * call returns an isolated stack (its own in-memory DB + temp WORM dir), so concurrent runs never
 * collide on a write-once WORM key.
 */
export async function createLegHarness(): Promise<LegHarness> {
  const db = new PGlite();

  // The non-superuser role RLS policies are GRANTed to (mirrors the production `withTenant` shape).
  await db.exec(
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
         CREATE ROLE app NOLOGIN;
       END IF;
     END $$;`,
  );

  // Apply the REAL composed migration set (field-crypto key tables → audit-worm chain → versions),
  // in the assembler's renumbered order — each migration ships its own ENABLE+FORCE RLS policy.
  for (const migration of assembleComplianceMigrations().sequence) {
    await db.exec(migration.sql);
  }

  // The app's own SEC/HIPAA table + its fail-closed tenant policy (the migration set does not own a
  // domain table; the edition records evidence in WORM + the chain, ADR-0070).
  await db.exec(
    `CREATE TABLE ${PHI_TABLE} (
       id         text PRIMARY KEY,
       account_id text NOT NULL,
       ssn        text NOT NULL
     );
     ${buildTenantPolicySql(PHI_TABLE)}`,
  );

  const root = mkdtempSync(join(tmpdir(), "caisson-worm-"));
  const store = new LocalArtifactStore(root);
  if (process.env.NODE_ENV === "production") {
    // Fail closed: this leg is a golden-pinned DETERMINISTIC demo that seals SYNTHETIC PHI under a
    // fixed demo vector — it must never run in production, where a refactor could route real tenant
    // data through it (parity with apps/site byok.ts, ADR-0183). apps/compliance is not deployed; tests
    // run under NODE_ENV=test, and the leg's determinism forbids fromEnv, so this guard is the safe
    // defense-in-depth (not a fromEnv switch, which would break the golden fixtures).
    throw new Error(
      "compliance leg harness must not run in production (demo key material only).",
    );
  }
  const provider = new DerivedKeyProvider(DEMO_MASTER_KEY, DEMO_FIELD_SALT);
  const sink = new InMemoryEventSink();

  return {
    db,
    store,
    provider,
    sink,
    async cleanup() {
      await db.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

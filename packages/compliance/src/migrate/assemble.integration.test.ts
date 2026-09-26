// Integration proof for the compliance edition's migration assembly (ADR-0070/0090/0014).
// Assembles the REAL per-package on-disk migrations — field-crypto KEY tables → audit-worm
// chain+version — into ONE ordered, renumbered sequence under ONE `schema_version` checksum ledger
// (the kernel's pure merge), then APPLIES that sequence against PGlite (a true Postgres with FORCE
// RLS, SET ROLE, plpgsql triggers, advisory locks) to prove the ordered apply is idempotent, the
// ledger is stamped, every composed tenant table still ships its RLS policy, and a tampered ledger
// fails closed. No network, no live cloud — PGlite only. The apply loop is the SHARED `runMigrations`
// from @caisson-sh/migrate (ADR-0090) — this test re-implements NOTHING; it injects a PGlite-backed
// `MigrationApplier` port, proving the edition's assembled output is consumable by the canonical
// forward-only runner (skip already-recorded versions; checksum drift on a recorded version is fatal,
// ADR-0006).
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { randomUUID } from "node:crypto";
import type { MergedMigration, MigrationAssembly } from "@caisson-sh/kernel";
import {
  type MigrationApplier,
  type MigrationRunResult,
  runMigrations,
} from "@caisson-sh/migrate";
import { type TestPg, newTestPg } from "@caisson-sh/testing";
import {
  assembleComplianceMigrations,
  complianceMigrationPackages,
  // Aliased: the local `RELEASED_GLOBAL_PREFIX` below is the CHECKSUM contract (version+digest of
  // the pre-0004 release); this is the assembler's identity PIN list. Same idea, different shape.
  RELEASED_GLOBAL_PREFIX as PINNED_PREFIX,
} from "./assemble.ts";

/** The DB-side `schema_version` ledger (ADR-0014) — the runner's record of what has been applied. */
const SCHEMA_VERSION_DDL = `CREATE TABLE IF NOT EXISTS schema_version (
  version    integer     PRIMARY KEY,
  checksum   text        NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);`;

/** Every tenant table the assembled sequence composes — used for the RLS-survives-assembly proof. */
const COMPOSED_TABLES = [
  "field_key_version",
  "field_wrapped_dek",
  "audit_chain_entry",
  "locked_version",
  "worm_artifact_version",
  "impersonation_session",
] as const;

/**
 * The global migration identities already released before audit-worm added artifact-version
 * persistence. These checksums are the production ledger contract: new package-local migrations
 * must append after this prefix instead of renumbering it.
 */
const RELEASED_GLOBAL_PREFIX = [
  {
    version: 1,
    sourcePackage: "@caisson-sh/field-crypto",
    sourceName: "0001_field_keys.sql",
    checksum:
      "e23c8bc5449c43e4a2f81e07ed6a13b1f9c357db4fa6692a542e9da61b9203da",
  },
  {
    version: 2,
    sourcePackage: "@caisson-sh/field-crypto",
    sourceName: "0002_field_keys_rls_nullif.sql",
    checksum:
      "cbd5e935f744529a866fd7800458996897ca75e424c5bad723f1c2c918863ae3",
  },
  {
    version: 3,
    sourcePackage: "@caisson-sh/audit-worm",
    sourceName: "0001_audit_chain.sql",
    checksum:
      "1661369f117e83e80f1301bfb60073c06d6fd9fcc5445da11402e189bb001aa2",
  },
  {
    version: 4,
    sourcePackage: "@caisson-sh/audit-worm",
    sourceName: "0002_versions.sql",
    checksum:
      "7591464b2c1055dca3165cfb2a127ee78ddb13193eeb5575312bdbf3fd1fc964",
  },
  {
    version: 5,
    sourcePackage: "@caisson-sh/audit-worm",
    sourceName: "0003_rls_nullif.sql",
    checksum:
      "c2a180d8d4fcb06f7c190883b974b2b18f0ba3fa9646a227bd5dc9b33a75460b",
  },
  {
    version: 6,
    sourcePackage: "@caisson-sh/compliance",
    sourceName: "0001_impersonation_session.sql",
    checksum:
      "da2e9bac7b168db5e317d85816e8317fd819d0b0a5a2989d28e90c62c0a39066",
  },
  {
    version: 7,
    sourcePackage: "@caisson-sh/compliance",
    sourceName: "0002_impersonation_session_rls_nullif.sql",
    checksum:
      "30c970d6680a3527abe1dbadd612762e3e83d08f3c7979555f20464b58eedb83",
  },
] as const;

/**
 * A PGlite-backed `MigrationApplier` (ADR-0090) — the ONLY thing this test supplies. The forward-only
 * apply/skip/checksum-drift loop is the SHARED `runMigrations` from @caisson-sh/migrate; this port just
 * wires it to a real DB: `applied()` reads the `schema_version` ledger, `apply()` runs the migration
 * SQL and records its ledger row inside ONE transaction. Forward-only idempotency + fail-closed on
 * checksum drift (ADR-0006) are proven here against a true Postgres, not re-implemented.
 */
function pgApplier(tp: TestPg): MigrationApplier {
  return {
    applied: () =>
      tp.query<{ version: number; checksum: string }>(
        "SELECT version, checksum FROM schema_version ORDER BY version",
      ),
    apply: (migration: MergedMigration) =>
      tp.pg.transaction(async (tx) => {
        await tx.exec(migration.sql);
        await tx.query(
          "INSERT INTO schema_version (version, checksum) VALUES ($1, $2)",
          [migration.seq, migration.checksum],
        );
      }),
  };
}

let tp: TestPg;
let assembly: MigrationAssembly;
let firstRun: MigrationRunResult;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(SCHEMA_VERSION_DDL);
  assembly = assembleComplianceMigrations();
  firstRun = await runMigrations(assembly, pgApplier(tp));
});

afterAll(async () => {
  await tp.close();
});

describe("assembled sequence (ADR-0070, TM-O)", () => {
  test("merges the dependency closure into ONE ordered, renumbered sequence — key tables FIRST", () => {
    // field-crypto's key table renumbers to 0001 AHEAD of the audit-worm chain that stores its
    // ciphertext (key tables before the encrypted-column layer), then chain, then version,
    // then the compliance edition's own impersonation table (ADR-0187 — it appends to that chain).
    // Each package's pgbouncer/pooler NULLIF hardening (ADR-0005/0006) rides its own follow-up
    // migration file, appended after the package's original migrations — append-only, never an edit.
    expect(assembly.sequence.map((m) => m.filename)).toEqual([
      "0001_field_keys.sql",
      "0002_field_keys_rls_nullif.sql",
      "0003_audit_chain.sql",
      "0004_versions.sql",
      "0005_rls_nullif.sql",
      "0006_impersonation_session.sql",
      "0007_impersonation_session_rls_nullif.sql",
      "0008_artifact_versions.sql",
    ]);
    expect(assembly.sequence.map((m) => m.sourcePackage)).toEqual([
      "@caisson-sh/field-crypto",
      "@caisson-sh/field-crypto",
      "@caisson-sh/audit-worm",
      "@caisson-sh/audit-worm",
      "@caisson-sh/audit-worm",
      "@caisson-sh/compliance",
      "@caisson-sh/compliance",
      "@caisson-sh/audit-worm",
    ]);
    expect(assembly.sequence.map((m) => m.seq)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  test("stamps ONE schema_version checksum ledger over the merged set (ADR-0014)", () => {
    expect(assembly.ledger.map((l) => l.version)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(assembly.ledger.map((l) => l.filename)).toEqual(
      assembly.sequence.map((m) => m.filename),
    );
    for (const entry of assembly.ledger) {
      expect(entry.checksum).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(assembly.schemaVersion).toMatch(/^[0-9a-f]{64}$/);
  });

  test("the assembly is deterministic — a re-run is byte-identical", () => {
    expect(JSON.stringify(assembleComplianceMigrations())).toBe(
      JSON.stringify(assembly),
    );
  });
});

describe("ordered apply + ledger (PGlite)", () => {
  test("applies the full ordered sequence on a fresh DB, recording the ledger", async () => {
    expect(firstRun.applied).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(firstRun.skipped).toEqual([]);

    const rows = await tp.query<{ version: number; checksum: string }>(
      "SELECT version, checksum FROM schema_version ORDER BY version",
    );
    expect(rows).toEqual(
      assembly.ledger.map((l) => ({
        version: l.version,
        checksum: l.checksum,
      })),
    );

    // Every composed migration actually created its table.
    for (const table of COMPOSED_TABLES) {
      const rows = await tp.query<{ reg: string | null }>(
        "SELECT to_regclass($1)::text AS reg",
        [table],
      );
      expect(rows[0]?.reg).toBe(table);
    }
  });

  test("re-running the assembled apply is idempotent — every version skipped", async () => {
    const second = await runMigrations(assembly, pgApplier(tp));
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("an existing released 1–7 ledger applies only artifact versions at 8", async () => {
    const upgraded = await newTestPg();
    try {
      await upgraded.exec(SCHEMA_VERSION_DDL);
      const migrationsByIdentity = new Map(
        assembly.sequence.map((migration) => [
          `${migration.sourcePackage}:${migration.sourceName}`,
          migration,
        ]),
      );

      for (const released of RELEASED_GLOBAL_PREFIX) {
        const migration = migrationsByIdentity.get(
          `${released.sourcePackage}:${released.sourceName}`,
        );
        expect(migration).toBeDefined();
        expect(migration?.checksum).toBe(released.checksum);
        await upgraded.exec(migration?.sql ?? "");
        await upgraded.query(
          "INSERT INTO schema_version (version, checksum) VALUES ($1, $2)",
          [released.version, released.checksum],
        );
      }

      const result = await runMigrations(assembly, pgApplier(upgraded));
      expect(result).toEqual({
        applied: [8],
        skipped: [1, 2, 3, 4, 5, 6, 7],
        schemaVersion: assembly.schemaVersion,
      });
      const [artifactVersions] = await upgraded.query<{ reg: string | null }>(
        "SELECT to_regclass('worm_artifact_version')::text AS reg",
      );
      expect(artifactVersions?.reg).toBe("worm_artifact_version");
    } finally {
      await upgraded.close();
    }
  });
});

describe("RLS survives assembly (TM-O — no tenant table ships without its policy)", () => {
  test("every composed tenant table has ENABLE + FORCE row security and a policy", async () => {
    for (const table of COMPOSED_TABLES) {
      const [sec] = await tp.query<{
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1",
        [table],
      );
      expect(sec?.relrowsecurity).toBe(true);
      expect(sec?.relforcerowsecurity).toBe(true);

      const [pol] = await tp.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM pg_policies WHERE tablename = $1",
        [table],
      );
      expect(pol?.n).toBeGreaterThan(0);
    }
  });

  test("the composed schema enforces tenant isolation end-to-end (fail-closed)", async () => {
    const a = randomUUID();
    const b = randomUUID();
    await tp.asTenant(a, (tx) =>
      tx.query(
        "INSERT INTO field_key_version (id, account_id, key_version) VALUES ($1, $2, 1)",
        [randomUUID(), a],
      ),
    );

    const ownCount = await tp.asTenant(a, async (tx) => {
      const r = await tx.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM field_key_version",
      );
      return r.rows[0]?.n;
    });
    expect(ownCount).toBe(1);

    // Tenant B sees nothing of A's row even with an explicit cross-tenant filter (RLS, not the WHERE).
    const crossCount = await tp.asTenant(b, async (tx) => {
      const r = await tx.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM field_key_version WHERE account_id = $1",
        [a],
      );
      return r.rows[0]?.n;
    });
    expect(crossCount).toBe(0);
  });
});

describe("ledger fails closed (ADR-0006)", () => {
  test("a tampered recorded checksum aborts the next apply — never silently re-applies", async () => {
    // Superuser rewrites a recorded checksum (a shipped migration's bytes were edited).
    await tp.query(
      "UPDATE schema_version SET checksum = $1 WHERE version = 1",
      ["deadbeef"],
    );
    await expect(runMigrations(assembly, pgApplier(tp))).rejects.toThrow(
      /checksum drift/,
    );
  });
});

describe("released-migration pinning", () => {
  // The assembler already refuses a pin that names a missing file and a duplicate pin. Nothing
  // caught the reverse: a migration that exists on disk but was never pinned. That one lands in
  // the UNPINNED tail, which is ordered by topological package order — so shipping an unpinned
  // compliance migration and later adding a field-crypto one silently RENUMBERS the released
  // migration, and every deployed ledger then reads it as checksum drift. Adding the pin in the
  // same change as the migration is the whole convention; this is what enforces it.
  test("every on-disk migration is pinned in RELEASED_GLOBAL_PREFIX", () => {
    const pinned = new Set(
      PINNED_PREFIX.map((p) => `${p.sourcePackage}\u0000${p.sourceName}`),
    );
    const unpinned: string[] = [];
    for (const pkg of complianceMigrationPackages()) {
      for (const migration of pkg.migrations) {
        const key = `${pkg.slug}\u0000${migration.name}`;
        if (!pinned.has(key)) unpinned.push(`${pkg.slug}:${migration.name}`);
      }
    }
    expect(unpinned).toEqual([]);
  });

  test("no pin names a migration that is no longer on disk", () => {
    const onDisk = new Set(
      complianceMigrationPackages().flatMap((pkg) =>
        pkg.migrations.map((m) => `${pkg.slug}\u0000${m.name}`),
      ),
    );
    const dangling = PINNED_PREFIX.filter(
      (p) => !onDisk.has(`${p.sourcePackage}\u0000${p.sourceName}`),
    ).map((p) => `${p.sourcePackage}:${p.sourceName}`);
    expect(dangling).toEqual([]);
  });
});

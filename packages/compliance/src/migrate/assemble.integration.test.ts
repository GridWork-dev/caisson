// Integration proof for the compliance edition's migration assembly (ADR-0070/0014; TM-O). Assembles
// the REAL per-package on-disk migrations — field-crypto KEY tables → audit-worm chain+version — into
// ONE ordered, renumbered sequence under ONE `schema_version` checksum ledger (the kernel's pure
// merge), then APPLIES that sequence against PGlite (a true Postgres with FORCE RLS, SET ROLE,
// plpgsql triggers, advisory locks) to prove the ordered apply is idempotent, the ledger is stamped,
// every composed tenant table still ships its RLS policy, and a tampered ledger fails closed. No
// network, no live cloud — PGlite only. The apply loop mirrors the @caisson/cli runner seam (skip
// already-recorded versions; checksum drift on a recorded version is fatal, ADR-0006) so the
// edition's assembled output is provably consumable by the canonical forward-only runner.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import type { MigrationAssembly } from "@caisson/kernel";
import { type TestPg, newTestPg } from "@caisson/testing";
import { assembleComplianceMigrations } from "./assemble.ts";

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
] as const;

interface ApplyResult {
  readonly applied: number[];
  readonly skipped: number[];
}

/**
 * Apply an assembled sequence in order, recording each `schema_version` row inside one transaction.
 * Forward-only + idempotent: an already-recorded version is skipped; if a recorded version's checksum
 * no longer matches the assembled one the run fails CLOSED — a shipped migration's bytes changed,
 * which ADR-0006 (append-only) forbids. (A migration checksum is a public content hash, not a secret,
 * so a plain compare is correct.)
 */
async function applyAssembly(
  tp: TestPg,
  assembly: MigrationAssembly,
): Promise<ApplyResult> {
  const prior = new Map<number, string>();
  for (const row of await tp.query<{ version: number; checksum: string }>(
    "SELECT version, checksum FROM schema_version ORDER BY version",
  )) {
    prior.set(row.version, row.checksum);
  }

  const applied: number[] = [];
  const skipped: number[] = [];
  for (const migration of assembly.sequence) {
    const seen = prior.get(migration.seq);
    if (seen !== undefined) {
      if (seen !== migration.checksum) {
        throw new Error(
          `migration checksum drift at version ${migration.seq} (${migration.filename})`,
        );
      }
      skipped.push(migration.seq);
      continue;
    }
    await tp.pg.transaction(async (tx) => {
      await tx.exec(migration.sql);
      await tx.query(
        "INSERT INTO schema_version (version, checksum) VALUES ($1, $2)",
        [migration.seq, migration.checksum],
      );
    });
    applied.push(migration.seq);
  }
  return { applied, skipped };
}

let tp: TestPg;
let assembly: MigrationAssembly;
let firstRun: ApplyResult;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(SCHEMA_VERSION_DDL);
  assembly = assembleComplianceMigrations();
  firstRun = await applyAssembly(tp, assembly);
});

afterAll(async () => {
  await tp.close();
});

describe("assembled sequence (ADR-0070, TM-O)", () => {
  test("merges the dependency closure into ONE ordered, renumbered sequence — key tables FIRST", () => {
    // field-crypto's key table renumbers to 0001 AHEAD of the audit-worm chain that stores its
    // ciphertext (TM-O: key tables before the encrypted-column layer), then chain, then version.
    expect(assembly.sequence.map((m) => m.filename)).toEqual([
      "0001_field_keys.sql",
      "0002_audit_chain.sql",
      "0003_versions.sql",
    ]);
    expect(assembly.sequence.map((m) => m.sourcePackage)).toEqual([
      "@caisson/field-crypto",
      "@caisson/audit-worm",
      "@caisson/audit-worm",
    ]);
    expect(assembly.sequence.map((m) => m.seq)).toEqual([1, 2, 3]);
  });

  test("stamps ONE schema_version checksum ledger over the merged set (ADR-0014)", () => {
    expect(assembly.ledger.map((l) => l.version)).toEqual([1, 2, 3]);
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
    expect(firstRun.applied).toEqual([1, 2, 3]);
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
    const second = await applyAssembly(tp, assembly);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual([1, 2, 3]);
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
    await expect(applyAssembly(tp, assembly)).rejects.toThrow(/checksum drift/);
  });
});

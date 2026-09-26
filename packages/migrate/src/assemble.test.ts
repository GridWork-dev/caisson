import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MergedMigration } from "@caisson-sh/kernel";
import { matchGolden } from "@caisson-sh/testing";
import {
  type SelectedPackage,
  assembleSelected,
  emitMigrationFileSet,
  readPackageMigrations,
} from "./assemble.ts";
import {
  type AppliedMigration,
  type MigrationApplier,
  runMigrations,
} from "./runner.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "__fixtures__");

// Two on-disk fixture packages: `@fixture/feature` depends on `@fixture/base`, so base's two
// migrations must order first and feature's `0001` renumbers to a global `0003`. Declared
// dep-first to prove the kernel topo-merge (not array order) drives the result.
const SELECTED: readonly SelectedPackage[] = [
  {
    slug: "@fixture/feature",
    dir: join(FIX, "feature"),
    dependsOn: ["@fixture/base"],
  },
  { slug: "@fixture/base", dir: join(FIX, "base"), dependsOn: [] },
];

/** An in-memory runner port (NO live DB in CI) recording exactly what was applied (ADR-0070). */
function memApplier(
  seed: readonly AppliedMigration[] = [],
): MigrationApplier & { rows: AppliedMigration[] } {
  const rows: AppliedMigration[] = [...seed];
  return {
    rows,
    applied(): Promise<readonly AppliedMigration[]> {
      return Promise.resolve([...rows]);
    },
    apply(migration: MergedMigration): Promise<void> {
      rows.push({ version: migration.seq, checksum: migration.checksum });
      return Promise.resolve();
    },
  };
}

describe("migration-assembly driver (ADR-0070)", () => {
  test("reads two fixture packages into ONE ordered, renumbered sequence", () => {
    const { sequence } = assembleSelected(SELECTED);
    expect(sequence.map((m) => m.sourcePackage)).toEqual([
      "@fixture/base",
      "@fixture/base",
      "@fixture/feature",
    ]);
    expect(sequence.map((m) => m.filename)).toEqual([
      "0001_init.sql",
      "0002_widgets.sql",
      "0003_feature_flags.sql",
    ]);
  });

  test("produces ONE schema_version ledger over the merged set", () => {
    const { sequence, ledger, schemaVersion } = assembleSelected(SELECTED);
    expect(ledger).toHaveLength(sequence.length);
    expect(ledger.map((l) => l.version)).toEqual([1, 2, 3]);
    expect(schemaVersion).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a package with no migrations/ dir contributes nothing", () => {
    expect(
      readPackageMigrations({
        slug: "@fixture/empty",
        dir: join(FIX, "empty"),
        dependsOn: [],
      }).migrations,
    ).toEqual([]);
  });

  test("re-running is byte-identical (deterministic, ADR-0014)", () => {
    expect(JSON.stringify(assembleSelected(SELECTED))).toBe(
      JSON.stringify(assembleSelected(SELECTED)),
    );
    expect(
      JSON.stringify(emitMigrationFileSet(assembleSelected(SELECTED))),
    ).toBe(JSON.stringify(emitMigrationFileSet(assembleSelected(SELECTED))));
  });

  test("the emitted generated-app file set matches its golden", () => {
    matchGolden(
      import.meta.url,
      "assembled-fileset",
      emitMigrationFileSet(assembleSelected(SELECTED)),
    );
  });
});

describe("migration-runner seam (ADR-0070)", () => {
  test("applies the sequence in order on a fresh DB, recording every checksum", async () => {
    const assembly = assembleSelected(SELECTED);
    const applier = memApplier();
    const result = await runMigrations(assembly, applier);

    expect(result.applied).toEqual([1, 2, 3]);
    expect(result.skipped).toEqual([]);
    expect(result.schemaVersion).toBe(assembly.schemaVersion);
    expect(applier.rows.map((r) => r.version)).toEqual([1, 2, 3]);
    expect(applier.rows.map((r) => r.checksum)).toEqual(
      assembly.sequence.map((m) => m.checksum),
    );
  });

  test("a re-run is idempotent — every version already recorded is skipped", async () => {
    const assembly = assembleSelected(SELECTED);
    const seed = assembly.sequence.map((m) => ({
      version: m.seq,
      checksum: m.checksum,
    }));
    const result = await runMigrations(assembly, memApplier(seed));

    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual([1, 2, 3]);
  });

  test("checksum drift on an already-applied version fails closed (ADR-0006)", () => {
    const assembly = assembleSelected(SELECTED);
    const tampered = memApplier([{ version: 1, checksum: "deadbeef" }]);
    expect(runMigrations(assembly, tampered)).rejects.toThrow(/checksum drift/);
  });
});

// W2b bundler tests (ADR-0091). Prove the build step discovers the contributing modules' source
// migrations and materializes them into the bundle layout the generator's `packageDir()` resolver
// reads — including the clean-first rebuild (a stale bundle entry never survives). Runs against the
// REAL packages/ source tree (discovery) but writes only into a throwaway temp bundle dir.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type SelectedPackage, assembleSelected } from "@caisson/migrate";
import {
  PACKAGES_ROOT,
  bundleMigrations,
  planMigrationBundle,
} from "./bundle-migrations.ts";

let bundleRoot: string;

beforeEach(() => {
  bundleRoot = mkdtempSync(join(tmpdir(), "caisson-migbundle-"));
});

afterEach(() => {
  rmSync(bundleRoot, { recursive: true, force: true });
});

describe("planMigrationBundle (ADR-0091)", () => {
  test("discovers the contributing modules' migrations from the real source tree", () => {
    const plan = planMigrationBundle(PACKAGES_ROOT, bundleRoot);
    const modules = new Set(plan.map((p) => p.module));
    // field-crypto (1) + audit-worm (2) are the only current sources (ADR-0091).
    expect(modules.has("field-crypto")).toBe(true);
    expect(modules.has("audit-worm")).toBe(true);
    const byModule = (m: string) =>
      plan.filter((p) => p.module === m).map((p) => p.file);
    expect(byModule("field-crypto")).toEqual(["0001_field_keys.sql"]);
    expect(byModule("audit-worm")).toEqual([
      "0001_audit_chain.sql",
      "0002_versions.sql",
    ]);
  });

  test("only NNNN_*.sql files are planned and each maps under bundleRoot/<module>/migrations/", () => {
    const plan = planMigrationBundle(PACKAGES_ROOT, bundleRoot);
    expect(plan.length).toBeGreaterThan(0);
    for (const copy of plan) {
      expect(copy.file).toMatch(/^\d+_.+\.sql$/);
      // The `migrations/` segment is load-bearing: readPackageMigrations appends it to packageDir().
      expect(copy.to).toBe(
        join(bundleRoot, copy.module, "migrations", copy.file),
      );
    }
  });

  test("the plan is deterministic — modules + files sorted, re-run identical", () => {
    expect(JSON.stringify(planMigrationBundle(PACKAGES_ROOT, bundleRoot))).toBe(
      JSON.stringify(planMigrationBundle(PACKAGES_ROOT, bundleRoot)),
    );
  });
});

describe("bundleMigrations (ADR-0091)", () => {
  test("materializes every planned migration into the bundle, byte-identical to source", () => {
    const copied = bundleMigrations(PACKAGES_ROOT, bundleRoot);
    expect(copied.length).toBeGreaterThan(0);
    for (const copy of copied) {
      expect(existsSync(copy.to)).toBe(true);
      expect(readFileSync(copy.to, "utf8")).toBe(
        readFileSync(copy.from, "utf8"),
      );
    }
    // The resolver layout the generator reads: migrations-bundle/<name>/migrations/NNNN_*.sql.
    expect(
      existsSync(
        join(bundleRoot, "field-crypto", "migrations", "0001_field_keys.sql"),
      ),
    ).toBe(true);
  });

  test("clean-first rebuild removes a stale bundle entry (no lingering migration)", () => {
    // Seed a stale entry that no source migration backs.
    mkdirSync(join(bundleRoot, "ghost"), { recursive: true });
    writeFileSync(join(bundleRoot, "ghost", "0001_stale.sql"), "-- stale\n");
    expect(existsSync(join(bundleRoot, "ghost", "0001_stale.sql"))).toBe(true);

    bundleMigrations(PACKAGES_ROOT, bundleRoot);

    // The rebuild wiped the stale module; the real migrations are present.
    expect(existsSync(join(bundleRoot, "ghost"))).toBe(false);
    expect(
      existsSync(
        join(bundleRoot, "field-crypto", "migrations", "0001_field_keys.sql"),
      ),
    ).toBe(true);
  });
});

// The layout contract that ADR-0091 hinges on: the bundle the build step writes MUST be readable by
// the SAME resolver the generator uses. packageDir() (meter.ts) hands assembleSelected a dir of
// `<bundleRoot>/<module>`, and readPackageMigrations appends `/migrations`. A flat bundle layout silently
// resolves to zero migrations (the merge becomes a permanent no-op), so this round trip is the regression
// lock: bundle → assembleSelected over the bundle dirs → a non-empty merged sequence.
describe("round-trip: the bundle is consumable by the resolver (ADR-0091)", () => {
  test("assembleSelected over the bundled dirs yields the merged field-crypto + audit-worm sequence", () => {
    bundleMigrations(PACKAGES_ROOT, bundleRoot);
    // Mirror exactly what meter.ts builds: dir = packageDir() = `<bundleRoot>/<module>` (no /migrations
    // here — readPackageMigrations adds it). audit-worm depends on field-crypto (down-only order).
    const selected: readonly SelectedPackage[] = [
      {
        slug: "field-crypto",
        dir: join(bundleRoot, "field-crypto"),
        dependsOn: [],
      },
      {
        slug: "audit-worm",
        dir: join(bundleRoot, "audit-worm"),
        dependsOn: ["field-crypto"],
      },
    ];
    const assembly = assembleSelected(selected);
    // field-crypto (1) + audit-worm (2) = 3 merged, renumbered into one sequence. A flat bundle → 0.
    expect(assembly.sequence.length).toBe(3);
  });
});

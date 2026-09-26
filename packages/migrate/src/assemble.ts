// The compose-time migration ASSEMBLER (ADR-0070/0090). The kernel owns the PURE merge algorithm
// (`assembleMigrations` — topo-order by the dep DAG, renumber into one `NNNN_*.sql` sequence, one
// `schema_version` checksum ledger over the merged set, ADR-0014). This is the IO half: it reads each
// selected package's on-disk `migrations/NNNN_*.sql`, feeds the bytes to the kernel algo, and emits
// the merged renumbered sequence + the single ledger as a generated-app file set. The runner that
// APPLIES the sequence lives alongside it (`./runner.ts`). This package is the ONE home for the
// assembler + runner; `@caisson-sh/cli` and `@caisson-sh/compliance` import them, never copy them (ADR-0090).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type MigrationAssembly,
  type MigrationFile,
  type PackageMigrations,
  assembleMigrations,
} from "@caisson-sh/kernel/node";
import type { EmittedFile, EmittedFileSet } from "./emit.ts";

/** A forward-only package migration on disk: `NNNN_<name>.sql`. */
const MIGRATION_FILE = /^\d+_.+\.sql$/;

/** Where the emitted ledger lands in the generated app (the runner's source of truth). */
const LEDGER_PATH = "migrations/schema_version.json";

/** A package selected into a generated app: its slug, its root dir, and its in-set (down-only) deps. */
export interface SelectedPackage {
  readonly slug: string;
  /** Path to the package root; its `migrations/NNNN_*.sql` files are read. */
  readonly dir: string;
  /** Other SELECTED package slugs this one depends on (down-only). Out-of-set deps impose no order. */
  readonly dependsOn: readonly string[];
}

/**
 * Read one package's forward-only migrations from `<dir>/migrations/`. Only `NNNN_*.sql` entries are
 * read (anything else is ignored); a package with no `migrations/` dir legitimately contributes
 * none. The SQL bytes are passed through verbatim so the kernel checksum is over the on-disk
 * content; the kernel algo re-validates names + re-sorts, so the read order here is not load-bearing.
 */
export function readPackageMigrations(pkg: SelectedPackage): PackageMigrations {
  const dir = join(pkg.dir, "migrations");
  const migrations: MigrationFile[] = existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => MIGRATION_FILE.test(name))
        .sort()
        .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf8") }))
    : [];
  return { slug: pkg.slug, dependsOn: pkg.dependsOn, migrations };
}

/**
 * Read every selected package's on-disk migrations and merge them via the kernel algo (ADR-0070):
 * ONE deterministic renumbered sequence + ONE `schema_version` checksum ledger. Deterministic given
 * fixed inputs (the kernel merge is pure) — a re-run is byte-identical.
 */
export function assembleSelected(
  packages: readonly SelectedPackage[],
): MigrationAssembly {
  return assembleMigrations(packages.map(readPackageMigrations));
}

/**
 * Emit an assembled result as the generated app's file set: one renumbered `migrations/NNNN_*.sql`
 * per merged migration + one `migrations/schema_version.json` ledger (the single checksum chain +
 * head the runner records against, ADR-0014). Pure + path-sorted → golden-able.
 */
export function emitMigrationFileSet(
  assembly: MigrationAssembly,
): EmittedFileSet {
  const files: EmittedFile[] = assembly.sequence.map((m) => ({
    path: `migrations/${m.filename}`,
    content: m.sql,
  }));
  files.push({
    path: LEDGER_PATH,
    content: `${JSON.stringify(
      { schemaVersion: assembly.schemaVersion, ledger: assembly.ledger },
      null,
      2,
    )}\n`,
  });
  return [...files].sort((a, b) => (a.path < b.path ? -1 : 1));
}

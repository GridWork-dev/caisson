// Compose-time migration BUNDLER (ADR-0091). A CLI build/pre-publish step that copies each
// contributing module's `src/migrations/NNNN_*.sql` into `packages/cli/migrations-bundle/<name>/migrations/`,
// mirroring how the CLI already ships its `templates/` tree as non-TS assets. The destination keeps the
// `migrations/` segment because the generator's resolver reads it back through that exact contract:
// `packageDir()` (meter.ts) returns `../migrations-bundle/<name>` via `import.meta.url`, and the shared
// `readPackageMigrations` (@caisson/migrate) appends `/migrations` — so a FLAT `<name>/<file>` layout
// would resolve to nothing and the merge would silently ship zero migrations. `import.meta.url` keeps it
// cwd-stable under turbo AND present in a published CLI, unlike a live workspace-source read. The bundle is a
// gitignored BUILD ARTIFACT regenerated from the canonical source migrations (never hand-edited, never
// committed) so the source packages stay the single source of truth and a removed migration cannot
// linger. The compose-time merge + single-ledger invariant (ADR-0070/0014) is unchanged — this only
// POPULATES the assembler's input. The migration assembler (@caisson/migrate) remains the authority on
// what a valid migration is; this build step is a dumb file copy.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/cli/scripts
/** The monorepo `packages/` root (…/packages/cli/scripts → …/packages). */
export const PACKAGES_ROOT = join(HERE, "..", "..");
/** Where the resolver (`packageDir()` in meter.ts) reads from: packages/cli/migrations-bundle. */
export const BUNDLE_ROOT = join(HERE, "..", "migrations-bundle");

/** A forward-only package migration on disk: `NNNN_<name>.sql` (same contract the assembler reads). */
const MIGRATION_FILE = /^\d+_.+\.sql$/;

/** One planned copy: a source migration and its bundle destination. */
export interface BundledMigration {
  /** Package dir name under `packages/`, e.g. `field-crypto`. */
  readonly module: string;
  /** The migration filename, `NNNN_*.sql`. */
  readonly file: string;
  /** Absolute source path (`packages/<module>/src/migrations/<file>`). */
  readonly from: string;
  /** Absolute destination path (`<bundleRoot>/<module>/migrations/<file>`) — the `migrations/` segment
   *  is what `readPackageMigrations` (@caisson/migrate) appends to `packageDir()`'s `<bundleRoot>/<module>`. */
  readonly to: string;
}

/**
 * Discover every `packages/<name>/src/migrations/NNNN_*.sql` and plan its copy into
 * `<bundleRoot>/<name>/migrations/` (the layout `readPackageMigrations` reads back). Reads the source
 * tree (discovery) but writes nothing — deterministic
 * (modules + files sorted). A package with no `src/migrations/` contributes none; today only
 * field-crypto + audit-worm carry migrations, but the scan is data-driven so a new module's
 * migrations bundle automatically.
 */
export function planMigrationBundle(
  packagesRoot: string,
  bundleRoot: string,
): BundledMigration[] {
  const out: BundledMigration[] = [];
  const modules = readdirSync(packagesRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const module of modules) {
    const migDir = join(packagesRoot, module, "src", "migrations");
    if (!existsSync(migDir)) continue;
    const files = readdirSync(migDir)
      .filter((f) => MIGRATION_FILE.test(f))
      .sort();
    for (const file of files) {
      out.push({
        module,
        file,
        from: join(migDir, file),
        to: join(bundleRoot, module, "migrations", file),
      });
    }
  }
  return out;
}

/**
 * Rebuild the migration bundle from scratch: REMOVE the bundle dir, then copy every planned migration.
 * The clean-first rebuild guarantees a source migration deleted upstream never lingers in the bundle.
 * Returns the plan that was materialized.
 */
export function bundleMigrations(
  packagesRoot: string = PACKAGES_ROOT,
  bundleRoot: string = BUNDLE_ROOT,
): BundledMigration[] {
  const plan = planMigrationBundle(packagesRoot, bundleRoot);
  rmSync(bundleRoot, { recursive: true, force: true });
  for (const copy of plan) {
    mkdirSync(dirname(copy.to), { recursive: true });
    cpSync(copy.from, copy.to);
  }
  return plan;
}

if (import.meta.main) {
  const copied = bundleMigrations();
  const moduleCount = new Set(copied.map((c) => c.module)).size;
  // A CI/build script reports what it wrote (process.stdout, not console — no-console floor).
  process.stdout.write(
    `cli: bundled ${copied.length} migration file(s) from ${moduleCount} module(s) into migrations-bundle/\n`,
  );
}

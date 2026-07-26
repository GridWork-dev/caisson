// Pure migration assembler (ADR-0070). Composable packages each own numbered, forward-only
// migrations; a generated app is ONE database with ONE migration history. This is the compose-time
// merge: it topologically orders the contributing packages by their dependency DAG (ADR-0003 — a
// package never depends "up" on an edition), renumbers their migrations into one global
// `NNNN_*.sql` sequence, and computes ONE `schema_version` checksum ledger over the merged set
// (ADR-0014). No edition or package owns global ordering or a private ledger.
//
// Pure + deterministic: no file IO, no clock, no randomness — the same input always yields
// byte-identical output, which is why it is golden-able. The compose-time driver (the CLI) reads
// the on-disk migrations and feeds them here; this module never touches the filesystem.
import { createHash } from "node:crypto";
import { canonicalize } from "./audit-chain.ts";

/** One package-owned migration file: its in-package name (`NNNN_*.sql`) and SQL body. */
export interface MigrationFile {
  readonly name: string;
  readonly sql: string;
}

/** A package's migration contribution: its slug, its in-set dependencies, and its migrations. */
export interface PackageMigrations {
  readonly slug: string;
  /** Other contributing package slugs this one depends on (down-only). Out-of-set deps are ignored. */
  readonly dependsOn: readonly string[];
  readonly migrations: readonly MigrationFile[];
}

/** One already-released migration identity pinned into the global ledger prefix. */
export interface PinnedMigrationIdentity {
  readonly sourcePackage: string;
  readonly sourceName: string;
}

/** One entry in the merged, globally-renumbered sequence. */
export interface MergedMigration {
  /** 1-based global ordinal in the assembled sequence. */
  readonly seq: number;
  /** Renumbered filename `NNNN_<base>.sql` (the original ordinal is replaced by the global one). */
  readonly filename: string;
  readonly sql: string;
  /** The package that contributed this migration. */
  readonly sourcePackage: string;
  /** The migration's original in-package name. */
  readonly sourceName: string;
  /** SHA-256 (hex) of the SQL body — the content checksum recorded in the ledger. */
  readonly checksum: string;
}

/** One `schema_version` ledger row over the merged set (ADR-0014). */
export interface SchemaVersionEntry {
  readonly version: number;
  readonly filename: string;
  readonly checksum: string;
}

/** The assembly result: the merged sequence, its ledger, and the single `schema_version` checksum. */
export interface MigrationAssembly {
  readonly sequence: readonly MergedMigration[];
  readonly ledger: readonly SchemaVersionEntry[];
  /** A single sha256 chained across the merged ledger — "is this DB at the expected schema". */
  readonly schemaVersion: string;
}

const MIGRATION_NAME = /^\d+_.+\.sql$/;

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Topologically order the packages by their in-set dependency DAG (Kahn's algorithm), breaking ties
 * by slug ascending so the order is deterministic. Dependencies outside the contributing set impose
 * no constraint (they contribute no migrations to order against). Throws on a duplicate slug or a
 * dependency cycle — flag, never guess (ADR-0006).
 */
function topoOrder(
  packages: readonly PackageMigrations[],
): PackageMigrations[] {
  const bySlug = new Map<string, PackageMigrations>();
  for (const pkg of packages) {
    if (bySlug.has(pkg.slug)) {
      throw new Error(`migration-assembly: duplicate package ${pkg.slug}`);
    }
    bySlug.set(pkg.slug, pkg);
  }

  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const pkg of packages) {
    let degree = 0;
    for (const dep of pkg.dependsOn) {
      if (!bySlug.has(dep)) continue; // out-of-set dep: no ordering constraint here
      degree += 1;
      const arr = dependents.get(dep) ?? [];
      arr.push(pkg.slug);
      dependents.set(dep, arr);
    }
    indegree.set(pkg.slug, degree);
  }

  const ordered: PackageMigrations[] = [];
  for (;;) {
    const ready = packages
      .map((p) => p.slug)
      .filter((slug) => indegree.get(slug) === 0)
      .sort();
    const next = ready[0];
    if (next === undefined) break;
    indegree.set(next, -1); // mark consumed
    ordered.push(bySlug.get(next) as PackageMigrations);
    for (const dependent of dependents.get(next) ?? []) {
      indegree.set(dependent, (indegree.get(dependent) ?? 0) - 1);
    }
  }

  if (ordered.length !== packages.length) {
    throw new Error("migration-assembly: dependency cycle");
  }
  return ordered;
}

/**
 * Merge the contributing packages' migrations into one renumbered sequence + one `schema_version`
 * checksum ledger. Deterministic and pure — the same input is always byte-identical, so the result
 * is golden-pinned (ADR-0013). The single `schemaVersion` is a sha256 chained across the ledger, so
 * any reordering or content drift changes it (ADR-0014).
 */
export function assembleMigrations(
  packages: readonly PackageMigrations[],
): MigrationAssembly {
  const ordered = topoOrder(packages);
  return assembleOrderedMigrations(
    ordered.flatMap((pkg) =>
      [...pkg.migrations]
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((migration) => ({ sourcePackage: pkg.slug, migration })),
    ),
  );
}

/**
 * Preserve an already-released global prefix while appending every newly discovered package
 * migration in normal dependency order. Package-local ordinals cannot alone preserve a composed
 * ledger: adding a migration to an earlier package would otherwise renumber later packages and make
 * their recorded checksums fail closed as drift.
 */
export function assembleMigrationsWithPinnedPrefix(
  packages: readonly PackageMigrations[],
  pinnedPrefix: readonly PinnedMigrationIdentity[],
): MigrationAssembly {
  const ordered = topoOrder(packages).flatMap((pkg) =>
    [...pkg.migrations]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map((migration) => ({ sourcePackage: pkg.slug, migration })),
  );
  const byIdentity = new Map(
    ordered.map((entry) => [
      `${entry.sourcePackage}\u0000${entry.migration.name}`,
      entry,
    ]),
  );
  const pinnedKeys = new Set<string>();
  const pinned = pinnedPrefix.map((identity) => {
    const key = `${identity.sourcePackage}\u0000${identity.sourceName}`;
    if (pinnedKeys.has(key)) {
      throw new Error(
        `migration-assembly: duplicate pinned migration ${identity.sourcePackage}:${identity.sourceName}`,
      );
    }
    pinnedKeys.add(key);
    const entry = byIdentity.get(key);
    if (entry === undefined) {
      throw new Error(
        `migration-assembly: missing pinned migration ${identity.sourcePackage}:${identity.sourceName}`,
      );
    }
    return entry;
  });

  return assembleOrderedMigrations([
    ...pinned,
    ...ordered.filter(
      (entry) =>
        !pinnedKeys.has(`${entry.sourcePackage}\u0000${entry.migration.name}`),
    ),
  ]);
}

function assembleOrderedMigrations(
  ordered: readonly {
    readonly sourcePackage: string;
    readonly migration: MigrationFile;
  }[],
): MigrationAssembly {
  const sequence: MergedMigration[] = [];
  let seq = 0;
  for (const { sourcePackage, migration } of ordered) {
    if (!MIGRATION_NAME.test(migration.name)) {
      throw new Error(
        `migration-assembly: invalid migration name ${migration.name}`,
      );
    }
    seq += 1;
    const base = migration.name.replace(/^\d+_/, "");
    sequence.push({
      seq,
      filename: `${String(seq).padStart(4, "0")}_${base}`,
      sql: migration.sql,
      sourcePackage,
      sourceName: migration.name,
      checksum: sha256(migration.sql),
    });
  }

  const ledger: SchemaVersionEntry[] = sequence.map((entry) => ({
    version: entry.seq,
    filename: entry.filename,
    checksum: entry.checksum,
  }));

  let cumulative = "";
  for (const entry of ledger) {
    cumulative = sha256(canonicalize([cumulative, entry.checksum]));
  }

  return { sequence, ledger, schemaVersion: cumulative };
}

// Migration assembly for the Compliance edition (ADR-0070, ADR-0014). A generated compliance app is
// ONE database with ONE migration history, but its dependency closure each owns numbered,
// forward-only `migrations/NNNN_*.sql`. This module DECLARES the edition's migration-contributing
// package set + its compose-time LAYERING order, then delegates the actual merge to the kernel's
// pure `assembleMigrations` — topo-order by the layering DAG, global renumber into one `NNNN_*.sql`
// sequence, ONE `schema_version` checksum ledger over the merged set.
//
// COMPOSE, NOT REBUILD: the topo-merge + checksum live in @caisson/kernel and no edition owns them
// (ADR-0070); the apply/record/checksum-drift runner seam lives in @caisson/cli. This file adds only
// the edition's package-set declaration + the IO glue that reads its packages' on-disk migrations
// (the same disk-read the CLI driver performs, specialized to the compliance dependency closure).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type MigrationAssembly,
  type MigrationFile,
  type PackageMigrations,
  assembleMigrations,
} from "@caisson/kernel";

/** A forward-only package migration on disk: `NNNN_<name>.sql`. */
const MIGRATION_FILE = /^\d+_.+\.sql$/;

/** The monorepo `packages/` root, resolved from this module (…/compliance/src/migrate → …/packages). */
const PACKAGES_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

/** One contributing package: its slug, the src dir whose `migrations/` are read, and its layering deps. */
interface ContributingPackage {
  readonly slug: string;
  readonly dir: string;
  readonly dependsOn: readonly string[];
}

/**
 * The Compliance edition's migration-contributing packages, declared in compose-time LAYERING order
 * (TM-O — key tables before the encrypted-column / ciphertext layer):
 *
 *   field-crypto  (field_key_version + field_wrapped_dek)   ── the crypto KEY infrastructure
 *        ↓ ordering predecessor
 *   audit-worm    (audit_chain_entry + locked_version)      ── commits PII as field-crypto CIPHERTEXT
 *
 * `dependsOn` here is the migration-LAYERING DAG fed to the kernel merge — NOT the code-import graph
 * (dependency-cruiser owns that, and stays 0-violation). audit-worm names field-crypto as an ordering
 * predecessor so the key tables always renumber AHEAD of the chain that stores their ciphertext, even
 * though audit-worm does NOT import field-crypto (the two trees are code-disjoint). Without this edge
 * the kernel's deterministic slug tie-break would order `audit-worm` first (it sorts ahead of
 * `field-crypto`), inverting the key→ciphertext layering.
 *
 * @caisson/{kernel,tenancy-rls} contribute NO migration files of their own — their RLS helpers are
 * emitted INTO each migration (`buildTenantPolicySql`), and the compliance edition itself records
 * evidence in the WORM artifact store + the audit chain, not a dedicated table — so it adds no
 * migration here either. The assembler picks up any package that later grows a `migrations/` dir.
 */
const CONTRIBUTING: readonly ContributingPackage[] = [
  {
    slug: "@caisson/field-crypto",
    dir: join(PACKAGES_ROOT, "field-crypto", "src"),
    dependsOn: [],
  },
  {
    slug: "@caisson/audit-worm",
    dir: join(PACKAGES_ROOT, "audit-worm", "src"),
    dependsOn: ["@caisson/field-crypto"],
  },
];

/** Read one package's forward-only `migrations/NNNN_*.sql` (verbatim bytes → the kernel checksum). */
function readMigrations(srcDir: string): MigrationFile[] {
  const dir = join(srcDir, "migrations");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => MIGRATION_FILE.test(name))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf8") }));
}

/**
 * The compliance edition's contributing packages as kernel `PackageMigrations` (SQL read from disk in
 * the declared layering order). The kernel merge re-validates names + re-sorts, so the read order is
 * not load-bearing — the `dependsOn` edges are.
 */
export function complianceMigrationPackages(): PackageMigrations[] {
  return CONTRIBUTING.map((pkg) => ({
    slug: pkg.slug,
    dependsOn: pkg.dependsOn,
    migrations: readMigrations(pkg.dir),
  }));
}

/**
 * Assemble the compliance edition's full migration set into ONE ordered, globally-renumbered sequence
 * + ONE `schema_version` checksum ledger via the kernel's pure merge (ADR-0070/0014). Deterministic —
 * a re-run is byte-identical, so the assembled sequence + ledger are golden-stable.
 */
export function assembleComplianceMigrations(): MigrationAssembly {
  return assembleMigrations(complianceMigrationPackages());
}

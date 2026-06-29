// Migration assembly for the Compliance edition (ADR-0070/0090, ADR-0014). A generated compliance app
// is ONE database with ONE migration history, but its dependency closure each owns numbered,
// forward-only `migrations/NNNN_*.sql`. This module DECLARES the edition's migration-contributing
// package set + its compose-time LAYERING order, then delegates BOTH the disk read and the merge to
// the base `@caisson/migrate` (`readPackageMigrations` + `assembleSelected`, ADR-0090) which wraps the
// kernel's pure `assembleMigrations` — topo-order by the layering DAG, global renumber into one
// `NNNN_*.sql` sequence, ONE `schema_version` checksum ledger over the merged set.
//
// COMPOSE, NOT COPY: the disk read + the topo-merge + the apply/checksum runner are owned ONCE in
// @caisson/migrate (ADR-0090); this file adds only the edition's package-set declaration. It no longer
// carries its own `MIGRATION_FILE`/`readMigrations` copy — that duplication is what ADR-0090 retired.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MigrationAssembly, PackageMigrations } from "@caisson/kernel";
import {
  type SelectedPackage,
  assembleSelected,
  readPackageMigrations,
} from "@caisson/migrate";

/** The monorepo `packages/` root, resolved from this module (…/compliance/src/migrate → …/packages). */
const PACKAGES_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

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
 * `field-crypto`), inverting the key→ciphertext layering. Each `dir` points at the package's `src`
 * dir, whose `migrations/NNNN_*.sql` the shared `readPackageMigrations` reads.
 *
 * @caisson/{kernel,tenancy-rls} contribute NO migration files of their own — their RLS helpers are
 * emitted INTO each migration (`buildTenantPolicySql`), and the compliance edition itself records
 * evidence in the WORM artifact store + the audit chain, not a dedicated table — so it adds no
 * migration here either. The assembler picks up any package that later grows a `migrations/` dir.
 */
const CONTRIBUTING: readonly SelectedPackage[] = [
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

/**
 * The compliance edition's contributing packages as kernel `PackageMigrations` (SQL read from disk in
 * the declared layering order via the shared `readPackageMigrations`). The kernel merge re-validates
 * names + re-sorts, so the read order is not load-bearing — the `dependsOn` edges are.
 */
export function complianceMigrationPackages(): PackageMigrations[] {
  return CONTRIBUTING.map(readPackageMigrations);
}

/**
 * Assemble the compliance edition's full migration set into ONE ordered, globally-renumbered sequence
 * + ONE `schema_version` checksum ledger via the base assembler (kernel merge, ADR-0070/0090/0014).
 * Deterministic — a re-run is byte-identical, so the assembled sequence + ledger are golden-stable.
 */
export function assembleComplianceMigrations(): MigrationAssembly {
  return assembleSelected(CONTRIBUTING);
}

// Migration assembly for the Compliance edition (ADR-0070/0090, ADR-0014). A generated compliance app
// is ONE database with ONE migration history, but its dependency closure each owns numbered,
// forward-only `migrations/NNNN_*.sql`. This module DECLARES the edition's migration-contributing
// package set + its compose-time LAYERING order, then delegates BOTH the disk read and the merge to
// the base `@caisson-sh/migrate` (`readPackageMigrations` + `assembleSelected`, ADR-0090) which wraps the
// kernel's pure `assembleMigrations` — topo-order by the layering DAG, global renumber into one
// `NNNN_*.sql` sequence, ONE `schema_version` checksum ledger over the merged set.
//
// COMPOSE, NOT COPY: the disk read + the topo-merge + the apply/checksum runner are owned ONCE in
// @caisson-sh/migrate (ADR-0090); this file adds only the edition's package-set declaration. It no longer
// carries its own `MIGRATION_FILE`/`readMigrations` copy — that duplication is what ADR-0090 retired.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assembleMigrationsWithPinnedPrefix,
  type MigrationAssembly,
  type PackageMigrations,
  type PinnedMigrationIdentity,
} from "@caisson-sh/kernel/node";
import {
  type SelectedPackage,
  readPackageMigrations,
} from "@caisson-sh/migrate";

/** The monorepo `packages/` root, resolved from this module (…/compliance/src/migrate → …/packages). */
const PACKAGES_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

/**
 * The Compliance edition's migration-contributing packages, declared in compose-time LAYERING order
 * (key tables before the encrypted-column / ciphertext layer):
 *
 *   field-crypto  (field_key_version + field_wrapped_dek)   ── the crypto KEY infrastructure
 *        ↓ ordering predecessor
 *   audit-worm    (audit_chain_entry + locked_version)      ── commits PII as field-crypto CIPHERTEXT
 *        ↓ ordering predecessor
 *   compliance    (impersonation_session, ADR-0187)         ── its dual trail APPENDS to that chain
 *
 * `dependsOn` here is the migration-LAYERING DAG fed to the kernel merge — NOT the code-import graph
 * (dependency-cruiser owns that, and stays 0-violation). audit-worm names field-crypto as an ordering
 * predecessor so the key tables always renumber AHEAD of the chain that stores their ciphertext, even
 * though audit-worm does NOT import field-crypto (the two trees are code-disjoint). Without this edge
 * the kernel's deterministic slug tie-break would order `audit-worm` first (it sorts ahead of
 * `field-crypto`), inverting the key→ciphertext layering. Each `dir` points at the package's `src`
 * dir, whose `migrations/NNNN_*.sql` the shared `readPackageMigrations` reads (ADR-0070: the loader
 * appends `/migrations` — the dir is the package src root, never the migrations dir itself).
 *
 * @caisson-sh/{kernel,tenancy-rls} contribute NO migration files of their own — their RLS helpers are
 * emitted INTO each migration (`buildTenantPolicySql`). The compliance edition records EVIDENCE in
 * the WORM artifact store + the audit chain, not a dedicated table — but since ADR-0187 it owns its
 * first migration: `impersonation_session`, the fail-closed session row the support-impersonation
 * kernel gates on. It layers AFTER audit-worm because its dual audit trail appends to the
 * `audit_chain_entry` table that migration creates.
 */
const CONTRIBUTING: readonly SelectedPackage[] = [
  {
    slug: "@caisson-sh/field-crypto",
    dir: join(PACKAGES_ROOT, "field-crypto", "src"),
    dependsOn: [],
  },
  {
    slug: "@caisson-sh/audit-worm",
    dir: join(PACKAGES_ROOT, "audit-worm", "src"),
    dependsOn: ["@caisson-sh/field-crypto"],
  },
  {
    slug: "@caisson-sh/compliance",
    dir: join(PACKAGES_ROOT, "compliance", "src"),
    dependsOn: ["@caisson-sh/audit-worm"],
  },
];

/**
 * The composed global release order, including artifact-version persistence appended at version 8.
 * Package-local ordinals are insufficient to preserve this ledger: any future package migration must
 * append after this prefix instead of inserting ahead of an already-released downstream package.
 */
/** Exported ONLY so the assembly test can assert every on-disk migration is pinned — see the
 *  `every on-disk migration is pinned` case. Not part of the runtime contract. */
export const RELEASED_GLOBAL_PREFIX: readonly PinnedMigrationIdentity[] = [
  {
    sourcePackage: "@caisson-sh/field-crypto",
    sourceName: "0001_field_keys.sql",
  },
  {
    sourcePackage: "@caisson-sh/field-crypto",
    sourceName: "0002_field_keys_rls_nullif.sql",
  },
  {
    sourcePackage: "@caisson-sh/audit-worm",
    sourceName: "0001_audit_chain.sql",
  },
  {
    sourcePackage: "@caisson-sh/audit-worm",
    sourceName: "0002_versions.sql",
  },
  {
    sourcePackage: "@caisson-sh/audit-worm",
    sourceName: "0003_rls_nullif.sql",
  },
  {
    sourcePackage: "@caisson-sh/compliance",
    sourceName: "0001_impersonation_session.sql",
  },
  {
    sourcePackage: "@caisson-sh/compliance",
    sourceName: "0002_impersonation_session_rls_nullif.sql",
  },
  {
    sourcePackage: "@caisson-sh/audit-worm",
    sourceName: "0004_artifact_versions.sql",
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
 * Assemble the compliance edition's full migration set into ONE ordered global sequence and checksum
 * ledger. The released prefix is identity-pinned; newly discovered package migrations append in the
 * normal dependency order. Deterministic — a re-run is byte-identical and deployed ledgers upgrade
 * without renumbering prior entries.
 */
export function assembleComplianceMigrations(): MigrationAssembly {
  return assembleMigrationsWithPinnedPrefix(
    complianceMigrationPackages(),
    RELEASED_GLOBAL_PREFIX,
  );
}

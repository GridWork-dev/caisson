// The codegen credit-debit seam (ADR-0049/0024/0007). Every generation meters a credit DEBIT
// BEFORE any file is written (debit-before-spend): a short balance returns 402 and nothing is
// written; a retried generation with the same `idempotencyKey` debits once. The HOSTED buyer MCP
// calls `runGeneration`, minting/accepting one `idempotencyKey` (UUID) per generation. The local
// `create-caisson` CLI generates FREE — no DB/tenant context on the buyer's machine, so it calls
// `generate` + the writer directly and never `runGeneration`; its monetization is the license-gated
// package install (NODE_AUTH_TOKEN), not a codegen credit (ADR-0093). Runs inside `withTenant` so
// the debit + the ledger are tenant-scoped (ADR-0005).
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CreditResult } from "@caisson/credits";
import { debit } from "@caisson/credits";
import { asCredits } from "@caisson/kernel";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import {
  type ModuleManifest,
  type RegistryIndex,
  assertKnownVersion,
} from "@caisson/registry-schema";
import {
  type GeneratedFile,
  type GeneratedFileSet,
  type GeneratorEngine,
  type Selection,
  generate,
} from "./generate.ts";
import { hashFileSet, recordGeneration } from "./generation-record.ts";
import {
  type SelectedPackage,
  assembleSelected,
  emitMigrationFileSet,
} from "@caisson/migrate";
import { type FileSetWriter, createFileSetWriter } from "./writer.ts";

/** A generation's billing identity. `idempotencyKey` is a caller-minted UUID, one per generation. */
export interface MeterInput {
  accountId: string;
  idempotencyKey: string;
  /** Credits per generation. Integer (ADR-0007). Defaults to 1. */
  amount?: number;
}

/** Debit one codegen charge. Throws `InsufficientCreditsError` (402) on a short balance. */
export function meterGeneration(
  tx: TenantExecutor,
  input: MeterInput,
): Promise<CreditResult> {
  return debit(tx, {
    accountId: input.accountId,
    // Mint the brand at this boundary (ADR-0206) — MeterInput.amount stays a plain integer input.
    amount: asCredits(input.amount ?? 1),
    eventType: "codegen_debit",
    idempotencyKey: input.idempotencyKey,
  });
}

export interface GenerationDeps {
  index: RegistryIndex;
  engine?: GeneratorEngine;
  /** Injected at P5 to materialize to disk (re-asserts path safety). Omitted → nothing is written. */
  writeFileSet?: FileSetWriter;
  /** Where a P5 writer would materialize. Unused until a writer is injected. */
  targetDir?: string;
  /** Override the migrations-bundle root the compose-time migration merge reads from. Omitted → the
   *  build-time `../migrations-bundle` dir resolved via `import.meta.url` (the published default). Tests
   *  inject a throwaway dir so they never read or corrupt the real (gitignored) build artifact. */
  bundleRoot?: string;
}

export interface GenerationOutcome {
  selection: Selection;
  files: GeneratedFileSet;
  balance: number;
  idempotent: boolean;
  /** The canonical generation audit row id (ADR-0049/T16). Stable across same-key retries. */
  generationId: string;
}

/** The BUNDLED migrations dir for a `@caisson/<name>` module, resolved relative to THIS file (via
 *  `import.meta.url`) — cwd-stable across `turbo`/root test runs AND present in a published CLI,
 *  unlike a workspace-source read. `readPackageMigrations` looks for `<dir>/migrations/NNNN_*.sql`,
 *  so the bundle stores each module's files at `<bundleRoot>/<name>/migrations/`.
 *  The bundle is POPULATED at build time by `scripts/bundle-migrations.ts` (ADR-0091, the first CLI
 *  build step) from each module's canonical `src/migrations/`: under a built or published CLI the dir
 *  is present and migration-bearing modules contribute their files; on a clean source checkout with no
 *  prior build the dir is absent, so the merge below falls back to a clean, deterministic no-op (never
 *  a cwd-dependent partial read). An optional `bundleRoot` overrides the resolved root — tests inject a
 *  throwaway dir so they never touch the real (gitignored) build artifact; omitted → the default above. */
function packageDir(moduleId: string, bundleRoot?: string): string {
  const name = moduleId.replace(/^@caisson\//, "");
  if (bundleRoot !== undefined) return join(bundleRoot, name);
  return fileURLToPath(
    new URL(`../migrations-bundle/${name}`, import.meta.url),
  );
}

/** The manifest for an exact `id@version` in the index. Both are already allowlist-validated upstream
 *  by `generate()`; a miss here is a defensive fail-closed (never silently skip). */
function manifestFor(
  index: RegistryIndex,
  id: string,
  version: string,
): ModuleManifest {
  const entry = index.modules.find((m) => m.id === id);
  const v = entry?.versions.find((x) => x.version === version);
  if (!v) {
    throw new Error(`no manifest for ${id}@${version} in the registry index`);
  }
  return v.manifest;
}

/**
 * Resolve an edition's FROZEN pinned member set (ADR-0077). The edition manifest (the `kind: "edition"`
 * module whose `editions[]` names this edition) carries an exact id→semver `members` map; the
 * generator folds those EXACT pins (never `latest`, never a range) into the buyer's deps. Fail-closed:
 * a missing edition manifest, an empty pin map, or any pin not present in the index THROWS — before
 * the debit, so a non-resolvable edition is never charged.
 */
function resolveEditionMembers(
  index: RegistryIndex,
  edition: NonNullable<Selection["edition"]>,
): Record<string, string> {
  for (const m of index.modules) {
    const v =
      m.versions.find((x) => x.version === m.latest) ??
      m.versions[m.versions.length - 1];
    const manifest = v?.manifest;
    if (manifest?.kind === "edition" && manifest.editions.includes(edition)) {
      const members = manifest.members;
      if (Object.keys(members).length === 0) {
        throw new Error(
          `edition ${edition} carries an empty member pin map (ADR-0077)`,
        );
      }
      // Every pin must resolve in the index — a bad/absent pin fails closed (never reaches a path).
      for (const [id, version] of Object.entries(members)) {
        assertKnownVersion(index, id, version);
      }
      return members;
    }
  }
  throw new Error(
    `no edition manifest for ${JSON.stringify(edition)} in the registry index`,
  );
}

/** Fold the edition's frozen member pins into `package.json` deps. An EXPLICIT selection version wins
 *  on a collision (the buyer's validated pick is authoritative); members fill the rest. Deterministic
 *  (deps re-sorted), so the result stays golden-able. */
function foldEditionMembers(
  files: GeneratedFileSet,
  members: Record<string, string>,
): GeneratedFileSet {
  const pkgFile = files.find((f) => f.path === "package.json");
  if (!pkgFile) return files; // no package.json to fold into (defensive)
  const pkg = JSON.parse(pkgFile.content) as {
    dependencies?: Record<string, string>;
  } & Record<string, unknown>;
  const deps: Record<string, string> = { ...(pkg.dependencies ?? {}) };
  for (const [id, version] of Object.entries(members)) {
    if (!(id in deps)) deps[id] = version;
  }
  pkg.dependencies = Object.fromEntries(
    Object.entries(deps).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
  );
  const rendered = `${JSON.stringify(pkg, null, 2)}\n`;
  return files.map((f) =>
    f.path === "package.json" ? { path: f.path, content: rendered } : f,
  );
}

/**
 * Assemble the selection's modules' on-disk migrations (ADR-0070) and MERGE the emitted
 * `migrations/*` into the generated file set. Each module → a `SelectedPackage` (slug = id, dir =
 * `packages/<name>`, dependsOn = its in-selection down-only deps). A module with no `migrations/` dir
 * contributes none; when NO module contributes a migration the assembly is empty and we add nothing
 * (no spurious ledger). Deterministic + path-sorted — migration files win on any path collision.
 */
function mergeMigrations(
  index: RegistryIndex,
  selection: Selection,
  files: GeneratedFileSet,
  bundleRoot?: string,
): GeneratedFileSet {
  const selected = new Set(selection.modules.map((m) => m.id));
  const packages: SelectedPackage[] = selection.modules.map((m) => ({
    slug: m.id,
    dir: packageDir(m.id, bundleRoot),
    dependsOn: manifestFor(index, m.id, m.version).dependencies.filter((d) =>
      selected.has(d),
    ),
  }));
  const assembly = assembleSelected(packages);
  if (assembly.sequence.length === 0) return files; // no migrations → contribute none
  const byPath = new Map<string, GeneratedFile>();
  for (const f of files) byPath.set(f.path, f);
  for (const f of emitMigrationFileSet(assembly)) byPath.set(f.path, f);
  return [...byPath.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
}

/**
 * Compose the FINAL materialized file set from the validated selection (ADR-0077 edition pins +
 * ADR-0070 migration assembly). Pure + read-only (edition fold is in-memory; migration assembly only
 * READS package migrations) — so it runs BEFORE the debit and a non-resolvable selection fails closed
 * without a charge. The same deterministic bytes are what gets written AND hashed into the audit row.
 */
function composeGeneratedFileSet(
  index: RegistryIndex,
  selection: Selection,
  files: GeneratedFileSet,
  bundleRoot?: string,
): GeneratedFileSet {
  const folded = selection.edition
    ? foldEditionMembers(files, resolveEditionMembers(index, selection.edition))
    : files;
  return mergeMigrations(index, selection, folded, bundleRoot);
}

/**
 * The full gated generation flow, in one `withTenant` transaction:
 *   1. validate + allowlist-gate the selection, then COMPOSE the final file set (edition pins +
 *      migration assembly) — all read-only, throws before any side effect,
 *   2. DEBIT before spend (402 aborts the whole transaction — nothing is written),
 *   3. write the file set (default disk writer when a `targetDir` is given; an injected writer wins),
 *   4. record the generation audit row (T16), POST-debit, in the same transaction.
 * A retried call with the same `idempotencyKey` debits once (ADR-0024), re-materializes, and the
 * `generation` row stays at one (ON CONFLICT). The debit strictly precedes the write: on a 402, steps
 * 3–4 are never reached, so a failed generation writes nothing and records nothing.
 */
export async function runGeneration(
  tx: TenantExecutor,
  deps: GenerationDeps,
  raw: unknown,
  meter: MeterInput,
): Promise<GenerationOutcome> {
  const { selection, files } = generate(deps.index, raw, deps.engine);
  const composed = composeGeneratedFileSet(
    deps.index,
    selection,
    files,
    deps.bundleRoot,
  );
  const result = await meterGeneration(tx, meter); // debit-before-spend; 402 throws here
  // An injected writer/spy still wins; otherwise default to the path-safe disk writer when a target
  // is given. With neither, nothing is written (Wave 0 returns the file set only).
  const writer =
    deps.writeFileSet ??
    (deps.targetDir !== undefined ? createFileSetWriter() : undefined);
  if (writer) {
    await writer(deps.targetDir ?? selection.projectName, composed);
  }
  const recordResult = await recordGeneration(tx, {
    accountId: meter.accountId,
    idempotencyKey: meter.idempotencyKey,
    selection,
    fileSetHash: hashFileSet(composed),
  });
  return {
    selection,
    files: composed,
    balance: result.balance,
    idempotent: result.idempotent,
    generationId: recordResult.id,
  };
}

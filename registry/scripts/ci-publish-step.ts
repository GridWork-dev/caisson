// registry/scripts/ci-publish-step.ts
// CI ledger-append + index-rebuild step (ADR-0021/0069). Called from the publish-and-index
// job after changesets publish. Scans all workspace package manifest.ts files, identifies
// versions not yet in the ledger, and (in live mode) appends them + rebuilds index.json.
// In dry-run mode (default, CAISSON_PUBLISH_DRY_RUN=true), reports planned actions without
// writing any files. publishedAt comes from the CI clock via --published-at — never derived
// internally (determinism: no Date.now(), no new Date() here).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ModuleManifest } from "../schema/module-manifest";
import { appendLedger } from "./append-ledger";
import {
  INDEX_PATH,
  LEDGER_PATH,
  buildIndexFromLedgerFile,
  parseLedger,
} from "./build-index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PublishStepOpts = {
  /** CI run identifier (e.g. github.run_id). Used in the gateAttestation. */
  runId: string;
  /** Full commit SHA of the run. Used in the gateAttestation ("<run-id>@<sha>"). */
  sha: string;
  /** ISO 8601 UTC timestamp from the CI clock — NEVER derived inside this function. */
  publishedAt: string;
  /** When true (default), reports what would happen without writing any files. */
  dryRun: boolean;
  /** Override for isolated testing; defaults to the on-disk registry/ledger.jsonl. */
  ledgerPath?: string | undefined;
  /** Override for isolated testing; defaults to the on-disk registry/index.json. */
  indexPath?: string | undefined;
  /** Override for isolated testing; defaults to the monorepo packages/ dir. */
  packagesDir?: string | undefined;
};

export type PublishStepResult = {
  /** Entries actually appended to the ledger (always 0 in dry-run mode). */
  appended: number;
  /** Entries already recorded in the ledger (skipped as already published). */
  skippedExisting: number;
  /** New entries found but not appended due to dry-run mode. */
  wouldAppend: number;
};

// ---------------------------------------------------------------------------
// Package manifest discovery
// ---------------------------------------------------------------------------

/** Absolute path to the monorepo root (two levels up from registry/scripts/). */
const DEFAULT_PACKAGES_DIR = join(import.meta.dir, "..", "..", "packages");

/**
 * True when `<packageDir>/package.json` declares `private: true`. A private package (e.g.
 * `@caisson/license-issue`, ADR-0110 — the signing key must NEVER reach a buyer tarball) is
 * intentionally never published by changesets, so it must never be appended to the ledger
 * either — appending it would advertise an "as if published" version that npm never actually
 * carries (the inverse of ADR-0111's "never-published = paid + no publishConfig" invariant).
 * Data-driven off package.json, never a hardcoded package name. Missing/unparseable
 * package.json fails OPEN to "not private" — the standards-gate, not this script, is the
 * authority on manifest/package.json validity. Exported for isolated testing.
 */
export function isPrivatePackage(packageDir: string): boolean {
  const pkgJsonPath = join(packageDir, "package.json");
  if (!existsSync(pkgJsonPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
      private?: unknown;
    };
    return pkg.private === true;
  } catch {
    return false;
  }
}

/**
 * Return absolute paths of every `packages/<name>/manifest.ts` that exists on disk, EXCLUDING
 * any package whose `package.json` declares `private: true` — a never-published package must
 * never reach the ledger/index (see `isPrivatePackage`). Exported for isolated testing.
 */
export function findManifestPaths(
  packagesDir: string = DEFAULT_PACKAGES_DIR,
): string[] {
  if (!existsSync(packagesDir)) return [];
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => !isPrivatePackage(join(packagesDir, d.name)))
    .map((d) => join(packagesDir, d.name, "manifest.ts"))
    .filter((p) => existsSync(p));
}

// ---------------------------------------------------------------------------
// Manifest loading
// ---------------------------------------------------------------------------

/**
 * Dynamically import a manifest.ts and return its default export.
 * The export is already a validated ModuleManifest — defineModule() runs Zod parse at module
 * load time, so a corrupt manifest throws on import. Exported for isolated testing.
 */
export async function loadManifest(path: string): Promise<ModuleManifest> {
  // Dynamic import; path is an absolute filesystem path resolved by the caller.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await import(path)) as { default: ModuleManifest };
  return mod.default;
}

// ---------------------------------------------------------------------------
// Core step logic
// ---------------------------------------------------------------------------

/**
 * Scan workspace manifests, compare against the on-disk ledger, and — in live mode — append
 * new (id, version) pairs + rebuild index.json. In dry-run mode reports planned actions only;
 * no file is written.
 */
export async function runPublishStep(
  opts: PublishStepOpts,
): Promise<PublishStepResult> {
  const {
    runId,
    sha,
    publishedAt,
    dryRun,
    ledgerPath = LEDGER_PATH,
    indexPath = INDEX_PATH,
    packagesDir = DEFAULT_PACKAGES_DIR,
  } = opts;

  const label = dryRun ? "[dry-run]" : "[live]";
  process.stdout.write(
    `registry/ci-publish-step: ${label} run=${runId || "??"} sha=${sha.slice(0, 7) || "??"} at=${publishedAt || "??"}\n`,
  );

  // Parse the existing ledger to identify already-recorded (id@version) pairs.
  const rawLedger = existsSync(ledgerPath)
    ? readFileSync(ledgerPath, "utf8")
    : "";
  const existingEntries = parseLedger(rawLedger);
  const alreadyPublished = new Set(
    existingEntries.map((e) => `${e.id}@${e.version}`),
  );

  // Discover all workspace package manifest.ts files.
  const manifestPaths = findManifestPaths(packagesDir);
  process.stdout.write(
    `registry/ci-publish-step: found ${manifestPaths.length} manifest file(s) under ${packagesDir}\n`,
  );

  const toAppend: ModuleManifest[] = [];
  let skippedExisting = 0;

  for (const p of manifestPaths) {
    let manifest: ModuleManifest;
    try {
      manifest = await loadManifest(p);
    } catch (err) {
      process.stderr.write(
        `registry/ci-publish-step: SKIP ${p} — load error: ${(err as Error).message}\n`,
      );
      continue;
    }
    const key = `${manifest.id}@${manifest.version}`;
    if (alreadyPublished.has(key)) {
      process.stdout.write(
        `registry/ci-publish-step: already in ledger — ${key}\n`,
      );
      skippedExisting++;
    } else {
      process.stdout.write(
        `registry/ci-publish-step: queued for append — ${key}\n`,
      );
      toAppend.push(manifest);
    }
  }

  if (toAppend.length === 0) {
    process.stdout.write("registry/ci-publish-step: nothing new to append\n");
    return { appended: 0, skippedExisting, wouldAppend: 0 };
  }

  if (dryRun) {
    process.stdout.write(
      `registry/ci-publish-step: dry-run — ${toAppend.length} entry(s) would be appended; no writes performed\n`,
    );
    return { appended: 0, skippedExisting, wouldAppend: toAppend.length };
  }

  // Live mode — append each new entry to the ledger (fail-closed: throws before any write on
  // an invalid manifest, per appendLedger's contract).
  const gateAttestation = `${runId}@${sha}`;
  for (const manifest of toAppend) {
    appendLedger({ manifest, publishedAt, gateAttestation, ledgerPath });
    process.stdout.write(
      `registry/ci-publish-step: appended ${manifest.id}@${manifest.version}\n`,
    );
  }

  // Rebuild index.json from the updated ledger and write it out.
  const bytes = buildIndexFromLedgerFile(ledgerPath);
  writeFileSync(indexPath, bytes);
  process.stdout.write(
    `registry/ci-publish-step: rebuilt index.json → ${indexPath} (${bytes.length} bytes)\n`,
  );

  return { appended: toAppend.length, skippedExisting, wouldAppend: 0 };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function parseCliArgs(): Omit<
  PublishStepOpts,
  "ledgerPath" | "indexPath" | "packagesDir"
> {
  const argv = process.argv.slice(2);
  let runId = "";
  let sha = "";
  let publishedAt = "";
  let dryRun = true; // safe default: never publish unless the caller explicitly says "false"

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === undefined) break;
    const val = argv[i + 1];
    if (flag === "--run-id" && val !== undefined) {
      runId = val;
      i++;
    } else if (flag === "--sha" && val !== undefined) {
      sha = val;
      i++;
    } else if (flag === "--published-at" && val !== undefined) {
      publishedAt = val;
      i++;
    } else if (flag === "--dry-run" && val !== undefined) {
      dryRun = val !== "false";
      i++;
    }
  }

  return { runId, sha, publishedAt, dryRun };
}

if (import.meta.main) {
  runPublishStep(parseCliArgs()).catch((err: unknown) => {
    process.stderr.write(
      `registry/ci-publish-step: fatal: ${(err as Error).message}\n`,
    );
    process.exit(1);
  });
}

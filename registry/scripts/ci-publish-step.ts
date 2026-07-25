// registry/scripts/ci-publish-step.ts
// CI ledger-append / index-rebuild / tarball-verify step (ADR-0021/0069, reworked by ADR-0325).
// Two modes, matching the commit-addressable release flow:
//
//   --mode version  (version-pr.yml) — runs AFTER `changeset version` on the version-PR branch:
//     appends new (id, version) pairs to the ledger, rebuilds index.json, packs each non-private
//     package and records its hash row into tarballs.json. All of it lands IN the version PR, so
//     the source truth (bumps + CHANGELOGs + ledger + index + sidecar) ships as ONE commit that
//     the release tag is later cut on.
//
//   --mode publish  (publish.yml, checked out at the release tag) — ZERO source mutation:
//     verifies every workspace version is ledgered + sidecar'd and index.json is a byte-identical
//     rebuild, then re-packs each tarball and requires its bytes to hash to EXACTLY the sidecar
//     row the version PR recorded (`bun pm pack` is byte-deterministic for identical source
//     bytes — a mismatch means the tag does not match the version PR's source, and the release
//     stops before any external write). Packing stages tarballs for the R2 upload step; no
//     tracked file is written.
//
// In dry-run mode (default, CAISSON_PUBLISH_DRY_RUN=true), reports planned actions without
// writing any files. publishedAt comes from the CI clock via --published-at — never derived
// internally (determinism: no Date.now(), no new Date() here).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { gunzipSync } from "node:zlib";
import { z } from "zod";
import type { ModuleManifest } from "../schema/module-manifest";
import { appendLedger } from "./append-ledger";
import {
  INDEX_PATH,
  LEDGER_PATH,
  buildIndexFromLedgerFile,
  parseLedgerLines,
} from "./build-index";

// ---------------------------------------------------------------------------
// Tarball sidecar (ADR-0223 Fork 1.1) — the CI writer half of the contract the
// Worker reads (registry/worker/npm-routes.ts). Maps `<@caisson/module>@<version>`
// → {key, shasum, integrity, size}: the R2 object key + npm's two integrity forms.
// This step is the ONLY writer, in the same commit that writes ledger.jsonl + index.json.
// ---------------------------------------------------------------------------

/** registry/tarballs.json — git-tracked, inlined into the Worker bundle at build time like index.json. */
export const SIDECAR_PATH = join(import.meta.dir, "..", "tarballs.json");
/** Where `bun pm pack` output is staged for the R2 upload step (keyed dirs `<slug>/<slug>-<v>.tgz`). */
export const STAGING_DIR = join(import.meta.dir, "..", ".tarball-staging");
/** Repo-root `bun.lock` — the dependency resolution every `bun pm pack` rewrite runs under. */
export const LOCKFILE_PATH = join(import.meta.dir, "..", "..", "bun.lock");

/**
 * SHA-256 of the lockfile governing this run's packs (ADR-0365 / CAISSON-127). Undefined when the
 * lockfile is absent (isolated test fixtures) — rows then record without provenance, keeping the
 * pre-ADR shape.
 */
export function currentLockHash(
  path: string = LOCKFILE_PATH,
): string | undefined {
  if (!existsSync(path)) return undefined;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

// Local strict schema (the write boundary). The Worker owns the READ schema; keeping the write
// shape here avoids a scripts→worker layering dependency. Both mirror `{key,shasum,integrity,size,meta}`.
const DepMap = z.record(z.string(), z.string());
// The abbreviated-packument install fields the client needs to build the dependency tree. Kept in
// sync with the Worker's PackumentMeta (registry/worker/npm-routes.ts). npm resolves deps from the
// packument, NOT the tarball — omitting these installs a package with zero dependencies.
// ponytail: the 5 install fields real caisson packages carry; add os/cpu/peerDependenciesMeta here +
// in the Worker if a native or peer-dep package ever ships.
const PackumentMeta = z
  .object({
    dependencies: DepMap.optional(),
    optionalDependencies: DepMap.optional(),
    peerDependencies: DepMap.optional(),
    bin: z.union([z.string(), DepMap]).optional(),
    engines: DepMap.optional(),
  })
  .strict();
export type PackumentMeta = z.infer<typeof PackumentMeta>;

const SidecarDist = z
  .object({
    key: z.string().min(1),
    shasum: z.string().min(1),
    integrity: z.string().min(1),
    size: z.number().int().nonnegative(),
    meta: PackumentMeta.optional(),
    /** SHA-256 of the repo-root `bun.lock` the row was recorded under (ADR-0365 / CAISSON-127).
     *  `bun pm pack` rewrites resolved dependency versions into the packed package.json, so a row's
     *  bytes are only reproducible under the same resolution. Provenance, not content: excluded
     *  from the publish byte-equality compare. Absent on pre-ADR rows. */
    lockHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  })
  .strict();
const Sidecar = z
  .object({
    $comment: z.string().optional(),
    tarballs: z.record(z.string(), SidecarDist),
  })
  .strict();
export type TarballDist = z.infer<typeof SidecarDist>;
export type Sidecar = z.infer<typeof Sidecar>;

/**
 * Read `package/package.json` out of a gzipped npm tarball's bytes (standard ustar, as `bun pm pack`
 * emits it). Pure — no temp files. Returns null when the bytes are not a valid gzip/tar (e.g. a test
 * stub) or carry no package.json, so a non-tarball input degrades to "no meta" instead of throwing.
 */
function readPackedManifest(bytes: Uint8Array): Record<string, unknown> | null {
  let tar: Buffer;
  try {
    tar = gunzipSync(Buffer.from(bytes));
  } catch {
    return null;
  }
  for (let off = 0; off + 512 <= tar.length;) {
    const header = tar.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break; // end-of-archive
    const name = (
      header.subarray(0, 100).toString("utf8").split("\0")[0] ?? ""
    ).trim();
    const sizeOctal = header
      .subarray(124, 136)
      .toString("utf8")
      .replace(/\0.*$/, "")
      .trim();
    const size = Number.parseInt(sizeOctal, 8) || 0;
    const body = off + 512;
    if (name === "package/package.json") {
      try {
        return JSON.parse(
          tar.subarray(body, body + size).toString("utf8"),
        ) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    off = body + Math.ceil(size / 512) * 512;
  }
  return null;
}

/**
 * Lift the abbreviated-packument install fields from a packed tarball's package.json. Validated at the
 * boundary — a malformed field drops meta entirely rather than crashing the Worker's one-shot sidecar
 * parse. `devDependencies` are deliberately NOT captured (transitive dev deps are never installed).
 * Returns undefined when the package carries none of the install fields.
 */
export function packumentMeta(bytes: Uint8Array): PackumentMeta | undefined {
  const pkg = readPackedManifest(bytes);
  if (pkg === null) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "bin",
    "engines",
  ] as const) {
    const v = pkg[field];
    if (v === undefined || v === null) continue;
    if (typeof v === "object" && Object.keys(v).length === 0) continue; // {} → omit
    cleaned[field] = v;
  }
  if (Object.keys(cleaned).length === 0) return undefined;
  const parsed = PackumentMeta.safeParse(cleaned);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Compute the npm dist metadata for a packed tarball's bytes. `shasum` = SHA-1 hex (npm's legacy
 * `dist.shasum`); `integrity` = sha512 Subresource-Integrity string (`sha512-<base64>`, npm's
 * `dist.integrity`). `key` = the R2 object key `<slug>/<slug>-<version>.tgz` — scope dropped, byte-for-byte
 * the key `registry/worker/npm-routes.ts` derives on the tarball GET. `meta` = the resolved install
 * fields lifted from the tarball's package.json (so the client resolves the dependency tree).
 * node:crypto only, no `ssri` dep.
 */
export function computeTarballDist(
  bytes: Uint8Array,
  slug: string,
  version: string,
): TarballDist {
  const buf = Buffer.from(bytes);
  const meta = packumentMeta(bytes);
  return {
    key: `${slug}/${slug}-${version}.tgz`,
    shasum: createHash("sha1").update(buf).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(buf).digest("base64")}`,
    size: buf.length,
    ...(meta ? { meta } : {}),
  };
}

/** Read the sidecar (or an empty one if absent), parse-or-throw at the boundary. */
export function readSidecar(path: string = SIDECAR_PATH): Sidecar {
  const raw = existsSync(path) ? readFileSync(path, "utf8") : '{"tarballs":{}}';
  return Sidecar.parse(JSON.parse(raw));
}

/**
 * Write the sidecar deterministically: keys sorted, `$comment` preserved first, 2-space JSON +
 * trailing newline (same discipline as index.json, so a rerun is byte-stable and diffs cleanly).
 */
export function writeSidecar(
  sidecar: Sidecar,
  path: string = SIDECAR_PATH,
): void {
  const tarballs: Record<string, TarballDist> = {};
  for (const k of Object.keys(sidecar.tarballs).sort()) {
    tarballs[k] = sidecar.tarballs[k] as TarballDist;
  }
  const out =
    sidecar.$comment !== undefined
      ? { $comment: sidecar.$comment, tarballs }
      : { tarballs };
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
}

/** Pack a package into `<staging>/<slug>/<slug>-<version>.tgz` and return its bytes. Injectable for tests. */
export type PackFn = (
  packageDir: string,
  slug: string,
  version: string,
  stagingDir: string,
) => Uint8Array;

/** Default pack: `bun pm pack` (execFile arg-array, no shell). Scope dropped via an explicit
 * --filename, passed as the FULL staged path — bun rejects --filename combined with
 * --destination ("cannot use both filename and destination"), so the path carries the dir.
 * Exported so the test suite can prove the byte-determinism the publish gate rests on. */
export const defaultPack: PackFn = (packageDir, slug, version, stagingDir) => {
  const outDir = join(stagingDir, slug);
  mkdirSync(outDir, { recursive: true });
  const filename = `${slug}-${version}.tgz`;
  const res = spawnSync(
    "bun",
    [
      "pm",
      "pack",
      "--quiet",
      "--ignore-scripts",
      "--filename",
      join(outDir, filename),
    ],
    { cwd: packageDir, encoding: "buffer" },
  );
  if (res.status !== 0) {
    throw new Error(
      `bun pm pack failed for ${slug}@${version}: ${res.stderr?.toString() ?? "unknown error"}`,
    );
  }
  return readFileSync(join(outDir, filename));
};

export interface RefreshVersionCandidateOpts {
  /** PR-head checkout treated as data only; no source file under it is imported or executed. */
  readonly candidateRoot: string;
  /** Fork-point ledger materialized from the trusted merge base. */
  readonly baseLedgerPath: string;
  /** Fork-point sidecar materialized from the trusted merge base. */
  readonly baseSidecarPath: string;
  readonly dryRun?: boolean | undefined;
  readonly stagingDir?: string | undefined;
  readonly packFn?: PackFn | undefined;
}

const CandidatePackage = z
  .object({
    name: z.string().regex(/^@caisson\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    private: z.boolean().optional(),
  })
  .strict();

function candidatePackageKey(key: string): { slug: string; version: string } {
  const match =
    /^@caisson\/([a-z0-9]+(?:-[a-z0-9]+)*)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(
      key,
    );
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new Error(`invalid candidate tarball key: ${key}`);
  }
  return { slug: match[1], version: match[2] };
}

function pathInside(root: string, ...parts: string[]): string {
  const path = resolve(root, ...parts);
  if (!path.startsWith(`${root}${sep}`)) {
    throw new Error(`candidate path escapes checkout root: ${path}`);
  }
  return path;
}

/**
 * Sibling-churn guard (CAISSON-124): every EXISTING sidecar row not in `skipKeys` (i.e. not freshly
 * (re-)recorded this run) whose package is still at that same version on this tree must still
 * re-pack to the bytes it advertises. When a consume bumps a `workspace:*` dependency, `bun pm
 * pack` rewrites that resolved version into an unchanged sibling's tarball — staling its row at
 * its own version. Shared by both call sites that can churn a sibling this way: the trusted
 * synchronize-refresh path (`refreshVersionCandidateTarballs`) and the initial dispatch
 * `--mode version` step (`runPublishStep`) — a single-shot version PR never fires a synchronize
 * event, so without this shared check that path skips the guard entirely (the bug this closes).
 * Superseded historical versions (package.json gone, or already bumped past the row) are
 * un-repackable from HEAD and out of scope — the live R2 probe (r2-parity-probe.ts) is their
 * integrity net.
 */
function checkSiblingChurn(opts: {
  sidecar: Sidecar;
  skipKeys: ReadonlySet<string>;
  packageDirFor: (slug: string) => string;
  packFn: PackFn;
  stagingDir: string;
  lockfilePath: string;
}): void {
  const { sidecar, skipKeys, packageDirFor, packFn, stagingDir, lockfilePath } =
    opts;
  const runLockHash = currentLockHash(lockfilePath);
  const siblingMismatches: string[] = [];
  for (const key of Object.keys(sidecar.tarballs)) {
    if (skipKeys.has(key)) continue; // freshly (re-)recorded this run
    const { slug, version } = candidatePackageKey(key);
    const packageDir = packageDirFor(slug);
    const pkgJsonPath = join(packageDir, "package.json");
    if (!existsSync(pkgJsonPath)) continue; // superseded — no longer on disk
    const rawPackage = z
      .record(z.string(), z.unknown())
      .parse(JSON.parse(readFileSync(pkgJsonPath, "utf8")));
    if (rawPackage.version !== version) continue; // superseded historical version
    const recorded = sidecar.tarballs[key] as TarballDist;
    // ADR-0365 / CAISSON-127 refinement (2026-07-19): the recorded lockHash covers the WHOLE
    // bun.lock, and workspace version bumps legitimately change it every consume — so it can
    // NEVER gate the re-pack (a short-circuit here mass-flags rows whose bytes are identical).
    // Always re-pack and byte-compare; the hash's job is to make a REAL mismatch's cause
    // legible (dependency-resolution drift vs a source edit).
    const bytes = packFn(packageDir, slug, version, stagingDir);
    const dist = computeTarballDist(bytes, slug, version);
    if (dist.shasum !== recorded.shasum || dist.size !== recorded.size) {
      const lockNote =
        recorded.lockHash !== undefined &&
        runLockHash !== undefined &&
        recorded.lockHash !== runLockHash
          ? ` — recorded under bun.lock sha256 ${recorded.lockHash.slice(0, 12)}…, this tree resolves ${runLockHash.slice(0, 12)}… (dependency-resolution drift)`
          : "";
      siblingMismatches.push(
        `${key} (recorded=${recorded.shasum}/${String(recorded.size)}B, would-be=${dist.shasum}/${String(dist.size)}B)${lockNote}`,
      );
    }
  }
  if (siblingMismatches.length > 0) {
    throw new Error(
      `sibling-churn: these already-recorded rows no longer re-pack to their advertised bytes from this tree — a workspace dependency's resolved version changed since the row was recorded. Fix: add a changeset bumping each package's OWN version in this release so a fresh row is recorded, else the release fails at the publish/tag byte-gate:\n  - ${siblingMismatches.join("\n  - ")}`,
    );
  }
}

/**
 * Refresh an automation-authored version PR without executing PR-head code. The trusted base
 * workflow calls this function against a candidate checkout treated strictly as data: historical
 * ledger/sidecar material must be byte/deep-identical to the fork point, the new sidecar-key set
 * must exactly match appended publish rows, package identity comes from field-picked package.json,
 * and packing disables lifecycle scripts. Only candidate registry/tarballs.json is written.
 */
export function refreshVersionCandidateTarballs(
  opts: RefreshVersionCandidateOpts,
): number {
  const root = resolve(opts.candidateRoot);
  const candidateLockfilePath = pathInside(root, "bun.lock");
  const candidateLedgerPath = pathInside(root, "registry", "ledger.jsonl");
  const candidateSidecarPath = pathInside(root, "registry", "tarballs.json");
  const baseLedger = readFileSync(opts.baseLedgerPath, "utf8");
  const candidateLedger = readFileSync(candidateLedgerPath, "utf8");
  if (!candidateLedger.startsWith(baseLedger)) {
    throw new Error(
      "version refresh rejected historical ledger drift from the fork point",
    );
  }

  const basePublishes = parseLedgerLines(baseLedger).publishes;
  const candidatePublishes = parseLedgerLines(candidateLedger).publishes;
  const basePublishKeys = new Set(
    basePublishes.map((entry) => `${entry.id}@${entry.version}`),
  );
  const appendedPublishKeys = new Set(
    candidatePublishes
      .map((entry) => `${entry.id}@${entry.version}`)
      .filter((key) => !basePublishKeys.has(key)),
  );

  const baseSidecar = readSidecar(opts.baseSidecarPath);
  const candidateSidecar = readSidecar(candidateSidecarPath);
  if (candidateSidecar.$comment !== baseSidecar.$comment) {
    throw new Error(
      "version refresh rejected historical tarball row drift: sidecar comment changed",
    );
  }
  for (const [key, baseRow] of Object.entries(baseSidecar.tarballs)) {
    const candidateRow = candidateSidecar.tarballs[key];
    if (
      candidateRow === undefined ||
      !isDeepStrictEqual(candidateRow, baseRow)
    ) {
      throw new Error(
        `version refresh rejected historical tarball row drift: ${key}`,
      );
    }
  }

  const candidateNewKeys = Object.keys(candidateSidecar.tarballs)
    .filter((key) => baseSidecar.tarballs[key] === undefined)
    .sort();
  const unexpected = candidateNewKeys.filter(
    (key) => !appendedPublishKeys.has(key),
  );
  const missing = [...appendedPublishKeys].filter(
    (key) => !candidateNewKeys.includes(key),
  );
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `version refresh candidate rows do not exactly match appended ledger publishes (unexpected=${unexpected.join(",") || "none"}; missing=${missing.join(",") || "none"})`,
    );
  }

  if (opts.dryRun === true) {
    process.stdout.write(
      `registry/ci-publish-step: dry-run — would securely re-pack ${candidateNewKeys.length} unmerged row(s)\n`,
    );
    return 0;
  }

  const packFn = opts.packFn ?? defaultPack;
  const stagingDir = opts.stagingDir ?? STAGING_DIR;
  const newKeySet = new Set(candidateNewKeys);
  const refreshLockHash = currentLockHash(candidateLockfilePath);
  for (const key of candidateNewKeys) {
    const { slug, version } = candidatePackageKey(key);
    const packageDir = pathInside(root, "packages", slug);
    const rawPackage = z
      .record(z.string(), z.unknown())
      .parse(
        JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")),
      );
    const pkg = CandidatePackage.parse({
      name: rawPackage.name,
      version: rawPackage.version,
      ...(rawPackage.private !== undefined
        ? { private: rawPackage.private }
        : {}),
    });
    if (
      pkg.name !== `@caisson/${slug}` ||
      pkg.version !== version ||
      pkg.private === true
    ) {
      throw new Error(`candidate package identity does not match ${key}`);
    }
    const bytes = packFn(packageDir, slug, version, stagingDir);
    candidateSidecar.tarballs[key] = {
      ...computeTarballDist(bytes, slug, version),
      ...(refreshLockHash !== undefined ? { lockHash: refreshLockHash } : {}),
    };
    process.stdout.write(
      `registry/ci-publish-step: securely re-packed + re-recorded ${key}\n`,
    );
  }

  // Sibling-churn guard (shared with the dispatch --mode version step — CAISSON-124): catch it HERE,
  // on the version PR, before merge, rather than hours later at the publish/tag byte-gate.
  checkSiblingChurn({
    sidecar: candidateSidecar,
    skipKeys: newKeySet,
    packageDirFor: (slug) => pathInside(root, "packages", slug),
    packFn,
    stagingDir,
    lockfilePath: candidateLockfilePath,
  });

  if (candidateNewKeys.length > 0) {
    writeSidecar(candidateSidecar, candidateSidecarPath);
  }
  return candidateNewKeys.length;
}

export type RecordTarballsOpts = {
  dryRun: boolean;
  sidecarPath?: string | undefined;
  stagingDir?: string | undefined;
  /**
   * Existing keys that belong to an unmerged version PR and may therefore be re-packed. Historical
   * rows remain append-only. The synchronize workflow derives this set by comparing with the branch
   * fork point's sidecar.
   */
  replaceKeys?: ReadonlySet<string> | undefined;
  /** Override the packer for isolated testing; defaults to a real `bun pm pack`. */
  packFn?: PackFn | undefined;
};

/**
 * Pack + hash + record a sidecar row for each candidate package MISSING from the sidecar (already
 * filtered to non-private by `findManifestPaths`, so the `isPrivatePackage` exclusion is preserved —
 * a private package's manifest never reaches here). Append-only (ADR-0006): an existing historical
 * sidecar key is never overwritten (and never re-packed). The sole exception is an explicit
 * `replaceKeys` entry derived from rows introduced on an unmerged version branch; those bytes have not
 * shipped yet and must follow in-branch source edits. Callers pass the FULL current-workspace manifest
 * set, not just newly-ledgered versions, so a version ledgered before the sidecar existed still gets
 * backfilled (see runPublishStep). In dry-run nothing is packed or written. Returns rows recorded or
 * re-recorded.
 */
export function recordTarballs(
  candidates: { manifest: ModuleManifest; packageDir: string }[],
  opts: RecordTarballsOpts,
): number {
  const {
    dryRun,
    sidecarPath = SIDECAR_PATH,
    stagingDir = STAGING_DIR,
    replaceKeys = new Set<string>(),
    packFn = defaultPack,
  } = opts;

  if (candidates.length === 0) return 0;

  if (dryRun) {
    const sidecar = readSidecar(sidecarPath);
    for (const { manifest } of candidates) {
      const key = `${manifest.id}@${manifest.version}`;
      if (sidecar.tarballs[key] !== undefined && !replaceKeys.has(key))
        continue; // already packed — nothing to do
      const slug = manifest.id.slice("@caisson/".length);
      process.stdout.write(
        `registry/ci-publish-step: dry-run — would ${replaceKeys.has(key) ? "re-pack" : "pack"} ${key} → R2 key ${slug}/${slug}-${manifest.version}.tgz\n`,
      );
    }
    return 0;
  }

  const sidecar = readSidecar(sidecarPath);
  let recorded = 0;
  for (const { manifest, packageDir } of candidates) {
    const key = `${manifest.id}@${manifest.version}`;
    if (sidecar.tarballs[key] !== undefined && !replaceKeys.has(key)) {
      process.stdout.write(
        `registry/ci-publish-step: tarball already recorded — ${key} (append-only, kept)\n`,
      );
      continue;
    }
    const slug = manifest.id.slice("@caisson/".length);
    const bytes = packFn(packageDir, slug, manifest.version, stagingDir);
    const recordLockHash = currentLockHash();
    sidecar.tarballs[key] = {
      ...computeTarballDist(bytes, slug, manifest.version),
      ...(recordLockHash !== undefined ? { lockHash: recordLockHash } : {}),
    };
    recorded++;
    process.stdout.write(
      `registry/ci-publish-step: ${replaceKeys.has(key) ? "re-packed + re-recorded" : "packed + recorded"} ${key} → ${sidecar.tarballs[key]?.key} (${sidecar.tarballs[key]?.size} bytes)\n`,
    );
  }
  if (recorded > 0) writeSidecar(sidecar, sidecarPath);
  return recorded;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PublishStepOpts = {
  /** CI run identifier (e.g. github.run_id). Used in the gateAttestation. */
  runId: string;
  /**
   * Full commit SHA of the run. In version mode: the main SHA the version PR was cut FROM,
   * recorded in the gateAttestation ("<run-id>@<sha>") — the final version-commit SHA cannot
   * be known while authoring its own content; the release tag anchors that (ADR-0325). In
   * publish mode: the tag SHA (logging only; publish never writes an attestation).
   */
  sha: string;
  /** ISO 8601 UTC timestamp from the CI clock — NEVER derived inside this function. */
  publishedAt: string;
  /** When true (default), reports what would happen without writing any files. */
  dryRun: boolean;
  /**
   * ADR-0325 flow position. "version" (default): append ledger + rebuild index + pack/record
   * sidecar rows — the version-PR writer. "publish": zero-mutation verify + stage at the
   * release tag — every workspace version must already be ledgered + sidecar'd, index.json
   * must be a byte-identical rebuild, and every re-packed tarball must hash to its recorded
   * sidecar row. Any violation throws before the R2 upload step can run.
   */
  mode?: "version" | "publish" | undefined;
  /** Override for isolated testing; defaults to the on-disk registry/ledger.jsonl. */
  ledgerPath?: string | undefined;
  /** Override for isolated testing; defaults to the on-disk registry/index.json. */
  indexPath?: string | undefined;
  /** Override for isolated testing; defaults to the monorepo packages/ dir. */
  packagesDir?: string | undefined;
  /** Override for isolated testing; defaults to the on-disk registry/tarballs.json. */
  sidecarPath?: string | undefined;
  /**
   * Version mode only: sidecar from the release branch's fork point. Candidate keys absent there
   * were introduced by the unmerged version PR and may be re-recorded after in-branch source edits.
   */
  refreshBaseSidecarPath?: string | undefined;
  /** Override for isolated testing; defaults to registry/.tarball-staging. */
  stagingDir?: string | undefined;
  /** Override the packer for isolated testing; defaults to a real `bun pm pack`. */
  packFn?: PackFn | undefined;
};

export type PublishStepResult = {
  /** Entries actually appended to the ledger (always 0 in dry-run mode). */
  appended: number;
  /** Entries already recorded in the ledger (skipped as already published). */
  skippedExisting: number;
  /**
   * Workspace manifests skipped because their id is delisted (ADR-0271) — split out from
   * `skippedExisting` so the summary distinguishes "already published" from "delisted, will
   * never be (re-)published" (a delisted id gets no tarball-sidecar reconcile either — see the
   * loop below).
   */
  skippedDelisted: number;
  /** New entries found but not appended due to dry-run mode. */
  wouldAppend: number;
  /** Tarball sidecar rows recorded (packed + hashed → tarballs.json; always 0 in dry-run). */
  tarballsRecorded: number;
  /**
   * Publish mode only: workspace versions whose re-packed bytes hash-matched their sidecar row
   * and are staged for the R2 upload step. Always 0 in version mode and in publish dry-run.
   */
  verifiedStaged: number;
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
  const mod = (await import(path)) as { default: ModuleManifest };
  return mod.default;
}

// ---------------------------------------------------------------------------
// Publish-mode verification (ADR-0325) — the zero-mutation release-tag path
// ---------------------------------------------------------------------------

type VerifyForPublishOpts = {
  loaded: { manifest: ModuleManifest; packageDir: string }[];
  alreadyPublished: Set<string>;
  skippedDelisted: number;
  dryRun: boolean;
  ledgerPath: string;
  indexPath: string;
  sidecarPath?: string | undefined;
  stagingDir?: string | undefined;
  packFn?: PackFn | undefined;
};

/**
 * ADR-0325 publish mode: the checked-out (tagged) tree must already BE the release. Verifies
 * every non-private workspace version is ledgered + sidecar'd and index.json is a byte-identical
 * ledger rebuild, then (live) re-packs each tarball and requires its bytes to hash to EXACTLY
 * the sidecar row the version PR recorded. Packing stages tarballs under stagingDir for the R2
 * upload step; NO tracked file is written on any path through this function. Failures are
 * collected so one run reports every problem, then thrown — the workflow stops before any
 * external write.
 */
function verifyForPublish(opts: VerifyForPublishOpts): PublishStepResult {
  const {
    loaded,
    alreadyPublished,
    skippedDelisted,
    dryRun,
    ledgerPath,
    indexPath,
    sidecarPath = SIDECAR_PATH,
    stagingDir = STAGING_DIR,
    packFn = defaultPack,
  } = opts;
  const problems: string[] = [];
  const sidecar = readSidecar(sidecarPath);

  // 1) Every workspace version must already be ledgered AND sidecar'd — that was the version
  //    PR's job; a miss means the tag was cut on a commit without (or before) the version PR.
  for (const { manifest } of loaded) {
    const key = `${manifest.id}@${manifest.version}`;
    if (!alreadyPublished.has(key)) {
      problems.push(
        `${key}: not in the ledger — the tagged commit does not include its version PR`,
      );
    }
    if (sidecar.tarballs[key] === undefined) {
      problems.push(
        `${key}: no tarballs.json row — the version PR did not record it`,
      );
    }
  }

  // 2) index.json must be a byte-identical rebuild of the ledger. Same proof as ci.yml's
  //    registry-index check (already green on the version commit) — re-run here so a manual
  //    publish dispatch is self-contained rather than trusting run ordering.
  const rebuilt = Buffer.from(buildIndexFromLedgerFile(ledgerPath));
  const onDisk = existsSync(indexPath)
    ? readFileSync(indexPath)
    : Buffer.alloc(0);
  if (!rebuilt.equals(onDisk)) {
    problems.push(
      `index.json is not a byte-identical rebuild of the ledger at ${ledgerPath}`,
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `publish-mode verification failed (fix: merge a fresh version PR and cut the tag on its merge commit):\n  - ${problems.join("\n  - ")}`,
    );
  }

  if (dryRun) {
    process.stdout.write(
      `registry/ci-publish-step: publish dry-run — ledger/sidecar/index consistent; would re-pack + hash-verify + stage ${loaded.length} tarball(s)\n`,
    );
    return {
      appended: 0,
      skippedExisting: 0,
      skippedDelisted,
      wouldAppend: 0,
      tarballsRecorded: 0,
      verifiedStaged: 0,
    };
  }

  // 3) Re-pack at the tagged source and require byte-equality with the recorded row. `bun pm
  //    pack` is byte-deterministic for identical source bytes (mtimes are normalized), so a
  //    mismatch means the tagged tree is NOT the source the version PR hashed — stop before any
  //    external write. The R2 upload step then skips objects that already exist, so re-verified
  //    old versions are never re-uploaded (rerun-safe, never-overwrite — ADR-0325 point 5).
  // ponytail: rows are verified against a re-pack under the PINNED bun (1.3.14 everywhere). If a
  // future bun bump changes the pack byte format, old unchanged versions will fail loudly here;
  // the upgrade path is a one-off operator re-record of affected rows, not a silent skip.
  const mismatches: string[] = [];
  let staged = 0;
  const publishLockHash = currentLockHash();
  for (const { manifest, packageDir } of loaded) {
    const key = `${manifest.id}@${manifest.version}`;
    const row = sidecar.tarballs[key] as TarballDist; // presence proven in (1)
    const slug = manifest.id.slice("@caisson/".length);
    const bytes = packFn(packageDir, slug, manifest.version, stagingDir);
    const dist = computeTarballDist(bytes, slug, manifest.version);
    // `lockHash` is record-time provenance, not tarball content — excluded from the byte-equality
    // compare (ADR-0365). On a mismatch it names the cause when the resolutions differ.
    const { lockHash: recordedLockHash, ...rowContent } = row;
    if (!isDeepStrictEqual(dist, rowContent)) {
      const lockNote =
        recordedLockHash !== undefined &&
        publishLockHash !== undefined &&
        recordedLockHash !== publishLockHash
          ? " — recorded under a DIFFERENT bun.lock resolution (lock-hash drift); bump the package's own version to re-record"
          : "";
      mismatches.push(
        `${key}: packed distribution record does not exactly match sidecar (packed=${dist.shasum}/${dist.size}B, recorded=${row.shasum}/${row.size}B)${lockNote}`,
      );
      continue;
    }
    staged++;
    process.stdout.write(
      `registry/ci-publish-step: verified ${key} — packed bytes match the recorded row; staged ${row.key}\n`,
    );
  }
  if (mismatches.length > 0) {
    throw new Error(
      `publish-mode tarball verification failed — the tagged tree does not reproduce the recorded bytes. Rows are append-only, so a post-recording edit to packed files (CHANGELOG, package.json, src) goes permanently stale — a fresh version PR will NOT re-record an existing row. Fix: from a PRISTINE checkout of the intended tag commit, delete the stale rows and re-run --mode version to re-record them (first ride, 2026-07-12):\n  - ${mismatches.join("\n  - ")}`,
    );
  }
  return {
    appended: 0,
    skippedExisting: 0,
    skippedDelisted,
    wouldAppend: 0,
    tarballsRecorded: 0,
    verifiedStaged: staged,
  };
}

// ---------------------------------------------------------------------------
// Core step logic
// ---------------------------------------------------------------------------

/**
 * Scan workspace manifests, compare against the on-disk ledger, and — in version mode (default,
 * live) — append new (id, version) pairs + rebuild index.json + pack/record sidecar rows. In
 * publish mode (ADR-0325), verify + stage only (see verifyForPublish). In dry-run mode reports
 * planned actions only; no file is written.
 */
export async function runPublishStep(
  opts: PublishStepOpts,
): Promise<PublishStepResult> {
  const {
    runId,
    sha,
    publishedAt,
    dryRun,
    mode = "version",
    ledgerPath = LEDGER_PATH,
    indexPath = INDEX_PATH,
    packagesDir = DEFAULT_PACKAGES_DIR,
    sidecarPath,
    refreshBaseSidecarPath,
    stagingDir,
    packFn,
  } = opts;

  const label = dryRun ? "[dry-run]" : "[live]";
  process.stdout.write(
    `registry/ci-publish-step: ${label} mode=${mode} run=${runId || "??"} sha=${sha.slice(0, 7) || "??"} at=${publishedAt || "??"}\n`,
  );

  // Parse the existing ledger to identify already-recorded (id@version) pairs and the MODULE-level
  // delisted ids (ADR-0271): a delisted module still has a workspace manifest, but appending a new
  // publish for it would be a ledger error (delisting is terminal) — skip it loudly instead of
  // failing the run. Filtered to `d.version === undefined` (ADR-0359) — a version-level delist
  // marks only ONE historical version as unpublished, not the whole module; folding it into this
  // set would wrongly treat every live module with a pruned old version as fully delisted and
  // silently skip its next version bump from the ledger/index/tarballs (catalog-freeze bug).
  const rawLedger = existsSync(ledgerPath)
    ? readFileSync(ledgerPath, "utf8")
    : "";
  const { publishes: existingEntries, delists } = parseLedgerLines(rawLedger);
  const alreadyPublished = new Set(
    existingEntries.map((e) => `${e.id}@${e.version}`),
  );
  const delistedIds = new Set(
    delists.filter((d) => d.version === undefined).map((d) => d.id),
  );

  // Discover all workspace package manifest.ts files.
  const manifestPaths = findManifestPaths(packagesDir);
  process.stdout.write(
    `registry/ci-publish-step: found ${manifestPaths.length} manifest file(s) under ${packagesDir}\n`,
  );

  // Every successfully-loaded, non-private workspace manifest (the current checkout's versions).
  // The tarball sidecar is reconciled over this FULL set, not just `toAppend`, so a version that was
  // ledgered before the sidecar mechanism existed still gets its tarball packed (the finding-2 backfill).
  const loaded: { manifest: ModuleManifest; packageDir: string }[] = [];
  const toAppend: { manifest: ModuleManifest; packageDir: string }[] = [];
  let skippedExisting = 0;
  let skippedDelisted = 0;

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
    if (delistedIds.has(manifest.id)) {
      // Not pushed to `loaded` either: a delisted module gets no tarball-sidecar reconcile — it has
      // no index entry to serve from. Counted separately from `skippedExisting` (ADR-0271) — this
      // id will NEVER be (re-)published, unlike an ordinary already-ledgered skip.
      process.stdout.write(
        `registry/ci-publish-step: delisted — skipped ${key}\n`,
      );
      skippedDelisted++;
      continue;
    }
    loaded.push({ manifest, packageDir: dirname(p) });
    if (alreadyPublished.has(key)) {
      process.stdout.write(
        `registry/ci-publish-step: already in ledger — ${key}\n`,
      );
      skippedExisting++;
    } else {
      process.stdout.write(
        `registry/ci-publish-step: queued for append — ${key}\n`,
      );
      toAppend.push({ manifest, packageDir: dirname(p) });
    }
  }

  // ADR-0325 publish mode: the tagged tree must already BE the release — verify + stage,
  // never write. Handles its own dry-run (metadata checks run; packing is skipped).
  if (mode === "publish") {
    return verifyForPublish({
      loaded,
      alreadyPublished,
      skippedDelisted,
      dryRun,
      ledgerPath,
      indexPath,
      sidecarPath,
      stagingDir,
      packFn,
    });
  }

  let replaceKeys: ReadonlySet<string> = new Set<string>();
  if (refreshBaseSidecarPath !== undefined) {
    if (!existsSync(refreshBaseSidecarPath)) {
      throw new Error(
        `version refresh base sidecar does not exist: ${refreshBaseSidecarPath}`,
      );
    }
    const baseSidecar = readSidecar(refreshBaseSidecarPath);
    replaceKeys = new Set(
      loaded
        .map(({ manifest }) => `${manifest.id}@${manifest.version}`)
        .filter((key) => baseSidecar.tarballs[key] === undefined),
    );
    process.stdout.write(
      `registry/ci-publish-step: version refresh — ${replaceKeys.size} unmerged row(s) may be re-recorded\n`,
    );
  }

  if (dryRun) {
    process.stdout.write(
      toAppend.length > 0
        ? `registry/ci-publish-step: dry-run — ${toAppend.length} entry(s) would be appended; no writes performed\n`
        : "registry/ci-publish-step: dry-run — nothing new to append; ledger/index unchanged\n",
    );
    // Log the planned tarball pack/upload set over the FULL workspace (backfill-aware); writes
    // nothing (R2 upload gate stays closed).
    recordTarballs(loaded, {
      dryRun: true,
      sidecarPath,
      stagingDir,
      replaceKeys,
      packFn,
    });
    return {
      appended: 0,
      skippedExisting,
      skippedDelisted,
      wouldAppend: toAppend.length,
      tarballsRecorded: 0,
      verifiedStaged: 0,
    };
  }

  // Live mode — append each new entry to the ledger + rebuild index (only when there IS something
  // new; a steady-state run leaves ledger/index byte-identical). fail-closed: appendLedger throws
  // before any write on an invalid manifest.
  if (toAppend.length > 0) {
    // "<run-id>@<base-sha>" — the SHA the version PR was cut FROM, not the release SHA (a commit
    // cannot contain its own hash; the release tag anchors the final state). See PublishStepOpts.sha.
    const gateAttestation = `${runId}@${sha}`;
    for (const { manifest } of toAppend) {
      appendLedger({ manifest, publishedAt, gateAttestation, ledgerPath });
      process.stdout.write(
        `registry/ci-publish-step: appended ${manifest.id}@${manifest.version}\n`,
      );
    }
    const bytes = buildIndexFromLedgerFile(ledgerPath);
    writeFileSync(indexPath, bytes);
    process.stdout.write(
      `registry/ci-publish-step: rebuilt index.json → ${indexPath} (${bytes.length} bytes)\n`,
    );
  } else {
    process.stdout.write(
      "registry/ci-publish-step: nothing new to append; ledger/index unchanged\n",
    );
  }

  // Reconcile the tarball sidecar over EVERY current-workspace version (append-only; packs only the
  // versions missing a row). This backfills the catalog that was ledgered before the sidecar existed
  // — else a steady-state run packs nothing and every packument returns versions:{} (finding-2).
  // Snapshot which keys the sidecar already carried BEFORE this run packs anything — mirrors
  // recordTarballs' own pack condition exactly, so "just (re-)recorded this run" below can't drift
  // from what recordTarballs actually wrote.
  const sidecarBefore = readSidecar(sidecarPath).tarballs;
  const tarballsRecorded = recordTarballs(loaded, {
    dryRun: false,
    sidecarPath,
    stagingDir,
    replaceKeys,
    packFn,
  });

  // Sibling-churn guard (CAISSON-124): run the same repack-and-compare check the synchronize
  // refresh job runs, but INSIDE this initial dispatch step — a single-shot version PR (created
  // here, merged with no follow-up push) never fires a synchronize event, so this was previously
  // the only place the check never ran, and a churned sibling row sailed through to the
  // publish-time byte gate instead.
  const justRecordedKeys = new Set(
    loaded
      .map(({ manifest }) => `${manifest.id}@${manifest.version}`)
      .filter(
        (key) => sidecarBefore[key] === undefined || replaceKeys.has(key),
      ),
  );
  checkSiblingChurn({
    sidecar: readSidecar(sidecarPath),
    skipKeys: justRecordedKeys,
    packageDirFor: (slug) => join(packagesDir, slug),
    packFn: packFn ?? defaultPack,
    stagingDir: stagingDir ?? STAGING_DIR,
    lockfilePath: LOCKFILE_PATH,
  });

  return {
    appended: toAppend.length,
    skippedExisting,
    skippedDelisted,
    wouldAppend: 0,
    tarballsRecorded,
    verifiedStaged: 0,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

type CliArgs = Omit<
  PublishStepOpts,
  "ledgerPath" | "indexPath" | "packagesDir"
> & {
  refreshCandidateRoot?: string | undefined;
  refreshBaseLedgerPath?: string | undefined;
};

function parseCliArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let runId = "";
  let sha = "";
  let publishedAt = "";
  let dryRun = true; // safe default: never publish unless the caller explicitly says "false"
  let mode: "version" | "publish" = "version";
  let refreshBaseSidecarPath: string | undefined;
  let refreshCandidateRoot: string | undefined;
  let refreshBaseLedgerPath: string | undefined;

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
    } else if (flag === "--mode" && val !== undefined) {
      if (val !== "version" && val !== "publish") {
        process.stderr.write(
          `registry/ci-publish-step: fatal: --mode must be "version" or "publish", got "${val}"\n`,
        );
        process.exit(1);
      }
      mode = val;
      i++;
    } else if (flag === "--refresh-base-sidecar" && val !== undefined) {
      refreshBaseSidecarPath = val;
      i++;
    } else if (flag === "--refresh-candidate-root" && val !== undefined) {
      refreshCandidateRoot = val;
      i++;
    } else if (flag === "--refresh-base-ledger" && val !== undefined) {
      refreshBaseLedgerPath = val;
      i++;
    }
  }

  return {
    runId,
    sha,
    publishedAt,
    dryRun,
    mode,
    refreshBaseSidecarPath,
    refreshCandidateRoot,
    refreshBaseLedgerPath,
  };
}

if (import.meta.main) {
  const {
    refreshCandidateRoot,
    refreshBaseLedgerPath,
    refreshBaseSidecarPath,
    ...publishArgs
  } = parseCliArgs();
  if (refreshCandidateRoot !== undefined) {
    try {
      if (
        refreshBaseLedgerPath === undefined ||
        refreshBaseSidecarPath === undefined
      ) {
        throw new Error(
          "--refresh-candidate-root requires --refresh-base-ledger and --refresh-base-sidecar",
        );
      }
      refreshVersionCandidateTarballs({
        candidateRoot: refreshCandidateRoot,
        baseLedgerPath: refreshBaseLedgerPath,
        baseSidecarPath: refreshBaseSidecarPath,
        dryRun: publishArgs.dryRun,
      });
    } catch (err: unknown) {
      process.stderr.write(
        `registry/ci-publish-step: fatal: ${(err as Error).message}\n`,
      );
      process.exit(1);
    }
  } else {
    runPublishStep({
      ...publishArgs,
      refreshBaseSidecarPath,
    }).catch((err: unknown) => {
      process.stderr.write(
        `registry/ci-publish-step: fatal: ${(err as Error).message}\n`,
      );
      process.exit(1);
    });
  }
}

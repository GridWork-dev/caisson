// registry/scripts/r2-historical-backfill.ts — historical tarball backfill for R2 (CAISSON-125).
//
// THE GAP: registry/tarballs.json advertises a sidecar row (R2 key + shasum/integrity/size) for
// every published (id,version) pair, but a "ride" (the trusted synchronize-refresh path in
// ci-publish-step.ts) only ever uploads the tarball CURRENT at ride-time — a superseded version's
// row was recorded once, historically, and its bytes were staged + uploaded on THAT day's run. When
// an upload never landed (a partial CI run, a pre-R2-wiring era, an aborted rerun), the row stays in
// tarballs.json forever but the object never existed in the bucket — the r2-parity-probe.ts MISSING
// class. This tool closes that gap for already-identified missing keys: it re-derives the HISTORICAL
// commit at which each target version was current, packs the tarball from a pristine (no-build,
// frozen-lockfile) worktree at that commit, and uploads ONLY when the repacked bytes hash to
// EXACTLY the row already advertised — the same "bun pm pack is byte-deterministic" trust the
// publish-time byte gate rests on (ci-publish-step.ts's --mode publish). A mismatch never uploads
// (fail-closed): a byte drift here means the historical commit resolution picked the wrong tree, not
// that the advertised row is wrong, so silently uploading mismatched bytes would make a buyer's
// integrity check fail LATER instead of failing loud HERE.
//
// Upload reuses the EXACT mechanism publish.yml + r2-parity-probe.ts already use for this bucket:
// `aws s3 cp` against R2's S3-compatible endpoint (R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/
// R2_ACCOUNT_ID) — not `wrangler r2 object put`, which has no configured credential path for the
// caisson-registry-tarballs bucket in this repo. Same bucket name, same object-key layout
// (`<slug>/<slug>-<version>.tgz`), no new dependency, no new credential surface.
//
// Defaults to dry-run; --upload is required to actually write to R2. Never touches git HEAD or the
// working tree — all historical checkouts happen in throwaway `git worktree add --detach` scratch
// dirs, always removed in a finally.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
  type Sidecar,
  type TarballDist,
  computeTarballDist,
  readSidecar,
} from "./ci-publish-step";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const R2_BUCKET = "caisson-registry-tarballs";

// ---------------------------------------------------------------------------
// Target parsing — the `--missing-file` line format
// ---------------------------------------------------------------------------

export interface HistoricalTarget {
  readonly id: string; // "@caisson/auth"
  readonly slug: string; // "auth"
  readonly version: string; // "1.0.0"
  readonly sidecarKey: string; // "@caisson/auth@1.0.0" — the tarballs.json key
  readonly r2Key: string; // "auth/auth-1.0.0.tgz" — the R2 object key
}

/**
 * Parse one `--missing-file` line into a target. Accepts either the sidecar key form
 * (`@caisson/<slug>@<version>`) or the R2 object-key form (`<slug>/<slug>-<version>.tgz`) — the two
 * shapes an operator is likely to have pasted from r2-parity-probe.ts's MISSING report lines.
 * Blank lines and `#`-comments are skipped (null). Malformed non-blank lines are also skipped —
 * the caller counts skipped lines and reports them, rather than aborting the whole file over one typo.
 */
export function parseMissingLine(raw: string): HistoricalTarget | null {
  const line = raw.trim();
  if (line === "" || line.startsWith("#")) return null;

  if (line.startsWith("@caisson/")) {
    const at = line.lastIndexOf("@");
    if (at <= 0) return null; // no version separator beyond the leading scope '@'
    const id = line.slice(0, at);
    const version = line.slice(at + 1);
    const slug = id.slice("@caisson/".length);
    if (slug === "" || version === "") return null;
    return {
      id,
      slug,
      version,
      sidecarKey: `${id}@${version}`,
      r2Key: `${slug}/${slug}-${version}.tgz`,
    };
  }

  const match = /^([a-z0-9-]+)\/\1-(.+)\.tgz$/.exec(line);
  const slug = match?.[1];
  const version = match?.[2];
  if (slug === undefined || version === undefined) return null;
  const id = `@caisson/${slug}`;
  return {
    id,
    slug,
    version,
    sidecarKey: `${id}@${version}`,
    r2Key: `${slug}/${slug}-${version}.tgz`,
  };
}

// ---------------------------------------------------------------------------
// Injectable steps (live impls below; tests inject fakes)
// ---------------------------------------------------------------------------

/** Resolve the newest commit at which `packages/<slug>/package.json` carried `version`. Throws when
 *  no commit in the file's history matches (fail loud — the caller reports it as an error row). */
export type ResolveCommitFn = (slug: string, version: string) => string;

/** Pack `packages/<slug>` from a pristine, no-build worktree at `commit`; returns the tgz bytes. */
export type PackAtCommitFn = (
  slug: string,
  version: string,
  commit: string,
) => Uint8Array;

/** Upload the packed bytes to R2 under `r2Key`. Only ever called after a byte-exact match. */
export type UploadFn = (r2Key: string, bytes: Uint8Array) => void;

const PackageJsonVersion = z.record(z.string(), z.unknown());

/** Live `ResolveCommitFn`: walk `git log` newest→oldest over the package.json path, `git show` each
 *  candidate, and stop at the first (= newest) commit whose version matches. execFileSync arg-arrays
 *  only — no shell string interpolation (identity/security.md). */
export const resolveHistoricalCommit: ResolveCommitFn = (slug, version) => {
  const log = execFileSync(
    "git",
    ["log", "--format=%H", "--", `packages/${slug}/package.json`],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  const commits = log.split("\n").filter((l) => l !== "");
  for (const commit of commits) {
    let raw: string;
    try {
      raw = execFileSync(
        "git",
        ["show", `${commit}:packages/${slug}/package.json`],
        { cwd: REPO_ROOT, encoding: "utf8" },
      );
    } catch {
      continue; // path didn't exist at this commit (e.g. package added later in a rename chain)
    }
    const parsed = PackageJsonVersion.safeParse(JSON.parse(raw));
    if (parsed.success && parsed.data.version === version) {
      return commit;
    }
  }
  throw new Error(
    `no commit in packages/${slug}/package.json history carries version ${version}`,
  );
};

/** Live `PackAtCommitFn`: `git worktree add --detach` a scratch checkout at `commit`, `bun install
 *  --frozen-lockfile` (NO build — a built tree poisons the pack), then `bun pm pack` the package.
 *  The worktree is always removed in the finally, whether packing succeeded or threw. */
export const packAtHistoricalCommit: PackAtCommitFn = (
  slug,
  version,
  commit,
) => {
  const scratchRoot = mkdtempSync(join(tmpdir(), "r2-backfill-wt-"));
  const worktreeDir = join(scratchRoot, `${slug}-${version}`);
  try {
    execFileSync("git", ["worktree", "add", "--detach", worktreeDir, commit], {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
    execFileSync("bun", ["install", "--frozen-lockfile"], {
      cwd: worktreeDir,
      stdio: "pipe",
    });
    const outFile = join(scratchRoot, `${slug}-${version}.tgz`);
    execFileSync(
      "bun",
      ["pm", "pack", "--quiet", "--ignore-scripts", "--filename", outFile],
      { cwd: join(worktreeDir, "packages", slug), stdio: "pipe" },
    );
    return readFileSync(outFile);
  } finally {
    try {
      execFileSync("git", ["worktree", "remove", "--force", worktreeDir], {
        cwd: REPO_ROOT,
        stdio: "pipe",
      });
    } catch {
      // best-effort — the scratchRoot rmSync below still reclaims the checkout either way.
    }
    rmSync(scratchRoot, { recursive: true, force: true });
  }
};

/** Live `UploadFn`: `aws s3 cp` against R2's S3-compatible endpoint — the exact mechanism
 *  publish.yml already uses for this bucket (no new credential surface). */
export const uploadToR2: UploadFn = (r2Key, bytes) => {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (accountId === undefined || accountId === "") {
    throw new Error("R2_ACCOUNT_ID is not set — cannot build the R2 endpoint");
  }
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const scratchDir = mkdtempSync(join(tmpdir(), "r2-backfill-upload-"));
  try {
    const tmpFile = join(scratchDir, "upload.tgz");
    writeFileSync(tmpFile, bytes);
    execFileSync(
      "aws",
      [
        "s3",
        "cp",
        tmpFile,
        `s3://${R2_BUCKET}/${r2Key}`,
        "--endpoint-url",
        endpoint,
        "--no-progress",
      ],
      { stdio: "pipe" },
    );
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
};

// ---------------------------------------------------------------------------
// Pure-ish core (network/git/fs only through the injected fns above — unit-testable)
// ---------------------------------------------------------------------------

export type BackfillRowStatus =
  "uploaded" | "dry-run-match" | "mismatch" | "error";

export interface BackfillRowResult {
  readonly sidecarKey: string;
  readonly r2Key: string;
  readonly commit?: string;
  readonly status: BackfillRowStatus;
  readonly detail: string;
}

export interface BackfillStepOpts {
  readonly resolveCommit: ResolveCommitFn;
  readonly packAtCommit: PackAtCommitFn;
  readonly upload: UploadFn;
  readonly doUpload: boolean;
}

/** Process one target: resolve its historical commit, repack, byte-compare against the sidecar row,
 *  and upload ONLY on an exact match with `doUpload` set. Never throws — every failure mode (no
 *  commit found, pack failure, byte mismatch) becomes an `error`/`mismatch` row so one bad key never
 *  aborts the rest of the batch; the CLI's exit code carries the fail-closed signal instead. */
export function backfillOne(
  target: HistoricalTarget,
  recorded: TarballDist,
  opts: BackfillStepOpts,
): BackfillRowResult {
  let commit: string;
  try {
    commit = opts.resolveCommit(target.slug, target.version);
  } catch (err) {
    return {
      sidecarKey: target.sidecarKey,
      r2Key: target.r2Key,
      status: "error",
      detail: `commit resolution failed: ${(err as Error).message}`,
    };
  }

  let bytes: Uint8Array;
  try {
    bytes = opts.packAtCommit(target.slug, target.version, commit);
  } catch (err) {
    return {
      sidecarKey: target.sidecarKey,
      r2Key: target.r2Key,
      commit,
      status: "error",
      detail: `pack at ${commit.slice(0, 7)} failed: ${(err as Error).message}`,
    };
  }

  const dist = computeTarballDist(bytes, target.slug, target.version);
  if (
    dist.shasum !== recorded.shasum ||
    dist.integrity !== recorded.integrity ||
    dist.size !== recorded.size
  ) {
    return {
      sidecarKey: target.sidecarKey,
      r2Key: target.r2Key,
      commit,
      status: "mismatch",
      detail: `recorded=${recorded.shasum}/${String(recorded.size)}B, would-be=${dist.shasum}/${String(dist.size)}B — refusing to upload`,
    };
  }

  if (!opts.doUpload) {
    return {
      sidecarKey: target.sidecarKey,
      r2Key: target.r2Key,
      commit,
      status: "dry-run-match",
      detail: `bytes match (${String(dist.size)}B); --upload not set`,
    };
  }

  opts.upload(target.r2Key, bytes);
  return {
    sidecarKey: target.sidecarKey,
    r2Key: target.r2Key,
    commit,
    status: "uploaded",
    detail: `uploaded ${String(dist.size)}B`,
  };
}

export interface RunBackfillOpts extends BackfillStepOpts {
  readonly targets: readonly HistoricalTarget[];
  readonly sidecar: Sidecar;
}

export interface RunBackfillResult {
  readonly rows: BackfillRowResult[];
  readonly uploaded: number;
  readonly matched: number;
  readonly failed: number;
}

/** Run the batch. A target with no matching sidecar row is reported as an `error` row (nothing to
 *  verify bytes against) rather than silently skipped. */
export function runBackfill(opts: RunBackfillOpts): RunBackfillResult {
  const rows: BackfillRowResult[] = [];
  for (const target of opts.targets) {
    const recorded = opts.sidecar.tarballs[target.sidecarKey];
    if (recorded === undefined) {
      rows.push({
        sidecarKey: target.sidecarKey,
        r2Key: target.r2Key,
        status: "error",
        detail: "no sidecar row for this key — not advertised in tarballs.json",
      });
      continue;
    }
    rows.push(backfillOne(target, recorded, opts));
  }
  return {
    rows,
    uploaded: rows.filter((r) => r.status === "uploaded").length,
    matched: rows.filter((r) => r.status === "dry-run-match").length,
    failed: rows.filter((r) => r.status === "error" || r.status === "mismatch")
      .length,
  };
}

/** One `[status] key ← commit — detail` report line per target. */
export function renderRow(row: BackfillRowResult): string {
  const commit = row.commit !== undefined ? ` @ ${row.commit.slice(0, 7)}` : "";
  return `  [${row.status.toUpperCase().padEnd(14)}] ${row.sidecarKey}${commit} — ${row.detail}`;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const CliArgs = z.object({
  missingFile: z.string().min(1),
  upload: z.boolean(),
  limit: z.number().int().positive().optional(),
});
type CliArgs = z.infer<typeof CliArgs>;

function parseCliArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let missingFile: string | undefined;
  let upload = false; // safe default: never write to R2 unless explicitly requested
  let limit: number | undefined;

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === undefined) break;
    const val = argv[i + 1];
    if (flag === "--missing-file" && val !== undefined) {
      missingFile = val;
      i++;
    } else if (flag === "--upload") {
      upload = true;
    } else if (flag === "--limit" && val !== undefined) {
      limit = Number.parseInt(val, 10);
      i++;
    }
  }

  if (missingFile === undefined) {
    process.stderr.write(
      "registry/r2-historical-backfill: fatal: --missing-file <path> is required\n",
    );
    process.exit(1);
  }
  return CliArgs.parse({ missingFile, upload, limit });
}

function main(): void {
  const args = parseCliArgs();
  const lines = readFileSync(args.missingFile, "utf8").split("\n");
  const targets: HistoricalTarget[] = [];
  let skipped = 0;
  for (const line of lines) {
    const parsed = parseMissingLine(line);
    if (parsed === null) {
      if (line.trim() !== "" && !line.trim().startsWith("#")) skipped++;
      continue;
    }
    targets.push(parsed);
  }
  const limited =
    args.limit !== undefined ? targets.slice(0, args.limit) : targets;

  const label = args.upload ? "[live]" : "[dry-run]";
  process.stdout.write(
    `registry/r2-historical-backfill: ${label} ${String(limited.length)} target(s) (${String(skipped)} unparseable line(s) skipped)\n`,
  );

  const result = runBackfill({
    targets: limited,
    sidecar: readSidecar(),
    resolveCommit: resolveHistoricalCommit,
    packAtCommit: packAtHistoricalCommit,
    upload: uploadToR2,
    doUpload: args.upload,
  });

  for (const row of result.rows) {
    process.stdout.write(`${renderRow(row)}\n`);
  }
  process.stdout.write(
    `registry/r2-historical-backfill: ${String(result.uploaded)} uploaded, ${String(result.matched)} matched (dry-run), ${String(result.failed)} failed\n`,
  );
  process.exit(result.failed > 0 ? 1 : 0);
}

if (import.meta.main) {
  main();
}

// Immutable-input Railway deploy: closes the STATE.md-proven class where `railway up` tars
// whatever happens to be sitting in the live working tree -- no ref pinning, no clean-tree
// guarantee (a stray local mode-600 file shipped once and broke boot). Ports the tag-pinning +
// ancestry-check pattern already proven in .github/workflows/publish.yml to Railway deploys.
//
// Pipeline: resolve <ref> to a full commit SHA -> refuse if it isn't an ancestor of origin/main
// -> `git archive <sha> | tar -x` into a clean scratch dir (git's own normalized 644/755 modes,
// no untracked cruft, no dirty state -- this alone kills the mode-600 class) -> refuse a repeat
// deploy of the same sha for the same service unless --force -> `railway up` from the clean
// staging dir -> append a receipt row. The receipts file is never git-committed here (the
// suggested `git add`/`git commit` is printed instead), matching how STATE.md entries are
// handled -- this tool is not the SOT for deploy history, only the mechanism.
//
// RAILWAY_TOKEN stays unset in CI (arms nothing here); this ships tooling only. Deploying is a
// separate operator-gated act (identity/doctrine.md, Autonomy line + DEPLOY).
//
// Usage: bun tooling/scripts/railway-deploy.ts --service <name> --ref <git-ref> [--force] [--dry-run]
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { z } from "zod";

const REPO_ROOT = join(import.meta.dir, "..", "..");
// Generous vs. a source-only `git archive` (node_modules is gitignored) -- avoids ENOBUFS on a
// monorepo without needing to stream.
const ARCHIVE_MAX_BUFFER = 512 * 1024 * 1024;

/** The exec seam every impure function below is threaded through. Tests inject a double so the
 *  suite never spawns git/tar/railway for real -- same shape as `node:child_process.execFileSync`
 *  so the default IS the real thing. */
export type ExecFileSyncFn = typeof execFileSync;

// ============================================================================================
// Pure: CLI args
// ============================================================================================

const ArgsSchema = z
  .object({
    service: z.string().min(1),
    ref: z.string().min(1),
    force: z.boolean(),
    dryRun: z.boolean(),
  })
  .strict();
export type Args = z.infer<typeof ArgsSchema>;

export function parseArgv(argv: readonly string[]): Args {
  let service: string | undefined;
  let ref: string | undefined;
  let force = false;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--service") service = argv[++i];
    else if (arg.startsWith("--service=")) service = arg.slice(10);
    else if (arg === "--ref") ref = argv[++i];
    else if (arg.startsWith("--ref=")) ref = arg.slice(6);
    else if (arg === "--force") force = true;
    else if (arg === "--dry-run") dryRun = true;
    else throw new Error(`railway-deploy: unrecognized argument "${arg}"`);
  }
  if (!service) throw new Error("railway-deploy: --service <name> is required");
  if (!ref) throw new Error("railway-deploy: --ref <git-ref> is required");
  return ArgsSchema.parse({ service, ref, force, dryRun });
}

// ============================================================================================
// Pure: receipts (docs/deploy/receipts/<service>.json -- a flat append-only array)
// ============================================================================================

const ReceiptSchema = z
  .object({
    sha: z.string(),
    deployedAt: z.string(),
    deployedBy: z.string(),
    forced: z.boolean().optional(),
  })
  .strict();
const ReceiptsFileSchema = z.array(ReceiptSchema);
export type Receipt = z.infer<typeof ReceiptSchema>;

/** `null` (no file yet) and an empty/whitespace-only string both parse to no receipts. */
export function parseReceipts(raw: string | null): Receipt[] {
  if (raw === null || raw.trim().length === 0) return [];
  return ReceiptsFileSchema.parse(JSON.parse(raw));
}

export function buildReceiptRow(
  sha: string,
  deployedAt: string,
  deployedBy: string,
  forced: boolean,
): Receipt {
  return forced
    ? { sha, deployedAt, deployedBy, forced: true }
    : { sha, deployedAt, deployedBy };
}

/** Refuses (throws) a repeat deploy of the same sha for this service unless `force`. */
export function checkReceiptCollision(
  receipts: readonly Receipt[],
  sha: string,
  force: boolean,
): void {
  if (receipts.some((r) => r.sha === sha) && !force) {
    throw new Error(
      `railway-deploy: ${sha} already has a deploy receipt for this service -- pass --force to redeploy the same sha`,
    );
  }
}

/** Append-only: never mutates `receipts`, never drops or reorders a prior row. */
export function appendReceipt(
  receipts: readonly Receipt[],
  row: Receipt,
): Receipt[] {
  return [...receipts, row];
}

export function receiptsPath(repoRoot: string, service: string): string {
  return join(repoRoot, "docs", "deploy", "receipts", `${service}.json`);
}

// ============================================================================================
// Impure: git / tar / railway (all threaded through the injectable exec seam)
// ============================================================================================

/** `git rev-parse --verify <ref>^{commit}` -> the full 40-char SHA. Fails loud on an
 *  unresolvable ref (typo, unfetched branch, ...) instead of silently deploying nothing. */
export function resolveRef(
  ref: string,
  cwd: string,
  exec: ExecFileSyncFn = execFileSync,
): string {
  let out: string | Buffer;
  try {
    out = exec("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
      cwd,
      encoding: "utf8",
    });
  } catch {
    throw new Error(
      `railway-deploy: could not resolve ref "${ref}" to a commit (git rev-parse --verify failed)`,
    );
  }
  return out.toString().trim();
}

/** Refuses a sha that is not on origin/main -- never deploy a ref only reachable from a feature
 *  branch. */
export function assertAncestorOfMain(
  sha: string,
  cwd: string,
  exec: ExecFileSyncFn = execFileSync,
): void {
  try {
    exec("git", ["merge-base", "--is-ancestor", sha, "origin/main"], { cwd });
  } catch {
    throw new Error(
      `railway-deploy: ${sha} is not an ancestor of origin/main -- refusing to deploy a ref not on main`,
    );
  }
}

/** `git archive <sha> | tar -x -C <stageDir>` without a shell pipe: the archive is captured as a
 *  Buffer and piped to tar's stdin via `input`. This yields git's own normalized 644/755 modes,
 *  no untracked cruft, and no dirty-tree state -- the fix for the mode-600 class, as a side
 *  effect of using the ref's committed bytes instead of `cp` of the live working tree. */
export function archiveRefToDir(
  sha: string,
  cwd: string,
  stageDir: string,
  exec: ExecFileSyncFn = execFileSync,
): void {
  const archive = exec("git", ["archive", sha], {
    cwd,
    maxBuffer: ARCHIVE_MAX_BUFFER,
  }) as Buffer;
  mkdirSync(stageDir, { recursive: true });
  exec("tar", ["-x", "-C", stageDir], { input: archive });
}

/** `git config user.name`, falling back to $USER/$USERNAME then a literal "unknown" -- never
 *  throws, a receipt always gets a deployedBy. */
export function resolveDeployedBy(
  cwd: string,
  exec: ExecFileSyncFn = execFileSync,
): string {
  try {
    const name = (
      exec("git", ["config", "user.name"], {
        cwd,
        encoding: "utf8",
      }) as string
    ).trim();
    if (name) return name;
  } catch {
    // fall through to the env-var fallback
  }
  return process.env.USER ?? process.env.USERNAME ?? "unknown";
}

// ============================================================================================
// main
// ============================================================================================

async function main(): Promise<void> {
  const args = parseArgv(process.argv.slice(2));

  const sha = resolveRef(args.ref, REPO_ROOT);
  assertAncestorOfMain(sha, REPO_ROOT);

  const stageDir = mkdtempSync(join(tmpdir(), "railway-deploy-"));
  try {
    archiveRefToDir(sha, REPO_ROOT, stageDir);

    const deployedBy = resolveDeployedBy(REPO_ROOT);
    const deployedAt = new Date().toISOString();
    const row = buildReceiptRow(sha, deployedAt, deployedBy, args.force);
    const railwayArgs = ["up", "--service", args.service, "--ci"];

    if (args.dryRun) {
      process.stdout.write(
        `[railway-deploy] dry-run: resolved ${args.ref} -> ${sha}\n`,
      );
      process.stdout.write(
        `[railway-deploy] dry-run: staged a clean tree at ${stageDir}\n`,
      );
      process.stdout.write(
        `[railway-deploy] dry-run: would run: railway ${railwayArgs.join(" ")} (cwd=${stageDir})\n`,
      );
      process.stdout.write(
        `[railway-deploy] dry-run: would append receipt: ${JSON.stringify(row)}\n`,
      );
      return;
    }

    const path = receiptsPath(REPO_ROOT, args.service);
    const existing = parseReceipts(
      existsSync(path) ? readFileSync(path, "utf8") : null,
    );
    checkReceiptCollision(existing, sha, args.force);

    execFileSync("railway", railwayArgs, { cwd: stageDir, stdio: "inherit" });

    const updated = appendReceipt(existing, row);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(updated, null, 2)}\n`);

    process.stdout.write(
      `[railway-deploy] deployed ${args.service} @ ${sha}\n`,
    );
    process.stdout.write(
      "[railway-deploy] receipt appended -- this tool never commits it. Suggested:\n",
    );
    process.stdout.write(`  git add ${relative(REPO_ROOT, path)}\n`);
    process.stdout.write(
      `  git commit -m "chore(deploy): record ${args.service} deploy receipt for ${sha.slice(0, 12)}"\n`,
    );
  } finally {
    rmSync(stageDir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    process.stderr.write(`railway-deploy: ${(err as Error).message}\n`);
    process.exit(1);
  });
}

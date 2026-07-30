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
// Deploying is a separate operator-gated act (identity/doctrine.md, Autonomy line + DEPLOY);
// RAILWAY_TOKEN is armed in CI as of 2026-07-30, so the workflow's own arm-guard is what keeps
// this inert, not an absent credential.
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
    // Railway-slug bound (not just non-empty) -- closes a path-traversal into receiptsPath()
    // below (`docs/deploy/receipts/${service}.json`) and the typo-defeats-single-use-gate variant.
    service: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
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
    out = exec(
      "git",
      ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`],
      {
        cwd,
        encoding: "utf8",
      },
    );
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
    exec(
      "git",
      ["merge-base", "--is-ancestor", "--end-of-options", sha, "origin/main"],
      { cwd },
    );
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
  const archive = exec("git", ["archive", "--end-of-options", sha], {
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
// Impure: deployment-status verification
//
// `railway up --ci` streams build logs and exits non-zero if that stream drops -- observed
// 2026-07-30 as "Failed to stream build logs: Failed to retrieve build log" ~64s in, on five
// consecutive runs whose deployments Railway's own ledger records as SUCCESS. The CLI's exit
// code therefore cannot distinguish "the deploy failed" from "the log stream died", and a
// false RED here is not cosmetic: the fleet workflow deploys the proof VERIFIER before its
// ISSUER, so one flake on the first service skips the second and half-deploys the fleet.
//
// The verdict is the deployment's own terminal status. `--detach` would also dodge the log
// stream, but it reports green the moment an upload is ACCEPTED -- a false green, the exact
// failure the workflow's arm-guard exists to prevent. Polling for a terminal state is the
// only shape that is neither.
// ============================================================================================

// Railway's CLI JSON envelope -- deliberately NOT .strict(): `meta` is a large vendor-owned
// object that evolves on their release cadence, and a new key in it must never fail a deploy
// verification. Same rule the repo applies to provider webhook envelopes.
const DeploymentSchema = z.object({ id: z.string(), status: z.string() });
const DeploymentListSchema = z.array(DeploymentSchema);
export type Deployment = z.infer<typeof DeploymentSchema>;

/** Anything not listed as terminal is treated as still in flight and re-polled -- an unknown
 *  future status must not be read as either success or failure. */
const TERMINAL_BAD = new Set(["FAILED", "CRASHED", "REMOVED", "SKIPPED"]);

export function classifyDeployStatus(status: string): "ok" | "bad" | "pending" {
  if (status === "SUCCESS") return "ok";
  return TERMINAL_BAD.has(status) ? "bad" : "pending";
}

/** Newest deployment for the service, or `null` when it has none yet. */
export function latestDeployment(
  service: string,
  cwd: string,
  exec: ExecFileSyncFn = execFileSync,
): Deployment | null {
  const out = exec(
    "railway",
    ["deployment", "list", "--service", service, "--json", "--limit", "1"],
    { cwd, encoding: "utf8" },
  ) as string;
  return DeploymentListSchema.parse(JSON.parse(out))[0] ?? null;
}

export const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Blocks until a deployment NEWER than `priorId` reaches a terminal state. Throws unless that
 *  state is SUCCESS -- including when the upload never produced a new deployment at all, which
 *  is the genuine-failure case (`railway up` 500ing on upload, seen the same day). */
export async function awaitDeployment(
  service: string,
  cwd: string,
  priorId: string | null,
  exec: ExecFileSyncFn = execFileSync,
  sleep: (ms: number) => Promise<void> = realSleep,
  pollMs = 10_000,
  maxPolls = 90,
  appearGrace = 6,
): Promise<void> {
  for (let poll = 0; poll < maxPolls; poll++) {
    const latest = latestDeployment(service, cwd, exec);
    if (!latest || latest.id === priorId) {
      // No new deployment row yet. Brief grace for Railway to register it, then call it a
      // genuine upload failure rather than burning the full poll budget.
      if (poll >= appearGrace) {
        throw new Error(
          `railway-deploy: no new ${service} deployment was created -- the upload did not reach Railway`,
        );
      }
    } else {
      const verdict = classifyDeployStatus(latest.status);
      if (verdict === "ok") return;
      if (verdict === "bad") {
        throw new Error(
          `railway-deploy: ${service} deployment ${latest.id} ended ${latest.status}`,
        );
      }
    }
    await sleep(pollMs);
  }
  throw new Error(
    `railway-deploy: timed out waiting for the ${service} deployment to reach a terminal state`,
  );
}

// ============================================================================================
// main
// ============================================================================================

/** Exported (with the same `exec` seam as every other impure function above) so a test can drive
 *  the real ordering -- resolve -> ancestry-assert -> archive -> deploy -- with an injected
 *  double, instead of re-implementing the sequence. `exec` defaults to the real `execFileSync`
 *  for the `import.meta.main` entrypoint below. */
export async function main(
  args: Args,
  exec: ExecFileSyncFn = execFileSync,
  sleep: (ms: number) => Promise<void> = realSleep,
): Promise<void> {
  const sha = resolveRef(args.ref, REPO_ROOT, exec);
  assertAncestorOfMain(sha, REPO_ROOT, exec);

  const stageDir = mkdtempSync(join(tmpdir(), "railway-deploy-"));
  try {
    archiveRefToDir(sha, REPO_ROOT, stageDir, exec);

    const deployedBy = resolveDeployedBy(REPO_ROOT, exec);
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
    // ponytail: single-use gate holds only on the operator's on-box persistent checkout --
    // receipts are a local uncommitted ledger (never git-committed by this tool, see file
    // header), so a fresh clone/CI checkout reads empty here and the gate is a no-op there.
    // RAILWAY_TOKEN is armed in CI as of 2026-07-30, so the gate no longer holds where it now
    // matters most. Upgrade path: read from committed git state, or an O_EXCL lock.
    checkReceiptCollision(existing, sha, args.force);

    // Captured BEFORE the deploy so the verification below can tell OUR deployment from the
    // one already sitting at the head of the ledger.
    const priorId = latestDeployment(args.service, stageDir, exec)?.id ?? null;

    let upExit: Error | null = null;
    try {
      exec("railway", railwayArgs, { cwd: stageDir, stdio: "inherit" });
    } catch (err) {
      // Not a verdict -- see the deployment-status section header. Recorded, then adjudicated
      // against the deployment's real terminal status.
      upExit = err as Error;
      process.stderr.write(
        `[railway-deploy] railway up exited non-zero (${upExit.message}) -- adjudicating against the deployment status\n`,
      );
    }
    await awaitDeployment(args.service, stageDir, priorId, exec, sleep);
    if (upExit) {
      process.stdout.write(
        "[railway-deploy] deployment reached SUCCESS despite that exit -- the CLI lost its log stream, the deploy landed\n",
      );
    }

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
  main(parseArgv(process.argv.slice(2))).catch((err: unknown) => {
    process.stderr.write(`railway-deploy: ${(err as Error).message}\n`);
    process.exit(1);
  });
}

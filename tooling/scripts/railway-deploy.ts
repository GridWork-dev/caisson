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
//        [--wait-minutes <n>]  (default 15; raise it above the service's railway.toml healthcheckTimeout)
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
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
    // How long to wait for the deployment to reach a terminal state. MUST exceed the service's
    // own `healthcheckTimeout` in its railway.toml plus build time, or a service that is still
    // legitimately warming is reported as a deploy failure. The 15-minute default fits every
    // fast service; caisson-docs needs far more (healthcheckTimeout = 1500s, and it re-embeds
    // its whole corpus on every cold boot), so its caller passes an explicit value.
    waitMinutes: z.number().int().min(1).max(120),
  })
  .strict();
export type Args = z.infer<typeof ArgsSchema>;

export function parseArgv(argv: readonly string[]): Args {
  let service: string | undefined;
  let ref: string | undefined;
  let force = false;
  let dryRun = false;
  let waitMinutes = DEFAULT_WAIT_MINUTES;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--service") service = argv[++i];
    else if (arg.startsWith("--service=")) service = arg.slice(10);
    else if (arg === "--ref") ref = argv[++i];
    else if (arg.startsWith("--ref=")) ref = arg.slice(6);
    else if (arg === "--wait-minutes") waitMinutes = Number(argv[++i]);
    else if (arg.startsWith("--wait-minutes="))
      waitMinutes = Number(arg.slice(15));
    else if (arg === "--force") force = true;
    else if (arg === "--dry-run") dryRun = true;
    else throw new Error(`railway-deploy: unrecognized argument "${arg}"`);
  }
  if (!service) throw new Error("railway-deploy: --service <name> is required");
  if (!ref) throw new Error("railway-deploy: --ref <git-ref> is required");
  return ArgsSchema.parse({ service, ref, force, dryRun, waitMinutes });
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

/** The receipt rendered for a CI run's job summary. States the limitation in the body rather than
 *  only in a log line, because the summary is what someone reads months later when asking what
 *  shipped -- an unqualified receipt on a run page would read as if the ledger had been updated. */
export function receiptEvidenceMarkdown(service: string, row: Receipt): string {
  return [
    `### Railway deploy receipt -- \`${service}\``,
    "",
    "Written here, **not** committed to `docs/deploy/receipts/` -- that file carries operator-run",
    "deploys only, and a CI checkout is discarded. This run page is the receipt.",
    "",
    "```json",
    JSON.stringify(row, null, 2),
    "```",
    "",
  ].join("\n");
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

/** The repo-root carrier `@caisson-sh/kernel`'s `servingRevision()` reads at runtime to answer the
 *  `x-caisson-revision` response header. Re-declared here rather than imported because it CANNOT be
 *  imported by specifier: `tooling/scripts/` has no package.json, so it is not a workspace and bun
 *  never links `@caisson-sh/*` into scope here (`bun test` resolves the bare specifier to nothing).
 *  The pair is pinned instead by a round-trip test that stamps with this constant and reads back
 *  through the kernel's own reader -- without that guard a rename on either side would fail
 *  nothing, and every service in the fleet would report `unknown` forever, which is exactly the
 *  silent blind spot this mechanism exists to remove. */
const REVISION_FILENAME = ".caisson-revision";

/** Overwrite the committed `unknown` placeholder in the STAGING tree with the sha being deployed.
 *
 *  This is the entire delivery mechanism. A Railway CLI upload carries no git ref
 *  (`RAILWAY_GIT_COMMIT_SHA` is populated for repo-triggered builds only), so the sha cannot arrive
 *  as a platform variable -- it has to be inside the uploaded bytes. `railway up` runs with
 *  `cwd: stageDir` and uploads that directory, so writing here puts the sha in the Docker build
 *  context and NOWHERE else: the operator's working tree is never touched, and the committed
 *  placeholder still reads `unknown` after a deploy.
 *
 *  Called after `archiveRefToDir`, which extracts the committed placeholder -- so this is always an
 *  overwrite of an existing file, never a create. That is what lets every Dockerfile COPY it
 *  unconditionally, with no glob and no missing-file fallback. */
export function stampRevision(stageDir: string, sha: string): void {
  writeFileSync(join(stageDir, REVISION_FILENAME), `${sha}\n`);
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

/** Poll cadence for `awaitDeployment`, and the wait budget `--wait-minutes` defaults to.
 *  15 minutes covers every service whose railway.toml `healthcheckTimeout` is short
 *  (admin/license/demos/site/support-bot are all 30s-300s). */
export const POLL_MS = 10_000;
export const DEFAULT_WAIT_MINUTES = 15;

/** Pure: wait budget in minutes -> poll count at the fixed cadence. Rounds UP: rounding down
 *  would shave the tail off exactly the long-warmup deploy this exists for. Fails loud on a
 *  non-finite budget -- NaN would make `poll < maxPolls` false on the first iteration, skipping
 *  the poll loop entirely and reporting a timeout on a deploy nobody ever looked at. */
export function pollsForWait(waitMinutes: number, pollMs = POLL_MS): number {
  if (!Number.isFinite(waitMinutes) || waitMinutes <= 0) {
    throw new Error(
      `railway-deploy: --wait-minutes must be a positive number, got ${String(waitMinutes)}`,
    );
  }
  return Math.ceil((waitMinutes * 60_000) / pollMs);
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
  pollMs = POLL_MS,
  maxPolls = pollsForWait(DEFAULT_WAIT_MINUTES),
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
    // Must follow the archive: it overwrites the placeholder that extraction just laid down.
    stampRevision(stageDir, sha);

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
        `[railway-deploy] dry-run: stamped ${REVISION_FILENAME} = ${sha}\n`,
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
    // Single-use gate. This tool never COMMITS a receipt (see the file header -- it prints a
    // suggested `git add`), but the operator does, and all six `docs/deploy/receipts/*.json` are
    // tracked. So a CI checkout does NOT read empty here, and the gate holds in CI against every
    // hand-committed row -- correcting a stale comment that claimed the opposite (ADR-0414).
    //
    // The live consequence, worth knowing before dispatching: a `workflow_dispatch` at a ref whose
    // sha ALREADY has a committed receipt for one of the fleet's services throws on that service,
    // and every later service in the job is skipped. Reachable in practice -- the services the
    // operator historically deployed by hand (docs, support-bot) carry the most committed rows.
    // Pass --force for a deliberate same-sha redeploy; a same-sha redeploy applies config and
    // ships no code, so know which one you want.
    //
    // Still not airtight: two concurrent runs on different machines can both read the pre-append
    // state. Upgrade path if that ever bites: an O_EXCL lock, or a Railway-side check.
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
    await awaitDeployment(
      args.service,
      stageDir,
      priorId,
      exec,
      sleep,
      POLL_MS,
      pollsForWait(args.waitMinutes),
    );
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

    // A CI run writes that receipt into a checkout that is then thrown away, so
    // docs/deploy/receipts/ carries operator-run deploys ONLY and reads stale after an autonomous
    // one (the v2026.07.30 train's leg 4 was the first, and nothing said so). This tool still does
    // not commit: a deploy job holding contents:write is the provenance defect ADR-0325 removed
    // from publish.yml. What changes here is that the drift stops being SILENT -- in CI the receipt
    // is written to the run's job summary, which is permanent and attributable, and the log says
    // plainly that the committed ledger was not updated.
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath !== undefined && summaryPath !== "") {
      appendFileSync(summaryPath, receiptEvidenceMarkdown(args.service, row));
      process.stdout.write(
        "[railway-deploy] receipt written to this run's job summary. The committed ledger at " +
          `${relative(REPO_ROOT, path)} was NOT updated -- a CI checkout is discarded. For this ` +
          "deploy, the run page and Railway's own deployment ledger are the evidence.\n",
      );
    } else {
      process.stdout.write(
        "[railway-deploy] receipt appended -- this tool never commits it. Suggested:\n",
      );
      process.stdout.write(`  git add ${relative(REPO_ROOT, path)}\n`);
      process.stdout.write(
        `  git commit -m "chore(deploy): record ${args.service} deploy receipt for ${sha.slice(0, 12)}"\n`,
      );
    }
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

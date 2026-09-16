#!/usr/bin/env bun
/**
 * release-readiness.ts — the ADR-0318 R3 gate. Every check must be GREEN before the release
 * train's propagation legs run; any red exits nonzero and the train stops before touching an
 * external surface. Run by .github/workflows/release-train.yml on the release SHA, and locally:
 *
 *   bun scripts/release-readiness.ts --tag v2026.07.30 [--sha <sha>] [--local]
 *
 * Checks (R3, locked; #0 added by ADR-0325):
 *   0. Release SHA on main — the tag targets a commit that is an ancestor of origin/main (the
 *      merged version-PR commit; a tag cut on a stray branch must never train).
 *   0b. Release tag signed (ADR-0382) — `git tag -v` verifies the tag against the allowed-signers
 *      file. ADVISORY for now: tags cut before the lock are unsigned and cannot become signed.
 *   1. CI green on the release SHA — all seven required checks, including the source security
 *      layer, support-bot and the R359 runtime-images-gate aggregate, completed successfully.
 *   2. Changesets drained — no pending .changeset/*.md (the version PR consumed them —
 *      version-pr.yml, ADR-0325; never a feature-branch or tag-path act).
 *   3. CHANGELOGs written — every non-private workspace package's CHANGELOG.md leads with its
 *      package.json version.
 *   4. `bun run sot` green — the SoT drift tool (ADR-ceiling parity, frontmatter/docs freshness,
 *      archive integrity, tracker-vs-PR reality, changeset preflight). Doubles as the R3
 *      docs-freshness check.
 *   4b. Registry coverage invariants (CAISSON-85/86) — every module's `latest` has a tarball row
 *      (hard), no advertised version outside the frozen pre-sidecar backlog is rowless, and every
 *      served member pin resolves served+tarball-backed (advertise-follows-upload, static half).
 *   5. R4 audit artifact on file — outputs/audit/release-audit-<tag>.md (the fresh full
 *      SHIP-audit-lane review of the cumulative diff since the last release tag).
 *   6. Per-release checklist complete — docs/releases/<tag>-checklist.md exists with ZERO
 *      unchecked boxes (the human items: marketing surfaces, announcement, live-leg attestations).
 *   7. (--local only) the live-hybrid retrieval golden leg — services/docs `bun run test:live`
 *      with real keys (Kickoff-M picker 2026-07-10: this leg gates at release readiness, not PR
 *      CI). In the train (no keys) the checklist attestation (#6) carries it instead.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { checkRegistryCoverage } from "../registry/scripts/coverage-invariants";

const REPO = resolve(import.meta.dir, "..");
export const REQUIRED_CHECKS = [
  "check",
  "standards-gate",
  "registry-index",
  "oscal-conformance",
  // ADR-0327 scan-gate flip (CAISSON-95): the deterministic security layer joins the required
  // set once its installers are pinned — which landed in the same change as this line.
  "deterministic",
  // ADR-0414: the Python gate for services/support-bot, promoted out of advisory in the same
  // change that gave that service an automated Railway deploy. Its paths filter was removed in
  // the same commit — this list treats a check that never reported as `missing`, so a
  // path-scoped required check would red readiness on every release that did not touch the bot.
  "support-bot",
  // R359 / CR-05: source scans cannot stand in for the enforcing runtime-image matrix.
  "runtime-images-gate",
] as const;

interface Args {
  tag: string;
  sha: string;
  local: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  let tag = "";
  let sha = "";
  let local = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tag") tag = argv[++i] ?? "";
    else if (a === "--sha") sha = argv[++i] ?? "";
    else if (a === "--local") local = true;
  }
  if (!tag) {
    console.error("FATAL: --tag <release-tag> is required");
    process.exit(1);
  }
  if (!sha) {
    sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO })
      .toString()
      .trim();
  }
  return { tag, sha, local };
}

type CheckResult = { name: string; ok: boolean; detail: string };
const results: CheckResult[] = [];
function record(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✓" : "  ✗"} ${name} — ${detail}`);
}

function run(cmd: string, args: readonly string[], cwd = REPO): string {
  return execFileSync(cmd, [...args], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  })
    .toString()
    .trim();
}

/** Blob contents are parser input: preserve every byte, including leading whitespace. */
function readGitBlob(repo: string, sha: string, path: string): string {
  return execFileSync("git", ["show", `${sha}:${path}`], {
    cwd: repo,
    stdio: ["ignore", "pipe", "pipe"],
  }).toString("utf8");
}

// --- 0. release SHA on main (ADR-0325) -----------------------------------------------------------
function checkTagOnMain(sha: string): void {
  try {
    // In CI the checkout is at the tag with full history; locally origin/main may be stale —
    // refresh it quietly, tolerating offline runs (merge-base still answers from local refs).
    try {
      run("git", ["fetch", "origin", "main", "--quiet"]);
    } catch {
      /* offline — check against the local origin/main ref */
    }
    run("git", ["merge-base", "--is-ancestor", sha, "origin/main"]);
    record(
      "release SHA on main",
      true,
      `${sha.slice(0, 8)} is an ancestor of origin/main`,
    );
  } catch {
    record(
      "release SHA on main",
      false,
      `${sha.slice(0, 8)} is NOT on origin/main — the tag must target the merged version-PR commit`,
    );
  }
}

// --- 0b. release tag is signed (ADR-0382) -------------------------------------------------------
// An annotated tag says WHO claims a release; a signed one proves it. Without a signature anyone
// with push access can move or forge a tag onto a different commit and every downstream leg — the
// registry publish, the mirror sync, the fleet redeploy — trusts it, because each of them resolves
// the tag rather than a SHA. `git tag -v` verifies against the allowed-signers file; it fails on an
// unsigned tag, an unknown signer, and a signature that does not match the tag's bytes.
//
// Tags cut before the signing lock are unsigned and cannot retroactively become signed, so this is
// a WARNING here rather than a hard gate: it reports honestly on every release without failing the
// train on history it cannot change. Promote it to a blocking check once the first signed tag has
// trained end to end (that flip is a one-word change: `record(..., ok, ...)`).
function checkTagSigned(tag: string): void {
  try {
    run("git", ["tag", "-v", tag]);
    record("release tag signed", true, `${tag} carries a valid signature`);
  } catch {
    // Not fatal — see above. Surfaced so an unsigned tag is a visible choice, never an oversight.
    console.log(
      `  ! release tag signed — ${tag} is UNSIGNED or its signer is not in the allowed-signers file (advisory; see docs/ops/release-tag-signing.md)`,
    );
  }
}

// --- 1. CI green on the release SHA -------------------------------------------------------------
function checkCi(sha: string): void {
  try {
    const raw = run("gh", [
      "api",
      `repos/{owner}/{repo}/commits/${sha}/check-runs`,
      "--paginate",
      "-q",
      "[.check_runs[] | {name, status, conclusion}]",
    ]);
    // --paginate emits one JSON array per page; normalize to a single list.
    const runs = raw
      .split("\n")
      .filter(Boolean)
      .flatMap(
        (line) =>
          JSON.parse(line) as {
            name: string;
            status: string;
            conclusion: string | null;
          }[],
      );
    const missing: string[] = [];
    const red: string[] = [];
    for (const required of REQUIRED_CHECKS) {
      const match = runs.filter((r) => r.name === required);
      if (match.length === 0) {
        missing.push(required);
        continue;
      }
      // A check re-run replaces its predecessor in the API answer set; any green instance passes.
      if (
        !match.some(
          (r) => r.status === "completed" && r.conclusion === "success",
        )
      )
        red.push(required);
    }
    const ok = missing.length === 0 && red.length === 0;
    record(
      "CI green on release SHA",
      ok,
      ok
        ? `all ${String(REQUIRED_CHECKS.length)} required checks green at ${sha.slice(0, 8)}`
        : `missing: [${missing.join(", ")}] red: [${red.join(", ")}]`,
    );
  } catch (err) {
    record("CI green on release SHA", false, `gh api failed: ${String(err)}`);
  }
}

// --- 2. changesets drained -----------------------------------------------------------------------
function checkChangesetsDrained(): void {
  const pending = readdirSync(join(REPO, ".changeset")).filter(
    (f) => f.endsWith(".md") && f !== "README.md",
  );
  record(
    "changesets drained",
    pending.length === 0,
    pending.length === 0
      ? "no pending changesets"
      : `${String(pending.length)} pending (version cut not consumed): ${pending.slice(0, 5).join(", ")}${pending.length > 5 ? ", …" : ""}`,
  );
}

// --- 3. CHANGELOGs written -----------------------------------------------------------------------
function checkChangelogs(): void {
  const bad: string[] = [];
  for (const group of ["packages", "tooling"]) {
    const base = join(REPO, group);
    if (!existsSync(base)) continue;
    for (const slug of readdirSync(base)) {
      const pj = join(base, slug, "package.json");
      if (!existsSync(pj)) continue;
      const pkg = JSON.parse(readFileSync(pj, "utf8")) as {
        name: string;
        version?: string;
        private?: boolean;
      };
      if (pkg.private || !pkg.version) continue;
      const changelog = join(base, slug, "CHANGELOG.md");
      if (!existsSync(changelog)) {
        bad.push(`${pkg.name} (no CHANGELOG.md)`);
        continue;
      }
      if (!readFileSync(changelog, "utf8").includes(`## ${pkg.version}`))
        bad.push(`${pkg.name} (no ## ${pkg.version} entry)`);
    }
  }
  record(
    "CHANGELOGs written",
    bad.length === 0,
    bad.length === 0
      ? "every versioned package's CHANGELOG leads with its current version"
      : bad.slice(0, 5).join("; ") + (bad.length > 5 ? "; …" : ""),
  );
}

// --- 4. sot green (doubles as docs freshness) ----------------------------------------------------
function checkSot(): void {
  try {
    run("bun", ["run", "sot"]);
    record("bun run sot", true, "SoT drift tool green (incl. docs freshness)");
  } catch (err) {
    // Surface the captured drift report — a CI readiness red must not be blind (first ride:
    // the only failure signal was this one-liner while sot's own output was swallowed).
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
    for (const chunk of [e.stdout, e.stderr]) {
      const text = chunk?.toString().trim();
      if (text) console.error(text);
    }
    record("bun run sot", false, "sot check failed — drift report above");
  }
}

// --- 4b. registry coverage invariants (CAISSON-85/86) --------------------------------------------
function checkRegistryCoverageGate(): void {
  // Static advertise-follows-upload proof: every module's latest has a tarball row (hard), no
  // advertised version outside the frozen pre-sidecar backlog is rowless, and every served member
  // pin resolves served+tarball-backed. Same invariants the registry-index CI job enforces via
  // coverage-invariants.test.ts — re-run here so the train's readiness verdict is self-contained.
  try {
    const report = checkRegistryCoverage({
      indexPath: join(REPO, "registry/index.json"),
      sidecarPath: join(REPO, "registry/tarballs.json"),
    });
    const detail = report.ok
      ? "latest/version/pin coverage all green (advertise-follows-upload)"
      : `latest: [${report.latest.join(", ")}] versions: [${report.versions
          .slice(0, 3)
          .join(
            ", ",
          )}${report.versions.length > 3 ? ", …" : ""}] pins: [${report.pins
          .slice(0, 3)
          .join(", ")}${report.pins.length > 3 ? ", …" : ""}]`;
    record("registry coverage (85/86)", report.ok, detail);
  } catch (err) {
    record(
      "registry coverage (85/86)",
      false,
      `coverage check failed to run: ${String(err)}`,
    );
  }
}

// --- 5. R4 audit artifact ------------------------------------------------------------------------
const releaseRef = z.string().regex(/^v[0-9][A-Za-z0-9._-]{0,100}$/);
const auditBindingSchema = z
  .object({
    base: releaseRef,
    tag: releaseRef,
    reviewed_sha: z.string().regex(/^[a-f0-9]{40}$/),
  })
  .strict();
const releaseAuditSchema = auditBindingSchema
  .extend({
    schema_version: z.literal(2),
    status: z.literal("clean"),
    critical: z.literal(0),
    reviewed_scope: z
      .array(z.string().trim().min(1).max(512))
      .min(1)
      .max(10000),
    reviewers: z
      .array(
        z
          .object({
            role: z.enum(["code_review", "security_audit"]),
            identity: z.string().trim().min(1).max(200),
            reviewed_at: z.iso.datetime({ offset: true }),
          })
          .strict(),
      )
      .length(2)
      .refine(
        (reviewers) =>
          new Set(reviewers.map((reviewer) => reviewer.role)).size === 2,
        "Both code review and security audit must be completed",
      ),
  })
  .strict();

export type AuditBinding = z.infer<typeof auditBindingSchema>;

// R370: only these two tag-specific files may change after the reviewed commit.
// No directory-wide docs exemption: a new policy, script or product byte needs review.
export const ATTESTATION_ONLY_PATHS = [
  "outputs/audit/release-audit-{tag}.md",
  "docs/releases/{tag}-checklist.md",
] as const;

/** File-backed boundary: a filename alone is never an R4 attestation. */
export function auditArtifactIsValid(
  path: string,
  expected: AuditBinding,
): boolean {
  try {
    return auditSourceIsValid(readFileSync(path, "utf8"), expected);
  } catch {
    return false;
  }
}

function auditSourceIsValid(source: string, expected: AuditBinding): boolean {
  try {
    const binding = auditBindingSchema.parse(expected);
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
    if (!frontmatter || source.length > 1_000_000) return false;
    const audit = releaseAuditSchema.parse(Bun.YAML.parse(frontmatter[1]!));
    return (
      audit.base === binding.base &&
      audit.tag === binding.tag &&
      audit.reviewed_sha === binding.reviewed_sha
    );
  } catch {
    return false;
  }
}

/** Read committed bytes, never a working-tree substitute for the tagged attestation. */
export function auditSuccessorIsValid(
  repo: string,
  tag: string,
  tagSha: string,
): boolean {
  try {
    releaseRef.parse(tag);
    z.string()
      .regex(/^[a-f0-9]{40}$/)
      .parse(tagSha);
    const reviewedSha = run("git", ["rev-parse", `${tagSha}^`], repo);
    // A merge has several parents and cannot use an ambiguous first-parent review.
    const parents = run(
      "git",
      ["rev-list", "--parents", "-n", "1", tagSha],
      repo,
    ).split(" ");
    if (parents.length !== 2 || parents[1] !== reviewedSha) return false;
    const allowed = ATTESTATION_ONLY_PATHS.map((path) =>
      path.replace("{tag}", tag),
    );
    // Preserve all filename bytes: trimming could turn a leading-space path into an allowed one.
    const changed = execFileSync(
      "git",
      ["diff", "--name-only", "--no-renames", "-z", reviewedSha, tagSha],
      { cwd: repo },
    )
      .toString()
      .split("\0")
      .filter(Boolean);
    if (changed.length === 0 || changed.some((path) => !allowed.includes(path)))
      return false;
    const base = run(
      "git",
      ["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", reviewedSha],
      repo,
    );
    const auditPath = allowed[0]!;
    // A symlink is not an audit/checklist file. Both must exist as regular blobs.
    for (const path of allowed) {
      const entry = run("git", ["ls-tree", tagSha, "--", path], repo);
      if (!entry.startsWith("100644 blob ")) return false;
    }
    return auditSourceIsValid(readGitBlob(repo, tagSha, auditPath), {
      base,
      tag,
      reviewed_sha: reviewedSha,
    });
  } catch {
    return false;
  }
}

function checkAuditArtifact(tag: string, sha: string): void {
  record(
    "R4 release audit on file",
    auditSuccessorIsValid(REPO, tag, sha),
    `requires clean code/security audit of ${sha}^ and only the two ${tag} attestation paths in its successor; CI still binds ${sha}`,
  );
}

// --- 6. per-release checklist --------------------------------------------------------------------
export function checkChecklist(tag: string, sha: string, repo = REPO): boolean {
  try {
    releaseRef.parse(tag);
    z.string()
      .regex(/^[a-f0-9]{40}$/)
      .parse(sha);
    const path = `docs/releases/${tag}-checklist.md`;
    const source = readGitBlob(repo, sha, path);
    const unchecked = (source.match(/^\s*-\s\[\s\]/gm) ?? []).length;
    record(
      "per-release checklist",
      unchecked === 0,
      unchecked === 0
        ? `all boxes checked at ${sha}`
        : `${String(unchecked)} unchecked box(es) at ${sha}`,
    );
    return unchecked === 0;
  } catch {
    record(
      "per-release checklist",
      false,
      `MISSING or unreadable docs/releases/${tag}-checklist.md at ${sha}`,
    );
    return false;
  }
}

// --- 7. live-hybrid golden leg (--local) ---------------------------------------------------------
function checkLiveHybrid(): void {
  const key =
    process.env.CAISSON_DOCS__OPENROUTER_API_KEY ??
    process.env.OPENROUTER_API_KEY ??
    "";
  if (key.length === 0) {
    record(
      "live-hybrid golden leg",
      false,
      "no OpenRouter key in env — source the env and re-run, or drop --local and attest via the checklist",
    );
    return;
  }
  try {
    execFileSync("bun", ["run", "test:live"], {
      cwd: join(REPO, "services/docs"),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, OPENROUTER_API_KEY: key },
      timeout: 15 * 60_000,
    });
    record(
      "live-hybrid golden leg",
      true,
      "services/docs test:live green (real fusion path)",
    );
  } catch {
    record("live-hybrid golden leg", false, "services/docs test:live FAILED");
  }
}

// Entry point guard (ADR-0414). Everything above is importable; only a direct
// `bun scripts/release-readiness.ts` runs the gate. Without this, importing the module to test
// REQUIRED_CHECKS parses argv, prints "FATAL: --tag is required", and exits the test process.
// release-train.yml's R3 job invokes this file directly, so `import.meta.main` is true there.
if (import.meta.main) {
  const { tag, sha, local } = parseArgs(Bun.argv.slice(2));
  console.log(
    `release-readiness — tag ${tag}, sha ${sha.slice(0, 12)}${local ? ", local" : ""}\n`,
  );
  checkTagOnMain(sha);
  checkTagSigned(tag);
  checkCi(sha);
  checkChangesetsDrained();
  checkChangelogs();
  checkSot();
  checkRegistryCoverageGate();
  checkAuditArtifact(tag, sha);
  checkChecklist(tag, sha);
  if (local) checkLiveHybrid();

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${failed.length === 0 ? "READY" : "NOT READY"} — ${String(results.length - failed.length)}/${String(results.length)} checks green`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

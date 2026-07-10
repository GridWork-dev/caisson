#!/usr/bin/env bun
/**
 * release-readiness.ts — the ADR-0318 R3 gate. Every check must be GREEN before the release
 * train's propagation legs run; any red exits nonzero and the train stops before touching an
 * external surface. Run by .github/workflows/release-train.yml on the release SHA, and locally:
 *
 *   bun scripts/release-readiness.ts --tag v2026.07.30 [--sha <sha>] [--local]
 *
 * Checks (R3, locked):
 *   1. CI green on the release SHA — the four required checks (check, standards-gate,
 *      registry-index, oscal-conformance) completed successfully.
 *   2. Changesets drained — no pending .changeset/*.md (the version cut consumed them).
 *   3. CHANGELOGs written — every non-private workspace package's CHANGELOG.md leads with its
 *      package.json version.
 *   4. `bun run sot` green — the SoT drift tool (ADR-ceiling parity, frontmatter/docs freshness,
 *      archive integrity, tracker-vs-PR reality, changeset preflight). Doubles as the R3
 *      docs-freshness check.
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

const REPO = resolve(import.meta.dir, "..");
const REQUIRED_CHECKS = [
  "check",
  "standards-gate",
  "registry-index",
  "oscal-conformance",
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
  } catch {
    record(
      "bun run sot",
      false,
      "sot check failed — run `bun run sot` for the drift report",
    );
  }
}

// --- 5. R4 audit artifact ------------------------------------------------------------------------
function checkAuditArtifact(tag: string): void {
  const path = join(REPO, "outputs/audit", `release-audit-${tag}.md`);
  record(
    "R4 release audit on file",
    existsSync(path),
    existsSync(path)
      ? `outputs/audit/release-audit-${tag}.md`
      : `MISSING outputs/audit/release-audit-${tag}.md — run the full SHIP-audit-lane review of the diff since the last release tag`,
  );
}

// --- 6. per-release checklist --------------------------------------------------------------------
function checkChecklist(tag: string): void {
  const path = join(REPO, "docs/releases", `${tag}-checklist.md`);
  if (!existsSync(path)) {
    record(
      "per-release checklist",
      false,
      `MISSING docs/releases/${tag}-checklist.md — copy docs/releases/TEMPLATE-checklist.md`,
    );
    return;
  }
  const unchecked = (readFileSync(path, "utf8").match(/^\s*-\s\[\s\]/gm) ?? [])
    .length;
  record(
    "per-release checklist",
    unchecked === 0,
    unchecked === 0
      ? "all boxes checked"
      : `${String(unchecked)} unchecked box(es)`,
  );
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

const { tag, sha, local } = parseArgs(Bun.argv.slice(2));
console.log(
  `release-readiness — tag ${tag}, sha ${sha.slice(0, 12)}${local ? ", local" : ""}\n`,
);
checkCi(sha);
checkChangesetsDrained();
checkChangelogs();
checkSot();
checkAuditArtifact(tag);
checkChecklist(tag);
if (local) checkLiveHybrid();

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${failed.length === 0 ? "READY" : "NOT READY"} — ${String(results.length - failed.length)}/${String(results.length)} checks green`,
);
process.exit(failed.length === 0 ? 0 : 1);

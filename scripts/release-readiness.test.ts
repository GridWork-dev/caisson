// Guards the required-check SET itself, not any one gate's logic. REQUIRED_CHECKS is a bare string
// list that release-readiness.ts compares against the GitHub check-runs API: a name here that no
// workflow defines makes every release "missing" that check forever, and a job here that can be
// skipped reds readiness on every release whose diff happened not to reach it. Both failures are
// silent until a release is already in flight, which is the wrong time to find out.
//
// Parsed with Bun.YAML, not regex. A first pass matched job KEYS with `^ {2}<name>:` and grepped
// for a 4-space `paths:`; the SHIP review defeated it three ways that this repo could plausibly
// produce — a `needs: changes` + `if: needs.changes.outputs.x` gate (quality.yml already has that
// `changes` job), a `paths:` at 6-space indent under a nested `on:`, and flow-style
// `push: { paths: [...] }`. A text heuristic over YAML is the wrong tool when a parser is in hand.
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, test } from "bun:test";

import {
  checkChecklist,
  auditArtifactIsValid,
  auditSuccessorIsValid,
  ATTESTATION_ONLY_PATHS,
  REQUIRED_CHECKS,
} from "./release-readiness.ts";

describe("R4 audit attestation", () => {
  const dir = mkdtempSync(join(tmpdir(), "caisson-r4-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  function git(repo: string, ...args: string[]): string {
    return execFileSync("git", args, {
      cwd: repo,
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    })
      .toString()
      .trim();
  }
  function scratch(): string {
    const repo = mkdtempSync(join(dir, "repo-"));
    git(repo, "init", "--quiet");
    git(repo, "config", "user.name", "R4 lifecycle fixture");
    git(repo, "config", "user.email", "r4@example.invalid");
    writeFileSync(join(repo, "product.ts"), "export const version = 1;\n");
    commit(repo);
    git(repo, "tag", "v2026.08.18");
    writeFileSync(join(repo, "product.ts"), "export const version = 2;\n");
    commit(repo);
    return repo;
  }
  function commit(repo: string): string {
    git(repo, "add", ".");
    git(repo, "commit", "--quiet", "-m", "test: lifecycle fixture");
    return git(repo, "rev-parse", "HEAD");
  }
  const fixtureRepo = scratch();
  const binding = {
    base: "v2026.08.18",
    tag: "v2026.09.16",
    reviewed_sha: git(fixtureRepo, "rev-parse", "HEAD"),
  };
  const clean = {
    schema_version: 2,
    ...binding,
    status: "clean",
    critical: 0,
    reviewed_scope: ["scripts/release-readiness.ts"],
    reviewers: [
      {
        role: "code_review",
        identity: "gw-code-reviewer",
        reviewed_at: "2026-09-16T02:37:11Z",
      },
      {
        role: "security_audit",
        identity: "gw-security-auditor",
        reviewed_at: "2026-09-16T02:37:11Z",
      },
    ],
  };
  function fixture(text: string): string {
    const path = join(dir, `${crypto.randomUUID()}.md`);
    writeFileSync(path, text);
    return path;
  }
  const document = (value: unknown) =>
    `---\n${JSON.stringify(value)}\n---\n# Audit\n`;

  function attestation(repo: string, reviewedSha: string): void {
    mkdirSync(join(repo, "outputs/audit"), { recursive: true });
    mkdirSync(join(repo, "docs/releases"), { recursive: true });
    writeFileSync(
      join(repo, `outputs/audit/release-audit-${binding.tag}.md`),
      document({ ...clean, reviewed_sha: reviewedSha }),
    );
    writeFileSync(
      join(repo, `docs/releases/${binding.tag}-checklist.md`),
      "- [x] fixture\n",
    );
  }

  test("R4 real Git lifecycle accepts review A then attestation-only B", () => {
    const repo = scratch();
    const a = git(repo, "rev-parse", "HEAD");
    attestation(repo, a);
    const b = commit(repo);
    expect(a).not.toBe(b);
    expect(auditSuccessorIsValid(repo, binding.tag, b)).toBe(true);
    // Working-tree tampering cannot replace the committed attestation.
    attestation(repo, git(repo, "rev-parse", "HEAD^"));
    writeFileSync(
      join(repo, `outputs/audit/release-audit-${binding.tag}.md`),
      "invalid",
    );
    expect(auditSuccessorIsValid(repo, binding.tag, b)).toBe(true);
  });
  test("R373 rejects committed audit with leading newline before frontmatter", () => {
    const repo = scratch();
    attestation(repo, git(repo, "rev-parse", "HEAD"));
    const path = join(repo, `outputs/audit/release-audit-${binding.tag}.md`);
    writeFileSync(path, `\n${readFileSync(path, "utf8")}`);
    const candidate = commit(repo);
    // A clean working copy must not rescue malformed committed bytes either.
    writeFileSync(path, readFileSync(path, "utf8").trimStart());
    expect(auditSuccessorIsValid(repo, binding.tag, candidate)).toBe(false);
  });

  test("R373 accepts committed complete checklist despite incomplete dirty copy", () => {
    const repo = scratch();
    attestation(repo, git(repo, "rev-parse", "HEAD"));
    const candidate = commit(repo);
    writeFileSync(
      join(repo, `docs/releases/${binding.tag}-checklist.md`),
      "- [ ] dirty copy\n",
    );
    expect(checkChecklist(binding.tag, candidate, repo)).toBe(true);
  });
  test("R373 rejects checklist absent from candidate despite complete working copy", () => {
    const repo = scratch();
    const candidate = git(repo, "rev-parse", "HEAD");
    attestation(repo, candidate);
    expect(checkChecklist(binding.tag, candidate, repo)).toBe(false);
  });

  test("R373 rejects committed incomplete checklist despite completed dirty copy", () => {
    const repo = scratch();
    attestation(repo, git(repo, "rev-parse", "HEAD"));
    const path = join(repo, `docs/releases/${binding.tag}-checklist.md`);
    writeFileSync(path, "- [ ] live evidence pending\n");
    const candidate = commit(repo);
    writeFileSync(path, "- [x] live evidence complete\n");
    expect(auditSuccessorIsValid(repo, binding.tag, candidate)).toBe(true);
    expect(checkChecklist(binding.tag, candidate, repo)).toBe(false);
  });

  test.each([
    "product.ts",
    "outputs/audit/unreviewed.md",
    "docs/releases/other-checklist.md",
    " outputs/audit/other.md",
  ])("R4 real Git lifecycle rejects unreviewed successor path %s", (path) => {
    const repo = scratch();
    const a = git(repo, "rev-parse", "HEAD");
    attestation(repo, a);
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), "unreviewed product or policy byte\n");
    const b = commit(repo);
    expect(auditSuccessorIsValid(repo, binding.tag, b)).toBe(false);
  });
  test("R4 real Git lifecycle rejects an audit naming C instead of parent A", () => {
    const repo = scratch();
    const a = git(repo, "rev-parse", "HEAD");
    // C is a real distinct existing commit, not an invented forty-character fixture.
    const c = git(repo, "rev-parse", `${a}^`);
    attestation(repo, c);
    const b = commit(repo);
    expect(auditSuccessorIsValid(repo, binding.tag, b)).toBe(false);
  });
  test("R4 attestation allowlist names exactly the audit and checklist", () => {
    expect(ATTESTATION_ONLY_PATHS).toEqual([
      "outputs/audit/release-audit-{tag}.md",
      "docs/releases/{tag}-checklist.md",
    ]);
  });

  test("R4 rejects an existing empty audit instead of accepting its filename", () => {
    expect(auditArtifactIsValid(fixture(""), binding)).toBe(false);
  });
  test("R4 accepts a clean audit bound to the exact base, tag and reviewed parent SHA", () => {
    expect(auditArtifactIsValid(fixture(document(clean)), binding)).toBe(true);
  });
  test.each([
    ["failed verdict", { status: "issues_found" }],
    ["blocking finding", { critical: 1 }],
    ["wrong SHA", { reviewed_sha: git(fixtureRepo, "rev-parse", "HEAD^") }],
    ["wrong base", { base: "v2026.07.30" }],
    ["wrong tag", { tag: "v2026.09.17" }],
    ["empty scope", { reviewed_scope: [] }],
    ["blank scope", { reviewed_scope: ["  "] }],
    ["no reviewers", { reviewers: [] }],
    [
      "duplicate roles",
      { reviewers: [clean.reviewers[0], clean.reviewers[0]] },
    ],
    [
      "blank identity",
      {
        reviewers: [
          { ...clean.reviewers[0], identity: " " },
          clean.reviewers[1],
        ],
      },
    ],
    [
      "invalid timestamp",
      {
        reviewers: [
          { ...clean.reviewers[0], reviewed_at: "yesterday" },
          clean.reviewers[1],
        ],
      },
    ],
    ["unknown metadata", { bypass: true }],
  ] as const)("R4 rejects %s", (_label, patch) => {
    expect(
      auditArtifactIsValid(fixture(document({ ...clean, ...patch })), binding),
    ).toBe(false);
  });
  test("R4 fails closed for absent, malformed and prose-only artifacts", () => {
    expect(auditArtifactIsValid(join(dir, "absent.md"), binding)).toBe(false);
    expect(auditArtifactIsValid(fixture("---\n[invalid\n---\n"), binding)).toBe(
      false,
    );
    expect(
      auditArtifactIsValid(fixture("Reviewed and approved"), binding),
    ).toBe(false);
  });
});

const WORKFLOWS_DIR = join(import.meta.dir, "..", ".github", "workflows");

/** The ONE `if:` a required job may carry — the CAISSON-96 draft guard, per ci.yml's header. */
const DRAFT_GUARD =
  "github.event_name != 'pull_request' || github.event.pull_request.draft == false";

interface Job {
  name?: string;
  if?: string;
  needs?: string | string[];
  "continue-on-error"?: boolean;
  steps?: {
    name?: string;
    run?: string;
    env?: Record<string, string>;
    if?: string;
    "continue-on-error"?: boolean;
  }[];
}
interface Trigger {
  paths?: string[];
  "paths-ignore"?: string[];
}
interface Workflow {
  on?: Record<string, Trigger | null>;
  true?: Record<string, Trigger | null>; // YAML 1.1: a bare `on:` key parses as boolean true
  jobs?: Record<string, Job>;
}

interface Found {
  file: string;
  key: string;
  job: Job;
  triggers: Record<string, Trigger | null>;
}

/** Parse every workflow once, and index by the check-run NAME each job reports under — which is
 *  `name:` when present and the job key otherwise. release-readiness.ts matches on that reported
 *  name, so indexing by job key alone would go green while every release reported it missing. */
const unparsable: string[] = [];

function jobsByReportedName(): Map<string, Found> {
  const found = new Map<string, Found>();
  for (const file of readdirSync(WORKFLOWS_DIR).filter(
    (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
  )) {
    let wf: Workflow;
    try {
      wf = Bun.YAML.parse(
        readFileSync(join(WORKFLOWS_DIR, file), "utf8"),
      ) as Workflow;
    } catch (err) {
      // Collected, not thrown. A parse error at module scope takes the whole suite down as
      // "0 pass / 0 fail" — technically non-zero, but it reads as "no tests ran" rather than
      // "this workflow is malformed", and it hides every other check in this file.
      unparsable.push(`${file}: ${String(err)}`);
      continue;
    }
    const triggers = wf.on ?? wf.true ?? {};
    for (const [key, job] of Object.entries(wf.jobs ?? {})) {
      found.set(job.name ?? key, { file, key, job, triggers });
    }
  }
  return found;
}

describe("REQUIRED_CHECKS — the release-readiness gate's own input", () => {
  const byName = jobsByReportedName();

  test("every workflow file parses — a throw here would blank the whole suite", () => {
    expect(unparsable).toEqual([]);
  });

  test("the set is non-empty, deduplicated, and at full strength", () => {
    // Guard the guard: a floor below the real size lets one silently drop out.
    expect(REQUIRED_CHECKS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(REQUIRED_CHECKS).size).toBe(REQUIRED_CHECKS.length);
    // And the parse itself must have found something, or every check below is vacuous.
    expect(byName.size).toBeGreaterThan(10);
  });

  test("every required check is a job some workflow actually reports under that name", () => {
    expect(REQUIRED_CHECKS.filter((name) => !byName.has(name))).toEqual([]);
  });

  test("no required check is path-scoped — a skipped check never reports and reads as missing", () => {
    // ci.yml's header states the rule from the PR side (a path-skipped required job never reports
    // and the PR blocks forever); release-readiness.ts enforces it from the release side, where a
    // check with zero runs lands in `missing`. Same constraint, both directions.
    const scoped = REQUIRED_CHECKS.flatMap((name) => {
      const hit = byName.get(name);
      if (!hit) return [];
      return Object.entries(hit.triggers)
        .filter(([, t]) => t?.paths ?? t?.["paths-ignore"])
        .map(([event]) => `${name} (${hit.file}, on.${event})`);
    });
    expect(scoped).toEqual([]);
  });

  test("no required check is conditionally skippable — only the CAISSON-96 draft guard is allowed", () => {
    // The other way a required job silently stops reporting: a job-level `if:` or a `needs:` on a
    // path-filter job. quality.yml already has a `changes` job of exactly that shape, so this is a
    // pattern the repo can produce, not a hypothetical.
    const conditional = REQUIRED_CHECKS.flatMap((name) => {
      // The fail-closed aggregate is tested structurally and behaviorally below.
      if (name === "runtime-images-gate") return [];
      const hit = byName.get(name);
      if (!hit) return [];
      const reasons: string[] = [];
      if (hit.job.if !== undefined && hit.job.if.trim() !== DRAFT_GUARD) {
        reasons.push(`if: ${hit.job.if}`);
      }
      if (hit.job.needs !== undefined) {
        reasons.push(`needs: ${String(hit.job.needs)}`);
      }
      return reasons.map((r) => `${name} (${hit.file}) — ${r}`);
    });
    expect(conditional).toEqual([]);
  });

  test("runtime images aggregate is required by release readiness", () => {
    expect(REQUIRED_CHECKS).toContain("runtime-images-gate");
  });

  test("runtime aggregate always consumes the selector and complete matrix", () => {
    const hit = byName.get("runtime-images-gate");
    expect(hit?.file).toBe("security-scan.yml");
    expect(hit?.job.if).toBe("always()");
    expect(hit?.job.needs).toEqual(["runtime-select", "runtime-images"]);
    expect(hit?.job["continue-on-error"]).not.toBe(true);
    expect(hit?.job.steps).toHaveLength(1);
    const step = hit?.job.steps?.[0];
    expect(step?.if).toBeUndefined();
    expect(step?.["continue-on-error"]).not.toBe(true);
    expect(step?.env).toEqual({
      SELECT_RESULT: "${{ needs.runtime-select.result }}",
      MATRIX_RESULT: "${{ needs.runtime-images.result }}",
    });
  });

  function aggregate(select: string, matrix: string): number | null {
    const script = byName.get("runtime-images-gate")?.job.steps?.[0]?.run;
    if (!script) throw new Error("runtime aggregate script missing");
    // Execute the actual workflow gate with synthetic outcomes; no scanners or credentials.
    return spawnSync("bash", ["-c", script], {
      env: {
        PATH: process.env.PATH,
        SELECT_RESULT: select,
        MATRIX_RESULT: matrix,
      },
    }).status;
  }

  test("runtime aggregate rejects a failed matrix member", () => {
    expect(aggregate("success", "failure")).toBe(1);
  });

  test("runtime aggregate is green only when both dependencies succeed", () => {
    for (const select of ["success", "failure", "cancelled", "skipped", ""]) {
      for (const matrix of ["success", "failure", "cancelled", "skipped", ""]) {
        expect(aggregate(select, matrix)).toBe(
          select === "success" && matrix === "success" ? 0 : 1,
        );
      }
    }
  });
});

// Unit tests for sot-check.ts. Each of the 6 checks gets at least one firing (drift) case
// and one green case. Checks whose logic is fundamentally filesystem/git-shaped (#1 ADR
// filename listing, #2 frontmatter freshness, #3 archive integrity, #4 branch hygiene) are
// exercised against SYNTHETIC fixture trees (temp dirs via fs.mkdtempSync, real `git`
// commits with controlled dates) — not mocks of the parsing logic. Checks #5/#6 depend on
// `gh`/`bunx` network+package calls; per SPEC (fixture trees "where cheap"), those are
// tested as pure functions over fixture data instead of hitting the real network/registry.
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  buildCeilingEditSuggestions,
  buildFreshnessEditSuggestions,
  buildPackageCountEditSuggestions,
  buildTrackerEditSuggestions,
  checkAdrCeilingParity,
  checkArchiveIntegrity,
  checkArchivedDocImmutable,
  checkDocFreshness,
  checkFrontmatterFreshness,
  checkLiveDocArchiveLink,
  checkPackageCountParity,
  computeBranchHygiene,
  computePackageCounts,
  diffPackageCounts,
  evaluateChangesetOutcome,
  extractAdrCeilingSources,
  extractCeiling,
  extractDocPackageRows,
  extractTrackerPrRefs,
  findStaleTrackerRefs,
  frontmatterKeyLine,
  maxAdrFromFilenames,
  type PackageCounts,
  parseFrontmatter,
  parseWorktreeList,
  printEditChecklist,
  printResults,
  type FrontmatterDoc,
} from "./sot-check";

// ============================================================================================
// Fixture helpers — a real, throwaway git repo per test that needs one
// ============================================================================================

function initGitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "sot-check-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: dir,
  });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  return dir;
}

function commitFile(
  dir: string,
  relPath: string,
  content: string,
  isoDate: string,
): void {
  const full = join(dir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  execFileSync("git", ["add", relPath], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", `commit ${relPath}`], {
    cwd: dir,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: isoDate,
      GIT_COMMITTER_DATE: isoDate,
    },
  });
}

function gitLastCommitDate(dir: string, relPath: string): string | null {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%cs", "--", relPath],
      {
        cwd: dir,
        encoding: "utf8",
      },
    ).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function gitHasUncommitted(dir: string, relPath: string): boolean {
  const out = execFileSync("git", ["status", "--porcelain", "--", relPath], {
    cwd: dir,
    encoding: "utf8",
  });
  return out.trim().length > 0;
}

/** A temp dir that is ALSO a git repo — every fixture in this file either needs real git
 *  commits (checks #2/#3b) or simply ignores git being there (checks #1/#3a). */
function withTempDir(fn: (dir: string) => void): void {
  const dir = initGitRepo();
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ============================================================================================
// parseFrontmatter — the house tolerant parser
// ============================================================================================

describe("parseFrontmatter", () => {
  test("returns null when there is no leading --- block", () => {
    expect(
      parseFrontmatter("# just a doc\n\nno frontmatter here\n"),
    ).toBeNull();
  });

  test("parses scalar keys", () => {
    const fm = parseFrontmatter(
      "---\nupdated: 2026-07-05\nstatus: live\n---\n# body\n",
    );
    expect(fm?.raw.updated).toBe("2026-07-05");
    expect(fm?.raw.status).toBe("live");
  });

  test("parses a dash-list under a key", () => {
    const text =
      "---\nupdated: 2026-07-05\ngrounds:\n  - package.json\n  - foo/bar.ts\n---\n";
    const fm = parseFrontmatter(text);
    expect(fm?.lists.grounds).toEqual(["package.json", "foo/bar.ts"]);
  });

  test("parses a bracket-list", () => {
    const fm = parseFrontmatter("---\ngrounds: [a.ts, b.ts]\n---\n");
    expect(fm?.lists.grounds).toEqual(["a.ts", "b.ts"]);
  });

  test("missing keys are simply absent, not thrown", () => {
    const fm = parseFrontmatter("---\nstatus: live\n---\n");
    expect(fm?.raw.updated).toBeUndefined();
    expect(fm?.lists.grounds).toBeUndefined();
  });
});

// ============================================================================================
// Check #1 — ADR ceiling parity (real fixture dir of ADR filenames)
// ============================================================================================

describe("check #1 — ADR ceiling parity", () => {
  test("maxAdrFromFilenames reads the real max off a fixture directory listing", () => {
    withTempDir((dir) => {
      const decisionsDir = join(dir, "knowledge", "decisions");
      mkdirSync(decisionsDir, { recursive: true });
      for (const name of [
        "ADR-0003-foo.md",
        "ADR-0010-bar.md",
        "ADR-0007-baz.md",
        "README.md",
      ]) {
        writeFileSync(join(decisionsDir, name), "");
      }
      const filenames = readdirSync(decisionsDir) as string[];
      expect(maxAdrFromFilenames(filenames)).toBe(10);
    });
  });

  test("extractCeiling matches both 'Ceiling 0242' and 'Ceiling: ADR-0245' phrasing", () => {
    expect(extractCeiling("blah **Ceiling 0242** (ADR-0242 foo)")).toBe(242);
    expect(
      extractCeiling("Ceiling: ADR-0245, catalog at docs/adr-index.md"),
    ).toBe(245);
  });

  test("green when all four sources agree", () => {
    const sources = extractAdrCeilingSources({
      decisionFilenames: ["ADR-0245-foo.md"],
      claudeMdText: "Ceiling 0245**",
      adrIndexText: "— ceiling 0245**;",
      forksText: "---\nadr_ceiling: 0245\n---\n",
    });
    const result = checkAdrCeilingParity(sources);
    expect(result.status).toBe("green");
  });

  test("drift when CLAUDE.md disagrees with the filesystem", () => {
    const sources = extractAdrCeilingSources({
      decisionFilenames: ["ADR-0245-foo.md"],
      claudeMdText: "Ceiling 0242**",
      adrIndexText: "ceiling 0245**",
      forksText: "---\nadr_ceiling: 0245\n---\n",
    });
    const result = checkAdrCeilingParity(sources);
    expect(result.status).toBe("drift");
    expect(result.details.join("\n")).toContain("ceiling sources disagree");
  });

  test("drift with a clear message when decisions-and-forks.md has no frontmatter at all", () => {
    const sources = extractAdrCeilingSources({
      decisionFilenames: ["ADR-0245-foo.md"],
      claudeMdText: "Ceiling 0245**",
      adrIndexText: "ceiling 0245**",
      forksText: "# Decisions & Forks — live board\n\nno frontmatter here\n",
    });
    const result = checkAdrCeilingParity(sources);
    expect(result.status).toBe("drift");
    expect(
      result.details.some(
        (d) => d.includes("adr_ceiling") && d.includes("MISSING"),
      ),
    ).toBe(true);
  });

  test("--update suggests fixing every source that disagrees with the filesystem truth", () => {
    const sources = extractAdrCeilingSources({
      decisionFilenames: ["ADR-0245-foo.md"],
      claudeMdText: "Ceiling 0242**",
      adrIndexText: "ceiling 0245**",
      forksText: "---\nadr_ceiling: 0240\n---\n",
    });
    const suggestions = buildCeilingEditSuggestions(sources, {
      claudeMd: "Ceiling 0242**",
      adrIndex: "ceiling 0245**",
      forks: "---\nadr_ceiling: 0240\n---\n",
    });
    expect(suggestions.map((s) => s.file)).toEqual([
      "CLAUDE.md",
      "docs/state/decisions-and-forks.md",
    ]);
    expect(suggestions[0]?.suggestion).toContain("0245");
  });
});

// ============================================================================================
// Check #2 — frontmatter freshness (real git repo, controlled commit dates)
// ============================================================================================

describe("check #2 — frontmatter freshness", () => {
  test("green: grounds file's last commit is at/before the doc's updated: date", () => {
    withTempDir((dir) => {
      commitFile(dir, "src.ts", "old", "2026-01-01T00:00:00");
      const doc: FrontmatterDoc = {
        path: "doc.md",
        text: "---\nupdated: 2026-01-02\ngrounds:\n  - src.ts\n---\n",
      };
      const findings = checkDocFreshness(
        doc,
        (p) => existsSync(join(dir, p)),
        (p) => gitLastCommitDate(dir, p),
      );
      expect(findings).toEqual([]);
      const result = checkFrontmatterFreshness(
        [doc],
        (p) => existsSync(join(dir, p)),
        (p) => gitLastCommitDate(dir, p),
      );
      expect(result.status).toBe("green");
    });
  });

  test("drift: grounds file committed after the doc's updated: date", () => {
    withTempDir((dir) => {
      commitFile(dir, "src.ts", "v1", "2026-01-01T00:00:00");
      commitFile(dir, "src.ts", "v2", "2026-06-01T00:00:00"); // newer than updated below
      const doc: FrontmatterDoc = {
        path: "doc.md",
        text: "---\nupdated: 2026-01-02\ngrounds:\n  - src.ts\n---\n",
      };
      const result = checkFrontmatterFreshness(
        [doc],
        (p) => existsSync(join(dir, p)),
        (p) => gitLastCommitDate(dir, p),
      );
      expect(result.status).toBe("drift");
      expect(result.details[0]).toContain("2026-06-01");

      const suggestions = buildFreshnessEditSuggestions(
        [doc],
        (p) => existsSync(join(dir, p)),
        (p) => gitLastCommitDate(dir, p),
      );
      expect(suggestions).toEqual([
        { file: "doc.md", line: 2, suggestion: "updated: 2026-06-01" },
      ]);
    });
  });

  test("drift: a dead grounds pointer (nonexistent path)", () => {
    withTempDir((dir) => {
      const doc: FrontmatterDoc = {
        path: "doc.md",
        text: "---\nupdated: 2026-01-02\ngrounds:\n  - does/not/exist.ts\n---\n",
      };
      const result = checkFrontmatterFreshness(
        [doc],
        (p) => existsSync(join(dir, p)),
        (p) => gitLastCommitDate(dir, p),
      );
      expect(result.status).toBe("drift");
      expect(result.details[0]).toContain("does not exist");
    });
  });

  test("not checked (returns null) when grounds: is missing", () => {
    const doc: FrontmatterDoc = {
      path: "doc.md",
      text: "---\nupdated: 2026-01-02\n---\n",
    };
    expect(
      checkDocFreshness(
        doc,
        () => true,
        () => null,
      ),
    ).toBeNull();
  });
});

// ============================================================================================
// Check #3 — archive integrity
// ============================================================================================

describe("check #3 — archive integrity", () => {
  test("3a fires: a status:live doc linking docs/archive/ directly", () => {
    const doc: FrontmatterDoc = {
      path: "docs/state/foo.md",
      text: "---\nupdated: 2026-07-05\nstatus: live\n---\nSee [old](../archive/foo.md).\n",
    };
    expect(checkLiveDocArchiveLink(doc)).toEqual([
      "docs/state/foo.md: status: live but links docs/archive/ directly — link the docs/state/ tombstone instead",
    ]);
  });

  test("3a green: a status:live doc with no archive link", () => {
    const doc: FrontmatterDoc = {
      path: "docs/state/foo.md",
      text: "---\nupdated: 2026-07-05\nstatus: live\n---\nNo archive links here.\n",
    };
    expect(checkLiveDocArchiveLink(doc)).toEqual([]);
  });

  test("3a does not fire for a tombstone (status: archived) that links the archive", () => {
    const doc: FrontmatterDoc = {
      path: "docs/state/foo.md",
      text: "---\nupdated: 2026-07-05\nstatus: archived\n---\nSee [old](../archive/foo.md).\n",
    };
    expect(checkLiveDocArchiveLink(doc)).toEqual([]);
  });

  test("3b fires: an archived doc committed again after its own updated: date", () => {
    withTempDir((dir) => {
      commitFile(
        dir,
        "docs/archive/foo.md",
        "---\nupdated: 2026-01-01\nstatus: archived\n---\nv1\n",
        "2026-01-01T00:00:00",
      );
      // Immutable docs shouldn't be re-committed — simulate exactly that drift.
      commitFile(
        dir,
        "docs/archive/foo.md",
        "---\nupdated: 2026-01-01\nstatus: archived\n---\nv2 edited after archiving\n",
        "2026-02-01T00:00:00",
      );
      const doc: FrontmatterDoc = {
        path: "docs/archive/foo.md",
        text: readFileSync(join(dir, "docs/archive/foo.md"), "utf8"),
      };
      const details = checkArchivedDocImmutable(
        doc,
        (p) => gitHasUncommitted(dir, p),
        (p) => gitLastCommitDate(dir, p),
      );
      expect(details.some((d) => d.includes("after its own updated"))).toBe(
        true,
      );
    });
  });

  test("3b fires: an archived doc with an uncommitted (working-tree) modification", () => {
    withTempDir((dir) => {
      commitFile(
        dir,
        "docs/archive/foo.md",
        "---\nupdated: 2026-01-01\nstatus: archived\n---\nv1\n",
        "2026-01-01T00:00:00",
      );
      writeFileSync(
        join(dir, "docs/archive/foo.md"),
        "---\nupdated: 2026-01-01\nstatus: archived\n---\nedited\n",
      );
      const doc: FrontmatterDoc = {
        path: "docs/archive/foo.md",
        text: readFileSync(join(dir, "docs/archive/foo.md"), "utf8"),
      };
      const details = checkArchivedDocImmutable(
        doc,
        (p) => gitHasUncommitted(dir, p),
        (p) => gitLastCommitDate(dir, p),
      );
      expect(details.some((d) => d.includes("uncommitted modifications"))).toBe(
        true,
      );
    });
  });

  test("3b green: an archived doc committed once, untouched since", () => {
    withTempDir((dir) => {
      commitFile(
        dir,
        "docs/archive/foo.md",
        "---\nupdated: 2026-01-01\nstatus: archived\n---\nv1\n",
        "2026-01-01T00:00:00",
      );
      const doc: FrontmatterDoc = {
        path: "docs/archive/foo.md",
        text: readFileSync(join(dir, "docs/archive/foo.md"), "utf8"),
      };
      const details = checkArchivedDocImmutable(
        doc,
        (p) => gitHasUncommitted(dir, p),
        (p) => gitLastCommitDate(dir, p),
      );
      expect(details).toEqual([]);
    });
  });

  test("aggregate checkArchiveIntegrity combines (a) and (b) into one CheckResult", () => {
    const liveDoc: FrontmatterDoc = {
      path: "docs/state/foo.md",
      text: "---\nupdated: 2026-07-05\nstatus: live\n---\nSee [old](../archive/foo.md).\n",
    };
    const result = checkArchiveIntegrity(
      [liveDoc],
      [],
      () => false,
      () => null,
    );
    expect(result.status).toBe("drift");
    expect(result.id).toBe("archive-integrity");
  });
});

// ============================================================================================
// Check #4 — branch hygiene (real git repo with real branches)
// ============================================================================================

describe("check #4 — branch hygiene", () => {
  test("drift: an extra local branch besides main + current", () => {
    const dir = initGitRepo();
    try {
      commitFile(dir, "README.md", "hi", "2026-01-01T00:00:00");
      execFileSync("git", ["branch", "feature/extra"], { cwd: dir });
      const branches = execFileSync(
        "git",
        ["branch", "--format=%(refname:short)"],
        {
          cwd: dir,
          encoding: "utf8",
        },
      )
        .split("\n")
        .map((b) => b.trim())
        .filter(Boolean);
      const result = computeBranchHygiene(branches, "main", [], dir);
      expect(result.status).toBe("drift");
      expect(result.details[0]).toContain("feature/extra");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("green: only main + the current branch exist", () => {
    const dir = initGitRepo();
    try {
      commitFile(dir, "README.md", "hi", "2026-01-01T00:00:00");
      const branches = execFileSync(
        "git",
        ["branch", "--format=%(refname:short)"],
        {
          cwd: dir,
          encoding: "utf8",
        },
      )
        .split("\n")
        .map((b) => b.trim())
        .filter(Boolean);
      const result = computeBranchHygiene(branches, "main", [], dir);
      expect(result.status).toBe("green");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("parseWorktreeList parses `git worktree list --porcelain` output", () => {
    const porcelain = [
      "worktree /repo/main",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /repo/wt-a",
      "HEAD def456",
      "branch refs/heads/feature/a",
      "",
    ].join("\n");
    expect(parseWorktreeList(porcelain)).toEqual([
      { path: "/repo/main", branch: "refs/heads/main" },
      { path: "/repo/wt-a", branch: "refs/heads/feature/a" },
    ]);
  });

  test("drift: an extra worktree beyond main + current", () => {
    const worktrees = parseWorktreeList(
      [
        "worktree /repo/main",
        "branch refs/heads/main",
        "",
        "worktree /repo/current",
        "branch refs/heads/feat/x",
        "",
        "worktree /repo/other",
        "branch refs/heads/feat/y",
        "",
      ].join("\n"),
    );
    const result = computeBranchHygiene(
      ["main", "feat/x", "feat/y"],
      "feat/x",
      worktrees,
      "/repo/current",
    );
    expect(result.status).toBe("drift");
    expect(result.details[1]).toContain("/repo/other");
  });
});

// ============================================================================================
// Check #5 — tracker vs reality (pure — fixture tracker text + fixture PR-state map)
// ============================================================================================

describe("check #5 — tracker vs reality", () => {
  const tracker = [
    "## Operator-owed",
    "| Row | PR |",
    "| launch thing | PR #100 |",
    "",
    "## Build-gated",
    "| another row | PR #200 |",
    "",
    "## Recently closed",
    "| done already | PR #300 |",
  ].join("\n");

  test("extractTrackerPrRefs only collects refs from tracked buckets, not Recently closed", () => {
    const refs = extractTrackerPrRefs(tracker);
    expect(refs.map((r) => r.pr)).toEqual([100, 200]);
  });

  test("extractTrackerPrRefs ignores bare #NN tokens that are not PR citations", () => {
    const withNonPr = [
      "## Build-gated",
      "| hygiene rows #4 / #5 / #10 changesets policy | ADR-0233 |",
      "## Trigger-parked",
      "| wave rows (e.g. #23 BYOK · #29 minimization · #64 UI); research #11 | ADR-0239 |",
    ].join("\n");
    expect(extractTrackerPrRefs(withNonPr)).toEqual([]);
  });

  test("extractTrackerPrRefs reads a `PRs #a, #b` list and a `PRs #a–#b` range", () => {
    const withList = [
      "## Build-gated",
      "| shipped | PRs #110, #120 and PRs #130–#132 |",
    ].join("\n");
    expect(extractTrackerPrRefs(withList).map((r) => r.pr)).toEqual([
      110, 120, 130, 132,
    ]);
  });

  test("drift: a tracked-bucket row cites a PR that is already MERGED", () => {
    const refs = extractTrackerPrRefs(tracker);
    const states = new Map([
      [100, "MERGED"],
      [200, "OPEN"],
    ]);
    const details = findStaleTrackerRefs(refs, states);
    expect(details).toEqual([
      '#100 in "Operator-owed" (line 3) is already MERGED on GitHub — tracker row is stale',
    ]);

    const suggestions = buildTrackerEditSuggestions(
      refs,
      states,
      "docs/state/outstanding-work.md",
    );
    expect(suggestions).toEqual([
      {
        file: "docs/state/outstanding-work.md",
        line: 3,
        suggestion:
          'move the row citing #100 (MERGED) from "Operator-owed" to Recently-closed',
      },
    ]);
  });

  test("green: all tracked-bucket PRs are still open", () => {
    const refs = extractTrackerPrRefs(tracker);
    const states = new Map([
      [100, "OPEN"],
      [200, "OPEN"],
    ]);
    expect(findStaleTrackerRefs(refs, states)).toEqual([]);
  });
});

// ============================================================================================
// Check #6 — changeset gate preflight (pure — synthetic exec outcomes)
// ============================================================================================

describe("check #6 — changeset gate preflight", () => {
  test("green: changeset status exits clean", () => {
    const result = evaluateChangesetOutcome({
      ok: true,
      stdout: "No unreleased changesets found.\n",
    });
    expect(result.status).toBe("green");
  });

  test("drift: changeset status reports a package missing a changeset", () => {
    const result = evaluateChangesetOutcome({
      ok: false,
      unavailable: false,
      stdout: "",
      stderr:
        "🦋  error Some packages have been changed but no changesets were found",
    });
    expect(result.status).toBe("drift");
    expect(result.details[0]).toContain("no changesets were found");
  });

  test("skip: bunx/changeset unavailable, never reported as an error", () => {
    const result = evaluateChangesetOutcome({ ok: false, unavailable: true });
    expect(result.status).toBe("skip");
  });
});

// ============================================================================================
// Check #7 — package count parity (pure — fixture disk counts + fixture doc text)
// ============================================================================================

describe("check #7 — package count parity", () => {
  test("computePackageCounts splits src vs test files and sums src-only LOC", () => {
    const counts = computePackageCounts([
      { isTest: false, lines: 100 },
      { isTest: false, lines: 50 },
      { isTest: true, lines: 0 },
      { isTest: true, lines: 0 },
    ]);
    expect(counts).toEqual({ src: 2, tests: 2, loc: 150 });
  });

  test("extractDocPackageRows reads a 3-tuple src/tests/loc cell, with its 1-based line", () => {
    const text = [
      "# doc",
      "",
      "| Package  | src / tests / loc | Verdict |",
      "| -------- | ------------------ | ------- |",
      "| `kernel` | 13 / 10 / 1427     | built   |",
    ].join("\n");
    const rows = extractDocPackageRows(text);
    expect(rows).toEqual([
      { pkg: "kernel", line: 5, src: 13, tests: 10, loc: 1427 },
    ]);
  });

  test("extractDocPackageRows tolerates trailing annotation text before the next pipe", () => {
    const text = "| `registry-schema` (`packages/`) | 5 / 5 / — | built |";
    const rows = extractDocPackageRows(text);
    expect(rows).toEqual([
      { pkg: "registry-schema", line: 1, src: 5, tests: 5, loc: null },
    ]);
  });

  test("extractDocPackageRows treats an em-dash loc cell as null, not a parse error", () => {
    const rows = extractDocPackageRows("| `pricebook` | 4 / 3 / — | built |");
    expect(rows[0]?.loc).toBeNull();
  });

  test("diffPackageCounts: green when disk matches the doc row exactly", () => {
    const disk = new Map<string, PackageCounts>([
      ["kernel", { src: 13, tests: 10, loc: 1427 }],
    ]);
    const findings = diffPackageCounts(disk, [
      { pkg: "kernel", line: 5, src: 13, tests: 10, loc: 1427 },
    ]);
    expect(findings).toEqual([]);
  });

  test("diffPackageCounts: stale when any of src/tests/loc disagree", () => {
    const disk = new Map<string, PackageCounts>([
      ["ai-evals", { src: 12, tests: 7, loc: 1323 }],
    ]);
    const findings = diffPackageCounts(disk, [
      { pkg: "ai-evals", line: 433, src: 6, tests: 1, loc: 800 },
    ]);
    expect(findings).toEqual([
      {
        pkg: "ai-evals",
        line: 433,
        kind: "stale",
        detail:
          "docs/build-state.md:433 `ai-evals` says 6 / 1 / 800, disk truth is 12 / 7 / 1323",
      },
    ]);
  });

  test("diffPackageCounts: a null doc loc cell never triggers stale on its own", () => {
    const disk = new Map<string, PackageCounts>([
      ["pricebook", { src: 4, tests: 3, loc: 523 }],
    ]);
    const findings = diffPackageCounts(disk, [
      { pkg: "pricebook", line: 385, src: 4, tests: 3, loc: null },
    ]);
    expect(findings).toEqual([]);
  });

  test("diffPackageCounts: a disk package with no doc row is missing-row, not a crash", () => {
    const disk = new Map<string, PackageCounts>([
      ["rate-limit", { src: 4, tests: 3, loc: 432 }],
    ]);
    const findings = diffPackageCounts(disk, []);
    expect(findings).toEqual([
      {
        pkg: "rate-limit",
        line: 0,
        kind: "missing-row",
        detail:
          "packages/rate-limit: on disk (4 / 3 / 432) but no matching row in docs/build-state.md",
      },
    ]);
  });

  test("diffPackageCounts: a doc row whose package dir is gone is dead-row", () => {
    const findings = diffPackageCounts(new Map(), [
      { pkg: "retired-pkg", line: 400, src: 1, tests: 1, loc: 10 },
    ]);
    expect(findings).toEqual([
      {
        pkg: "retired-pkg",
        line: 400,
        kind: "dead-row",
        detail:
          "docs/build-state.md:400 `retired-pkg` has a row but packages/retired-pkg no longer exists on disk",
      },
    ]);
  });

  test("checkPackageCountParity: green (missing-row is info, not drift) when nothing is stale/dead", () => {
    const disk = new Map<string, PackageCounts>([
      ["kernel", { src: 13, tests: 10, loc: 1427 }],
      ["rate-limit", { src: 4, tests: 3, loc: 432 }],
    ]);
    const doc = "| `kernel` | 13 / 10 / 1427 | built |";
    const result = checkPackageCountParity(disk, doc);
    expect(result.status).toBe("green");
    expect(result.details.some((d) => d.includes("rate-limit"))).toBe(true);
  });

  test("checkPackageCountParity: drift when a cell is stale", () => {
    const disk = new Map<string, PackageCounts>([
      ["ai-evals", { src: 12, tests: 7, loc: 1323 }],
    ]);
    const doc = "| `ai-evals` | 6 / 1 / 800 | built |";
    const result = checkPackageCountParity(disk, doc);
    expect(result.status).toBe("drift");
  });

  test("buildPackageCountEditSuggestions emits a corrected cell only for stale rows", () => {
    const disk = new Map<string, PackageCounts>([
      ["ai-evals", { src: 12, tests: 7, loc: 1323 }],
      ["kernel", { src: 13, tests: 10, loc: 1427 }],
    ]);
    const doc = [
      "| `ai-evals` | 6 / 1 / 800 | built |",
      "| `kernel` | 13 / 10 / 1427 | built |",
    ].join("\n");
    const suggestions = buildPackageCountEditSuggestions(
      disk,
      doc,
      "docs/build-state.md",
    );
    expect(suggestions).toEqual([
      {
        file: "docs/build-state.md",
        line: 1,
        suggestion: "`ai-evals` row -> 12 / 7 / 1323",
      },
    ]);
  });
});

// ============================================================================================
// frontmatterKeyLine + reporting smoke tests
// ============================================================================================

describe("frontmatterKeyLine", () => {
  test("finds the 1-based line of a top-level key", () => {
    expect(
      frontmatterKeyLine(
        "---\nupdated: 2026-07-05\ngrounds:\n  - a\n---\n",
        "grounds",
      ),
    ).toBe(3);
  });

  test("returns null when the key is absent", () => {
    expect(
      frontmatterKeyLine("---\nstatus: live\n---\n", "updated"),
    ).toBeNull();
  });
});

describe("printResults / printEditChecklist", () => {
  test("printResults renders status + id + details for every check", () => {
    const chunks: string[] = [];
    printResults(
      [
        { id: "adr-ceiling-parity", status: "green", details: ["all agree"] },
        {
          id: "branch-hygiene",
          status: "drift",
          details: ["feature/x exists"],
        },
      ],
      (s) => chunks.push(s),
    );
    const out = chunks.join("");
    expect(out).toContain("[GREEN] adr-ceiling-parity");
    expect(out).toContain("[DRIFT] branch-hygiene");
    expect(out).toContain("feature/x exists");
  });

  test("printEditChecklist renders file:line -> suggestion", () => {
    const chunks: string[] = [];
    printEditChecklist(
      [
        {
          file: "CLAUDE.md",
          line: 25,
          suggestion: "ceiling reference -> ADR-0245",
        },
      ],
      (s) => chunks.push(s),
    );
    expect(chunks.join("")).toContain(
      "CLAUDE.md:25 -> ceiling reference -> ADR-0245",
    );
  });

  test("printEditChecklist notes there is nothing to suggest when the list is empty", () => {
    const chunks: string[] = [];
    printEditChecklist([], (s) => chunks.push(s));
    expect(chunks.join("")).toContain("nothing to suggest");
  });
});

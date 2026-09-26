// Session-automation SOT drift report — the one `bun run sot` command from
// outputs/specs/sot-expansion/SPEC.md §2. Sibling of `vault-parity-check.ts` /
// `railway-env-sync.ts`.
//
// ADVISORY BY DESIGN: prints a drift report, exits 1 on any drift, 0 when green. NEVER
// writes a file — the never-auto-decide law extends to docs (the tool detects, the
// session author fixes). `--update` additionally prints a ready-to-apply edit checklist
// (file + line + suggested new value) for checks #1/#2/#5/#7 — still never writes.
//
// Eight checks (SPEC §2 table + ADR-0253's #7 + the 2026-07-11 docs-surface #8), each a
// pure function over already-gathered
// data + an
// impure gatherer that gets that data from the filesystem/git/gh/bunx. A `gh`- or
// `bunx`-dependent check that can't reach its tool/network degrades to `skip`, never an
// error.
//
// Usage: bun tooling/scripts/sot-check.ts [--update]
// Exit: 0 = green (or all-skip); 1 = drift on any check.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..", "..");

export type CheckStatus = "green" | "drift" | "skip";

export interface CheckResult {
  id: string;
  status: CheckStatus;
  details: string[];
}

export interface EditSuggestion {
  file: string;
  line: number | null;
  suggestion: string;
}

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

function lineNumberAt(text: string, index: number): number | null {
  if (index < 0) return null;
  let line = 1;
  for (let i = 0; i < index; i++) if (text[i] === "\n") line++;
  return line;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n… (truncated)` : text;
}

// ============================================================================================
// Pure: the house tolerant frontmatter parser (no YAML dependency)
// ============================================================================================

export interface Frontmatter {
  raw: Record<string, string>;
  lists: Record<string, string[]>;
}

function stripQuotes(s: string): string {
  const m = /^["'](.*)["']$/.exec(s);
  return m ? (m[1] as string) : s;
}

/** Tolerant line-based parser for the house frontmatter shape:
 *  `key: value`, `key:` followed by a `- item` dash-list, or `key: [a, b, c]`. Returns
 *  null when the text has no leading `---`/`---` block at all. */
export function parseFrontmatter(text: string): Frontmatter | null {
  const lines = text.split("\n");
  if ((lines[0] ?? "").trim() !== "---") return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if ((lines[i] ?? "").trim() === "---") {
      end = i;
      break;
    }
  }
  if (end < 0) return null;

  const raw: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  let currentListKey: string | null = null;

  for (const line of lines.slice(1, end)) {
    const dash = /^\s*-\s*(.+)$/.exec(line);
    if (dash && currentListKey) {
      const arr = lists[currentListKey] ?? [];
      arr.push(stripQuotes(dash[1]!.trim()));
      lists[currentListKey] = arr;
      continue;
    }
    const kv = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1] as string;
    const value = (kv[2] as string).trim();
    if (value === "") {
      currentListKey = key;
      continue;
    }
    currentListKey = null;
    const bracket = /^\[(.*)\]$/.exec(value);
    if (bracket) {
      lists[key] = (bracket[1] as string)
        .split(",")
        .map((s) => stripQuotes(s.trim()))
        .filter((s) => s.length > 0);
      continue;
    }
    raw[key] = stripQuotes(value);
  }
  return { raw, lists };
}

/** Line number (1-based) of a top-level `key:` line inside the frontmatter block, or null
 *  if the key never appears. */
export function frontmatterKeyLine(text: string, key: string): number | null {
  const re = new RegExp(`^${key}\\s*:`, "m");
  const m = re.exec(text);
  return m ? lineNumberAt(text, m.index) : null;
}

// ============================================================================================
// Check #1 — ADR ceiling parity
// ============================================================================================

const ADR_FILENAME_RE = /^ADR-(\d{4})-/;
// Tolerates the three phrasings actually in use: "Ceiling: ADR-0414" (CLAUDE.md),
// "ADR ceiling: 0414" (adr-index), and "ADR ceiling is `0401`" (build-state — the `is` and the
// backticks are why this file's drift was invisible to an earlier, tighter pattern). Verified
// behaviour-identical on the pre-existing three sources; "ADR-ceiling parity" still does not match.
const CEILING_RE = /ceiling(?:\s+is)?[:\s`*]*(?:ADR-)?(\d{4})/i;

export function maxAdrFromFilenames(
  filenames: readonly string[],
): number | null {
  let max: number | null = null;
  for (const f of filenames) {
    const m = ADR_FILENAME_RE.exec(f);
    if (!m) continue;
    const n = Number(m[1]);
    if (max === null || n > max) max = n;
  }
  return max;
}

export function extractCeiling(text: string): number | null {
  const m = CEILING_RE.exec(text);
  return m ? Number(m[1]) : null;
}

export interface AdrCeilingSources {
  filesystem: number | null;
  claudeMd: number | null;
  adrIndex: number | null;
  forks: number | null;
  /**
   * docs/build-state.md — source-of-truth #4. Added 2026-08-25 after it sat at ADR-0401 while the
   * other four agreed at 0414. It passed frontmatter-freshness the whole time (its `updated:`
   * stamp matched its own last commit) because that check proves a file was TOUCHED, not that its
   * prose is true. A ceiling stated in a file this gate does not read is a ceiling that can drift
   * silently, so the fix is to read every file that states one.
   */
  buildState: number | null;
}

export function extractAdrCeilingSources(input: {
  decisionFilenames: readonly string[];
  claudeMdText: string;
  adrIndexText: string;
  forksText: string;
  buildStateText: string;
}): AdrCeilingSources {
  const forksFm = parseFrontmatter(input.forksText);
  const forksRaw = forksFm?.raw.adr_ceiling;
  return {
    filesystem: maxAdrFromFilenames(input.decisionFilenames),
    claudeMd: extractCeiling(input.claudeMdText),
    adrIndex: extractCeiling(input.adrIndexText),
    forks: forksRaw ? Number(forksRaw) : null,
    buildState: extractCeiling(input.buildStateText),
  };
}

const CEILING_SOURCE_LABELS: readonly [
  key: keyof AdrCeilingSources,
  label: string,
][] = [
  ["filesystem", "filesystem (knowledge/decisions/)"],
  ["claudeMd", "CLAUDE.md"],
  ["adrIndex", "docs/adr-index.md"],
  ["forks", "docs/state/decisions-and-forks.md frontmatter adr_ceiling"],
  ["buildState", "docs/build-state.md"],
];

export function checkAdrCeilingParity(sources: AdrCeilingSources): CheckResult {
  const id = "adr-ceiling-parity";
  const details = CEILING_SOURCE_LABELS.map(
    ([key, label]) =>
      `${label}: ${sources[key] === null ? "MISSING" : `ADR-${pad4(sources[key] as number)}`}`,
  );
  const present = CEILING_SOURCE_LABELS.map(([key]) => sources[key]).filter(
    (n): n is number => n !== null,
  );
  const anyMissing = present.length < CEILING_SOURCE_LABELS.length;
  const allAgree = present.length > 0 && present.every((n) => n === present[0]);

  if (anyMissing) {
    return {
      id,
      status: "drift",
      details: [
        ...details,
        "one or more ceiling sources could not be determined",
      ],
    };
  }
  if (!allAgree) {
    return {
      id,
      status: "drift",
      details: [...details, "ceiling sources disagree"],
    };
  }
  return { id, status: "green", details };
}

/** Filesystem is treated as ground truth (the ADR files are the actual decisions) — a
 *  suggestion is emitted for every other source that disagrees with it. */
export function buildCeilingEditSuggestions(
  sources: AdrCeilingSources,
  texts: {
    claudeMd: string;
    adrIndex: string;
    forks: string;
    buildState: string;
  },
): EditSuggestion[] {
  const truth = sources.filesystem;
  if (truth === null) return [];
  const suggestions: EditSuggestion[] = [];
  if (sources.claudeMd !== truth) {
    const m = CEILING_RE.exec(texts.claudeMd);
    suggestions.push({
      file: "CLAUDE.md",
      line: m ? lineNumberAt(texts.claudeMd, m.index) : null,
      suggestion: `ceiling reference -> ADR-${pad4(truth)}`,
    });
  }
  if (sources.adrIndex !== truth) {
    const m = CEILING_RE.exec(texts.adrIndex);
    suggestions.push({
      file: "docs/adr-index.md",
      line: m ? lineNumberAt(texts.adrIndex, m.index) : null,
      suggestion: `ceiling reference -> ${pad4(truth)}`,
    });
  }
  if (sources.forks !== truth) {
    suggestions.push({
      file: "docs/state/decisions-and-forks.md",
      line: frontmatterKeyLine(texts.forks, "adr_ceiling"),
      suggestion: `adr_ceiling: ${pad4(truth)}`,
    });
  }
  if (sources.buildState !== truth) {
    const m = CEILING_RE.exec(texts.buildState);
    suggestions.push({
      file: "docs/build-state.md",
      line: m ? lineNumberAt(texts.buildState, m.index) : null,
      suggestion: `ceiling reference -> ${pad4(truth)}`,
    });
  }
  return suggestions;
}

// ============================================================================================
// Check #2 — frontmatter freshness
// ============================================================================================

export interface FrontmatterDoc {
  /** repo-relative path, used for display + as the git-log target for its own commits */
  path: string;
  text: string;
}

export interface FreshnessFinding {
  file: string;
  groundsPath: string;
  kind: "stale" | "dead-pointer";
  detail: string;
}

/** Findings for ONE doc. A doc with no `updated:` stamp is not checked — returns null.
 *  A doc WITH a stamp is always checked against its OWN last commit (ADR-0395 §4: a doc
 *  edited today and left stamped last week used to pass clean, because only `grounds:`
 *  paths were ever compared — and the docs that drifted worst carry no `grounds:` at all).
 *  The `grounds:` comparison still requires a `grounds:` key. */
export function checkDocFreshness(
  doc: FrontmatterDoc,
  pathExists: (relPath: string) => boolean,
  lastCommitDate: (relPath: string) => string | null,
): FreshnessFinding[] | null {
  const fm = parseFrontmatter(doc.text);
  if (!fm) return null;
  const updated = fm.raw.updated;
  if (!updated) return null;

  const findings: FreshnessFinding[] = [];
  // `groundsPath` is the doc itself here on purpose: it makes buildFreshnessEditSuggestions
  // resolve the corrected stamp from the doc's own commit date with no extra branch.
  const ownCommit = lastCommitDate(doc.path);
  if (ownCommit && ownCommit > updated) {
    findings.push({
      file: doc.path,
      groundsPath: doc.path,
      kind: "stale",
      detail: `${doc.path}: last committed ${ownCommit}, but its own updated: says ${updated}`,
    });
  }

  const grounds = fm.lists.grounds;
  if (!grounds || grounds.length === 0) return findings;

  for (const g of grounds) {
    if (g.startsWith("http://") || g.startsWith("https://")) continue;
    if (!pathExists(g)) {
      findings.push({
        file: doc.path,
        groundsPath: g,
        kind: "dead-pointer",
        detail: `${doc.path}: grounds path "${g}" does not exist`,
      });
      continue;
    }
    const commitDate = lastCommitDate(g);
    if (commitDate && commitDate > updated) {
      findings.push({
        file: doc.path,
        groundsPath: g,
        kind: "stale",
        detail: `${doc.path}: grounds "${g}" committed ${commitDate}, doc says updated: ${updated}`,
      });
    }
  }
  return findings;
}

export function checkFrontmatterFreshness(
  docs: readonly FrontmatterDoc[],
  pathExists: (relPath: string) => boolean,
  lastCommitDate: (relPath: string) => string | null,
): CheckResult {
  const id = "frontmatter-freshness";
  const all: FreshnessFinding[] = [];
  for (const doc of docs) {
    const findings = checkDocFreshness(doc, pathExists, lastCommitDate);
    if (findings) all.push(...findings);
  }
  if (all.length === 0) {
    return {
      id,
      status: "green",
      details: [
        "every doc and its grounds paths are at or before that doc's updated: date",
      ],
    };
  }
  return { id, status: "drift", details: all.map((f) => f.detail) };
}

export function buildFreshnessEditSuggestions(
  docs: readonly FrontmatterDoc[],
  pathExists: (relPath: string) => boolean,
  lastCommitDate: (relPath: string) => string | null,
): EditSuggestion[] {
  const suggestions: EditSuggestion[] = [];
  for (const doc of docs) {
    const findings = checkDocFreshness(doc, pathExists, lastCommitDate);
    if (!findings || findings.length === 0) continue;
    const staleDates = findings
      .filter(
        (f): f is FreshnessFinding & { kind: "stale" } => f.kind === "stale",
      )
      .map((f) => lastCommitDate(f.groundsPath))
      .filter((d): d is string => d !== null)
      .sort();
    const updatedLine = frontmatterKeyLine(doc.text, "updated");
    if (staleDates.length > 0) {
      suggestions.push({
        file: doc.path,
        line: updatedLine,
        suggestion: `updated: ${staleDates[staleDates.length - 1]}`,
      });
    }
    for (const f of findings.filter((f) => f.kind === "dead-pointer")) {
      suggestions.push({
        file: doc.path,
        line: frontmatterKeyLine(doc.text, "grounds"),
        suggestion: `remove or fix dead grounds entry "${f.groundsPath}"`,
      });
    }
  }
  return suggestions;
}

// ============================================================================================
// Check #3 — archive integrity
// ============================================================================================

// Matches a link/path pointing at the archive dir regardless of vantage point: `docs/archive/`
// (repo-root-relative mentions) or `../archive/` / `./archive/` (relative from inside docs/).
// (a) RETIRED 2026-07-11 (state-folder reorg): live docs now link docs/archive/ directly.
// The tombstone-indirection rule died when the stubs moved to docs/archive/tombstones/ —
// checkLiveDocArchiveLink removed; (b) archived-doc immutability below is unchanged.

/** (b) a file under docs/archive/ is immutable: no uncommitted modification, and no
 *  commit newer than its own frontmatter updated: date. */
export function checkArchivedDocImmutable(
  doc: FrontmatterDoc,
  hasUncommittedChanges: (relPath: string) => boolean,
  lastCommitDate: (relPath: string) => string | null,
): string[] {
  const fm = parseFrontmatter(doc.text);
  if (!fm || fm.raw.status !== "archived") return [];
  const details: string[] = [];
  if (hasUncommittedChanges(doc.path)) {
    details.push(`${doc.path}: archived doc has uncommitted modifications`);
  }
  const updated = fm.raw.updated;
  const commitDate = lastCommitDate(doc.path);
  if (updated && commitDate && commitDate > updated) {
    details.push(
      `${doc.path}: archived doc committed ${commitDate}, after its own updated: ${updated}`,
    );
  }
  return details;
}

export function checkArchiveIntegrity(
  archivedDocs: readonly FrontmatterDoc[],
  hasUncommittedChanges: (relPath: string) => boolean,
  lastCommitDate: (relPath: string) => string | null,
): CheckResult {
  const id = "archive-integrity";
  const details: string[] = [];
  for (const doc of archivedDocs) {
    details.push(
      ...checkArchivedDocImmutable(doc, hasUncommittedChanges, lastCommitDate),
    );
  }
  if (details.length === 0) {
    return {
      id,
      status: "green",
      details: ["archived docs unmodified"],
    };
  }
  return { id, status: "drift", details };
}

// ============================================================================================
// Check #4 — branch hygiene (advisory listing, not an error tone)
// ============================================================================================

export interface WorktreeEntry {
  path: string;
  branch: string | null;
}

export function parseWorktreeList(text: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let current: Partial<WorktreeEntry> = {};
  for (const line of text.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path)
        entries.push({ path: current.path, branch: current.branch ?? null });
      current = { path: line.slice("worktree ".length).trim() };
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).trim();
    }
  }
  if (current.path)
    entries.push({ path: current.path, branch: current.branch ?? null });
  return entries;
}

export function computeBranchHygiene(
  branches: readonly string[],
  currentBranch: string,
  worktrees: readonly WorktreeEntry[],
  currentPath: string,
): CheckResult {
  const id = "branch-hygiene";
  const extraBranches = branches
    // `git branch` emits parenthesized pseudo-entries — "(HEAD detached at <sha>)", "(no
    // branch)" — in detached-HEAD checkouts (every release-tag CI checkout); they are not
    // local branches and must not read as hygiene drift (first train ride, 2026-07-12).
    .filter((b) => !b.startsWith("("))
    .filter((b) => b !== "main" && b !== currentBranch)
    .sort();
  const mainEntry = worktrees.find((w) => w.branch === "refs/heads/main");
  const extraWorktrees = worktrees.filter(
    (w) => w.path !== currentPath && (!mainEntry || w.path !== mainEntry.path),
  );
  const details = [
    `local branches besides main + current (${currentBranch}): ${
      extraBranches.length ? extraBranches.join(", ") : "(none)"
    }`,
    `worktrees besides main + current: ${
      extraWorktrees.length
        ? extraWorktrees
            .map((w) => `${w.path} [${w.branch ?? "detached"}]`)
            .join(", ")
        : "(none)"
    }`,
  ];
  const status: CheckStatus =
    extraBranches.length > 0 || extraWorktrees.length > 0 ? "drift" : "green";
  return { id, status, details };
}

// ============================================================================================
// Check #5 — tracker vs reality
// ============================================================================================

const TRACKER_HEADER_RE = /^#{1,4}\s+(.+?)\s*$/;
const TRACKED_BUCKET_RE =
  /operator[\s-]owed|build[\s-]gated|trigger[\s-]parked/i;
const RECENTLY_CLOSED_RE = /recently[\s-]closed/i;
// A PR citation is `PR #NN` / `PRs #NN, #NN` / `PRs #NN–#NN` (the repo convention). A bare
// `#NN` is NOT a PR ref — the tracker uses `#NN` for hygiene-row, wave-6-row, and
// `research #NN` item numbers, which must never be probed as PRs (false drift + bad gh calls).
const PR_CLUSTER_RE = /\bPRs?\s+(#\d{2,6}(?:\s*[,–—-]\s*#\d{2,6})*)/gi;
const PR_NUM_RE = /#(\d{2,6})/g;

export interface TrackerPrRef {
  bucket: string;
  pr: number;
  line: number;
}

export function extractTrackerPrRefs(text: string): TrackerPrRef[] {
  const lines = text.split("\n");
  let currentBucket: string | null = null;
  const refs: TrackerPrRef[] = [];
  lines.forEach((line, idx) => {
    const h = TRACKER_HEADER_RE.exec(line);
    if (h) {
      currentBucket = h[1] as string;
      return;
    }
    if (!currentBucket || RECENTLY_CLOSED_RE.test(currentBucket)) return;
    if (!TRACKED_BUCKET_RE.test(currentBucket)) return;
    for (const cluster of line.matchAll(PR_CLUSTER_RE)) {
      for (const m of (cluster[1] as string).matchAll(PR_NUM_RE)) {
        refs.push({ bucket: currentBucket, pr: Number(m[1]), line: idx + 1 });
      }
    }
  });
  return refs;
}

export function findStaleTrackerRefs(
  refs: readonly TrackerPrRef[],
  states: ReadonlyMap<number, string>,
): string[] {
  const details: string[] = [];
  const seen = new Set<string>();
  for (const r of refs) {
    const state = states.get(r.pr);
    if (state !== "MERGED" && state !== "CLOSED") continue;
    const key = `${r.bucket}#${r.pr}`;
    if (seen.has(key)) continue;
    seen.add(key);
    details.push(
      `#${r.pr} in "${r.bucket}" (line ${r.line}) is already ${state} on GitHub — tracker row is stale`,
    );
  }
  return details;
}

export function buildTrackerEditSuggestions(
  refs: readonly TrackerPrRef[],
  states: ReadonlyMap<number, string>,
  trackerPath: string,
): EditSuggestion[] {
  const seen = new Set<number>();
  const suggestions: EditSuggestion[] = [];
  for (const r of refs) {
    const state = states.get(r.pr);
    if ((state !== "MERGED" && state !== "CLOSED") || seen.has(r.pr)) continue;
    seen.add(r.pr);
    suggestions.push({
      file: trackerPath,
      line: r.line,
      suggestion: `move the row citing #${r.pr} (${state}) from "${r.bucket}" to Recently-closed`,
    });
  }
  return suggestions;
}

// ============================================================================================
// Check #6 — changeset gate preflight (reuses `bunx changeset status`, never reimplements it)
// ============================================================================================

export type ChangesetOutcome =
  | { ok: true; stdout: string }
  | { ok: false; unavailable: true }
  | { ok: false; unavailable: false; stdout: string; stderr: string };

export type BumpLevel = "patch" | "minor" | "major";
export type BumpCounts = Record<BumpLevel, number>;

const BUMP_HEADER_RE = /^info Packages to be bumped at (patch|minor|major):?$/;
const BUMP_NONE_RE = /^info NO packages to be bumped at (patch|minor|major)$/;

/** Pure: count the packages `changeset status` says each level will bump. Parses the tool's
 *  own output rather than re-deriving bumps from `.changeset/*.md` — the resolution (fan-out
 *  through workspace dependents) is changesets' job, never ours. */
export function countChangesetBumps(stdout: string): BumpCounts {
  const counts: BumpCounts = { patch: 0, minor: 0, major: 0 };
  let current: BumpLevel | null = null;
  for (const raw of stdout.split("\n")) {
    // strip the butterfly prefix changesets writes on every line
    const line = raw.replace(/^\s*🦋\s*/u, "").trim();
    const header = BUMP_HEADER_RE.exec(line);
    if (header) {
      current = header[1] as BumpLevel;
      continue;
    }
    if (line === "---" || BUMP_NONE_RE.test(line)) {
      current = null;
      continue;
    }
    if (current !== null && line.startsWith("- ")) counts[current]++;
  }
  return counts;
}

/** On `main`, `changeset status --since=origin/main` self-compares to an empty diff and
 *  reports "NO packages to be bumped" over a real queue (ADR-0395 §4). The gatherer drops
 *  `--since` there; this renders what the queue actually resolves to. */
export function summarizeQueuedChangesets(
  stdout: string,
  changesetFileCount: number,
): string {
  const { patch, minor, major } = countChangesetBumps(stdout);
  const files = `${changesetFileCount} changeset file${changesetFileCount === 1 ? "" : "s"} queued`;
  if (patch + minor + major === 0) {
    return `${files}; resolving to no package releases`;
  }
  return `${files}, resolving to ${patch} patch / ${minor} minor / ${major} major package releases`;
}

export function evaluateChangesetOutcome(
  outcome: ChangesetOutcome,
): CheckResult {
  const id = "changeset-gate-preflight";
  if (!outcome.ok && outcome.unavailable) {
    return {
      id,
      status: "skip",
      details: ["bunx/changeset unavailable — skipping"],
    };
  }
  if (outcome.ok) {
    return {
      id,
      status: "green",
      details: [
        outcome.stdout.trim() || "no changed packages are missing a changeset",
      ],
    };
  }
  const combined = `${outcome.stdout}${outcome.stderr}`.trim();
  return {
    id,
    status: "drift",
    details: [truncate(combined || "changeset status exited non-zero", 2000)],
  };
}

// ============================================================================================
// Check #7 — package count parity (docs/build-state.md "Per-package reality check" tables)
// ============================================================================================
//
// Scoped to `packages/*` only, matching the doc's own stated semantics ("`src` = non-test
// source files under `packages/<p>/src`") — the separate apps/services table uses a
// different 2-number "ts files / loc" shape with no test-count column and is out of scope.

export interface PackageCounts {
  src: number;
  tests: number;
  loc: number;
}

export interface PackageDiskFile {
  isTest: boolean;
  lines: number;
}

/** Pure: reduce an already-gathered flat file list for one package into src/tests/loc.
 *  `loc` is source LOC only (mirrors the doc's own `find ... ! -name "*.test.ts" -exec wc -l`
 *  convention) — test-file lines never count toward it. */
export function computePackageCounts(
  files: readonly PackageDiskFile[],
): PackageCounts {
  let src = 0;
  let tests = 0;
  let loc = 0;
  for (const f of files) {
    if (f.isTest) {
      tests++;
      continue;
    }
    src++;
    loc += f.lines;
  }
  return { src, tests, loc };
}

export interface DocPackageRow {
  pkg: string;
  line: number;
  src: number;
  tests: number;
  loc: number | null; // null = doc cell is the "—" placeholder
}

// Name cell may carry trailing annotation text before the next `|` (e.g. "`registry-schema`
// (`packages/`)") — `[^|]*` tolerates it without widening what counts as the package name.
const PACKAGE_ROW_RE =
  /^\|\s*`([a-z][a-z0-9-]*)`[^|]*\|\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+|—|-)\s*\|/gm;

/** Pure: extract every `` `pkg` | N / M / L | `` row from the doc's 3-tuple src/tests/loc
 *  tables. Rows using a different cell shape (the apps/services 2-tuple table) simply don't
 *  match this pattern and are never considered. */
export function extractDocPackageRows(text: string): DocPackageRow[] {
  const rows: DocPackageRow[] = [];
  for (const m of text.matchAll(PACKAGE_ROW_RE)) {
    const locRaw = m[4] as string;
    rows.push({
      pkg: m[1] as string,
      line: lineNumberAt(text, m.index ?? 0),
      src: Number(m[2]),
      tests: Number(m[3]),
      loc: locRaw === "—" || locRaw === "-" ? null : Number(locRaw),
    });
  }
  return rows;
}

function formatDiskCell(c: PackageCounts): string {
  return `${c.src} / ${c.tests} / ${c.loc}`;
}

function formatDocCell(r: DocPackageRow): string {
  return `${r.src} / ${r.tests} / ${r.loc === null ? "—" : r.loc}`;
}

export interface PackageCountFinding {
  pkg: string;
  line: number;
  kind: "stale" | "missing-row" | "dead-row";
  detail: string;
}

/** Pure: diff disk truth against the doc's parsed rows. A doc `loc` of "—" is tolerated
 *  (never flagged stale on loc alone) since a handful of rows legitimately omit it. A
 *  package dir on disk with no doc row is `missing-row` (info, not a crash); a doc row
 *  whose package dir no longer exists is `dead-row`. */
export function diffPackageCounts(
  diskByPkg: ReadonlyMap<string, PackageCounts>,
  docRows: readonly DocPackageRow[],
): PackageCountFinding[] {
  const findings: PackageCountFinding[] = [];
  const docByPkg = new Map(docRows.map((r) => [r.pkg, r]));

  for (const [pkg, disk] of diskByPkg) {
    const row = docByPkg.get(pkg);
    if (!row) {
      findings.push({
        pkg,
        line: 0,
        kind: "missing-row",
        detail: `packages/${pkg}: on disk (${formatDiskCell(disk)}) but no matching row in docs/build-state.md`,
      });
      continue;
    }
    const locMatches = row.loc === null || row.loc === disk.loc;
    if (row.src !== disk.src || row.tests !== disk.tests || !locMatches) {
      findings.push({
        pkg,
        line: row.line,
        kind: "stale",
        detail: `docs/build-state.md:${row.line} \`${pkg}\` says ${formatDocCell(row)}, disk truth is ${formatDiskCell(disk)}`,
      });
    }
  }
  for (const row of docRows) {
    if (!diskByPkg.has(row.pkg)) {
      findings.push({
        pkg: row.pkg,
        line: row.line,
        kind: "dead-row",
        detail: `docs/build-state.md:${row.line} \`${row.pkg}\` has a row but packages/${row.pkg} no longer exists on disk`,
      });
    }
  }
  return findings;
}

// --- Summary totals (ADR-0395 §4) ---------------------------------------------------------
//
// The per-package table above is only half the claim surface: both build-state and the
// package catalog also state census TOTALS in prose/summary rows, and nothing read them.
// package-catalog's "62 packages / 45 commercial / 80 workspaces" sat wrong against disk
// (63 / 46 / 81) through a green gate.

export interface DiskTotals {
  packages: number;
  apache: number;
  commercial: number;
  workspaces: number;
}

export interface SummaryClaim {
  /** repo-relative doc path */
  file: string;
  /** human label used in the drift message */
  label: string;
  /** capture group 1 must be the claimed number */
  pattern: RegExp;
  /** which disk total the claim must equal */
  expect: keyof DiskTotals;
}

/** Every census total a source-of-truth doc states. A claim whose pattern stops matching is
 *  reported as DRIFT, never silence — otherwise a reworded summary quietly leaves its number
 *  unchecked again, which is the exact failure this check was extended to close. */
export const SUMMARY_CLAIMS: readonly SummaryClaim[] = [
  {
    file: "docs/build-state.md",
    label: "packages total",
    pattern: /\*\*(\d+) packages:\*\*/,
    expect: "packages",
  },
  {
    file: "docs/build-state.md",
    label: "Apache-2.0 packages",
    pattern: /\*\*\d+ packages:\*\*\s*(\d+) Apache-2\.0/,
    expect: "apache",
  },
  {
    file: "docs/build-state.md",
    label: "commercial packages",
    pattern: /Apache-2\.0 and (\d+) commercial/,
    expect: "commercial",
  },
  {
    file: "docs/build-state.md",
    label: "Bun workspaces",
    pattern: /(\d+) Bun workspaces total/,
    expect: "workspaces",
  },
  {
    file: "docs/state/package-catalog.md",
    label: "packages total",
    pattern: /^\|\s*Packages\s*\|\s*(\d+)\s*\|/m,
    expect: "packages",
  },
  {
    file: "docs/state/package-catalog.md",
    label: "Apache-2.0 packages",
    pattern: /^\|\s*Packages\s*\|[^|]*\|\s*(\d+) Apache-2\.0/m,
    expect: "apache",
  },
  {
    file: "docs/state/package-catalog.md",
    label: "commercial packages",
    pattern: /Apache-2\.0;\s*(\d+) commercial/,
    expect: "commercial",
  },
  {
    file: "docs/state/package-catalog.md",
    label: "Bun workspaces",
    pattern: /^\|\s*Bun workspaces total\s*\|\s*\*\*(\d+)\*\*/m,
    expect: "workspaces",
  },
  {
    file: "docs/state/package-catalog.md",
    label: "Open Base heading",
    pattern: /^##\s*Open Base\s*—\s*(\d+) Apache-2\.0 packages/m,
    expect: "apache",
  },
  {
    file: "docs/state/public-surface.md",
    label: "Apache-2.0 PUBLIC set heading",
    pattern: /^##\s*1\..*Apache-2\.0 PUBLIC set \((\d+) packages\)/m,
    expect: "apache",
  },
  {
    file: "docs/architecture.md",
    label: "packages total",
    pattern: /^\|\s*`packages\/`\s*\|\s*(\d+)\s*\|/m,
    expect: "packages",
  },
  {
    file: "docs/architecture.md",
    label: "Apache-2.0 packages",
    pattern: /^\|\s*`packages\/`\s*\|[^|]*\|[^|]*?(\d+) Apache-2\.0/m,
    expect: "apache",
  },
  {
    file: "docs/architecture.md",
    label: "commercial packages",
    pattern: /^\|\s*`packages\/`\s*\|[^|]*\|[^|]*?and (\d+) commercial/m,
    expect: "commercial",
  },
  {
    file: "docs/architecture.md",
    label: "Bun workspaces",
    pattern: /The root has (\d+) Bun workspaces/,
    expect: "workspaces",
  },
];

export interface SummaryFinding {
  file: string;
  line: number | null;
  detail: string;
  suggestion: string;
}

/** Pure: diff every declared summary claim against disk truth. A doc absent from `docTexts`
 *  is skipped (its existence is check #8's job, not this one). */
export function diffSummaryTotals(
  totals: DiskTotals,
  docTexts: ReadonlyMap<string, string>,
  claims: readonly SummaryClaim[] = SUMMARY_CLAIMS,
): SummaryFinding[] {
  const findings: SummaryFinding[] = [];
  for (const claim of claims) {
    const text = docTexts.get(claim.file);
    if (text === undefined) continue;
    const expected = totals[claim.expect];
    const m = claim.pattern.exec(text);
    if (!m) {
      findings.push({
        file: claim.file,
        line: null,
        detail:
          `${claim.file}: the "${claim.label}" summary no longer matches the shape this gate reads ` +
          `— restate it or update SUMMARY_CLAIMS (disk truth is ${expected})`,
        suggestion: `restore a parseable "${claim.label}" summary stating ${expected}`,
      });
      continue;
    }
    const claimed = Number(m[1]);
    if (claimed === expected) continue;
    const line = lineNumberAt(text, m.index);
    findings.push({
      file: claim.file,
      line,
      detail: `${claim.file}${line === null ? "" : `:${line}`} summary says ${claimed} ${claim.label}, disk truth is ${expected}`,
      suggestion: `${claim.label} -> ${expected}`,
    });
  }
  return findings;
}

export interface SummaryTotalsInput {
  totals: DiskTotals;
  docTexts: ReadonlyMap<string, string>;
}

export function checkPackageCountParity(
  diskByPkg: ReadonlyMap<string, PackageCounts>,
  docText: string,
  summary?: SummaryTotalsInput,
): CheckResult {
  const id = "package-count-parity";
  const findings = diffPackageCounts(diskByPkg, extractDocPackageRows(docText));
  const stale = findings.filter((f) => f.kind === "stale");
  const dead = findings.filter((f) => f.kind === "dead-row");
  const missing = findings.filter((f) => f.kind === "missing-row");
  const summaryFindings = summary
    ? diffSummaryTotals(summary.totals, summary.docTexts)
    : [];

  if (stale.length === 0 && dead.length === 0 && summaryFindings.length === 0) {
    return {
      id,
      status: "green",
      details: [
        "all packages/* src/tests/loc cells match disk truth",
        ...(summary
          ? [
              `summary totals agree with disk: ${summary.totals.packages} packages ` +
                `(${summary.totals.apache} Apache-2.0 / ${summary.totals.commercial} commercial), ` +
                `${summary.totals.workspaces} Bun workspaces`,
            ]
          : []),
        ...missing.map((f) => f.detail),
      ],
    };
  }
  return {
    id,
    status: "drift",
    details: [
      ...stale.map((f) => f.detail),
      ...dead.map((f) => f.detail),
      ...summaryFindings.map((f) => f.detail),
      ...missing.map((f) => f.detail),
    ],
  };
}

export function buildPackageCountEditSuggestions(
  diskByPkg: ReadonlyMap<string, PackageCounts>,
  docText: string,
  docPath: string,
  summary?: SummaryTotalsInput,
): EditSuggestion[] {
  const findings = diffPackageCounts(
    diskByPkg,
    extractDocPackageRows(docText),
  ).filter((f) => f.kind === "stale");
  const rowSuggestions = findings.map((f) => {
    const disk = diskByPkg.get(f.pkg) as PackageCounts;
    return {
      file: docPath,
      line: f.line,
      suggestion: `\`${f.pkg}\` row -> ${formatDiskCell(disk)}`,
    };
  });
  if (!summary) return rowSuggestions;
  return [
    ...rowSuggestions,
    ...diffSummaryTotals(summary.totals, summary.docTexts).map((f) => ({
      file: f.file,
      line: f.line,
      suggestion: f.suggestion,
    })),
  ];
}

// ============================================================================================
// Check #8 — docs-surface (root slim, 2026-07-11): root markdown stays within the allowlist
// and AGENTS.md remains a symlink to CLAUDE.md (the zero-drift agent mirror).
// Convention: docs/README.md §Docs-surface conventions.
// ============================================================================================

export const ROOT_MD_ALLOWLIST = [
  "AGENTS.md",
  "CLAUDE.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "README.md",
  "SECURITY.md",
];

// docs/state/ = live boards/ledgers ONLY (state-folder reorg 2026-07-11): procedures live
// in docs/ops/, dated one-offs + tombstone stubs in docs/archive/. A new board lands here
// deliberately - add it to this list in the same commit.
export const STATE_MD_ALLOWLIST = [
  "adapter-expansion.md",
  "compatibility-matrix.md",
  "decisions-and-forks.md",
  "go-live-legal-and-entity.md",
  "linear-integration.md",
  "operator-surface.md",
  "outstanding-work.md",
  "package-catalog.md",
  "production-readiness.md",
  "providers.md",
  "public-surface.md",
];

export interface DocsSurfaceInput {
  rootMdFiles: readonly string[];
  stateMdFiles: readonly string[];
  // readlink of AGENTS.md; null = missing or not a symlink
  agentsMdLinkTarget: string | null;
}

export function checkDocsSurface(input: DocsSurfaceInput): CheckResult {
  const id = "docs-surface";
  const details: string[] = [];
  const strays = input.rootMdFiles
    .filter((f) => !ROOT_MD_ALLOWLIST.includes(f))
    .sort();
  if (strays.length > 0) {
    details.push(
      `root markdown outside the allowlist (${ROOT_MD_ALLOWLIST.join(", ")}): ` +
        `${strays.join(", ")} - move into docs/ or docs/archive/ per docs/README.md conventions`,
    );
  }
  const stateStrays = input.stateMdFiles
    .filter((f) => !STATE_MD_ALLOWLIST.includes(f))
    .sort();
  if (stateStrays.length > 0) {
    details.push(
      `docs/state/ files outside the boards allowlist: ${stateStrays.join(", ")} - ` +
        `procedures go to docs/ops/, dated/executed docs to docs/archive/, or extend STATE_MD_ALLOWLIST deliberately`,
    );
  }
  if (input.agentsMdLinkTarget !== "CLAUDE.md") {
    details.push(
      input.agentsMdLinkTarget === null
        ? "AGENTS.md missing or not a symlink - must be a symlink to CLAUDE.md"
        : `AGENTS.md symlink points at ${input.agentsMdLinkTarget}, expected CLAUDE.md`,
    );
  }
  if (details.length === 0) {
    return {
      id,
      status: "green",
      details: [
        "root + docs/state/ markdown within allowlists; AGENTS.md -> CLAUDE.md symlink intact",
      ],
    };
  }
  return { id, status: "drift", details };
}

// ============================================================================================
// Impure: filesystem/git/gh/bunx gatherers
// ============================================================================================

function fileText(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf8");
}

function pathExistsInRepo(relPath: string): boolean {
  return existsSync(join(REPO_ROOT, relPath));
}

function lastCommitDate(relPath: string): string | null {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%cs", "--", relPath],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
      },
    ).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function hasUncommittedChanges(relPath: string): boolean {
  try {
    const out = execFileSync("git", ["status", "--porcelain", "--", relPath], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function globRepoFiles(pattern: string): string[] {
  const glob = new Bun.Glob(pattern);
  const out: string[] = [];
  for (const f of glob.scanSync({ cwd: REPO_ROOT })) out.push(f);
  return out.sort();
}

function readFrontmatterDocs(relPaths: readonly string[]): FrontmatterDoc[] {
  return relPaths
    .filter((p) => pathExistsInRepo(p))
    .map((p) => ({ path: p, text: fileText(p) }));
}

function gatherAdrCeilingCheck(): {
  result: CheckResult;
  suggestions: EditSuggestion[];
} {
  const decisionFilenames = existsSync(
    join(REPO_ROOT, "knowledge", "decisions"),
  )
    ? readdirSync(join(REPO_ROOT, "knowledge", "decisions"))
    : [];
  const claudeMdText = fileText("CLAUDE.md");
  const adrIndexText = fileText("docs/adr-index.md");
  const forksText = pathExistsInRepo("docs/state/decisions-and-forks.md")
    ? fileText("docs/state/decisions-and-forks.md")
    : "";
  const buildStateText = pathExistsInRepo("docs/build-state.md")
    ? fileText("docs/build-state.md")
    : "";
  const sources = extractAdrCeilingSources({
    decisionFilenames,
    claudeMdText,
    adrIndexText,
    forksText,
    buildStateText,
  });
  return {
    result: checkAdrCeilingParity(sources),
    suggestions: buildCeilingEditSuggestions(sources, {
      claudeMd: claudeMdText,
      adrIndex: adrIndexText,
      forks: forksText,
      buildState: buildStateText,
    }),
  };
}

const FRESHNESS_EXTRA_PATHS = [
  "docs/architecture.md",
  "docs/build-state.md",
  "docs/deploy/STATE.md",
];

function gatherFreshnessDocs(): FrontmatterDoc[] {
  const stateGlob = globRepoFiles("docs/state/*.md");
  const opsGlob = globRepoFiles("docs/ops/*.md");
  const paths = [
    ...new Set([...stateGlob, ...opsGlob, ...FRESHNESS_EXTRA_PATHS]),
  ];
  return readFrontmatterDocs(paths);
}

function gatherFreshnessCheck(): {
  result: CheckResult;
  suggestions: EditSuggestion[];
} {
  const docs = gatherFreshnessDocs();
  return {
    result: checkFrontmatterFreshness(docs, pathExistsInRepo, lastCommitDate),
    suggestions: buildFreshnessEditSuggestions(
      docs,
      pathExistsInRepo,
      lastCommitDate,
    ),
  };
}

function gatherArchiveIntegrityCheck(): CheckResult {
  const archivePaths = globRepoFiles("docs/archive/**/*.md");
  const archivedDocs = readFrontmatterDocs(archivePaths);
  return checkArchiveIntegrity(
    archivedDocs,
    hasUncommittedChanges,
    lastCommitDate,
  );
}

function gatherBranchHygieneCheck(): CheckResult {
  const branches = execFileSync(
    "git",
    ["branch", "--format=%(refname:short)"],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
    },
  )
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
  const currentBranch = execFileSync(
    "git",
    ["rev-parse", "--abbrev-ref", "HEAD"],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
    },
  ).trim();
  const currentPath = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();
  const worktreeText = execFileSync(
    "git",
    ["worktree", "list", "--porcelain"],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
    },
  );
  return computeBranchHygiene(
    branches,
    currentBranch,
    parseWorktreeList(worktreeText),
    currentPath,
  );
}

function ghAvailable(): boolean {
  try {
    execFileSync("gh", ["--version"], { encoding: "utf8", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function fetchPrState(pr: number): string | null {
  const raw = execFileSync(
    "gh",
    ["pr", "view", String(pr), "--json", "state"],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: 5000,
    },
  );
  const parsed = JSON.parse(raw) as { state?: string };
  return parsed.state ?? null;
}

const TRACKER_PATH = "docs/state/outstanding-work.md";

function gatherTrackerCheck(): {
  result: CheckResult;
  suggestions: EditSuggestion[];
} {
  const id = "tracker-vs-reality";
  if (!pathExistsInRepo(TRACKER_PATH)) {
    return {
      result: {
        id,
        status: "skip",
        details: [`${TRACKER_PATH} does not exist yet`],
      },
      suggestions: [],
    };
  }
  const refs = extractTrackerPrRefs(fileText(TRACKER_PATH));
  if (refs.length === 0) {
    return {
      result: {
        id,
        status: "green",
        details: ["no PR references in tracked buckets"],
      },
      suggestions: [],
    };
  }
  if (!ghAvailable()) {
    return {
      result: {
        id,
        status: "skip",
        details: ["gh CLI unavailable — skipping"],
      },
      suggestions: [],
    };
  }
  const states = new Map<number, string>();
  try {
    for (const pr of new Set(refs.map((r) => r.pr))) {
      const state = fetchPrState(pr);
      if (state) states.set(pr, state);
    }
  } catch (err) {
    return {
      result: {
        id,
        status: "skip",
        details: [`gh call failed (${(err as Error).message}) — skipping`],
      },
      suggestions: [],
    };
  }
  const details = findStaleTrackerRefs(refs, states);
  return {
    result: {
      id,
      status: details.length ? "drift" : "green",
      details: details.length
        ? details
        : ["all cited PRs still open or unresolved"],
    },
    suggestions: buildTrackerEditSuggestions(refs, states, TRACKER_PATH),
  };
}

function countLines(text: string): number {
  // matches `wc -l` semantics: a count of newline characters, not a split-based line count
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") n++;
  return n;
}

/** Recursive `.ts` file walk under `dir`, skipping `node_modules`/`dist`/dotfiles — mirrors
 *  the brief's `find <dir> -name "*.ts"` (no build output, no vendored code). */
function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name.startsWith(".")
      )
        continue;
      const full = join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(full);
    }
  }
  return out;
}

function gatherDiskPackageCounts(): Map<string, PackageCounts> {
  const result = new Map<string, PackageCounts>();
  const packagesDir = join(REPO_ROOT, "packages");
  if (!existsSync(packagesDir)) return result;
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const srcDir = join(packagesDir, entry.name, "src");
    if (!existsSync(srcDir)) continue;
    const files: PackageDiskFile[] = listTsFiles(srcDir).map((full) => {
      const isTest = full.endsWith(".test.ts");
      return {
        isTest,
        lines: isTest ? 0 : countLines(readFileSync(full, "utf8")),
      };
    });
    result.set(entry.name, computePackageCounts(files));
  }
  return result;
}

const BUILD_STATE_PATH = "docs/build-state.md";

const APACHE_LICENSE = "Apache-2.0";

/** Disk truth for the census totals: every workspace manifest the root `workspaces` globs
 *  actually resolve to, and the `packages/*` subset split by SPDX license (Apache-2.0 vs any other
 *  declared license, which the census still reports as "commercial"). */
function gatherDiskTotals(): DiskTotals {
  const root = JSON.parse(fileText("package.json")) as {
    workspaces?: string[] | { packages?: string[] };
  };
  const globs = Array.isArray(root.workspaces)
    ? root.workspaces
    : (root.workspaces?.packages ?? []);
  const manifests = new Set<string>();
  for (const g of globs) {
    for (const f of new Bun.Glob(`${g}/package.json`).scanSync({
      cwd: REPO_ROOT,
    })) {
      manifests.add(f);
    }
  }
  let packages = 0;
  let apache = 0;
  let commercial = 0;
  for (const rel of manifests) {
    if (!rel.startsWith("packages/")) continue;
    packages++;
    const license = (JSON.parse(fileText(rel)) as { license?: string }).license;
    if (license === APACHE_LICENSE) apache++;
    else if (license !== undefined) commercial++;
  }
  return { packages, apache, commercial, workspaces: manifests.size };
}

function gatherPackageCountCheck(): {
  result: CheckResult;
  suggestions: EditSuggestion[];
} {
  const diskByPkg = gatherDiskPackageCounts();
  const docText = pathExistsInRepo(BUILD_STATE_PATH)
    ? fileText(BUILD_STATE_PATH)
    : "";
  const docTexts = new Map<string, string>();
  for (const claim of SUMMARY_CLAIMS) {
    if (docTexts.has(claim.file) || !pathExistsInRepo(claim.file)) continue;
    docTexts.set(claim.file, fileText(claim.file));
  }
  const summary: SummaryTotalsInput = { totals: gatherDiskTotals(), docTexts };
  return {
    result: checkPackageCountParity(diskByPkg, docText, summary),
    suggestions: buildPackageCountEditSuggestions(
      diskByPkg,
      docText,
      BUILD_STATE_PATH,
      summary,
    ),
  };
}

function gatherDocsSurfaceCheck(): CheckResult {
  const rootMdFiles = readdirSync(REPO_ROOT).filter((f) => f.endsWith(".md"));
  const stateMdFiles = readdirSync(join(REPO_ROOT, "docs", "state")).filter(
    (f) => f.endsWith(".md"),
  );
  let agentsMdLinkTarget: string | null;
  try {
    agentsMdLinkTarget = readlinkSync(join(REPO_ROOT, "AGENTS.md"));
  } catch {
    agentsMdLinkTarget = null;
  }
  return checkDocsSurface({ rootMdFiles, stateMdFiles, agentsMdLinkTarget });
}

function gatherChangesetCheck(): CheckResult {
  try {
    // Release-PR exemption — the SAME rule ci.yml's presence gate applies: changesets DELETED
    // since origin/main mean this branch consumed them (`changeset version`), so `changeset
    // status` would flag the very packages the cut just released. CI skips; so do we.
    const deleted = execFileSync(
      "git",
      [
        "diff",
        "--name-only",
        "--diff-filter=D",
        "origin/main...HEAD",
        "--",
        ".changeset/*.md",
      ],
      { cwd: REPO_ROOT, encoding: "utf8", timeout: 30000 },
    ).trim();
    if (deleted !== "") {
      return {
        id: "changeset-gate-preflight",
        status: "green",
        details: [
          "release PR (changesets consumed since origin/main) — presence gate skipped, matching ci.yml",
        ],
      };
    }
    // On `main`, `--since=origin/main` self-compares to an empty diff and reports "NO
    // packages to be bumped" over a real queue (ADR-0395 §4). Drop the flag there and
    // report what the queued changesets actually resolve to.
    const onMain =
      execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      }).trim() === "main";
    const stdout = execFileSync(
      "bunx",
      onMain
        ? ["changeset", "status"]
        : ["changeset", "status", "--since=origin/main"],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 30000,
      },
    );
    if (!onMain) return evaluateChangesetOutcome({ ok: true, stdout });
    const queuedFiles = readdirSync(join(REPO_ROOT, ".changeset")).filter(
      (f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md",
    ).length;
    return {
      id: "changeset-gate-preflight",
      status: "green",
      details: [summarizeQueuedChangesets(stdout, queuedFiles)],
    };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
    };
    if (e.code === "ENOENT") {
      return evaluateChangesetOutcome({ ok: false, unavailable: true });
    }
    return evaluateChangesetOutcome({
      ok: false,
      unavailable: false,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message,
    });
  }
}

// ============================================================================================
// Reporting + CLI
// ============================================================================================

export function printResults(
  results: readonly CheckResult[],
  write: (s: string) => void = (s) => process.stdout.write(s),
): void {
  write("\nsot-check — session source-of-truth drift report\n");
  for (const r of results) {
    write(`\n[${r.status.toUpperCase()}] ${r.id}\n`);
    for (const d of r.details) write(`    ${d}\n`);
  }
}

export function printEditChecklist(
  suggestions: readonly EditSuggestion[],
  write: (s: string) => void = (s) => process.stdout.write(s),
): void {
  write("\n--update — ready-to-apply edit checklist (never auto-applied)\n");
  if (suggestions.length === 0) {
    write("    (nothing to suggest — checks #1/#2/#5/#7 are all green)\n");
    return;
  }
  for (const s of suggestions) {
    write(
      `    ${s.file}${s.line !== null ? `:${s.line}` : ""} -> ${s.suggestion}\n`,
    );
  }
}

function relRepoPath(p: string): string {
  return relative(REPO_ROOT, p);
}

async function main(): Promise<void> {
  const update = process.argv.slice(2).includes("--update");

  const ceiling = gatherAdrCeilingCheck();
  const freshness = gatherFreshnessCheck();
  const archive = gatherArchiveIntegrityCheck();
  const branches = gatherBranchHygieneCheck();
  const tracker = gatherTrackerCheck();
  const changeset = gatherChangesetCheck();
  const packageCounts = gatherPackageCountCheck();
  const docsSurface = gatherDocsSurfaceCheck();

  const results = [
    ceiling.result,
    freshness.result,
    archive,
    branches,
    tracker.result,
    changeset,
    packageCounts.result,
    docsSurface,
  ];
  printResults(results);

  if (update) {
    const suggestions = [
      ...ceiling.suggestions,
      ...freshness.suggestions,
      ...tracker.suggestions,
      ...packageCounts.suggestions,
    ].map((s) => ({
      ...s,
      file: s.file.startsWith(REPO_ROOT) ? relRepoPath(s.file) : s.file,
    }));
    printEditChecklist(suggestions);
  }

  const drift = results.some((r) => r.status === "drift");
  process.stdout.write(
    drift
      ? "\nsot-check: DRIFT found — see above.\n"
      : "\nsot-check: green — no drift detected.\n",
  );
  process.exit(drift ? 1 : 0);
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    process.stderr.write(`sot-check: ${(err as Error).message}\n`);
    process.exit(1);
  });
}

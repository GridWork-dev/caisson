// Session-automation SOT drift report — the one `bun run sot` command from
// outputs/specs/sot-expansion/SPEC.md §2. Sibling of `vault-parity-check.ts` /
// `railway-env-sync.ts`.
//
// ADVISORY BY DESIGN: prints a drift report, exits 1 on any drift, 0 when green. NEVER
// writes a file — the never-auto-decide law extends to docs (the tool detects, the
// session author fixes). `--update` additionally prints a ready-to-apply edit checklist
// (file + line + suggested new value) for checks #1/#2/#5 — still never writes.
//
// Six checks (SPEC §2 table), each a pure function over already-gathered data + an
// impure gatherer that gets that data from the filesystem/git/gh/bunx. A `gh`- or
// `bunx`-dependent check that can't reach its tool/network degrades to `skip`, never an
// error.
//
// Usage: bun tooling/scripts/sot-check.ts [--update]
// Exit: 0 = green (or all-skip); 1 = drift on any check.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
const CEILING_RE = /ceiling[:\s*]*(?:ADR-)?(\d{4})/i;

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
}

export function extractAdrCeilingSources(input: {
  decisionFilenames: readonly string[];
  claudeMdText: string;
  adrIndexText: string;
  forksText: string;
}): AdrCeilingSources {
  const forksFm = parseFrontmatter(input.forksText);
  const forksRaw = forksFm?.raw.adr_ceiling;
  return {
    filesystem: maxAdrFromFilenames(input.decisionFilenames),
    claudeMd: extractCeiling(input.claudeMdText),
    adrIndex: extractCeiling(input.adrIndexText),
    forks: forksRaw ? Number(forksRaw) : null,
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
  texts: { claudeMd: string; adrIndex: string; forks: string },
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

/** Findings for ONE doc. Docs missing `updated:` or `grounds:` are not checked (per
 *  SPEC, "missing grounds key = not checked") — returns null. */
export function checkDocFreshness(
  doc: FrontmatterDoc,
  pathExists: (relPath: string) => boolean,
  lastCommitDate: (relPath: string) => string | null,
): FreshnessFinding[] | null {
  const fm = parseFrontmatter(doc.text);
  if (!fm) return null;
  const updated = fm.raw.updated;
  const grounds = fm.lists.grounds;
  if (!updated || !grounds || grounds.length === 0) return null;

  const findings: FreshnessFinding[] = [];
  for (const g of grounds) {
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
      details: ["all grounds paths are at or after their doc's updated: date"],
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
const ARCHIVE_LINK_RE = /(?:^|[(\s'"])(?:\.\.?\/)*(?:docs\/)?archive\//m;

/** (a) a status:live doc must not link a docs/archive/ path directly — it must route
 *  through its docs/state/ tombstone instead. */
export function checkLiveDocArchiveLink(doc: FrontmatterDoc): string[] {
  const fm = parseFrontmatter(doc.text);
  if (!fm || fm.raw.status !== "live") return [];
  if (ARCHIVE_LINK_RE.test(doc.text)) {
    return [
      `${doc.path}: status: live but links docs/archive/ directly — link the docs/state/ tombstone instead`,
    ];
  }
  return [];
}

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
  liveDocs: readonly FrontmatterDoc[],
  archivedDocs: readonly FrontmatterDoc[],
  hasUncommittedChanges: (relPath: string) => boolean,
  lastCommitDate: (relPath: string) => string | null,
): CheckResult {
  const id = "archive-integrity";
  const details: string[] = [];
  for (const doc of liveDocs) details.push(...checkLiveDocArchiveLink(doc));
  for (const doc of archivedDocs) {
    details.push(
      ...checkArchivedDocImmutable(doc, hasUncommittedChanges, lastCommitDate),
    );
  }
  if (details.length === 0) {
    return {
      id,
      status: "green",
      details: ["no live->archive direct links; archived docs unmodified"],
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
  const sources = extractAdrCeilingSources({
    decisionFilenames,
    claudeMdText,
    adrIndexText,
    forksText,
  });
  return {
    result: checkAdrCeilingParity(sources),
    suggestions: buildCeilingEditSuggestions(sources, {
      claudeMd: claudeMdText,
      adrIndex: adrIndexText,
      forks: forksText,
    }),
  };
}

const FRESHNESS_EXTRA_PATHS = ["docs/architecture.md", "docs/deploy/STATE.md"];

function gatherFreshnessDocs(): FrontmatterDoc[] {
  const stateGlob = globRepoFiles("docs/state/*.md");
  const paths = [...new Set([...stateGlob, ...FRESHNESS_EXTRA_PATHS])];
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
  const allDocPaths = globRepoFiles("docs/**/*.md").filter(
    (p) => !p.startsWith("docs/archive/"),
  );
  const archivePaths = globRepoFiles("docs/archive/**/*.md");
  const liveDocs = readFrontmatterDocs(allDocPaths);
  const archivedDocs = readFrontmatterDocs(archivePaths);
  return checkArchiveIntegrity(
    liveDocs,
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

function gatherChangesetCheck(): CheckResult {
  try {
    const stdout = execFileSync(
      "bunx",
      ["changeset", "status", "--since=origin/main"],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 30000,
      },
    );
    return evaluateChangesetOutcome({ ok: true, stdout });
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
    write("    (nothing to suggest — checks #1/#2/#5 are all green)\n");
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

  const results = [
    ceiling.result,
    freshness.result,
    archive,
    branches,
    tracker.result,
    changeset,
  ];
  printResults(results);

  if (update) {
    const suggestions = [
      ...ceiling.suggestions,
      ...freshness.suggestions,
      ...tracker.suggestions,
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

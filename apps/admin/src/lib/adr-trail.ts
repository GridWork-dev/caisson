/**
 * adr-trail.ts — the decisions source-of-truth, read once and baked at BUILD time.
 *
 * The standalone Railway image (ADR-0114/0138) does NOT ship the repo tree, so `knowledge/decisions`
 * and the forks board are read here at module-evaluation time — during `next build`, while the repo
 * IS present — and frozen into module-level consts. The /decisions page is `force-static`, so nothing
 * here re-runs at request time; and if this module were ever re-imported inside the shipped image, the
 * repo-root walk-up finds no `knowledge/decisions` marker and every parse degrades to an empty result
 * rather than throwing. No env, no fetch, no per-request fs — an inert baked read.
 *
 * Dependency-free by contract (node:fs + node:path only, no markdown lib): a clean pre-formatted view
 * of the relevant sections, per the A7 scope — not a rendered document.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface AdrEntry {
  /** The zero-padded ADR number as an int (e.g. 140). */
  number: number;
  /** The title after the `—` on the `# ADR-NNNN — <title>` line. */
  title: string;
  /** The first word of the `Status:` line, lowercased (`accepted` / `proposed` / `locked`). */
  status: string;
  /** The first ISO date on the `Status:` line, if present. */
  date?: string;
  /** The source filename (e.g. `ADR-0140-admin-auth-cf-access.md`). */
  file: string;
}

/** The parsed forks board — a few extracted string blocks, not a rendered document. */
export interface ForksBoard {
  /** The paragraph directly under the H1 (the board's own description). */
  intro: string;
  /** The prose under `## Open …`, flattened — kept only as a presence check / fallback for
   *  when that section isn't a table (see `openRows`). */
  openSummary: string;
  /** The `## Open …` table's body rows (Item, State), markdown syntax stripped per cell — one
   *  row per fork, not the whole table flattened into a single prose wall. Empty if the section
   *  isn't a pipe table. */
  openRows: string[][];
  /** Every `##` section title in file order — the trail of locked/closed decision rounds. */
  sections: string[];
}

/**
 * Find the monorepo root by walking up from the build cwd (turbo sets it to the package dir; a bare
 * `next build` sets it to apps/admin) and, as a fallback, from this module's own location, until a
 * dir carrying `knowledge/decisions` is found. Robust to which dir the build runs from; returns null
 * (→ empty baked data) inside the repo-less standalone image.
 */
function findRepoRoot(): string | null {
  const isDir = (p: string): boolean => {
    try {
      return statSync(p).isDirectory();
    } catch {
      return false;
    }
  };
  const starts: string[] = [process.cwd()];
  try {
    starts.push(dirname(fileURLToPath(import.meta.url)));
  } catch {
    /* import.meta.url unavailable — cwd walk covers the build case */
  }
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 10; i++) {
      if (isDir(join(dir, "knowledge", "decisions"))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

const TITLE_RE = /^#\s+ADR-(\d{3,4})\s+[—–-]\s+(.+?)\s*$/;
// `**Status:**` (bold, ~14 ADRs) or plain `Status:`; the rest is `<word> · <date> (notes…)`.
const STATUS_RE = /^\*{0,2}Status:\*{0,2}\s*(.+)$/i;
const DATE_RE = /(\d{4}-\d{2}-\d{2})/;
const STATUS_WORD_RE = /([A-Za-z]+)/;

/** Pure parser — exported so a hermetic test can drive it without touching the repo tree. */
export function parseAdrContent(text: string, file: string): AdrEntry | null {
  const lines = text.split(/\r?\n/);
  let number: number | null = null;
  let title = "";
  for (const line of lines) {
    const m = TITLE_RE.exec(line);
    if (m) {
      number = Number.parseInt(m[1] ?? "", 10);
      title = m[2] ?? "";
      break;
    }
  }
  if (number === null) return null;

  let status = "";
  let date: string | undefined;
  for (const line of lines) {
    const m = STATUS_RE.exec(line);
    if (m) {
      const rest = m[1] ?? "";
      status = (STATUS_WORD_RE.exec(rest)?.[1] ?? "").toLowerCase();
      date = DATE_RE.exec(rest)?.[1];
      break;
    }
  }
  return {
    number,
    title,
    status,
    file,
    ...(date !== undefined ? { date } : {}),
  };
}

function loadAdrTrail(root: string | null): AdrEntry[] {
  if (!root) return [];
  const dir = join(root, "knowledge", "decisions");
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => /^ADR-\d{3,4}.*\.md$/.test(f));
  } catch {
    return [];
  }
  const entries: AdrEntry[] = [];
  for (const file of files) {
    try {
      const parsed = parseAdrContent(
        readFileSync(join(dir, file), "utf8"),
        file,
      );
      if (parsed) entries.push(parsed);
    } catch {
      /* skip an unreadable/malformed ADR rather than fail the whole trail */
    }
  }
  return entries.sort((a, b) => a.number - b.number);
}

// ponytail: light emphasis strip (** and wrapping _) — enough to read the one Open paragraph cleanly;
// a real markdown renderer is explicitly out of scope.
function stripEmphasis(s: string): string {
  return s.replace(/\*\*/g, "").replace(/^_+/, "").replace(/_+$/, "").trim();
}

/** Strip inline markdown noise from one table cell — backticks, bold, strikethrough, and
 *  `[label](url)` links collapse to plain text. Enough to read the board's own table cleanly as
 *  structured rows instead of one flattened prose wall (CAISSON-141); a real markdown renderer
 *  stays out of scope per this module's dependency-free contract. */
function stripCellMarkup(s: string): string {
  return s
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/~~([^~]*)~~/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim();
}

/** Parse a GFM pipe table's body rows (every line's cells, header + `---` separator skipped).
 *  Pure — exported so a hermetic test can drive it without touching the repo tree. */
export function parsePipeTableRows(lines: readonly string[]): string[][] {
  const tableLines = lines
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|") && l.length > 1);
  // [0] = header row, [1] = the `---` separator row — both skipped; [2..] = data.
  return tableLines
    .slice(2)
    .map((line) => line.slice(1, -1).split("|").map(stripCellMarkup));
}

function loadForksBoard(root: string | null): ForksBoard {
  const empty: ForksBoard = {
    intro: "",
    openSummary: "",
    openRows: [],
    sections: [],
  };
  if (!root) return empty;
  let text: string;
  try {
    text = readFileSync(
      join(root, "docs", "state", "decisions-and-forks.md"),
      "utf8",
    );
  } catch {
    return empty;
  }
  const lines = text.split(/\r?\n/);

  const sections: string[] = [];
  for (const line of lines) {
    const title = /^##\s+(.+?)\s*$/.exec(line)?.[1];
    if (title) sections.push(title);
  }

  // intro: the paragraph between the H1 and the first `## `.
  const h1 = lines.findIndex((l) => /^#\s+/.test(l));
  const firstH2 = lines.findIndex((l) => /^##\s+/.test(l));
  const intro =
    h1 >= 0 && firstH2 > h1
      ? stripEmphasis(
          lines
            .slice(h1 + 1, firstH2)
            .join(" ")
            .replace(/\s+/g, " "),
        )
      : "";

  // The `## Open …` section body, up to the next header of any level.
  const openIdx = lines.findIndex((l) => /^##\s+Open\b/i.test(l));
  let openSummary = "";
  let openRows: string[][] = [];
  if (openIdx >= 0) {
    const rest = lines.slice(openIdx + 1);
    const nextHeader = rest.findIndex((l) => /^#/.test(l));
    const body = nextHeader >= 0 ? rest.slice(0, nextHeader) : rest;
    openSummary = stripEmphasis(body.join(" ").replace(/\s+/g, " "));
    openRows = parsePipeTableRows(body);
  }

  return { intro, openSummary, openRows, sections };
}

const ROOT = findRepoRoot();

/** All ADRs under `knowledge/decisions`, parsed at build time, ascending by number. Frozen. */
export const ADR_TRAIL: readonly AdrEntry[] = Object.freeze(loadAdrTrail(ROOT));

/** The forks board sections, extracted at build time. Frozen. */
export const FORKS_BOARD: ForksBoard = Object.freeze(loadForksBoard(ROOT));

/** Highest ADR number in the trail (the ceiling), or 0 if the trail is empty. */
export const ADR_CEILING: number = ADR_TRAIL.reduce(
  (max, e) => (e.number > max ? e.number : max),
  0,
);

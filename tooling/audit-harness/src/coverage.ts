// Per-round coverage ledger + the loop's DRY predicate (ADR-0233 / SPEC audit-harness-v2, tasks 4–5).
// v1 answered "did we cover everything?" by re-running until a critic went quiet — luck plus
// persistence. v2 makes it a LEDGER: each round appends one row per audited cell (domain × dimension)
// recording it was executed, so an unaudited cell is VISIBLE, never inferred. The loop terminates on
// an explicit predicate (`isRoundDry`), not on exhaustion.
//
// Pure data + pure functions. No dispatch, no model call (AGENTS.md boundary): the driver appends
// rows as it fans out and calls `isRoundDry` to decide whether to loop.

/** One audited cell in one round. `executed: false` marks a planned-but-skipped cell (still visible). */
export interface CoverageRow {
  round: number;
  domain: string;
  dimension: string;
  filesScanned: number;
  findings: number;
  executed: boolean;
}

/** A cell key = domain × dimension. */
export interface Cell {
  domain: string;
  dimension: string;
}

const cellKey = (domain: string, dimension: string): string =>
  `${domain}∷${dimension}`;

// ── coverage.toml round-trip — same constrained [[cell]] array-of-tables style as the findings ledger.

const COVERAGE_HEADER = `# audit-harness per-round coverage ledger — ADR-0233 (ADVISORY). One row per audited cell.
# A cell = (domain × applicable-dimension). executed=true means a finder actually ran the cell this
# round; a missing/executed=false cell is an unaudited surface, made visible instead of inferred.
`;

export function serializeCoverage(rows: readonly CoverageRow[]): string {
  const tables = [...rows]
    .sort(
      (a, b) =>
        a.round - b.round ||
        a.domain.localeCompare(b.domain) ||
        a.dimension.localeCompare(b.dimension),
    )
    .map(
      (r) =>
        `[[cell]]\n` +
        `round = ${String(r.round)}\n` +
        `domain = ${JSON.stringify(r.domain)}\n` +
        `dimension = ${JSON.stringify(r.dimension)}\n` +
        `files_scanned = ${String(r.filesScanned)}\n` +
        `findings = ${String(r.findings)}\n` +
        `executed = ${r.executed ? "true" : "false"}\n`,
    );
  return `${COVERAGE_HEADER}\n${tables.join("\n")}`;
}

/** Read back a quoted value written by `JSON.stringify`; a hand-edited one that fails to parse is
 *  kept without its quotes. */
function unquote(quoted: string): string {
  try {
    return String(JSON.parse(quoted));
  } catch {
    return quoted.slice(1, -1);
  }
}

export function parseCoverage(toml: string): CoverageRow[] {
  const out: CoverageRow[] = [];
  let cur: Record<string, string> | null = null;
  const flush = (): void => {
    const c = cur;
    cur = null;
    if (!c) return;
    const { round, domain, dimension, files_scanned, findings, executed } = c;
    if (round && domain && dimension && files_scanned && findings && executed) {
      out.push({
        round: Number(round),
        domain,
        dimension,
        filesScanned: Number(files_scanned),
        findings: Number(findings),
        executed: executed === "true",
      });
    }
  };
  for (const lineRaw of toml.split("\n")) {
    const line = lineRaw.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line === "[[cell]]") {
      flush();
      cur = {};
      continue;
    }
    const m = line.match(/^(\w+)\s*=\s*(?:(".*")|(\S+))$/);
    if (m && cur && m[1] !== undefined) {
      cur[m[1]] = m[2] === undefined ? (m[3] ?? "") : unquote(m[2]);
    }
  }
  flush();
  return out;
}

/** A per-cell coverage grid for the report — one line per cell, sorted, with executed + tallies. */
export function coverageGrid(rows: readonly CoverageRow[]): string {
  if (rows.length === 0)
    return "  (no coverage ledger — run has not enumerated cells yet)";
  return [...rows]
    .sort(
      (a, b) =>
        a.round - b.round ||
        a.domain.localeCompare(b.domain) ||
        a.dimension.localeCompare(b.dimension),
    )
    .map(
      (r) =>
        `  r${String(r.round)} ${r.executed ? "✓" : "·"} ${r.domain} × ${r.dimension} ` +
        `— ${String(r.filesScanned)} file(s), ${String(r.findings)} finding(s)`,
    )
    .join("\n");
}

export interface DryInputs {
  /** the round being evaluated. */
  round: number;
  /** coverage-gate.test.ts green this run (every tree unit claimed). */
  coverageGateGreen: boolean;
  /** every applicable cell that MUST be executed (domain × applicable-dimension). */
  expectedCells: readonly Cell[];
  /** the coverage rows recorded this run (all rounds). */
  rows: readonly CoverageRow[];
  /** ids of findings that were NEW or REGRESSED this round (not already in the ledger). */
  newFindingIds: readonly string[];
  /** surfaces the completeness critic named this round (empty = it found nothing). */
  criticNamedSurfaces: readonly string[];
}

export interface DryResult {
  dry: boolean;
  /** why the round is NOT dry — empty when dry. */
  reasons: string[];
}

/**
 * The loop's termination oracle (SPEC §"loop-until-dry"). A round is DRY iff ALL hold:
 *  1. the coverage gate is green (every tree unit claimed),
 *  2. every applicable cell shows executed:true this round,
 *  3. the round produced zero findings whose id is not already in the ledger,
 *  4. the completeness critic named nothing.
 * Otherwise it returns the concrete reasons to loop again. Replaces v1's "run again and see."
 */
export function isRoundDry(inp: DryInputs): DryResult {
  const reasons: string[] = [];

  if (!inp.coverageGateGreen) {
    reasons.push("coverage gate not green (a tree unit is unclaimed)");
  }

  const executed = new Set(
    inp.rows
      .filter((r) => r.round === inp.round && r.executed)
      .map((r) => cellKey(r.domain, r.dimension)),
  );
  for (const c of inp.expectedCells) {
    if (!executed.has(cellKey(c.domain, c.dimension))) {
      reasons.push(`cell not executed: ${c.domain} × ${c.dimension}`);
    }
  }

  if (inp.newFindingIds.length > 0) {
    reasons.push(
      `${String(inp.newFindingIds.length)} new/regressed finding id(s) this round`,
    );
  }
  if (inp.criticNamedSurfaces.length > 0) {
    reasons.push(
      `completeness critic named ${String(inp.criticNamedSurfaces.length)} surface(s): ${inp.criticNamedSurfaces.join(", ")}`,
    );
  }

  return { dry: reasons.length === 0, reasons };
}

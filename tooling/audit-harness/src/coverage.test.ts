import { describe, expect, test } from "bun:test";

import {
  coverageGrid,
  isRoundDry,
  parseCoverage,
  serializeCoverage,
  type Cell,
  type CoverageRow,
} from "./coverage.ts";

const row = (over: Partial<CoverageRow> = {}): CoverageRow => ({
  round: 1,
  domain: "packages/kernel",
  dimension: "D1",
  filesScanned: 12,
  findings: 0,
  executed: true,
  ...over,
});

describe("coverage.toml round-trip (ADR-0233, task 4)", () => {
  test("serialize ∘ parse is identity across rounds, executed flags, and quotes", () => {
    const rows: CoverageRow[] = [
      row(),
      row({ dimension: "D2", filesScanned: 12, findings: 1 }),
      row({ round: 2, dimension: "D7", executed: false, filesScanned: 0 }),
      row({ round: 3, domain: 'a "quoted" path\\with\\backslashes' }),
    ];
    const parsed = parseCoverage(serializeCoverage(rows));
    expect(parsed).toEqual(
      [...rows].sort(
        (a, b) =>
          a.round - b.round ||
          a.domain.localeCompare(b.domain) ||
          a.dimension.localeCompare(b.dimension),
      ),
    );
  });

  test("an empty ledger parses back to []", () => {
    expect(parseCoverage(serializeCoverage([]))).toEqual([]);
  });

  test("grid renders a per-cell line with an executed marker", () => {
    const grid = coverageGrid([
      row(),
      row({ dimension: "D7", executed: false }),
    ]);
    expect(grid).toContain("packages/kernel × D1");
    expect(grid).toContain("✓");
    expect(grid).toContain("·"); // the un-executed cell
  });
});

describe("isRoundDry — the loop termination oracle (ADR-0233, task 5)", () => {
  const cells: Cell[] = [
    { domain: "packages/kernel", dimension: "D1" },
    { domain: "packages/kernel", dimension: "D2" },
  ];
  const rows: CoverageRow[] = [
    row({ dimension: "D1" }),
    row({ dimension: "D2" }),
  ];

  test("DRY only when gate green + every cell executed + no new findings + critic silent", () => {
    const r = isRoundDry({
      round: 1,
      coverageGateGreen: true,
      expectedCells: cells,
      rows,
      newFindingIds: [],
      criticNamedSurfaces: [],
    });
    expect(r.dry).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  test("NOT dry when a cell was not executed", () => {
    const r = isRoundDry({
      round: 1,
      coverageGateGreen: true,
      expectedCells: cells,
      rows: [row({ dimension: "D1" })], // D2 missing
      newFindingIds: [],
      criticNamedSurfaces: [],
    });
    expect(r.dry).toBe(false);
    expect(r.reasons.join(" ")).toContain("D2");
  });

  test("NOT dry when new findings appeared, the gate is red, or the critic named a surface", () => {
    expect(
      isRoundDry({
        round: 1,
        coverageGateGreen: true,
        expectedCells: cells,
        rows,
        newFindingIds: ["abc123"],
        criticNamedSurfaces: [],
      }).dry,
    ).toBe(false);
    expect(
      isRoundDry({
        round: 1,
        coverageGateGreen: false,
        expectedCells: cells,
        rows,
        newFindingIds: [],
        criticNamedSurfaces: [],
      }).dry,
    ).toBe(false);
    expect(
      isRoundDry({
        round: 1,
        coverageGateGreen: true,
        expectedCells: cells,
        rows,
        newFindingIds: [],
        criticNamedSurfaces: ["packages/ghost"],
      }).dry,
    ).toBe(false);
  });
});

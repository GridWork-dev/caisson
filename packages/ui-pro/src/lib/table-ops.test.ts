import { describe, expect, test } from "bun:test";

import {
  aggregate,
  applyFilters,
  compareCells,
  groupRows,
  matchesFilter,
  sortRows,
  toCsv,
  type AccessorMap,
  type ColumnFilter,
} from "./table-ops";

interface Row {
  team: string;
  seats: number;
}

const rows: Row[] = [
  { team: "Acme", seats: 12 },
  { team: "Beta", seats: 3 },
  { team: "Acme", seats: 7 },
  { team: "Corp", seats: 20 },
];

const accessors: AccessorMap<Row> = {
  team: (r) => r.team,
  seats: (r) => r.seats,
};

describe("matchesFilter", () => {
  test("contains is case-insensitive", () => {
    expect(matchesFilter("Acme", "contains", "cm")).toBe(true);
    expect(matchesFilter("Acme", "contains", "xyz")).toBe(false);
  });

  test("equals / notEquals compare the whole value", () => {
    expect(matchesFilter("Acme", "equals", "acme")).toBe(true);
    expect(matchesFilter("Acme", "notEquals", "beta")).toBe(true);
  });

  test("numeric ops need both sides numeric, else no match", () => {
    expect(matchesFilter(12, "gt", "5")).toBe(true);
    expect(matchesFilter(12, "lte", "12")).toBe(true);
    expect(matchesFilter("x", "gt", "5")).toBe(false);
    expect(matchesFilter(12, "gt", "notanumber")).toBe(false);
  });
});

describe("applyFilters", () => {
  test("ANDs all filters", () => {
    const filters: ColumnFilter[] = [
      { columnKey: "team", op: "equals", value: "acme" },
      { columnKey: "seats", op: "gt", value: "10" },
    ];
    expect(applyFilters(rows, filters, accessors)).toEqual([
      { team: "Acme", seats: 12 },
    ]);
  });

  test("ignores a filter on an unknown column", () => {
    const filters: ColumnFilter[] = [
      { columnKey: "nope", op: "contains", value: "x" },
    ];
    expect(applyFilters(rows, filters, accessors)).toHaveLength(4);
  });
});

describe("sortRows", () => {
  test("sorts numerically ascending/descending; null sort is a copy", () => {
    const asc = sortRows(rows, { columnKey: "seats", dir: "asc" }, accessors);
    expect(asc.map((r) => r.seats)).toEqual([3, 7, 12, 20]);
    const desc = sortRows(rows, { columnKey: "seats", dir: "desc" }, accessors);
    expect(desc.map((r) => r.seats)).toEqual([20, 12, 7, 3]);
    expect(sortRows(rows, null, accessors)).toEqual(rows);
  });

  test("is stable on ties", () => {
    const byTeam = sortRows(rows, { columnKey: "team", dir: "asc" }, accessors);
    // The two Acme rows keep their original 12-then-7 order.
    const acme = byTeam.filter((r) => r.team === "Acme");
    expect(acme.map((r) => r.seats)).toEqual([12, 7]);
  });
});

describe("groupRows + aggregate", () => {
  test("groups by value in first-seen order with correct aggregates", () => {
    const groups = groupRows(rows, (r) => r.team);
    expect(groups.map((g) => g.key)).toEqual(["Acme", "Beta", "Corp"]);
    const acme = groups[0]!;
    expect(aggregate(acme.rows, (r) => r.seats, "count")).toBe(2);
    expect(aggregate(acme.rows, (r) => r.seats, "sum")).toBe(19);
    expect(aggregate(acme.rows, (r) => r.seats, "max")).toBe(12);
    expect(aggregate(acme.rows, (r) => r.seats, "avg")).toBe(9.5);
  });

  test("numeric aggregate over no numeric cells is null", () => {
    expect(aggregate(rows, (r) => r.team, "sum")).toBeNull();
  });
});

describe("compareCells", () => {
  test("sorts nullish last", () => {
    expect(compareCells(null, 5)).toBeGreaterThan(0);
    expect(compareCells(5, null)).toBeLessThan(0);
  });
});

describe("toCsv", () => {
  test("quotes fields with commas, quotes, or newlines and uses CRLF", () => {
    const csv = toCsv([
      ["team", "note"],
      ["Acme", "a,b"],
      ["Beta", 'say "hi"'],
    ]);
    expect(csv).toBe('team,note\r\nAcme,"a,b"\r\nBeta,"say ""hi"""');
  });

  test("neutralizes leading formula triggers with a quoted leading apostrophe", () => {
    // Pre-fix each of these exported live: =/+/-/@ open a formula in Excel/Sheets.
    expect(toCsv([["=1+2"]])).toBe(`"'=1+2"`);
    expect(toCsv([["+cmd"]])).toBe(`"'+cmd"`);
    expect(toCsv([["-2+3"]])).toBe(`"'-2+3"`);
    expect(toCsv([["@SUM(A1)"]])).toBe(`"'@SUM(A1)"`);
    // A trigger char mid-field is fine — only a LEADING one is dangerous.
    expect(toCsv([["a=b"]])).toBe("a=b");
    // Injection + embedded quote still escapes the quote inside the guard.
    expect(toCsv([['=HYPERLINK("x")']])).toBe(`"'=HYPERLINK(""x"")"`);
  });
});

describe("aggregate large-array safety", () => {
  test("min/max over 200k rows does not throw (no arg-limit spread)", () => {
    const big = Array.from({ length: 200_000 }, (_, i) => ({ n: i }));
    // Math.min(...nums) blows the call-argument limit (RangeError) around ~125k elements.
    expect(() => aggregate(big, (r) => r.n, "min")).not.toThrow();
    expect(aggregate(big, (r) => r.n, "min")).toBe(0);
    expect(aggregate(big, (r) => r.n, "max")).toBe(199_999);
  });
});

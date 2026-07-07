import { describe, expect, test } from "bun:test";

import { fuzzyFilter, fuzzyMatch } from "./fuzzy";

describe("fuzzyMatch", () => {
  test("matches an in-order subsequence, case-insensitively", () => {
    const m = fuzzyMatch("dtp", "DataTablePro");
    expect(m).not.toBeNull();
    expect(m!.indices).toEqual([0, 2, 9]); // D(0), first t(2), P(9)
  });

  test("returns null when a query char is missing or out of order", () => {
    expect(fuzzyMatch("xyz", "DataTablePro")).toBeNull();
    expect(fuzzyMatch("pt", "DataTablePro")).toBeNull(); // p after t only
  });

  test("an empty query matches with score 0", () => {
    expect(fuzzyMatch("", "anything")).toEqual({ score: 0, indices: [] });
  });

  test("ranks a contiguous / word-boundary hit above a scattered one", () => {
    const contiguous = fuzzyMatch("data", "DataTablePro")!;
    const scattered = fuzzyMatch("data", "dxaxtxa")!;
    expect(contiguous.score).toBeGreaterThan(scattered.score);
  });
});

describe("fuzzyFilter", () => {
  const items = ["DataTablePro", "TreePro", "OpsMatrix", "DateRangePicker"];

  test("empty query returns every item in original order", () => {
    expect(fuzzyFilter("  ", items, (s) => s)).toEqual(items);
  });

  test("filters to matches, best-first", () => {
    const out = fuzzyFilter("pro", items, (s) => s);
    expect(out).toContain("TreePro");
    expect(out).toContain("DataTablePro");
    expect(out).not.toContain("OpsMatrix");
  });

  test("ranks a word-start match ahead of a mid-word one", () => {
    const out = fuzzyFilter(
      "date",
      ["update-record", "DateRangePicker"],
      (s) => s,
    );
    expect(out[0]).toBe("DateRangePicker");
  });
});

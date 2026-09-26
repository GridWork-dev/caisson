// Unit tests for the PURE report-shaping function only — no live tsc/native-tsc binary spawn
// anywhere in this file (checkPackageDrift is impure, exercised only by the live
// dts-drift job in ci.yml), house style with tsgo-agreement.test.ts.
import { describe, expect, test } from "bun:test";
import { summarizeDrift } from "./dts-drift-check";
import type { PackageDriftResult } from "./dts-drift-check";

describe("summarizeDrift", () => {
  test("all identical: no drift, one table row per package", () => {
    const results: PackageDriftResult[] = [
      { pkg: "packages/kernel", status: "identical" },
      { pkg: "packages/ui", status: "identical" },
    ];
    const { anyDrift, table } = summarizeDrift(results);
    expect(anyDrift).toBe(false);
    expect(table).toEqual([
      "| package | status |",
      "|---|---|",
      "| packages/kernel | identical |",
      "| packages/ui | identical |",
    ]);
  });

  test("one differing package flips anyDrift true", () => {
    const results: PackageDriftResult[] = [
      { pkg: "packages/kernel", status: "identical" },
      {
        pkg: "packages/ui",
        status: "differing",
        diff: {
          identical: [],
          differing: ["index.d.ts"],
          onlyIn6: [],
          onlyIn7: [],
        },
      },
    ];
    expect(summarizeDrift(results).anyDrift).toBe(true);
  });

  test("a skipped package (compiler failed to emit) fails the gate without masquerading as drift", () => {
    const results: PackageDriftResult[] = [
      {
        pkg: "packages/kernel",
        status: "skipped",
        reason: "base tsc failed to emit: boom",
      },
    ];
    const summary = summarizeDrift(results);
    expect(summary).toMatchObject({ anyDrift: false, failed: true });
    expect(summary.table[2]).toBe(
      "| packages/kernel | skipped (base tsc failed to emit: boom) |",
    );
  });

  test("an empty result set fails the gate", () => {
    expect(summarizeDrift([])).toMatchObject({
      anyDrift: false,
      failed: true,
    });
  });

  test("an all-identical sweep passes the gate", () => {
    expect(
      summarizeDrift([{ pkg: "packages/kernel", status: "identical" }]),
    ).toMatchObject({ anyDrift: false, failed: false });
  });
});

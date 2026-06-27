import { describe, expect, test } from "bun:test";
import { runGate } from "./gate.ts";

describe("standards gate", () => {
  test("the repo conforms to the standard (no violations)", () => {
    const { violations } = runGate();
    if (violations.length > 0) {
      // Surface the detail so a failure is actionable, not just a count.
      console.error(violations);
    }
    expect(violations).toEqual([]);
  });

  test("kernel + testing are active (checked, not scaffold-skipped)", () => {
    const { checked } = runGate();
    expect(checked).toContain("packages/kernel");
    expect(checked).toContain("tooling/testing");
  });
});

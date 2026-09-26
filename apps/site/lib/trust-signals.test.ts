// Smoke test for the truthful-signals block (ADR-0374 lock 2): every signal is computed, never
// hand-typed, and the freshness gate on signal 3 degrades honestly instead of asserting a specific
// scenario the changelog will eventually outgrow (today's real fixture is fresh; a future run past
// the 90-day gate should read "Dated release history", not throw or drift into a false claim).
import { describe, expect, test } from "bun:test";

import { BASE_PACKAGES } from "./base-substrate";
import { truthfulSignals } from "./trust-signals";

describe("truthfulSignals", () => {
  test("returns exactly the three locked signals, in order, with real link targets", () => {
    const signals = truthfulSignals();
    expect(signals.map((s) => s.key)).toEqual([
      "open-base",
      "build-state",
      "docs-depth",
    ]);
    expect(signals.map((s) => s.href)).toEqual([
      "/docs/base",
      "/updates",
      "/docs",
    ]);
  });

  test("the open-base label is derived from BASE_PACKAGES.length, never hand-typed", () => {
    const signal = truthfulSignals().find((s) => s.key === "open-base");
    expect(signal?.label).toBe(
      `Apache-2.0 base, ${BASE_PACKAGES.length} packages`,
    );
  });

  test("the build-state label either names a real date or falls back honestly, never a raw ISO string", () => {
    const signal = truthfulSignals().find((s) => s.key === "build-state");
    expect(signal?.label).toMatch(
      /^(Latest update [A-Z][a-z]{2} \d{1,2}, \d{4}|Dated release history)$/,
    );
    // Never overclaims a versioned artifact (ChangelogEntry.version is optional) by naming a
    // specific "release" in the dated form — only the honest, ungated fallback string may.
    if (signal?.label.startsWith("Latest")) {
      expect(signal.label).not.toContain("release");
    }
  });

  test("the docs-depth label is a positive, computed page count", () => {
    const signal = truthfulSignals().find((s) => s.key === "docs-depth");
    const n = Number(signal?.label.split(" ")[0]);
    expect(n).toBeGreaterThan(0);
    expect(signal?.label).toBe(`${n} pages of documentation`);
  });
});

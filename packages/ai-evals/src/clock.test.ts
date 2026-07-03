// Clock-seam tests (ADR-0214). `systemClock`/`fixedClock`/`sequencedClock` in isolation, then the
// backtest guarantee itself: `defineEval` run twice — once against a live clock, once replayed
// against a fixed clock — produces IDENTICAL scoring output for identical input. That's the whole
// point of the seam: a backtest takes the exact same `defineEval` code path as a live run, with only
// the injected clock differing, so there is no replay-only branch to drift out of sync.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fixedClock, sequencedClock, systemClock } from "./clock.ts";
import { defineEval } from "./define-eval.ts";
import { exactGrader } from "./graders.ts";

describe("systemClock", () => {
  test("reads live wall-clock time", () => {
    const before = Date.now();
    const now = systemClock.now();
    const after = Date.now();
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });
});

describe("fixedClock", () => {
  test("returns the same instant on every call, from a Date or an ISO string", () => {
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");

    const fromDate = fixedClock(new Date("2027-06-15T12:00:00.000Z"));
    expect(fromDate.now().toISOString()).toBe("2027-06-15T12:00:00.000Z");
  });
});

describe("sequencedClock", () => {
  test("returns each timestamp once, in order, then repeats the last", () => {
    const clock = sequencedClock([
      "2026-01-01T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
    ]);
    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(clock.now().toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(clock.now().toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });

  test("an empty sequence throws (fail-closed, not a silent 'now')", () => {
    expect(() => sequencedClock([])).toThrow();
  });
});

describe("backtest-via-live-code-path replay (ADR-0214, the row-25 guarantee)", () => {
  const cases = [
    { id: "c1", input: {}, output: "hello", expected: { equals: "hello" } },
    { id: "c2", input: {}, output: "world", expected: { equals: "planet" } },
  ];

  async function runEval(clock?: Parameters<typeof defineEval>[0]["clock"]) {
    return defineEval({
      name: "backtest-replay",
      promptVersionId: "11111111-1111-4111-8111-111111111111",
      threshold: 0.5,
      cases,
      scorers: { exact: exactGrader() },
      ...(clock !== undefined ? { clock } : {}),
    });
  }

  test("a live run and a replayed run score identically given identical inputs", async () => {
    const live = await runEval(systemClock);
    const replayed = await runEval(fixedClock("2020-01-01T00:00:00.000Z"));

    // Everything scoring-related matches exactly — the seam changes nothing about how the eval runs.
    expect(replayed.score).toBe(live.score);
    expect(replayed.scorers).toEqual(live.scorers);
    expect(replayed.passed).toBe(live.passed);
    expect(replayed.scoredCases).toEqual(live.scoredCases);
    expect(replayed.cases).toBe(live.cases);

    // Only the stamped decision time differs — proof the clock is actually the injected seam, not
    // dead plumbing, and that the live run really did read a live instant.
    expect(replayed.ranAt).toBe("2020-01-01T00:00:00.000Z");
    expect(live.ranAt).not.toBe(replayed.ranAt);
  });

  test("defineEval with no clock defaults to systemClock (an unset seam is still live)", async () => {
    const before = Date.now();
    const run = await runEval(undefined);
    const after = Date.now();
    expect(new Date(run.ranAt!).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(run.ranAt!).getTime()).toBeLessThanOrEqual(after);
  });

  test("running the SAME eval twice with two different fixed clocks is fully deterministic", async () => {
    const a = await runEval(fixedClock("2021-01-01T00:00:00.000Z"));
    const b = await runEval(fixedClock("2099-12-31T23:59:59.000Z"));
    expect(a.score).toBe(b.score);
    expect(a.scoredCases).toEqual(b.scoredCases);
    expect(a.ranAt).not.toBe(b.ranAt);
  });
});

describe("Date.now()/new Date() call-site audit (ADR-0214)", () => {
  test("define-eval.ts, eval-ledger.ts, and reflexivity-queue.ts read the Clock seam in CODE, not a bare Date call (prose mentions in comments are fine)", () => {
    const dir = import.meta.dir;
    for (const file of [
      "define-eval.ts",
      "eval-ledger.ts",
      "reflexivity-queue.ts",
    ]) {
      const src = readFileSync(join(dir, file), "utf8");
      // Strip `/** ... */` JSDoc blocks and `//` line comments first — the doc comments in these
      // files legitimately NAME `Date.now()` while explaining why it's no longer called; only a
      // real (non-comment) call site would defeat the seam.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
      expect(code).not.toMatch(/Date\.now\(\)/);
      expect(code).not.toMatch(/new Date\(\)\.toISOString\(\)/);
    }
  });
});

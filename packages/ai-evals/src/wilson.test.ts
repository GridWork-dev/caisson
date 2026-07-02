// Wilson-CI tests (ADR-0208). Closed-form, no deps: CI tightens with sample size at the same 100%
// observed pass rate.
import { describe, expect, test } from "bun:test";
import { wilsonLowerBound } from "./wilson.ts";

describe("wilsonLowerBound", () => {
  test("n=large/100% → tight interval close to 1", () => {
    const lb = wilsonLowerBound(300, 300);
    expect(lb).toBeGreaterThan(0.95);
    expect(lb).toBeLessThanOrEqual(1);
  });

  test("n=3/100% → wide interval, below 0.5", () => {
    const lb = wilsonLowerBound(3, 3);
    expect(lb).toBeLessThan(0.5);
    expect(lb).toBeCloseTo(0.4385, 4);
  });

  test("the large-sample bound is tighter (higher) than the small-sample bound at the same rate", () => {
    expect(wilsonLowerBound(300, 300)).toBeGreaterThan(wilsonLowerBound(3, 3));
  });

  test("n=0 → 0 (no evidence, most conservative)", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  test("0 successes → a lower bound of 0", () => {
    expect(wilsonLowerBound(0, 10)).toBe(0);
  });

  test("z is respected: a looser z widens the interval (lowers the bound)", () => {
    const loose = wilsonLowerBound(8, 10, 1.0);
    const strict = wilsonLowerBound(8, 10, 2.58);
    expect(loose).toBeGreaterThan(strict);
  });
});

import { describe, expect, test } from "bun:test";

import { areaPath, extent, linearScale, linePath, niceTicks } from "./charts";

describe("extent", () => {
  test("returns min/max; empty is [0, 0]", () => {
    expect(extent([3, 1, 4, 1, 5, 9, 2])).toEqual([1, 9]);
    expect(extent([])).toEqual([0, 0]);
    expect(extent([7])).toEqual([7, 7]);
  });

  test("survives a large series without an arg-limit throw", () => {
    const big = Array.from({ length: 200_000 }, (_, i) => i);
    expect(() => extent(big)).not.toThrow();
    expect(extent(big)).toEqual([0, 199_999]);
  });
});

describe("linearScale", () => {
  test("maps the domain onto the range linearly", () => {
    const s = linearScale(0, 10, 0, 100);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(50);
    expect(s(10)).toBe(100);
  });

  test("inverts when the range is reversed (SVG y-down axis)", () => {
    const y = linearScale(0, 100, 200, 0);
    expect(y(0)).toBe(200);
    expect(y(100)).toBe(0);
  });

  test("a flat domain maps to the range midpoint, never NaN", () => {
    const s = linearScale(5, 5, 0, 80);
    expect(s(5)).toBe(40);
    expect(Number.isNaN(s(5))).toBe(false);
  });
});

describe("niceTicks", () => {
  test("covers the domain with round, evenly-spaced ticks", () => {
    const ticks = niceTicks(0, 100, 5);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(100);
    const step = ticks[1]! - ticks[0]!;
    for (let i = 1; i < ticks.length; i++) {
      expect(Number((ticks[i]! - ticks[i - 1]!).toFixed(6))).toBe(step);
    }
  });

  test("a zero-width or non-finite domain yields a single tick", () => {
    expect(niceTicks(42, 42)).toEqual([42]);
    expect(niceTicks(NaN, NaN)).toEqual([0]);
  });
});

describe("path builders", () => {
  const pts = [
    { x: 0, y: 10 },
    { x: 5, y: 0 },
    { x: 10, y: 8 },
  ];

  test("linePath threads points with M then L; empty is ''", () => {
    expect(linePath(pts)).toBe("M0 10 L5 0 L10 8");
    expect(linePath([])).toBe("");
  });

  test("areaPath closes down to the baseline", () => {
    expect(areaPath(pts, 20)).toBe("M0 10 L5 0 L10 8 L10 20 L0 20 Z");
    expect(areaPath([], 20)).toBe("");
  });
});

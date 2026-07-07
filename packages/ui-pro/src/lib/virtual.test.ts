import { describe, expect, test } from "bun:test";

import { windowRange } from "./virtual";

describe("windowRange", () => {
  test("windows around the scroll offset with overscan and honest spacers", () => {
    // 1000 rows, 40px each, 400px viewport, scrolled to 4000px (row 100), overscan 4.
    const w = windowRange(1000, 4000, 40, 400, 4);
    expect(w.start).toBe(96); // floor(4000/40) - 4
    expect(w.end).toBe(96 + 10 + 8); // start + ceil(400/40) + overscan*2
    expect(w.padTop).toBe(96 * 40);
    expect(w.padBottom).toBe((1000 - w.end) * 40);
    // spacers + rendered slice reconstruct the full scroll height
    expect(w.padTop + (w.end - w.start) * 40 + w.padBottom).toBe(1000 * 40);
  });

  test("clamps at the top", () => {
    const w = windowRange(1000, 0, 40, 400);
    expect(w.start).toBe(0);
    expect(w.padTop).toBe(0);
  });

  test("fail-closed: a non-positive/NaN row height renders all rows", () => {
    expect(windowRange(50, 0, 0, 400)).toEqual({
      start: 0,
      end: 50,
      padTop: 0,
      padBottom: 0,
    });
    expect(windowRange(50, 0, Number.NaN, 400).end).toBe(50);
  });

  test("empty list is an empty window", () => {
    expect(windowRange(0, 0, 40, 400)).toEqual({
      start: 0,
      end: 0,
      padTop: 0,
      padBottom: 0,
    });
  });
});

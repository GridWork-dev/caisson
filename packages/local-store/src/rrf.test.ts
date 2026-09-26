// The fusion arithmetic on its own, without a database. `store.test.ts` + `golden.test.ts` already
// pin the fused RANKING through `hybridSearch`; these cover what only the extracted function can be
// asked directly — the two guards and the unlimited form.
import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import { RRF_K, fuseByRrf } from "./rrf.ts";

const vec = { ranks: new Map([[1, 1]]), weight: 1 };

describe("fuseByRrf", () => {
  test("sums every leg a key appears in, and omits a key no leg reached", () => {
    const fused = fuseByRrf([
      { ranks: new Map([[1, 1]]), weight: 1 },
      { ranks: new Map([[2, 1]]), weight: 1 },
    ]);
    expect(fused).toEqual([
      { key: 1, score: 1 / (RRF_K + 1) },
      { key: 2, score: 1 / (RRF_K + 1) },
    ]);
  });

  test("an exact score tie breaks by key ascending, not by insertion order", () => {
    const fused = fuseByRrf([{ ranks: new Map([[9, 1]]), weight: 1 }, vec]);
    expect(fused.map((r) => r.key)).toEqual([1, 9]);
  });

  test("no `limit` keeps every row; a `limit` truncates the sorted ranking", () => {
    const legs = [
      {
        ranks: new Map([
          [1, 1],
          [2, 2],
          [3, 3],
        ]),
        weight: 1,
      },
    ];
    expect(fuseByRrf(legs)).toHaveLength(3);
    expect(fuseByRrf(legs, { limit: 2 }).map((r) => r.key)).toEqual([1, 2]);
  });

  test("a non-positive or non-finite rrfK throws (flag-never-guess)", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => fuseByRrf([vec], { rrfK: bad })).toThrow(ValidationError);
    }
  });

  test("a non-positive or non-finite leg weight throws (flag-never-guess)", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        fuseByRrf([{ ranks: new Map([[1, 1]]), weight: bad }]),
      ).toThrow(ValidationError);
    }
  });

  test("a negative, non-integer, or non-finite limit throws instead of silently truncating", () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => fuseByRrf([vec], { limit: bad })).toThrow(ValidationError);
    }
  });
});

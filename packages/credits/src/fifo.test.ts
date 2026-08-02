import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson/kernel";
import { planFifoDebit } from "./fifo.ts";

describe("planFifoDebit", () => {
  test("rejects malformed money before it can poison covered or shortfall", () => {
    for (const remaining of [Number.NaN, Infinity, -Infinity, 1.5]) {
      expect(() => planFifoDebit([{ id: "bad", remaining }], 1)).toThrow(
        ValidationError,
      );
    }

    // Validate the whole input, not only the prefix needed to cover this debit.
    expect(() =>
      planFifoDebit(
        [
          { id: "cover", remaining: 10 },
          { id: "bad-later", remaining: Number.NaN },
        ],
        1,
      ),
    ).toThrow(ValidationError);
  });

  test("non-positive remainders cannot make an uncovered debit look funded", () => {
    expect(
      planFifoDebit(
        [
          { id: "negative", remaining: -10 },
          { id: "drained", remaining: 0 },
        ],
        5,
      ),
    ).toEqual({ draws: [], covered: 0, shortfall: 5 });
  });
});

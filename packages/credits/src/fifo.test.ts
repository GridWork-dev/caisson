import { describe, expect, test } from "bun:test";
import { ValidationError, asCredits } from "@caisson-sh/kernel";
import type { TenantExecutor } from "@caisson-sh/tenancy-rls";
import { debit } from "./credits.ts";
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

  test("the server rejects a malformed query remainder before consumption or wallet update", async () => {
    const statements: string[] = [];
    const tx: TenantExecutor = {
      async query<T>(sql: string): Promise<{ rows: T[] }> {
        statements.push(sql);
        if (sql.includes("INSERT INTO credit_event")) {
          return { rows: [{ id: "debit_1" } as unknown as T] };
        }
        if (sql.includes("FROM credit_event g")) {
          return {
            rows: [
              {
                id: "grant_1",
                remaining: Number.NaN,
              } as unknown as T,
            ],
          };
        }
        return { rows: [] };
      },
      async exec(sql: string): Promise<unknown> {
        statements.push(sql);
        throw new Error("unexpected exec in debit remainder test");
      },
    };

    await expect(
      debit(tx, {
        accountId: "acct_bad_remainder",
        amount: asCredits(1),
        eventType: "codegen_debit",
        idempotencyKey: "debit_bad_remainder",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(
      statements.some((sql) => sql.includes("INSERT INTO grant_consumption")),
    ).toBe(false);
    expect(statements.some((sql) => sql.includes("UPDATE credit_wallet"))).toBe(
      false,
    );
  });
});

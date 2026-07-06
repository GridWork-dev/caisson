// RENEWAL_BOOK (ADR-0244/0251): fail-closed resolve, the branch predicate, placeholder hygiene, and
// the ONE-BOOK invariant — a provider price id lives in exactly one of PURCHASE_BOOK / PLAN_BOOK /
// RENEWAL_BOOK (a price id resolving in two books would double-fulfill a paid line).
import { describe, expect, test } from "bun:test";
import { PLAN_BOOK } from "./plans.ts";
import { PURCHASE_BOOK } from "./purchases.ts";
import {
  RENEWAL_BOOK,
  isRenewalPrice,
  parseRenewalBook,
  resolveRenewal,
} from "./renewals.ts";

describe("RENEWAL_BOOK (ADR-0251)", () => {
  test("a known renewal price resolves to the entitlement it renews", () => {
    expect(resolveRenewal("pri_01kwvz6kzh4h43aec3r5rs5je4")).toEqual({
      renewsEntitlement: "compliance",
    });
  });

  test("an unknown price id THROWS (fail-closed — never a guessed extension)", () => {
    expect(() => resolveRenewal("pri_unknown_00000000000000000000")).toThrow(
      /no renewal-book entry/,
    );
  });

  test("an inherited object key never resolves (own-property check)", () => {
    expect(() => resolveRenewal("__proto__")).toThrow();
    expect(isRenewalPrice("constructor")).toBe(false);
  });

  test("isRenewalPrice is the branch predicate — true for renewal SKUs, false otherwise", () => {
    expect(isRenewalPrice("pri_01kwvz6mcfzgjemqa72czdfkmq")).toBe(true);
    expect(isRenewalPrice("pri_01kwd76be2eq96kff5nqw236c0")).toBe(false); // a PURCHASE_BOOK id
  });

  test("every row parses under the strict boundary schema", () => {
    expect(() => parseRenewalBook(RENEWAL_BOOK)).not.toThrow();
    expect(() =>
      parseRenewalBook({ pri_x: { renewsEntitlement: "x", extra: 1 } }),
    ).toThrow();
  });

  test("every row carries a real Paddle price id (no placeholder left behind)", () => {
    for (const id of Object.keys(RENEWAL_BOOK)) {
      expect(id).toMatch(/^pri_01[a-z0-9]{24}$/);
      expect(id).not.toContain("placeholder");
    }
  });

  test("a price id lives in EXACTLY ONE of PURCHASE_BOOK / PLAN_BOOK / RENEWAL_BOOK", () => {
    const books: [string, Record<string, unknown>][] = [
      ["PURCHASE_BOOK", PURCHASE_BOOK],
      ["PLAN_BOOK", PLAN_BOOK],
      ["RENEWAL_BOOK", RENEWAL_BOOK],
    ];
    const seen = new Map<string, string>();
    for (const [name, book] of books) {
      for (const priceId of Object.keys(book)) {
        const prior = seen.get(priceId);
        expect(
          prior === undefined
            ? null
            : `${priceId} is in both ${prior} and ${name}`,
        ).toBeNull();
        seen.set(priceId, name);
      }
    }
  });
});

// plan-book unit tests (ADR-0089): resolvePlan is fail-closed (unknown id throws, never a guessed
// grant) and parsePlanBook rejects malformed rows at the boundary. Pure, no DB.
import { describe, expect, test } from "bun:test";
import { ConfigError, ValidationError } from "@caisson/kernel";
import { type PlanBookEntry, parsePlanBook, resolvePlan } from "./plans.ts";

describe("resolvePlan — fail-closed (ADR-0089 §6)", () => {
  test("an unknown price id throws (never a guessed grant)", () => {
    expect(() => resolvePlan("price_does_not_exist")).toThrow(ConfigError);
  });
  test("a known placeholder id returns its exact entry", () => {
    const entry = resolvePlan("price_developer_monthly_PLACEHOLDER");
    expect(entry.planTag).toBe("developer");
    expect(entry.creditsPerCycle).toBe(1000);
    expect(entry.cadence).toBe("month");
    expect(entry.entitlements).toEqual([]); // credits-only plan grants no edition
  });
  test("an edition plan carries its purchased-id entitlement (ADR-0071 — not the expanded slugs)", () => {
    // The plan carries WHAT WAS BOUGHT (the edition name); the index expands it to member slugs at
    // gate time (expandEntitlements). A plan never stores the leaf member set (ADR-0071 binding).
    expect(
      resolvePlan("price_compliance_updates_annual_PLACEHOLDER").entitlements,
    ).toEqual(["compliance"]);
  });
  test("resolvePlan reads an injected book", () => {
    const book: Record<string, PlanBookEntry> = {
      price_x: {
        planTag: "x",
        creditsPerCycle: 5,
        cadence: "year",
        entitlements: [],
      },
    };
    expect(resolvePlan("price_x", book).creditsPerCycle).toBe(5);
    expect(() =>
      resolvePlan("price_developer_monthly_PLACEHOLDER", book),
    ).toThrow(ConfigError);
  });
});

describe("parsePlanBook — strict boundary", () => {
  test("rejects a non-integer creditsPerCycle", () => {
    expect(() =>
      parsePlanBook({
        price_a: {
          planTag: "a",
          creditsPerCycle: 1.5,
          cadence: "month",
          entitlements: [],
        },
      }),
    ).toThrow(ValidationError);
  });
  test("rejects an unknown cadence", () => {
    expect(() =>
      parsePlanBook({
        price_a: {
          planTag: "a",
          creditsPerCycle: 5,
          cadence: "weekly",
          entitlements: [],
        },
      }),
    ).toThrow(ValidationError);
  });
  test("rejects a missing entitlements field (required, ADR-0071)", () => {
    expect(() =>
      parsePlanBook({
        price_a: { planTag: "a", creditsPerCycle: 5, cadence: "month" },
      }),
    ).toThrow(ValidationError);
  });
  test("rejects a non-string entitlement id", () => {
    expect(() =>
      parsePlanBook({
        price_a: {
          planTag: "a",
          creditsPerCycle: 5,
          cadence: "month",
          entitlements: [42],
        },
      }),
    ).toThrow(ValidationError);
  });
  test("accepts an edition entitlement", () => {
    const book = parsePlanBook({
      price_a: {
        planTag: "a",
        creditsPerCycle: 5,
        cadence: "month",
        entitlements: ["compliance"],
      },
    });
    expect(book.price_a?.entitlements).toEqual(["compliance"]);
  });
  test("rejects an unknown key (strict)", () => {
    expect(() =>
      parsePlanBook({
        price_a: {
          planTag: "a",
          creditsPerCycle: 5,
          cadence: "month",
          entitlements: [],
          extra: 1,
        },
      }),
    ).toThrow(ValidationError);
  });
});

import { expect, test } from "bun:test";
import { computeOwned } from "./plan-owned.ts";

test("an entitlement-bearing plan is owned only when every entitlement it grants is active", () => {
  expect(
    computeOwned(["compliance"], new Set(["compliance"]), new Set(), "pri_x"),
  ).toBe(true);
  expect(computeOwned(["compliance"], new Set(), new Set(), "pri_x")).toBe(
    false,
  );
  // Partial coverage (owns one of two entitlements a plan grants) still reads as NOT owned.
  expect(
    computeOwned(
      ["compliance", "everything"],
      new Set(["compliance"]),
      new Set(),
      "pri_x",
    ),
  ).toBe(false);
});

test("a zero-entitlement plan (Developer) is owned via an ACTIVE subscription_status row for its price id — never vacuously true", () => {
  expect(computeOwned([], new Set(), new Set(), "pri_dev")).toBe(false);
  expect(computeOwned([], new Set(), new Set(["pri_dev"]), "pri_dev")).toBe(
    true,
  );
  // A different account's active subscription on a DIFFERENT price id never leaks ownership here.
  expect(computeOwned([], new Set(), new Set(["pri_other"]), "pri_dev")).toBe(
    false,
  );
});

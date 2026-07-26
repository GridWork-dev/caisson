import { describe, expect, test } from "bun:test";

import { bundleUpgradeQuote } from "./upgrade-quote";

describe("bundleUpgradeQuote — F8 self-serve upgrade crediting (ADR-0247 F8 / ADR-0257)", () => {
  // The checkout reads the pre-declared pricebook credit map; it never recomputes bundle − owned ad-hoc.
  test("owns nothing → pays full bundle retail", () => {
    const q = bundleUpgradeQuote("compliance", []);
    expect(q.credit).toBe(0);
    expect(q.upgradePrice).toBe(q.bundleRetail);
  });

  test("crediting matrix across owned sets (Compliance $1,649)", () => {
    // [owned bare slugs] → expected credit off the $1,649 Compliance bundle.
    const cases: ReadonlyArray<readonly [readonly string[], number]> = [
      [["field-crypto"], 199],
      [["field-crypto", "audit-worm"], 348],
      [["compliance-core", "frameworks-pack"], 548],
      // an owned NON-member (ai-meter) is ignored, not credited
      [["field-crypto", "ai-meter"], 199],
    ];
    for (const [owned, credit] of cases) {
      const q = bundleUpgradeQuote("compliance", owned);
      expect(q.credit).toBe(credit);
      expect(q.upgradePrice).toBe(1649 - credit);
    }
  });

  test("owning enough members floors the upgrade price at $0 (never negative)", () => {
    // Every priced Compliance member: sum (2,319) exceeds the $1,649 retail → floored to 0.
    const allMembers = [
      "compliance-core",
      "frameworks-pack",
      "oscal-spine",
      "signing-primitive",
      "audit-worm",
      "field-crypto",
      "alerting",
      "retention-runner",
      "access-review",
      "risk-register",
      "trust-page",
    ];
    expect(bundleUpgradeQuote("compliance", allMembers).upgradePrice).toBe(0);
  });

  test("an unknown bundle id is fail-closed (throws, never a silent quote)", () => {
    expect(() =>
      bundleUpgradeQuote("not-a-bundle", ["field-crypto"]),
    ).toThrow();
  });
});

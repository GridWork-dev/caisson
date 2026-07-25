// F7/F8 upgrade book (ADR-0247 / ADR-0257 / ADR-0258). Pins the fail-closed credit resolution, the
// below-sum invariant over the pre-declared retail data, the $0 credit floor, and data integrity
// (every timeline member is priced).
import { describe, expect, test } from "bun:test";
import { BUNDLE_IDS } from "@caisson/registry-schema";
import {
  BUNDLE_MEMBERSHIP_BOOK,
  BUNDLE_RETAIL,
  SKU_RETAIL,
  bundleMembershipTimeline,
  creditableMembers,
  isCreditableMember,
  resolveUpgradeCredit,
  upgradeQuote,
} from "./upgrades.ts";

describe("resolveUpgradeCredit — fail-closed (ADR-0247 F8)", () => {
  test("a creditable member resolves to its retail", () => {
    expect(resolveUpgradeCredit("field-crypto", "compliance")).toBe(199);
    expect(resolveUpgradeCredit("compliance-core", "compliance")).toBe(299);
  });

  test("an item that is NOT a member of the bundle THROWS (unmapped pair, never a silent 0)", () => {
    // ai-meter is an AI-Production member, not a Compliance one — crediting it toward Compliance
    // would be a silent-0 overcharge; it must throw instead.
    expect(() => resolveUpgradeCredit("ai-meter", "compliance")).toThrow();
  });

  test("an unknown bundle id THROWS", () => {
    expect(() =>
      resolveUpgradeCredit("field-crypto", "no-such-bundle"),
    ).toThrow();
  });

  test("an unknown item toward a real bundle THROWS", () => {
    expect(() => resolveUpgradeCredit("not-a-sku", "compliance")).toThrow();
  });

  test("a hostile prototype key never resolves to a truthy member", () => {
    expect(() => resolveUpgradeCredit("__proto__", "compliance")).toThrow();
    expect(() => resolveUpgradeCredit("constructor", "everything")).toThrow();
  });

  test("everything credits every priced SKU at its retail", () => {
    expect(resolveUpgradeCredit("ui-pro", "everything")).toBe(129);
    expect(resolveUpgradeCredit("org-controls", "everything")).toBe(249);
  });
});

describe("upgradeQuote — bundle − owned, floored at $0 (ADR-0247 F8)", () => {
  test("no owned items → full bundle retail", () => {
    const q = upgradeQuote("compliance", []);
    expect(q.credit).toBe(0);
    expect(q.upgradePrice).toBe(BUNDLE_RETAIL.compliance);
  });

  test("owning a subset credits their retail, below the bundle price (below-sum)", () => {
    // field-crypto (199) + audit-worm (149) = 348 credited off Compliance $1,449.
    const q = upgradeQuote("compliance", ["field-crypto", "audit-worm"]);
    expect([...q.creditedItems].sort()).toEqual(["audit-worm", "field-crypto"]);
    expect(q.credit).toBe(348);
    expect(q.upgradePrice).toBe(1449 - 348);
    expect(q.upgradePrice).toBeGreaterThan(0);
  });

  test("owning EVERY member floors the upgrade price at $0 (credit ≥ bundle retail)", () => {
    const allMembers = creditableMembers("compliance");
    const q = upgradeQuote("compliance", allMembers);
    expect(q.credit).toBeGreaterThanOrEqual(BUNDLE_RETAIL.compliance);
    expect(q.upgradePrice).toBe(0); // never negative
  });

  test("owned items that are NOT members of the target bundle are ignored (no throw)", () => {
    // A Compliance-only owner upgrading to AI-Production: field-crypto IS a shared member (credited),
    // audit-worm is NOT an AI-Production member (ignored, not a fail-closed case).
    const q = upgradeQuote("ai-production", ["field-crypto", "audit-worm"]);
    expect(q.creditedItems).toEqual(["field-crypto"]);
    expect(q.credit).toBe(199);
    expect(q.upgradePrice).toBe(739 - 199);
  });

  test("duplicate owned ids are credited once", () => {
    const q = upgradeQuote("compliance", ["field-crypto", "field-crypto"]);
    expect(q.credit).toBe(199);
  });

  test("an unknown bundle id throws (fail-closed narrow)", () => {
    expect(() => upgradeQuote("nope", [])).toThrow();
  });
});

describe("data integrity — the pre-declared money data holds its invariants", () => {
  test("every timeline member across every persona bundle is priced in SKU_RETAIL", () => {
    for (const [bundleId, timeline] of Object.entries(BUNDLE_MEMBERSHIP_BOOK)) {
      for (const member of Object.keys(timeline)) {
        expect(
          Object.hasOwn(SKU_RETAIL, member),
          `${member} (member of ${bundleId}) is missing a SKU_RETAIL price`,
        ).toBe(true);
      }
    }
  });

  test("every timeline join date is a valid ISO instant", () => {
    for (const timeline of Object.values(BUNDLE_MEMBERSHIP_BOOK)) {
      for (const iso of Object.values(timeline)) {
        expect(Number.isNaN(Date.parse(iso))).toBe(false);
      }
    }
  });

  test("below-sum invariant: each bundle retail < Σ its members' retail (ADR-0258)", () => {
    for (const bundleId of BUNDLE_IDS) {
      const memberSum = creditableMembers(bundleId).reduce(
        (sum, id) => sum + resolveUpgradeCredit(id, bundleId),
        0,
      );
      expect(
        memberSum,
        `${bundleId}: member sum ${memberSum} must exceed retail ${BUNDLE_RETAIL[bundleId]}`,
      ).toBeGreaterThan(BUNDLE_RETAIL[bundleId]);
    }
  });

  test("every persona bundle's members are creditable; everything covers the whole priced catalog", () => {
    expect(isCreditableMember("field-crypto", "compliance")).toBe(true);
    expect(isCreditableMember("ai-meter", "compliance")).toBe(false);
    expect([...creditableMembers("everything")].sort()).toEqual(
      Object.keys(SKU_RETAIL).sort(),
    );
  });

  test("everything has no snapshot timeline (whole catalog, grandfathered)", () => {
    expect(bundleMembershipTimeline("everything")).toEqual({});
  });
});

// ADR-0381 lock 2 — the paid-price floor on an upgrade credit. `paidMinorUnits` is the buyer's own
// recorded charge (minor units, `entitlement_grant.charged_amount`); the credit is never below it.
describe("upgrade credit honours what the buyer actually paid (ADR-0381 lock 2)", () => {
  // `SKU_RETAIL` is keyed by plain string, so `noUncheckedIndexedAccess` widens a lookup to
  // `number | undefined`. Resolve it once, loudly, rather than asserting at each call site.
  const retailOf = (itemId: string): number => {
    const retail = SKU_RETAIL[itemId];
    if (retail === undefined) throw new Error(`no retail price for ${itemId}`);
    return retail;
  };

  test("omitted paid amount credits at retail — the pre-0381 behaviour", () => {
    expect(resolveUpgradeCredit("field-crypto", "compliance")).toBe(
      retailOf("field-crypto"),
    );
    expect(resolveUpgradeCredit("field-crypto", "compliance", undefined)).toBe(
      retailOf("field-crypto"),
    );
  });

  test("a paid price ABOVE current retail wins — a price cut never strands the buyer", () => {
    // Bought at $249 when the SKU listed higher; retail has since been cut to $199.
    expect(resolveUpgradeCredit("field-crypto", "compliance", 24900)).toBe(249);
  });

  test("a paid price BELOW retail does not reduce the credit — retail is the floor", () => {
    // A discounted/affiliate purchase still credits the full retail, never the discounted amount.
    expect(resolveUpgradeCredit("field-crypto", "compliance", 9900)).toBe(
      retailOf("field-crypto"),
    );
  });

  test("a fractional paid amount rounds UP, never below what was paid", () => {
    // $299.50 paid must credit at least $299.50 — flooring to 299 would break the clause.
    expect(resolveUpgradeCredit("field-crypto", "compliance", 29950)).toBe(300);
  });

  test("a zero paid amount is not treated as unknown — retail still applies", () => {
    expect(resolveUpgradeCredit("field-crypto", "compliance", 0)).toBe(
      retailOf("field-crypto"),
    );
  });

  test("a corrupt paid amount throws rather than crediting a fraction", () => {
    expect(() =>
      resolveUpgradeCredit("field-crypto", "compliance", -1),
    ).toThrow();
    expect(() =>
      resolveUpgradeCredit("field-crypto", "compliance", 199.5),
    ).toThrow();
  });

  test("a quote applies the floor per item and leaves unpriced items at retail", () => {
    const owned = ["field-crypto", "audit-worm"];
    const base = upgradeQuote("compliance", owned);
    // Only field-crypto has a recorded overpay; audit-worm keeps its retail credit.
    const withPaid = upgradeQuote("compliance", owned, {
      "field-crypto": 40000,
    });
    expect(withPaid.credit).toBe(base.credit - retailOf("field-crypto") + 400);
    expect(withPaid.upgradePrice).toBe(
      Math.max(0, BUNDLE_RETAIL.compliance - withPaid.credit),
    );
  });

  test("an inherited Object.prototype key is never read as a paid amount", () => {
    // `{}.constructor` is truthy; a bare index would smuggle it in as a money value.
    const quote = upgradeQuote("compliance", ["field-crypto"], {});
    expect(quote.credit).toBe(retailOf("field-crypto"));
  });

  test("a credit is never below the buyer's paid price, across the whole catalog", () => {
    for (const [itemId, retail] of Object.entries(SKU_RETAIL)) {
      const paidMinorUnits = (retail + 50) * 100;
      expect(
        resolveUpgradeCredit(itemId, "everything", paidMinorUnits),
      ).toBeGreaterThanOrEqual(paidMinorUnits / 100);
    }
  });
});

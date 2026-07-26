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
    expect(resolveUpgradeCredit("oscal-spine", "compliance")).toBe(249);
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
    // field-crypto (199) + audit-worm (149) = 348 credited off Compliance $1,649.
    const q = upgradeQuote("compliance", ["field-crypto", "audit-worm"]);
    expect([...q.creditedItems].sort()).toEqual(["audit-worm", "field-crypto"]);
    expect(q.credit).toBe(348);
    expect(q.upgradePrice).toBe(1649 - 348);
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

  test("the ADR-0383/0386 two-price move keeps the locked sums and ladder", () => {
    const complianceSum = creditableMembers("compliance").reduce(
      (sum, id) => sum + resolveUpgradeCredit(id, "compliance"),
      0,
    );
    const everythingSum = creditableMembers("everything").reduce(
      (sum, id) => sum + resolveUpgradeCredit(id, "everything"),
      0,
    );
    expect(SKU_RETAIL["oscal-spine"]).toBe(249);
    expect(BUNDLE_MEMBERSHIP_BOOK.compliance["oscal-spine"]).toBe(
      "2026-07-25T00:00:00.000Z",
    );
    expect(BUNDLE_RETAIL.compliance).toBe(1649);
    expect(BUNDLE_RETAIL.everything).toBe(2259);
    expect(complianceSum).toBe(2319);
    expect(everythingSum).toBe(4633);
    expect(BUNDLE_RETAIL.compliance).toBeLessThan(complianceSum);
    expect(BUNDLE_RETAIL.everything).toBeLessThan(everythingSum);
    expect(BUNDLE_RETAIL.everything).toBeGreaterThanOrEqual(
      BUNDLE_RETAIL.compliance,
    );
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

// ADR-0381 lock 2 — the paid-price floor on an upgrade credit. The paid amount is the buyer's own
// recorded charge as a {amountMinorUnits, currency} pair (`entitlement_grant.charged_amount` +
// `charged_currency`); the credit is never below it. The currency is load-bearing — 29900 is $299
// in USD and ¥29,900 in JPY, so an integer alone cannot be compared against a USD retail.
describe("upgrade credit honours what the buyer actually paid (ADR-0381 lock 2)", () => {
  // `SKU_RETAIL` is keyed by plain string, so `noUncheckedIndexedAccess` widens a lookup to
  // `number | undefined`. Resolve it once, loudly, rather than asserting at each call site.
  const retailOf = (itemId: string): number => {
    const retail = SKU_RETAIL[itemId];
    if (retail === undefined) throw new Error(`no retail price for ${itemId}`);
    return retail;
  };

  /** A USD charge in cents — the shape every pre-existing case in this block assumed. */
  const usd = (amountMinorUnits: number) => ({
    amountMinorUnits,
    currency: "usd",
  });

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
    expect(resolveUpgradeCredit("field-crypto", "compliance", usd(24900))).toBe(
      249,
    );
  });

  test("a paid price BELOW retail does not reduce the credit — retail is the floor", () => {
    // A discounted/affiliate purchase still credits the full retail, never the discounted amount.
    expect(resolveUpgradeCredit("field-crypto", "compliance", usd(9900))).toBe(
      retailOf("field-crypto"),
    );
  });

  test("a fractional paid amount rounds UP, never below what was paid", () => {
    // $299.50 paid must credit at least $299.50 — flooring to 299 would break the clause.
    expect(resolveUpgradeCredit("field-crypto", "compliance", usd(29950))).toBe(
      300,
    );
  });

  test("a zero paid amount is not treated as unknown — retail still applies", () => {
    expect(resolveUpgradeCredit("field-crypto", "compliance", usd(0))).toBe(
      retailOf("field-crypto"),
    );
  });

  test("a corrupt paid amount throws rather than crediting a fraction", () => {
    expect(() =>
      resolveUpgradeCredit("field-crypto", "compliance", usd(-1)),
    ).toThrow();
    expect(() =>
      resolveUpgradeCredit("field-crypto", "compliance", usd(199.5)),
    ).toThrow();
  });

  test("a quote applies the floor per item and leaves unpriced items at retail", () => {
    const owned = ["field-crypto", "audit-worm"];
    const base = upgradeQuote("compliance", owned);
    // Only field-crypto has a recorded overpay; audit-worm keeps its retail credit.
    const withPaid = upgradeQuote("compliance", owned, {
      "field-crypto": usd(40000),
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

  // The grill's P2 on PR #334: the quote API took a bare integer and divided it by 100, so a
  // ¥29,900 charge on a $249 SKU credited $299 — a currency converted by arithmetic accident.
  test("a NON-USD charge falls back to retail rather than being read as cents", () => {
    // 29900 is ¥29,900 (~$190 at any plausible rate), NOT 29,900 US cents.
    expect(
      resolveUpgradeCredit("field-crypto", "compliance", {
        amountMinorUnits: 29900,
        currency: "jpy",
      }),
    ).toBe(retailOf("field-crypto"));
    // The bug's signature: the old code returned 299 here.
    expect(
      resolveUpgradeCredit("field-crypto", "compliance", {
        amountMinorUnits: 29900,
        currency: "jpy",
      }),
    ).not.toBe(299);
  });

  test("currency is matched case-insensitively — providers send USD and usd", () => {
    expect(
      resolveUpgradeCredit("field-crypto", "compliance", {
        amountMinorUnits: 24900,
        currency: "USD",
      }),
    ).toBe(249);
  });

  test("a paid amount with no currency is a corrupt pair and throws", () => {
    // The CHECK constraint writes charged_amount and charged_currency together or not at all, so
    // an amount without one means a tampered or hand-written row. Never assume USD.
    expect(() =>
      resolveUpgradeCredit("field-crypto", "compliance", {
        amountMinorUnits: 24900,
        currency: "   ",
      }),
    ).toThrow();
  });

  test("a non-USD entry in a quote leaves that item at retail", () => {
    const quote = upgradeQuote("compliance", ["field-crypto", "audit-worm"], {
      "field-crypto": { amountMinorUnits: 4000000, currency: "jpy" },
    });
    const base = upgradeQuote("compliance", ["field-crypto", "audit-worm"]);
    expect(quote.credit).toBe(base.credit);
  });

  test("a credit is never below the buyer's paid price, across the whole catalog", () => {
    for (const [itemId, retail] of Object.entries(SKU_RETAIL)) {
      const cents = (retail + 50) * 100;
      expect(
        resolveUpgradeCredit(itemId, "everything", usd(cents)),
      ).toBeGreaterThanOrEqual(cents / 100);
    }
  });
});

import { describe, expect, test } from "bun:test";

import {
  addCartItem,
  CART_STORAGE_KEY,
  cartItemSchema,
  cartSubtotal,
  cartUpgrade,
  type CartItem,
  isInCart,
  parseStoredCart,
  pruneCart,
  prunedLines,
  removeCartItem,
  serializeCart,
} from "./cart";
import { LIVE_PRICE_IDS } from "./catalog";

const compliance: CartItem = {
  id: "compliance",
  priceId: "pri_01kwd76be2eq96kff5nqw236c0",
  label: "Compliance",
  amount: 799,
  kind: "edition",
};

const fieldCrypto: CartItem = {
  id: "field-crypto",
  priceId: "price_module_field_crypto_PLACEHOLDER",
  label: "Field encryption",
  amount: 199,
  kind: "module",
};

describe("cart item operations", () => {
  test("addCartItem appends a new item", () => {
    expect(addCartItem([], compliance)).toEqual([compliance]);
  });

  test("addCartItem is idempotent on id (no duplicate lines on re-add)", () => {
    const once = addCartItem([], compliance);
    const twice = addCartItem(once, compliance);
    expect(twice).toEqual([compliance]);
  });

  test("addCartItem does not mutate the input array", () => {
    const items: CartItem[] = [];
    addCartItem(items, compliance);
    expect(items).toEqual([]);
  });

  test("removeCartItem drops only the matching id", () => {
    const items = [compliance, fieldCrypto];
    expect(removeCartItem(items, "compliance")).toEqual([fieldCrypto]);
  });

  test("removeCartItem on an absent id is a no-op copy", () => {
    const items = [compliance];
    expect(removeCartItem(items, "bundle")).toEqual([compliance]);
  });

  test("cartSubtotal sums integer amounts", () => {
    expect(cartSubtotal([compliance, fieldCrypto])).toBe(998);
  });

  test("cartSubtotal of an empty cart is 0", () => {
    expect(cartSubtotal([])).toBe(0);
  });

  test("isInCart reflects membership", () => {
    expect(isInCart([compliance], "compliance")).toBe(true);
    expect(isInCart([compliance], "bundle")).toBe(false);
  });
});

describe("cart persistence (de)serialization", () => {
  test("round-trips through serialize/parse", () => {
    const items = [compliance, fieldCrypto];
    expect(parseStoredCart(serializeCart(items))).toEqual(items);
  });

  test("parseStoredCart on null is an empty cart", () => {
    expect(parseStoredCart(null)).toEqual([]);
  });

  test("parseStoredCart on an empty string is an empty cart", () => {
    expect(parseStoredCart("")).toEqual([]);
  });

  test("parseStoredCart on malformed JSON is an empty cart (fail-closed)", () => {
    expect(parseStoredCart("{not json")).toEqual([]);
  });

  test("parseStoredCart drops a payload with an unknown field (.strict())", () => {
    const tampered = JSON.stringify([{ ...compliance, extra: "x" }]);
    expect(parseStoredCart(tampered)).toEqual([]);
  });

  test("parseStoredCart drops a negative-amount line (schema floor)", () => {
    const tampered = JSON.stringify([{ ...compliance, amount: -1 }]);
    expect(parseStoredCart(tampered)).toEqual([]);
  });

  test("parseStoredCart drops a line with an unknown kind", () => {
    const tampered = JSON.stringify([{ ...compliance, kind: "subscription" }]);
    expect(parseStoredCart(tampered)).toEqual([]);
  });

  test("parseStoredCart drops a non-array payload", () => {
    expect(parseStoredCart(JSON.stringify({ id: "compliance" }))).toEqual([]);
  });
});

describe("pruneCart (stale persisted lines, ADR-0238)", () => {
  test("drops a line whose price id is not in the allowlist, keeps valid lines", () => {
    const retired: CartItem = {
      id: "module:compliance",
      priceId: "pri_01kwj6m31fxw5vn532h5ft6780", // retired edition-core row (ADR-0238)
      label: "Compliance core",
      amount: 299,
      kind: "module",
    };
    const pruned = pruneCart(
      [retired, compliance],
      new Set([compliance.priceId]),
    );
    expect(pruned).toEqual([compliance]);
  });

  test("the four retired ADR-0238 edition-core price ids are NOT in the live allowlist", () => {
    for (const priceId of [
      "pri_01kwj6m31fxw5vn532h5ft6780",
      "pri_01kwj6m55yagz7188qer0pa0cd",
      "pri_01kwj6m5mzyn76b8jkknmjndb4",
      "pri_01kwj6m6cbtsh6n5b1bxtb2j0k",
    ]) {
      expect(LIVE_PRICE_IDS.has(priceId)).toBe(false);
    }
  });

  test("every live catalog price id survives pruning (no false positives)", () => {
    const line: CartItem = {
      ...fieldCrypto,
      priceId: [...LIVE_PRICE_IDS][0] as string,
    };
    expect(pruneCart([line], LIVE_PRICE_IDS)).toEqual([line]);
  });
});

describe("prunedLines (G32 — the diff pruneCart surfaces as a notice)", () => {
  test("the dropped line is returned, the kept line is not", () => {
    const retired: CartItem = {
      id: "module:compliance",
      priceId: "pri_01kwj6m31fxw5vn532h5ft6780",
      label: "Compliance core",
      amount: 299,
      kind: "module",
    };
    const stored = [retired, compliance];
    const kept = pruneCart(stored, new Set([compliance.priceId]));
    expect(prunedLines(stored, kept)).toEqual([retired]);
  });

  test("nothing pruned → an empty diff", () => {
    const stored = [compliance];
    const kept = pruneCart(stored, new Set([compliance.priceId]));
    expect(prunedLines(stored, kept)).toEqual([]);
  });

  test("everything pruned → the whole stored cart is the diff", () => {
    const stored = [compliance, fieldCrypto];
    expect(prunedLines(stored, [])).toEqual(stored);
  });
});

describe("cartItemSchema", () => {
  test("accepts a well-formed item", () => {
    expect(cartItemSchema.safeParse(compliance).success).toBe(true);
  });

  test("rejects a blank id", () => {
    expect(cartItemSchema.safeParse({ ...compliance, id: "" }).success).toBe(
      false,
    );
  });
});

test("CART_STORAGE_KEY is namespaced and non-empty", () => {
  expect(CART_STORAGE_KEY.length).toBeGreaterThan(0);
  expect(CART_STORAGE_KEY.startsWith("cs-")).toBe(true);
});

describe("cartUpgrade (Everything nudge, ADR-0193/0258)", () => {
  const everything: CartItem = {
    id: "bundle:everything",
    priceId: "pri_01kyeczrjj0tzpwg7tv752e42s",
    label: "Everything",
    amount: 2259,
    kind: "bundle",
  };
  const line = (
    kind: "bundle" | "module",
    slug: string,
    amount: number,
  ): CartItem => ({
    id: `${kind}:${slug}`,
    priceId: "pri_x",
    label: slug,
    amount,
    kind,
  });

  test("suggests Everything when the cart totals more than it, with the real saving", () => {
    // Three module lines totalling 2,359 > the 2,259 bundle → save 100. Everything covers EVERY
    // sellable SKU by construction (the explicit full-catalog rule), so no line can disqualify.
    const u = cartUpgrade(
      [
        line("module", "compliance-core", 299),
        line("module", "org-controls", 249),
        line("module", "field-crypto", 1811),
      ],
      everything,
    );
    expect(u?.bundle.kind).toBe("bundle");
    expect(u?.saves).toBe(2359 - 2259);
  });

  test("no suggestion when the subtotal is at or below the bundle price", () => {
    // 299 + 249 = 548 < 2,259 → the bundle would cost MORE, so no fabricated saving.
    expect(
      cartUpgrade(
        [
          line("module", "compliance-core", 299),
          line("module", "org-controls", 249),
        ],
        everything,
      ),
    ).toBeUndefined();
  });

  test("no suggestion when a bundle is already in the cart", () => {
    expect(
      cartUpgrade(
        [line("bundle", "compliance", 1649), line("module", "ui-pro", 129)],
        everything,
      ),
    ).toBeUndefined();
  });

  test("no suggestion for an empty cart", () => {
    expect(cartUpgrade([], everything)).toBeUndefined();
  });
});

describe("forward-only bundle reprices", () => {
  test("persisted predecessor price ids are pruned while replacement ids remain live", () => {
    const oldCompliance: CartItem = {
      id: "bundle:compliance",
      priceId: "pri_01kwwqa2hne35c1df5xe8p91z3",
      label: "Compliance",
      amount: 1449,
      kind: "bundle",
    };
    const newCompliance: CartItem = {
      ...oldCompliance,
      priceId: "pri_01kyeczreqq58ze5en0p3f0jkc",
      amount: 1649,
    };
    expect(pruneCart([oldCompliance], LIVE_PRICE_IDS)).toEqual([]);
    expect(pruneCart([newCompliance], LIVE_PRICE_IDS)).toEqual([newCompliance]);
  });
});

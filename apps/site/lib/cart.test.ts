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
  removeCartItem,
  serializeCart,
} from "./cart";

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

describe("cartUpgrade (bundle nudge, ADR-0193)", () => {
  const bundle: CartItem = {
    id: "bundle",
    priceId: "pri_01kwd76bp60acq51mftvpgr42k",
    label: "Everything bundle",
    amount: 1499,
    kind: "bundle",
  };
  const edition = (slug: string, amount: number): CartItem => ({
    id: `edition:${slug}`,
    priceId: "pri_x",
    label: slug,
    amount,
    kind: "edition",
  });

  test("suggests the bundle when the cart totals more than it, with the real saving", () => {
    // 799 + 599 + 249 = 1647 > 1499 bundle → save 148.
    const u = cartUpgrade(
      [
        edition("compliance", 799),
        edition("ai-kit", 599),
        edition("agentic-dev", 249),
      ],
      bundle,
    );
    expect(u?.bundle.kind).toBe("bundle");
    expect(u?.saves).toBe(1647 - 1499);
  });

  test("no suggestion when the subtotal is at or below the bundle price", () => {
    // 799 + 599 = 1398 < 1499 → the bundle would cost MORE, so no fabricated saving.
    expect(
      cartUpgrade([edition("compliance", 799), edition("ai-kit", 599)], bundle),
    ).toBeUndefined();
  });

  test("no suggestion when a bundle is already in the cart", () => {
    expect(
      cartUpgrade([bundle, edition("compliance", 799)], bundle),
    ).toBeUndefined();
  });

  test("no suggestion for an empty cart", () => {
    expect(cartUpgrade([], bundle)).toBeUndefined();
  });
});

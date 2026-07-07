import { describe, expect, test } from "bun:test";

import type { CartItem } from "./cart";
import { applyBundleUpsell, bestBundleUpsell } from "./cart-upsell";
import { MODULE_PRICES } from "./pricing";

/** A module cart line for `slug`, priced from the real catalog (integer USD). */
function mod(slug: string): CartItem {
  const m = MODULE_PRICES.find((p) => p.id === slug);
  if (!m) throw new Error(`test fixture: unknown module ${slug}`);
  return {
    id: `module:${slug}`,
    priceId: `pri_test_${slug}`,
    label: m.label,
    amount: m.amount,
    kind: "module",
  };
}

function bundle(id: string, amount: number): CartItem {
  return {
    id: `bundle:${id}`,
    priceId: `pri_test_${id}`,
    label: id,
    amount,
    kind: "bundle",
  };
}

describe("bestBundleUpsell", () => {
  test("empty / no-module cart → no suggestion", () => {
    expect(bestBundleUpsell([])).toBeUndefined();
    expect(bestBundleUpsell([bundle("compliance", 1049)])).toBeUndefined();
  });

  test("overlap below 60% of the bundle price → no suggestion", () => {
    // field-crypto ($199) alone is far under 60% of any bundle it belongs to.
    expect(bestBundleUpsell([mod("field-crypto")])).toBeUndefined();
  });

  test("overlap ≥ 60% of the bundle price → suggests that bundle with pay-more delta", () => {
    // Compliance ($1049): compliance-core 299 + frameworks-pack 249 + field-crypto 199 = 747.
    // 747 ≥ 60% of 1049 (629.4) → qualifies; delta = 1049 - 747 = 302 (pay more for the whole bundle).
    const u = bestBundleUpsell([
      mod("compliance-core"),
      mod("frameworks-pack"),
      mod("field-crypto"),
    ]);
    expect(u?.bundleId).toBe("compliance");
    expect(u?.overlapSum).toBe(747);
    expect(u?.bundlePrice).toBe(1049);
    expect(u?.delta).toBe(302);
    expect(u?.memberCount).toBe(3);
    expect([...(u?.memberItemIds ?? [])].sort()).toEqual([
      "module:compliance-core",
      "module:field-crypto",
      "module:frameworks-pack",
    ]);
  });

  test("a bundle already in the cart is never suggested", () => {
    const cart = [
      bundle("compliance", 1049),
      mod("compliance-core"),
      mod("frameworks-pack"),
      mod("field-crypto"),
    ];
    expect(bestBundleUpsell(cart)).toBeUndefined();
  });

  test("picks the bundle the cart covers best when the threshold gates the others", () => {
    // signing-primitive 199 + audit-worm 149 + field-crypto 199 = 547.
    // Provenance ($399): all three are members, overlap 547 ≥ 239.4 → qualifies, coverage 547/547 = 1.
    // Compliance ($1049): the same 547 is < 629.4 → gated out. Result must be provenance.
    const u = bestBundleUpsell([
      mod("signing-primitive"),
      mod("audit-worm"),
      mod("field-crypto"),
    ]);
    expect(u?.bundleId).toBe("provenance");
    expect(u?.overlapSum).toBe(547);
    expect(u?.delta).toBe(399 - 547); // negative → a real saving
  });
});

describe("applyBundleUpsell", () => {
  test("removes the covered member lines and adds the bundle line", () => {
    const cart = [mod("agent-kernel"), mod("agent-runner"), mod("tool-exec")];
    const u = bestBundleUpsell(cart);
    expect(u?.bundleId).toBe("agentic-dev");
    const bundleItem = bundle("agentic-dev", 329);
    const next = applyBundleUpsell(cart, u!, bundleItem);
    expect(next.map((i) => i.id)).toEqual(["bundle:agentic-dev"]);
  });

  test("keeps unrelated lines and never duplicates the bundle", () => {
    const cart = [mod("agent-kernel"), mod("agent-runner"), mod("tool-exec")];
    const u = bestBundleUpsell(cart)!;
    const bundleItem = bundle("agentic-dev", 329);
    const withBundle = [...cart, bundleItem];
    const next = applyBundleUpsell(withBundle, u, bundleItem);
    expect(next.filter((i) => i.id === "bundle:agentic-dev")).toHaveLength(1);
  });
});

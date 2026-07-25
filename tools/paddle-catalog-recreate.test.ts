import { describe, expect, test } from "bun:test";

import {
  buildCatalogMapping,
  buildPlan,
  resolveExportPath,
  type PaddleObject,
} from "./paddle-catalog-recreate";

function completeSnapshot(): PaddleObject[] {
  return buildPlan().map((product, productIndex) => ({
    id: `pro_${String(productIndex).padStart(3, "0")}`,
    custom_data: { caisson_id: product.caissonId },
    prices: product.prices.map((price, priceIndex) => ({
      id: `pri_${String(productIndex).padStart(3, "0")}_${String(priceIndex).padStart(3, "0")}`,
      custom_data: { caisson_key: price.key },
    })),
  }));
}

describe("buildCatalogMapping", () => {
  test("exports one exact product and price id for every planned marker", () => {
    const mapping = buildCatalogMapping(buildPlan(), completeSnapshot());

    expect(Object.keys(mapping.products)).toHaveLength(35);
    expect(Object.keys(mapping.prices)).toHaveLength(66);
    expect(mapping.products.compliance).toBe("pro_000");
    expect(mapping.prices.compliance).toBe("pri_000_000");
    expect(mapping.prices["renew:agent-runner"]).toMatch(/^pri_/);
  });

  test("fails closed when an expected product is missing", () => {
    const snapshot = completeSnapshot();
    snapshot.pop();

    expect(() => buildCatalogMapping(buildPlan(), snapshot)).toThrow(
      /missing product marker/,
    );
  });

  test("fails closed on a duplicate price marker", () => {
    const snapshot = completeSnapshot();
    const firstPrice = snapshot[0]?.prices?.[0];
    if (!firstPrice) throw new Error("fixture is incomplete");
    snapshot[0]?.prices?.push({
      id: "pri_duplicate",
      custom_data: firstPrice.custom_data,
    });

    expect(() => buildCatalogMapping(buildPlan(), snapshot)).toThrow(
      /duplicate price marker/,
    );
  });

  test("fails closed on unexpected marked products and prices", () => {
    const extraProduct: PaddleObject = {
      id: "pro_extra",
      custom_data: { caisson_id: "not-in-the-plan" },
      prices: [],
    };
    expect(() =>
      buildCatalogMapping(buildPlan(), [...completeSnapshot(), extraProduct]),
    ).toThrow(/unexpected product marker/);

    const snapshot = completeSnapshot();
    snapshot[0]?.prices?.push({
      id: "pri_extra",
      custom_data: { caisson_key: "not-in-the-plan" },
    });
    expect(() => buildCatalogMapping(buildPlan(), snapshot)).toThrow(
      /unexpected price marker/,
    );
  });
});

describe("resolveExportPath", () => {
  test("allows a relative path contained by the working directory", () => {
    expect(
      resolveExportPath(
        "outputs/executions/paddle-production-map.json",
        "/repo",
      ),
    ).toBe("/repo/outputs/executions/paddle-production-map.json");
  });

  test("rejects absolute, traversal, and null-byte paths", () => {
    expect(() => resolveExportPath("/tmp/map.json", "/repo")).toThrow(
      /relative/,
    );
    expect(() => resolveExportPath("../map.json", "/repo")).toThrow(
      /traversal/,
    );
    expect(() => resolveExportPath("map\u0000.json", "/repo")).toThrow(
      /null byte/,
    );
  });
});

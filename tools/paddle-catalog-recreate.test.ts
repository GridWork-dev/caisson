import { describe, expect, test } from "bun:test";

import {
  classifyCatalogAudit,
  buildCatalogMapping,
  buildPlan,
  loadAuditCatalog,
  renderAuditReport,
  resolveExportPath,
  type PaddleObject,
  type PaddlePrice,
  type PlanProduct,
} from "./paddle-catalog-recreate";

type CompletePaddlePrice = PaddlePrice;

type CompletePaddleProduct = PaddleObject & {
  prices: CompletePaddlePrice[];
};

function completeSnapshot(): CompletePaddleProduct[] {
  return buildPlan().map((product, productIndex) => {
    const productId = `pro_${String(productIndex).padStart(3, "0")}`;
    return {
      id: productId,
      name: product.name,
      type: product.type,
      tax_category: product.taxCategory,
      status: product.status,
      custom_data: {
        caisson_id: product.caissonId,
        caisson_kind: product.kind,
      },
      prices: product.prices.map((price, priceIndex) => ({
        id: `pri_${String(productIndex).padStart(3, "0")}_${String(priceIndex).padStart(3, "0")}`,
        product_id: productId,
        description: price.description,
        type: price.type,
        billing_cycle:
          price.billingInterval === undefined
            ? null
            : {
                interval: price.billingInterval,
                frequency: price.billingFrequency,
              },
        unit_price: {
          amount: String(price.amountCents),
          currency_code: price.currencyCode,
        },
        status: price.status,
        custom_data: { caisson_key: price.key },
      })),
    };
  });
}

function plannedPrice(
  snapshot: CompletePaddleProduct[],
  marker: string,
): CompletePaddlePrice {
  const price = snapshot
    .flatMap((product) => product.prices)
    .find((candidate) => candidate.custom_data?.caisson_key === marker);
  if (!price) throw new Error(`fixture is missing price "${marker}"`);
  return price;
}

function firstPlannedProduct(
  snapshot: CompletePaddleProduct[],
): CompletePaddleProduct {
  const product = snapshot[0];
  if (!product) throw new Error("fixture is missing its first product");
  return product;
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
      /missing active product marker/,
    );
  });

  test("fails closed on a wrong amount", () => {
    const snapshot = completeSnapshot();
    plannedPrice(snapshot, "compliance").unit_price.amount = "100";

    expect(() => buildCatalogMapping(buildPlan(), snapshot)).toThrow(
      /amount mismatch/,
    );
  });

  test("fails closed on a wrong currency", () => {
    const snapshot = completeSnapshot();
    plannedPrice(snapshot, "compliance").unit_price.currency_code = "JPY";

    expect(() => buildCatalogMapping(buildPlan(), snapshot)).toThrow(
      /currency mismatch/,
    );
  });

  test("fails closed on a wrong cadence", () => {
    const recurringSnapshot = completeSnapshot();
    plannedPrice(recurringSnapshot, "compliance").billing_cycle = {
      interval: "year",
      frequency: 1,
    };
    expect(() => buildCatalogMapping(buildPlan(), recurringSnapshot)).toThrow(
      /billing cycle mismatch/,
    );

    const frequencySnapshot = completeSnapshot();
    plannedPrice(frequencySnapshot, "developer").billing_cycle = {
      interval: "year",
      frequency: 2,
    };
    expect(() => buildCatalogMapping(buildPlan(), frequencySnapshot)).toThrow(
      /billing cycle mismatch/,
    );
  });

  test("fails closed on a duplicate active price", () => {
    const snapshot = completeSnapshot();
    const compliancePrice = plannedPrice(snapshot, "compliance");
    snapshot.push({
      id: "pro_unmarked",
      name: "Unmarked product",
      type: "standard",
      tax_category: "saas",
      status: "active",
      custom_data: null,
      prices: [
        {
          ...compliancePrice,
          id: "pri_duplicate",
          product_id: "pro_unmarked",
        },
      ],
    });

    expect(() => buildCatalogMapping(buildPlan(), snapshot)).toThrow(
      /duplicate active price marker/,
    );
  });

  test("fails closed on a misplaced price", () => {
    const snapshot = completeSnapshot();
    plannedPrice(snapshot, "compliance").product_id = "pro_wrong_owner";

    expect(() => buildCatalogMapping(buildPlan(), snapshot)).toThrow(
      /owning product mismatch/,
    );
  });

  test("fails closed when locked product attributes drift", () => {
    const nameSnapshot = completeSnapshot();
    firstPlannedProduct(nameSnapshot).name = "Wrong name";
    expect(() => buildCatalogMapping(buildPlan(), nameSnapshot)).toThrow(
      /name mismatch/,
    );

    const typeSnapshot = completeSnapshot();
    firstPlannedProduct(typeSnapshot).type = "custom";
    expect(() => buildCatalogMapping(buildPlan(), typeSnapshot)).toThrow(
      /type mismatch/,
    );

    const taxSnapshot = completeSnapshot();
    firstPlannedProduct(taxSnapshot).tax_category = "standard";
    expect(() => buildCatalogMapping(buildPlan(), taxSnapshot)).toThrow(
      /tax category mismatch/,
    );

    const kindSnapshot = completeSnapshot();
    const kindProduct = firstPlannedProduct(kindSnapshot);
    kindProduct.custom_data = {
      ...kindProduct.custom_data,
      caisson_kind: "module",
    };
    expect(() => buildCatalogMapping(buildPlan(), kindSnapshot)).toThrow(
      /kind mismatch/,
    );
  });

  test("fails closed when locked price attributes drift", () => {
    const descriptionSnapshot = completeSnapshot();
    plannedPrice(descriptionSnapshot, "compliance").description =
      "Wrong description";
    expect(() => buildCatalogMapping(buildPlan(), descriptionSnapshot)).toThrow(
      /description mismatch/,
    );

    const typeSnapshot = completeSnapshot();
    plannedPrice(typeSnapshot, "compliance").type = "custom";
    expect(() => buildCatalogMapping(buildPlan(), typeSnapshot)).toThrow(
      /type mismatch/,
    );
  });

  test("requires active product and price status", () => {
    const productSnapshot = completeSnapshot();
    firstPlannedProduct(productSnapshot).status = "archived";
    expect(() => buildCatalogMapping(buildPlan(), productSnapshot)).toThrow(
      /status mismatch/,
    );

    const priceSnapshot = completeSnapshot();
    plannedPrice(priceSnapshot, "compliance").status = "archived";
    expect(() => buildCatalogMapping(buildPlan(), priceSnapshot)).toThrow(
      /missing active price marker/,
    );
  });

  test("fails closed on a duplicate price marker within a product", () => {
    const snapshot = completeSnapshot();
    const firstPrice = snapshot[0]?.prices[0];
    if (!firstPrice) throw new Error("fixture is incomplete");
    snapshot[0]?.prices.push({
      ...firstPrice,
      id: "pri_duplicate",
    });

    expect(() => buildCatalogMapping(buildPlan(), snapshot)).toThrow(
      /duplicate active price marker/,
    );
  });

  test("fails closed on unexpected marked products and prices", () => {
    const extraProduct: PaddleObject = {
      id: "pro_extra",
      name: "Unexpected product",
      type: "standard",
      tax_category: "saas",
      status: "active",
      custom_data: { caisson_id: "not-in-the-plan" },
      prices: [],
    };
    expect(() =>
      buildCatalogMapping(buildPlan(), [...completeSnapshot(), extraProduct]),
    ).toThrow(/unexpected product marker/);

    const snapshot = completeSnapshot();
    const firstPrice = snapshot[0]?.prices[0];
    if (!firstPrice) throw new Error("fixture is incomplete");
    snapshot[0]?.prices.push({
      ...firstPrice,
      id: "pri_extra",
      custom_data: { caisson_key: "not-in-the-plan" },
    });
    expect(() => buildCatalogMapping(buildPlan(), snapshot)).toThrow(
      /unexpected active price marker/,
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

describe("--audit", () => {
  const auditPlan: PlanProduct[] = [
    {
      caissonId: "expected",
      kind: "module",
      name: "Expected",
      type: "standard",
      status: "active",
      taxCategory: "saas",
      prices: [
        {
          key: "expected-price",
          description: "Expected price",
          type: "standard",
          status: "active",
          amountCents: 100,
          currencyCode: "USD",
        },
      ],
    },
    {
      caissonId: "duplicate",
      kind: "module",
      name: "Duplicate",
      type: "standard",
      status: "active",
      taxCategory: "saas",
      prices: [
        {
          key: "duplicate-price",
          description: "Duplicate price",
          type: "standard",
          status: "active",
          amountCents: 200,
          currencyCode: "USD",
        },
      ],
    },
    {
      caissonId: "missing",
      kind: "module",
      name: "Missing",
      type: "standard",
      status: "active",
      taxCategory: "saas",
      prices: [
        {
          key: "missing-price",
          description: "Missing price",
          type: "standard",
          status: "active",
          amountCents: 300,
          currencyCode: "USD",
        },
      ],
    },
  ];

  function auditProduct(
    id: string,
    marker: string | null,
    priceId: string,
    priceMarker: string | null,
  ): PaddleObject {
    return {
      id,
      name: id,
      type: "standard",
      tax_category: "saas",
      status: "active",
      custom_data: marker === null ? null : { caisson_id: marker },
      prices: [
        {
          id: priceId,
          product_id: id,
          description: priceId,
          type: "standard",
          billing_cycle: null,
          unit_price: { amount: "100", currency_code: "USD" },
          status: "active",
          custom_data:
            priceMarker === null ? null : { caisson_key: priceMarker },
        },
      ],
    };
  }

  test("classifies every live object exactly once and reports missing plan entries", () => {
    const products = [
      auditProduct(
        "pro_expected",
        "expected",
        "pri_expected",
        "expected-price",
      ),
      auditProduct("pro_unknown", "unknown", "pri_unknown", "unknown-price"),
      auditProduct("pro_unmarked", null, "pri_unmarked", null),
      auditProduct(
        "pro_duplicate_1",
        "duplicate",
        "pri_duplicate_1",
        "duplicate-price",
      ),
      auditProduct(
        "pro_duplicate_2",
        "duplicate",
        "pri_duplicate_2",
        "duplicate-price",
      ),
    ];
    const prices = products.flatMap((product) => product.prices);

    const report = classifyCatalogAudit(auditPlan, products, prices);

    expect(report.expected).toHaveLength(2);
    expect(report.unknownMarker).toHaveLength(2);
    expect(report.unmarked).toHaveLength(2);
    expect(report.duplicateMarker).toHaveLength(4);
    expect(report.missing).toHaveLength(2);

    const liveIds = [
      ...report.expected,
      ...report.unknownMarker,
      ...report.unmarked,
      ...report.duplicateMarker,
    ].map((item) => item.id);
    expect(new Set(liveIds).size).toBe(10);
    expect(liveIds).toHaveLength(10);

    const output = renderAuditReport(report, "sandbox");
    expect(output).toContain("EXPECTED (2)");
    expect(output).toContain("UNKNOWN MARKER (2)");
    expect(output).toContain("UNMARKED (pre-script/manual) (2)");
    expect(output).toContain("DUPLICATE MARKER (4)");
    expect(output).toContain("MISSING (2)");
    for (const id of [...liveIds, "missing", "missing-price"]) {
      expect(output).toContain(id);
    }
  });

  test("loads products and prices through GET-only pagination to exhaustion", async () => {
    const calls: Array<{ method: string; path: string }> = [];
    const pages = new Map<
      string,
      {
        data: unknown;
        meta: { pagination: { has_more: boolean; next: string } };
      }
    >([
      [
        "/products?per_page=200&status=active,archived",
        {
          data: [],
          meta: {
            pagination: { has_more: true, next: "/products?after=pro_1" },
          },
        },
      ],
      [
        "/products?after=pro_1",
        {
          data: [],
          meta: { pagination: { has_more: false, next: "" } },
        },
      ],
      [
        "/prices?per_page=200&status=active,archived",
        {
          data: [],
          meta: {
            pagination: { has_more: true, next: "/prices?after=pri_1" },
          },
        },
      ],
      [
        "/prices?after=pri_1",
        {
          data: [],
          meta: { pagination: { has_more: false, next: "" } },
        },
      ],
    ]);

    const snapshot = await loadAuditCatalog(async (method, path) => {
      calls.push({ method, path });
      const page = pages.get(path);
      if (!page) throw new Error(`unexpected audit path: ${path}`);
      return page;
    });

    expect(snapshot).toEqual({ products: [], prices: [] });
    expect(calls).toEqual([
      {
        method: "GET",
        path: "/products?per_page=200&status=active,archived",
      },
      { method: "GET", path: "/products?after=pro_1" },
      {
        method: "GET",
        path: "/prices?per_page=200&status=active,archived",
      },
      { method: "GET", path: "/prices?after=pri_1" },
    ]);
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });
});

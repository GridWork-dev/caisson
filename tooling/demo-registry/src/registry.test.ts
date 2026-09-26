import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CATALOG_ENTRIES, entriesByTier, listPackages } from "./registry.ts";

describe("CATALOG_ENTRIES", () => {
  test("loads without throwing and every id is unique", () => {
    // A duplicate/invalid entry throws at module load (see registry.ts's `validate`) — reaching
    // this line at all is half the assertion; the Set check below is the other half.
    const ids = new Set(CATALOG_ENTRIES.map((e) => e.id));
    expect(ids.size).toBe(CATALOG_ENTRIES.length);
  });

  test("covers the base kit, ui-pro, and per-package tiers", () => {
    expect(entriesByTier("apache-base").length).toBeGreaterThanOrEqual(30);
    expect(entriesByTier("ui-pro").length).toBe(11);
    expect(entriesByTier("per-package-ui").length).toBe(5);
  });

  test("listPackages enumerates every owning package once", () => {
    const packages = listPackages();
    expect(new Set(packages).size).toBe(packages.length);
    expect(packages).toContain("@caisson/ui");
    expect(packages).toContain("@caisson/ui-pro");
    expect(packages).toContain("@caisson/audit-worm");
  });

  test("every entry declares at least one variant and a non-empty description", () => {
    for (const e of CATALOG_ENTRIES) {
      expect(e.variants.length).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThan(0);
    }
  });

  test("pins the current Compliance price in rendered buyer demos", () => {
    const mobileBuyBar = CATALOG_ENTRIES.find(
      (entry) => entry.id === "ui.mobile-buy-bar",
    )?.render?.();
    const moneyCell = CATALOG_ENTRIES.find(
      (entry) => entry.id === "ui.money-cell",
    )?.render?.();

    expect(renderToStaticMarkup(mobileBuyBar)).toContain("$1,649");
    expect(renderToStaticMarkup(moneyCell)).toContain("$1,649.00");
  });
});

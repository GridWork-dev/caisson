// Data-lint for the bundle content records (the sibling of module-pages.test.ts): every bundle has a
// record, member ids that name a sellable SKU resolve, and the pop-out-only `everything` entry stays
// content-free. Keeps the pop-out and the standalone pages reading the same non-drifting source.
import { describe, expect, test } from "bun:test";

import { BUNDLE_PAGES, bundlePageRecord } from "./bundle-pages";
import { BUNDLE_PRICES, MODULE_PRICES, modulesByBundle } from "./pricing";

describe("BUNDLE_PAGES (bundle content records)", () => {
  test("every priced bundle has exactly one record (bijection with BUNDLE_PRICES)", () => {
    const priced = BUNDLE_PRICES.map((b) => b.id).sort();
    const recorded = BUNDLE_PAGES.map((r) => r.slug).sort();
    expect(recorded).toEqual(priced);
  });

  test("each record resolves via bundlePageRecord and carries hero + definition", () => {
    for (const b of BUNDLE_PRICES) {
      const r = bundlePageRecord(b.id);
      expect(r).toBeDefined();
      expect(r?.hero.eyebrow.length).toBeGreaterThan(0);
      expect(r?.hero.title.length).toBeGreaterThan(0);
      expect(r?.hero.lede.length).toBeGreaterThan(0);
      expect(r?.definition.length).toBeGreaterThan(0);
    }
  });

  test("the five persona/Provenance bundles carry members and FAQ; only everything is bare", () => {
    for (const r of BUNDLE_PAGES) {
      if (r.slug === "everything") {
        expect(r.members).toEqual([]);
        expect(r.faq).toEqual([]);
      } else {
        expect(r.members.length).toBeGreaterThan(0);
        expect(r.faq.length).toBeGreaterThan(0);
      }
    }
  });

  test("every member id that names a sellable SKU resolves in MODULE_PRICES", () => {
    const sellable = new Set(MODULE_PRICES.map((m) => m.id));
    // A member id is either a sellable module (priced, links out) or a base-package slug (unpriced).
    // The base-package ids are the non-sellable members the pages render unpriced.
    const basePackages = new Set([
      "kernel",
      "tenancy-rls",
      "migrate",
      "ai-config",
      "license-verify",
    ]);
    const unknown = BUNDLE_PAGES.flatMap((r) =>
      r.members
        .filter((m) => !sellable.has(m.id) && !basePackages.has(m.id))
        .map((m) => `${r.slug} -> ${m.id}`),
    );
    expect(unknown).toEqual([]);
  });

  test("provenance members mirror modulesByBundle ids + labels (rendered from the record)", () => {
    const record = bundlePageRecord("provenance");
    const members = modulesByBundle("provenance");
    expect(record?.members.map((m) => m.id)).toEqual(members.map((m) => m.id));
    expect(record?.members.map((m) => m.name)).toEqual(
      members.map((m) => m.label),
    );
  });
});

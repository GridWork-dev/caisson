// Data-lint for the bundle content records (the sibling of module-pages.test.ts): every bundle has a
// record, member ids that name a sellable SKU resolve, and the pop-out-only `everything` entry stays
// content-free. Keeps the pop-out and the standalone pages reading the same non-drifting source.
import { describe, expect, test } from "bun:test";

import { BUNDLE_PAGES, bundlePageRecord, spellCount } from "./bundle-pages";
import { BUNDLES, MODULES, modulesByBundle } from "./catalog";

describe("BUNDLE_PAGES (bundle content records)", () => {
  test("every priced bundle has exactly one record (bijection with BUNDLES)", () => {
    const priced = BUNDLES.map((b) => b.id).sort();
    const recorded = BUNDLE_PAGES.map((r) => r.slug).sort();
    expect(recorded).toEqual(priced);
  });

  test("each record resolves via bundlePageRecord and carries hero + definition", () => {
    for (const b of BUNDLES) {
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

  test("every member id that names a sellable SKU resolves in MODULES", () => {
    const sellable = new Set(MODULES.map((m) => m.id));
    // A member id is either a sellable module (priced, links out) or a base-package slug (unpriced).
    // The base-package ids are the non-sellable members the pages render unpriced.
    const basePackages = new Set([
      "kernel",
      "tenancy-rls",
      "migrate",
      "ai-config",
    ]);
    const unknown = BUNDLE_PAGES.flatMap((r) =>
      r.members
        .filter((m) => !sellable.has(m.id) && !basePackages.has(m.id))
        .map((m) => `${r.slug} -> ${m.id}`),
    );
    expect(unknown).toEqual([]);
  });

  test("no record carries a price (nothing on the site is for sale)", () => {
    const priced = BUNDLE_PAGES.flatMap((r) =>
      (JSON.stringify(r).match(/\$\d[\d,]*/g) ?? []).map(
        (f) => `${r.slug}: ${f}`,
      ),
    );
    expect(priced).toEqual([]);
  });

  test("the ai-production lede's member count matches the members it enumerates", () => {
    // The lede's closing sentence says "all seven modules below" and names each one; a member
    // add/remove would silently desync it (the four-vs-seven class the live re-audit caught).
    const record = bundlePageRecord("ai-production");
    expect(record?.members.length).toBe(7);
    expect(record?.hero.lede).toContain("all seven modules");
  });

  test("provenance members mirror modulesByBundle ids + labels (rendered from the record)", () => {
    const record = bundlePageRecord("provenance");
    const members = modulesByBundle("provenance");
    expect(record?.members.map((m) => m.id)).toEqual(members.map((m) => m.id));
    expect(record?.members.map((m) => m.name)).toEqual(
      members.map((m) => m.label),
    );
  });

  test("every persona bundle's priced members exactly match modulesByBundle (G31)", () => {
    // Order-independent (compliance/local-first/agentic-dev intersperse unpriced base-package
    // members in a different display order than modulesByBundle's catalog order) — this guards the
    // SET of priced members against under- or over-listing, the exact class G31 caught:
    // ai-production's hand-authored list showed 4 real modules against modulesByBundle's true 6
    // (missing field-crypto, ai-evals, credits).
    const sellableIds = new Set(MODULES.map((m) => m.id));
    for (const b of BUNDLES) {
      if (b.id === "everything") continue;
      const record = bundlePageRecord(b.id);
      const recordedSellable = [...(record?.members ?? [])]
        .map((m) => m.id)
        .filter((id) => sellableIds.has(id))
        .sort();
      const real = modulesByBundle(b.id)
        .map((m) => m.id)
        .sort();
      expect(recordedSellable).toEqual(real);
    }
  });

  test("every bundle's member count spells out correctly, and out-of-range falls back to a numeral", () => {
    for (const r of BUNDLE_PAGES) {
      if (r.slug === "everything") continue;
      expect(spellCount(r.members.length)).not.toBe(String(r.members.length));
    }
    expect(spellCount(0)).toBe("Zero");
    expect(spellCount(13)).toBe("Thirteen");
    expect(spellCount(14)).toBe("Fourteen");
    expect(spellCount(16)).toBe("16");
  });
});

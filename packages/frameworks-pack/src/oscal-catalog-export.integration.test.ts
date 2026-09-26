// src/evidence/oscal-catalog-export.test.ts — OSCAL catalog-model export (SPEC oscal-spine (a)).
import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import {
  OSCAL_VERSION,
  toOscalCatalog,
  type OscalCatalogExportOptions,
} from "@caisson-sh/oscal-spine";
import {
  euAiAct,
  hipaaSecurity,
  soc2Tsc,
  type Framework,
} from "@caisson-sh/frameworks-pack";

// The exporter and golden belong to oscal-spine; the framework data comes from this parent package.
const PKG_SRC_META = new URL("../../oscal-spine/src/index.ts", import.meta.url)
  .href;

const NOW = new Date("2026-07-18T00:00:00.000Z");

function counterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

function det(
  overrides?: Partial<OscalCatalogExportOptions>,
): OscalCatalogExportOptions {
  return {
    now: NOW,
    newId: counterIds(),
    title: "Caisson Canonical Control Catalog",
    version: "2026.1",
    ...overrides,
  };
}

const ALL_PACKS: readonly Framework[] = [soc2Tsc, hipaaSecurity, euAiAct];

describe("toOscalCatalog — merged catalog shape (F4: one document)", () => {
  test("emits a wrapped catalog document with required metadata", () => {
    const doc = toOscalCatalog(ALL_PACKS, det());
    expect(doc.catalog.uuid).toBe("00000000-0000-4000-8000-000000000001");
    expect(doc.catalog.metadata.title).toBe(
      "Caisson Canonical Control Catalog",
    );
    expect(doc.catalog.metadata.version).toBe("2026.1");
    expect(doc.catalog.metadata["oscal-version"]).toBe(OSCAL_VERSION);
    expect(doc.catalog.metadata["last-modified"]).toBe(NOW.toISOString());
  });

  test("groups mirror each control's own family field", () => {
    const doc = toOscalCatalog(ALL_PACKS, det());
    const groupIds = doc.catalog.groups.map((g) => g.id);
    expect(groupIds).toContain("access-control");
    expect(groupIds).toContain("data-protection");
    // groups are sorted lexicographically (determinism, independent of input order).
    expect(groupIds).toEqual([...groupIds].sort());
  });

  test("a control shared verbatim across packs (AUDIT.IMMUTABLE-LOG) is deduped to ONE entry, globally", () => {
    // AUDIT.IMMUTABLE-LOG carries a DIFFERENT `family` in eu-ai-act ("Record-Keeping") than in
    // soc2-tsc ("Audit & Accountability") — a real divergence in the shipped data, despite the
    // id/title/statement being reused verbatim. Dedup must be global (by id), never per-family,
    // or the same control id would land in two groups — which OSCAL forbids.
    const doc = toOscalCatalog(ALL_PACKS, det());
    const hits = doc.catalog.groups.flatMap((g) =>
      g.controls.filter((c) => c.id === "AUDIT.IMMUTABLE-LOG"),
    );
    expect(hits.length).toBe(1);
  });

  test("determinism holds even for a control whose family diverges across packs", () => {
    const a = toOscalCatalog([soc2Tsc, euAiAct], det());
    const b = toOscalCatalog([euAiAct, soc2Tsc], det());
    expect(a).toEqual(b);
  });

  test("a control carries its urn:caisson:control: link + caisson-family prop", () => {
    const doc = toOscalCatalog([soc2Tsc], det());
    const group = doc.catalog.groups.find((g) => g.id === "access-control");
    const control = group?.controls.find(
      (c) => c.id === "ACCESS-CONTROL.LOGICAL",
    );
    expect(control?.links).toEqual([
      { href: "urn:caisson:control:ACCESS-CONTROL.LOGICAL", rel: "canonical" },
    ]);
    expect(control?.props).toEqual([
      {
        name: "caisson-family",
        ns: "https://caisson.sh/ns/oscal",
        value: "Access Control",
      },
    ]);
  });

  test("a control's statement (and optional guidance) become OSCAL parts", () => {
    const doc = toOscalCatalog([soc2Tsc], det());
    const control = doc.catalog.groups
      .flatMap((g) => g.controls)
      .find((c) => c.id === "ACCESS-CONTROL.LOGICAL");
    const partNames = control?.parts.map((p) => p.name);
    expect(partNames).toContain("statement");
    expect(partNames).toContain("guidance");
  });

  test("controls within a group are sorted lexicographically by id", () => {
    const doc = toOscalCatalog(ALL_PACKS, det());
    for (const group of doc.catalog.groups) {
      const ids = group.controls.map((c) => c.id);
      expect(ids).toEqual([...ids].sort());
    }
  });

  test("fails closed on an invalid clock", () => {
    expect(() =>
      toOscalCatalog(ALL_PACKS, det({ now: new Date(Number.NaN) })),
    ).toThrow();
  });

  test("the default id source mints distinct random UUIDs per call", () => {
    const doc = toOscalCatalog(ALL_PACKS, {
      now: NOW,
      title: "t",
      version: "v",
    });
    const ids = new Set([
      doc.catalog.uuid,
      ...doc.catalog.groups.flatMap(() => []),
    ]);
    expect(ids.size).toBeGreaterThan(0);
  });
});

describe("toOscalCatalog — determinism", () => {
  test("identical input + injected clock/id seam yields a byte-identical document", () => {
    const a = toOscalCatalog(ALL_PACKS, det());
    const b = toOscalCatalog(ALL_PACKS, det());
    expect(a).toEqual(b);
  });

  test("input pack order never changes the output (groups/controls always sorted)", () => {
    const a = toOscalCatalog([soc2Tsc, hipaaSecurity, euAiAct], det());
    const b = toOscalCatalog([euAiAct, soc2Tsc, hipaaSecurity], det());
    expect(a).toEqual(b);
  });
});

describe("toOscalCatalog — copy floor (ADR-0080 / oscal-spine binding requirement 3)", () => {
  test("no group title, control title, or prose text claims compliant/certified/fedramp", () => {
    const doc = toOscalCatalog(ALL_PACKS, det());
    const forbidden = /\b(certified|compliant|fedramp)\b/i;
    expect(doc.catalog.metadata.title).not.toMatch(forbidden);
    for (const group of doc.catalog.groups) {
      expect(group.title).not.toMatch(forbidden);
      for (const control of group.controls) {
        expect(control.title).not.toMatch(forbidden);
        for (const part of control.parts) {
          expect(part.prose).not.toMatch(forbidden);
        }
      }
    }
  });
});

describe("toOscalCatalog — byte-stable golden", () => {
  test("the merged three-pack catalog is byte-stable", () => {
    matchGolden(
      PKG_SRC_META,
      "oscal-catalog.merged",
      toOscalCatalog(ALL_PACKS, det()),
    );
  });
});

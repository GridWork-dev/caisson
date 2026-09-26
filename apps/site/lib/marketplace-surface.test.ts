import { describe, expect, test } from "bun:test";

import { type DiagramKey, entryHasMedia, mediaSlides } from "./media-manifest";
import {
  ALL_ENTRIES,
  BUNDLE_ENTRIES,
  CATEGORIES,
  entryByViewId,
  MODULE_ENTRIES,
  PLATFORM,
  primaryCategory,
} from "./marketplace-surface";
import { BUNDLES, MODULES } from "./catalog";

describe("marketplace surface entries", () => {
  test("ALL_ENTRIES is every bundle + every module, bundles first", () => {
    expect(BUNDLE_ENTRIES.length).toBe(BUNDLES.length);
    expect(MODULE_ENTRIES.length).toBe(MODULES.length);
    expect(ALL_ENTRIES.length).toBe(BUNDLES.length + MODULES.length);
    expect(
      ALL_ENTRIES.slice(0, BUNDLES.length).every((e) => e.kind === "bundle"),
    ).toBe(true);
  });

  test("viewIds are unique and round-trip through entryByViewId", () => {
    const ids = ALL_ENTRIES.map((e) => e.viewId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of ALL_ENTRIES) {
      expect(entryByViewId(e.viewId)).toBe(e);
    }
    expect(entryByViewId("module:does-not-exist")).toBeUndefined();
  });

  test("demoHref points at the entry's own poke in the static /demos zone (a family borrows its hero's)", () => {
    for (const e of ALL_ENTRIES) {
      const poke = mediaSlides(e.kind, e.id).find(
        (s) => s.kind === "poke",
      )?.poke;
      expect(e.demoHref).toBe(poke ? `/demos/embed/${poke}` : null);
    }
    // Non-vacuous: every module but ui-pro has a demo, and the compliance family borrows field-crypto.
    expect(MODULE_ENTRIES.filter((e) => e.demoHref !== null).length).toBe(
      MODULES.length - 1,
    );
    expect(entryByViewId("bundle:compliance")?.demoHref).toBe(
      "/demos/embed/field-crypto",
    );
  });

  test("categories: Everything has none; a persona bundle is its own; a platform module is Platform", () => {
    const everything = entryByViewId("bundle:everything");
    expect(everything?.categories).toEqual([]);

    const compliance = entryByViewId("bundle:compliance");
    expect(compliance?.categories).toEqual(["compliance"]);

    // org-controls is a standalone platform SKU (no persona bundle grants it).
    const orgControls = entryByViewId("module:org-controls");
    expect(orgControls?.categories).toEqual([PLATFORM]);
    expect(primaryCategory(orgControls!)).toBe(PLATFORM);

    // A module never carries the whole-catalog Everything as a category.
    for (const e of MODULE_ENTRIES) {
      expect(e.categories).not.toContain("everything");
    }
  });

  test("CATEGORIES covers every entry's categories", () => {
    for (const e of ALL_ENTRIES) {
      for (const c of e.categories) {
        expect(CATEGORIES).toContain(c);
      }
    }
  });
});

describe("media manifest", () => {
  test("every sellable module except ui-pro carries an interactive proof", () => {
    for (const module of MODULES) {
      const pokes = mediaSlides("module", module.id).filter(
        (slide) => slide.kind === "poke",
      );
      expect(
        pokes.length,
        `${module.id}: expected exactly one interactive poke`,
      ).toBe(module.id === "ui-pro" ? 0 : 1);
    }
  });

  test("audit-worm carries its real code-artifact slide (ADR-0290 — no more video kind)", () => {
    const slides = mediaSlides("module", "audit-worm");
    expect(slides.some((s) => s.kind === "code-artifact")).toBe(true);
    expect(slides.some((s) => (s.kind as string) === "video")).toBe(false);
    expect(entryHasMedia("module", "audit-worm")).toBe(true);
  });

  test("ui-pro carries the component slide, not the old interactive kind", () => {
    const slides = mediaSlides("module", "ui-pro");
    expect(
      slides.some((s) => s.kind === "component" && s.component === "ui-pro"),
    ).toBe(true);
    expect(slides.some((s) => (s.kind as string) === "interactive")).toBe(
      false,
    );
  });

  test("field-crypto and the compliance bundle carry authored diagrams", () => {
    // field-crypto's diagram is its bespoke blueprint sheet (ADR-0377 pilot; the shared
    // mechanism diagrams retired with the ADR-0378 migrate-all wave).
    const fieldCrypto = mediaSlides("module", "field-crypto");
    expect(
      fieldCrypto.some((s) => s.diagram === "schematic-field-crypto"),
    ).toBe(true);
    // ADR-0378 bundle order post-migration: strata sheet → composition → borrowed hero poke.
    const compliance = mediaSlides("bundle", "compliance");
    expect(compliance.length).toBe(3);
    expect(compliance[0]?.diagram).toBe("schematic-compliance");
    expect(compliance[1]?.compositionBundle).toBe("compliance");
    expect(compliance[2]?.kind).toBe("poke");
    expect(compliance[2]?.poke).toBe("field-crypto");
  });

  test("code-artifact slides render a real depth-page artifact and count toward the MEDIA facet", () => {
    // prompt-registry post-ADR-0378: bespoke sheet, then its poke, then the live component,
    // then its module-pages.ts artifact — all four kinds present.
    const slides = mediaSlides("module", "prompt-registry");
    expect(slides.length).toBe(4);
    expect(slides.map((s) => s.kind)).toEqual([
      "diagram",
      "poke",
      "component",
      "code-artifact",
    ]);
    const code = slides.find((s) => s.kind === "code-artifact");
    expect(code?.artifact?.file).toBe("packages/prompt-registry/src/render.ts");
    const diagram = slides.find((s) => s.kind === "diagram");
    expect(diagram?.diagram).toBe("schematic-prompt-registry");
    expect(entryHasMedia("module", "prompt-registry")).toBe(true);
  });

  test("ADR-0308 full-depth: each module that ships a showable @caisson/ui surface carries its component slide (after any sheet + poke, ADR-0378)", () => {
    const expected: Record<string, string> = {
      "ui-pro": "ui-pro",
      "audit-worm": "audit-worm",
      "ai-meter": "ai-meter",
      "prompt-registry": "prompt-registry",
      "local-store": "local-store",
      credits: "credits",
    };
    for (const [id, key] of Object.entries(expected)) {
      const slides = mediaSlides("module", id);
      const sheetOrPoke = new Set(["poke"]);
      const lead = slides.findIndex(
        (s) =>
          !sheetOrPoke.has(s.kind) &&
          !(s.kind === "diagram" && s.diagram?.startsWith("schematic-")),
      );
      expect(
        slides[lead]?.kind === "component" && slides[lead]?.component === key,
        `module:${id} must carry its ${key} component slide directly after sheet/poke`,
      ).toBe(true);
    }
    // A backend-only module with no showable @caisson/ui surface carries no component slide —
    // field-crypto's interactive slide is its ADR-0378 poke, not a kit component.
    expect(
      mediaSlides("module", "field-crypto").some((s) => s.kind === "component"),
    ).toBe(false);
  });

  test("ADR-0378: the flagship modules carry their poke after the sheet, and the depth order is sheet then poke", () => {
    const flagships: Record<string, string> = {
      "field-crypto": "field-crypto",
      "audit-worm": "audit-worm",
      "ai-meter": "ai-meter",
      guardrails: "guardrails",
    };
    for (const [id, key] of Object.entries(flagships)) {
      const slides = mediaSlides("module", id, { omitCodeArtifact: true });
      expect(slides[0]?.kind, `module:${id} leads with its sheet or poke`).toBe(
        slides[0]?.diagram?.startsWith("schematic-") ? "diagram" : "poke",
      );
      const pokeAt = slides.findIndex((s) => s.kind === "poke");
      expect(pokeAt >= 0 && slides[pokeAt]?.poke === key).toBe(true);
    }
    // The card viewer hoists the poke to slide 1 (leadWithPoke).
    const viewer = mediaSlides("module", "field-crypto", {
      omitCodeArtifact: true,
      leadWithPoke: true,
    });
    expect(viewer[0]?.kind).toBe("poke");
  });

  test("ADR-0380: the three compliance-gap depth pages lead with their live poke, then their shipped schematic", () => {
    const modules = ["access-review", "risk-register", "trust-page"] as const;
    for (const id of modules) {
      const slides = mediaSlides("module", id, {
        omitCodeArtifact: true,
      });
      expect(slides.map((slide) => slide.kind)).toEqual(["poke", "diagram"]);
      expect(slides[0]?.poke).toBe(id);
      expect(slides[0]?.caption.length).toBeGreaterThan(0);
      expect(slides[1]?.diagram).toBe(`schematic-${id}` as DiagramKey);
      expect(slides[1]?.caption.length).toBeGreaterThan(0);
    }
  });

  test("ADR-0380 preserves schematic-first depth composition for an existing record", () => {
    const slides = mediaSlides("module", "field-crypto", {
      omitCodeArtifact: true,
    });
    expect(slides[0]?.diagram).toBe("schematic-field-crypto");
    expect(slides[1]?.poke).toBe("field-crypto");
  });

  test("every bundle carries a real composition slide naming its own member modules", () => {
    // ADR-0378 post-migration: every bundle has its strata sheet at slide 0; the composition
    // slide follows at slide 1.
    for (const b of BUNDLES) {
      const slides = mediaSlides("bundle", b.id);
      expect(slides[0]?.diagram).toBe(`schematic-${b.id}` as DiagramKey);
      expect(slides[1]?.compositionBundle).toBe(b.id);
    }
  });

  test("every catalog entry has real media — the 33/33 floor", () => {
    for (const e of ALL_ENTRIES) {
      expect(entryHasMedia(e.kind, e.id)).toBe(true);
    }
  });

  test("a genuinely unmapped entry still falls back to the placeholder slide", () => {
    const slides = mediaSlides("module", "does-not-exist-id");
    expect(slides.length).toBe(1);
    expect(slides[0]?.kind).toBe("image");
    expect(entryHasMedia("module", "does-not-exist-id")).toBe(false);
  });

  test("the SurfaceEntry.hasMedia flag agrees with entryHasMedia", () => {
    for (const e of ALL_ENTRIES) {
      expect(e.hasMedia).toBe(entryHasMedia(e.kind, e.id));
    }
  });

  test("omitCodeArtifact (ADR-0290 WR-03) drops the code-artifact slide but leaves other slides + entryHasMedia untouched", () => {
    const withCode = mediaSlides("module", "prompt-registry");
    const withoutCode = mediaSlides("module", "prompt-registry", {
      omitCodeArtifact: true,
    });
    expect(withCode.some((s) => s.kind === "code-artifact")).toBe(true);
    expect(withoutCode.some((s) => s.kind === "code-artifact")).toBe(false);
    // Default call sites (card viewer / preview dialog, entryHasMedia) are unaffected.
    expect(entryHasMedia("module", "prompt-registry")).toBe(true);

    // A diagram-carrying module keeps its diagram slide either way.
    const fieldCrypto = mediaSlides("module", "field-crypto", {
      omitCodeArtifact: true,
    });
    expect(fieldCrypto.some((s) => s.kind === "diagram")).toBe(true);
  });

  test("depth-page slides (omitCodeArtifact) still carry real media for EVERY module — the silent-placeholder guard", () => {
    // The module depth pages build their carousel with omitCodeArtifact (WR-03), so a module whose
    // only slide is its code artifact ships the bare brand placeholder there — silently. Every
    // module must own a diagram or component slide, so its depth page always shows real media; a
    // future module cannot pass the catalog-wide floor above on its code artifact alone.
    for (const e of MODULE_ENTRIES) {
      const slides = mediaSlides("module", e.id, { omitCodeArtifact: true });
      expect(
        slides.some((s) => s.kind === "diagram" || s.kind === "component"),
        `module:${e.id} has no diagram/component slide — its depth page would ship the bare placeholder`,
      ).toBe(true);
    }
  });
});

import { describe, expect, test } from "bun:test";

import { entryHasMedia, mediaSlides } from "./media-manifest";
import {
  ALL_ENTRIES,
  BUNDLE_ENTRIES,
  CATEGORIES,
  entryByViewId,
  MODULE_ENTRIES,
  PLATFORM,
  PRICE_BANDS,
  primaryCategory,
} from "./marketplace-surface";
import { BUNDLE_PRICES, MODULE_PRICES } from "./pricing";

describe("marketplace surface entries", () => {
  test("ALL_ENTRIES is every bundle + every module, bundles first", () => {
    expect(BUNDLE_ENTRIES.length).toBe(BUNDLE_PRICES.length);
    expect(MODULE_ENTRIES.length).toBe(MODULE_PRICES.length);
    expect(ALL_ENTRIES.length).toBe(
      BUNDLE_PRICES.length + MODULE_PRICES.length,
    );
    expect(
      ALL_ENTRIES.slice(0, BUNDLE_PRICES.length).every(
        (e) => e.kind === "bundle",
      ),
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

  test("every entry lands in exactly one price band (the bands partition the range)", () => {
    for (const e of ALL_ENTRIES) {
      const hits = PRICE_BANDS.filter((b) => b.test(e.amount));
      expect(hits.length).toBe(1);
    }
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
    expect(
      mediaSlides("module", "field-crypto").some((s) => s.kind === "diagram"),
    ).toBe(true);
    // compliance now leads with its bundle-composition slide, then its 3 mechanism diagrams.
    const compliance = mediaSlides("bundle", "compliance");
    expect(
      compliance.filter((s) => s.kind === "diagram" && s.diagram !== undefined)
        .length,
    ).toBe(3);
    expect(compliance[0]?.compositionBundle).toBe("compliance");
  });

  test("code-artifact slides render a real depth-page artifact and count toward the MEDIA facet", () => {
    // prompt-registry now leads with its live component (ADR-0306), then its module-pages.ts
    // artifact, then its mechanism diagram — all three kinds present.
    const slides = mediaSlides("module", "prompt-registry");
    expect(slides.length).toBe(3);
    expect(slides.map((s) => s.kind)).toEqual([
      "component",
      "code-artifact",
      "diagram",
    ]);
    const code = slides.find((s) => s.kind === "code-artifact");
    expect(code?.artifact?.file).toBe("packages/prompt-registry/src/render.ts");
    const diagram = slides.find((s) => s.kind === "diagram");
    expect(diagram?.diagram).toBe("prompt-render-boundary");
    expect(entryHasMedia("module", "prompt-registry")).toBe(true);
  });

  test("ADR-0306 full-depth: each module that ships a showable @caisson/ui surface leads with its component slide", () => {
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
      expect(
        slides[0]?.kind === "component" && slides[0]?.component === key,
        `module:${id} must lead with its ${key} component slide`,
      ).toBe(true);
    }
    // A backend-only module (no showable surface) legitimately carries no component slide.
    expect(
      mediaSlides("module", "field-crypto").some((s) => s.kind === "component"),
    ).toBe(false);
  });

  test("every bundle leads with a real composition slide naming its own member modules", () => {
    for (const b of BUNDLE_PRICES) {
      const slides = mediaSlides("bundle", b.id);
      expect(slides[0]?.kind).toBe("diagram");
      expect(slides[0]?.compositionBundle).toBe(b.id);
    }
    // Everything reuses the whole-catalog hero artifact (no per-module bundles[] members to list).
    const everything = mediaSlides("bundle", "everything");
    expect(everything[0]?.compositionBundle).toBe("everything");
  });

  test("every catalog entry has real media — the ADR-0290 28/28 floor", () => {
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
    // future module cannot pass the 28/28 floor above on its code artifact alone.
    for (const e of MODULE_ENTRIES) {
      const slides = mediaSlides("module", e.id, { omitCodeArtifact: true });
      expect(
        slides.some((s) => s.kind === "diagram" || s.kind === "component"),
        `module:${e.id} has no diagram/component slide — its depth page would ship the bare placeholder`,
      ).toBe(true);
    }
  });
});

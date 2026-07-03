import { describe, expect, test } from "bun:test";

import { GLOSSARY_TERMS, glossaryPageSpec } from "./glossary";

// Data-lint (glossary SPEC Task 5 verify) — this is batch 1 (renderer + hub + compliance cluster,
// ADR-0235 Fork C); later batches append pure data records, so this asserts a floor, never the
// eventual 32-term total.
describe("GLOSSARY_TERMS — data lint", () => {
  test("batch 1 ships at least the 12 committed terms", () => {
    expect(GLOSSARY_TERMS.length).toBeGreaterThanOrEqual(12);
  });

  test("every slug is unique", () => {
    const slugs = GLOSSARY_TERMS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("every term carries a non-empty code artifact", () => {
    for (const term of GLOSSARY_TERMS) {
      expect(term.artifact.code.trim().length).toBeGreaterThan(0);
    }
  });

  test("every term carries a sells.ctaHref", () => {
    for (const term of GLOSSARY_TERMS) {
      expect(term.sells.ctaHref.length).toBeGreaterThan(0);
    }
  });

  test("every definition is answer-first: 40-60 words", () => {
    for (const term of GLOSSARY_TERMS) {
      const words = term.definition.trim().split(/\s+/).filter(Boolean);
      expect(words.length).toBeGreaterThanOrEqual(40);
      expect(words.length).toBeLessThanOrEqual(60);
    }
  });

  test("every related slug resolves within GLOSSARY_TERMS (no dead cross-links)", () => {
    const slugs = new Set(GLOSSARY_TERMS.map((t) => t.slug));
    for (const term of GLOSSARY_TERMS) {
      for (const relatedSlug of term.related ?? []) {
        expect(slugs.has(relatedSlug)).toBe(true);
      }
    }
  });
});

describe("glossaryPageSpec — the ordered section builder", () => {
  test("emits hero -> section -> codeArtifact -> featureGrid -> faq -> [section] -> cta, in order", () => {
    const withRelated = GLOSSARY_TERMS.find(
      (t) => (t.related ?? []).length > 0,
    );
    expect(withRelated).toBeDefined();
    const spec = glossaryPageSpec(withRelated!);
    expect(spec.sections.map((s) => s.kind)).toEqual([
      "hero",
      "section",
      "codeArtifact",
      "featureGrid",
      "faq",
      "section",
      "cta",
    ]);
  });

  test("a term with no resolvable related terms skips the related-terms section", () => {
    const noRelated = GLOSSARY_TERMS.find(
      (t) => (t.related ?? []).length === 0,
    );
    expect(noRelated).toBeDefined();
    const spec = glossaryPageSpec(noRelated!);
    expect(spec.sections.map((s) => s.kind)).toEqual([
      "hero",
      "section",
      "codeArtifact",
      "featureGrid",
      "faq",
      "cta",
    ]);
  });

  test("meta.path is /glossary/<slug> for every term", () => {
    for (const term of GLOSSARY_TERMS) {
      const spec = glossaryPageSpec(term);
      expect(spec.meta.path).toBe(`/glossary/${term.slug}`);
    }
  });
});

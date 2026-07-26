import { describe, expect, test } from "bun:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GLOSSARY_TERMS, glossaryPageSpec, renderInlineCode } from "./glossary";

// Data-lint (glossary SPEC Task 5 verify). ADR-0235 locked the first 32 terms; the AEO program
// (CAISSON-29 / D5, 2026-07-07) added 3 long-tail explainers (WORM-for-SaaS, OSCAL-export-from-TS,
// multi-tenant-RLS-for-compliance) as the new operator lock Fork A requires ("never add without a
// new lock"); eu-ai-act-article-50 landed via the Kickoff-J picker (CAISSON-79); ADR-0367 locked
// the 7-term expansion batch (TSA/Rekor/receipt/crosswalk/anchor/trajectory/token-hash) and the
// batch-3 mechanism terms (outbox/idempotency/canonical-json/AAD/redaction/injection/replay, both 2026-07-19).
// This pins the current total; a drift in either direction is a bug.
describe("GLOSSARY_TERMS — data lint", () => {
  test("all 50 locked terms ship (SPEC Task 5 gate, ADR-0235 Fork A + CAISSON-29 + CAISSON-79 + the ADR-0367 expansion batch)", () => {
    expect(GLOSSARY_TERMS.length).toBe(50);
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

  test("renderInlineCode wraps backtick spans in <code>, leaves plain prose a string", () => {
    expect(renderInlineCode("no code here")).toBe("no code here");
    const html = renderToStaticMarkup(
      renderInlineCode("the `audit-worm` package") as ReactElement,
    );
    expect(html).toContain('<code class="cs-code-inline">audit-worm</code>');
    expect(html).not.toContain("`");
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
    // Every live term now carries curated related links (Fork D), so exercise the builder's
    // skip branch with a synthetic record rather than coupling the contract to live data.
    const noRelated = { ...GLOSSARY_TERMS[0]!, related: [] };
    const spec = glossaryPageSpec(noRelated);
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

  test("hero.ctas carries a visible Glossary breadcrumb back to /glossary", () => {
    const term = GLOSSARY_TERMS[0]!;
    const hero = glossaryPageSpec(term).sections[0];
    if (hero?.kind !== "hero") throw new Error("expected a hero section");
    const html = renderToStaticMarkup(hero.ctas as ReactElement);
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/glossary"');
    expect(html).toContain("Glossary");
    expect(html).toContain(term.term);
  });
});

describe("envelope-encryption production parity", () => {
  const term = GLOSSARY_TERMS.find(
    ({ slug }) => slug === "envelope-encryption",
  );

  test("shows the same bounded KMS operation seam used by production", () => {
    expect(term).toBeDefined();
    expect(term?.artifact.code).toContain(
      "private readonly operationOptions: KmsOperationOptions",
    );
    expect(term?.artifact.code).toContain(
      "this.kms.generateDataKey(tenantId, this.operationOptions)",
    );
    expect(term?.artifact.code).toContain(
      "this.kms.decryptDataKey(tenantId, wrapped, this.operationOptions)",
    );
  });

  test("describes the actual Azure default credential chain", () => {
    const backendCopy = term?.properties.find(
      ({ title }) => title === "Three shipped cloud backends, one KMS port",
    )?.body;
    expect(backendCopy).toContain("default Azure credential chain");
    expect(backendCopy).not.toContain("explicit service-principal");
  });
});

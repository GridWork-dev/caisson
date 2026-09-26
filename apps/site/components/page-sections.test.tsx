import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { PageSection } from "@/lib/page-sections";

import { PageSections } from "./page-sections";

// Render smoke tests — one per `kind` (renderer SPEC §3, glossary SPEC Task 2 verify): each
// variant must render its mapped @caisson-sh/ui / site primitive.
describe("<PageSections> — exhaustive switch renderer", () => {
  test("hero → <Hero>", () => {
    const html = renderToStaticMarkup(
      <PageSections
        sections={[
          {
            kind: "hero",
            eyebrow: "Glossary",
            title: "WORM audit log",
            lede: "A write-once, read-many log an attacker cannot edit or delete.",
          },
        ]}
      />,
    );
    expect(html).toContain("cs-hero");
    expect(html).toContain("WORM audit log");
  });

  test("section → <Section>", () => {
    const html = renderToStaticMarkup(
      <PageSections
        sections={[{ kind: "section", eyebrow: "Definition", lede: "..." }]}
      />,
    );
    expect(html).toContain("cs-section");
    expect(html).toContain("Definition");
  });

  test("featureGrid → <FeatureGrid> of <Card>s", () => {
    const html = renderToStaticMarkup(
      <PageSections
        sections={[
          {
            kind: "featureGrid",
            items: [
              { title: "Append-only", body: "Every row chains to the last." },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain("cs-feature-grid");
    expect(html).toContain("cs-card");
    expect(html).toContain("Append-only");
  });

  test("controlMap → Card + framed CodeBlock per row", () => {
    const html = renderToStaticMarkup(
      <PageSections
        sections={[
          {
            kind: "controlMap",
            items: [
              {
                title: "Record-keeping",
                body: "Every inference hashes into an append-only chain.",
                code: "await verifyChain(db)",
                clause: "Art. 12",
              },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain("cs-card");
    expect(html).toContain("cs-terminal");
    expect(html).toContain("await verifyChain(db)");
    expect(html).toContain("Art. 12");
  });

  test("codeArtifact → framed <CodeBlock> inside a .cs-container", () => {
    const html = renderToStaticMarkup(
      <PageSections
        sections={[
          {
            kind: "codeArtifact",
            code: "await verifyChain(db)",
            label: "kernel",
          },
        ]}
      />,
    );
    expect(html).toContain("cs-terminal");
    expect(html).toContain("await verifyChain(db)");
    expect(html).toContain("cs-container");
    expect(html.indexOf("cs-container")).toBeLessThan(
      html.indexOf("cs-terminal"),
    );
  });

  test("comparison → <SkuMatrix>", () => {
    const html = renderToStaticMarkup(
      <PageSections
        sections={[
          {
            kind: "comparison",
            columns: ["Base"],
            rows: [{ label: "Audit log", cells: [true] }],
          },
        ]}
      />,
    );
    expect(html).toContain("cs-matrix");
    expect(html).toContain("Audit log");
  });

  test("faq → <Faq> disclosure list", () => {
    const html = renderToStaticMarkup(
      <PageSections
        sections={[
          {
            kind: "faq",
            items: [{ question: "What is a WORM log?", answer: "..." }],
          },
        ]}
      />,
    );
    expect(html).toContain("cs-faq");
    expect(html).toContain("What is a WORM log?");
  });

  test("cta → primary + optional secondary <Button>", () => {
    const html = renderToStaticMarkup(
      <PageSections
        sections={[
          {
            kind: "cta",
            title: "Ship it",
            primary: { label: "Get Compliance", href: "/marketplace" },
            secondary: { label: "Read the docs", href: "/docs" },
          },
        ]}
      />,
    );
    expect(html).toContain("cs-cta-row");
    expect(html).toContain("Get Compliance");
    expect(html).toContain("Read the docs");
  });

  test("custom → the node verbatim, unflattened", () => {
    const html = renderToStaticMarkup(
      <PageSections
        sections={[
          {
            kind: "custom",
            node: <span data-testid="hand-authored">raw</span>,
          },
        ]}
      />,
    );
    expect(html).toContain('data-testid="hand-authored"');
  });

  test("a mixed-kind array renders every section in order", () => {
    const sections: PageSection[] = [
      { kind: "hero", eyebrow: "e", title: "t", lede: "l" },
      { kind: "faq", items: [{ question: "q", answer: "a" }] },
      { kind: "custom", node: "tail" },
    ];
    const html = renderToStaticMarkup(<PageSections sections={sections} />);
    expect(html.indexOf("cs-hero")).toBeLessThan(html.indexOf("cs-faq"));
    expect(html.indexOf("cs-faq")).toBeLessThan(html.indexOf("tail"));
  });
});

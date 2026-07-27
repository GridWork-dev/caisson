import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import WritingHubPage from "../app/(marketing)/writing/page";
import { generateStaticParams } from "../app/(marketing)/writing/[slug]/page";
import sitemap from "../app/sitemap";
import { PageSections } from "../components/page-sections";
import { MARKETING_ROUTES } from "./routes";
import { techArticle } from "./jsonld";
import {
  WRITING_PIECES,
  writingLastModified,
  writingPageSpec,
  type WritingPiece,
} from "./writing";

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function pieceHref(piece: WritingPiece): string {
  return `/writing/${piece.slug}`;
}

const EVERGREEN_ONLY_ARTICLE_50_CONCEPTS = [
  /\bemotion[- ]recognition\b/iu,
  /\bbiometric categorisation\b/iu,
  /\bqualified law[- ]enforcement exception\b/iu,
  /\bpersonal[- ]data law\b/iu,
  /\baccessibility requirements\b/iu,
  /\bEUR 15 million\b/iu,
  /\bworldwide annual turnover\b/iu,
  /\bmarket[- ]surveillance authorities\b/iu,
] as const;

function evergreenOnlyMatches(value: string): readonly RegExp[] {
  return EVERGREEN_ONLY_ARTICLE_50_CONCEPTS.filter((pattern) =>
    pattern.test(value),
  );
}

describe("WRITING_PIECES registry", () => {
  test("slugs are unique", () => {
    const slugs = WRITING_PIECES.map((piece) => piece.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("every piece is linked from the /writing hub", () => {
    const html = renderToStaticMarkup(WritingHubPage());
    for (const piece of WRITING_PIECES) {
      expect(html).toContain(`href="${pieceHref(piece)}"`);
    }
  });

  test("every piece becomes a static spoke route", () => {
    expect(generateStaticParams()).toEqual(
      WRITING_PIECES.map((piece) => ({ slug: piece.slug })),
    );
  });

  test("every spoke is present in the sitemap", () => {
    const entries = sitemap();
    const urls = new Set(entries.map((entry) => entry.url));
    for (const piece of WRITING_PIECES) {
      expect(urls.has(`https://caisson.sh${pieceHref(piece)}`)).toBe(true);
      expect(
        entries.find(
          (entry) => entry.url === `https://caisson.sh${pieceHref(piece)}`,
        )?.lastModified,
      ).toEqual(writingLastModified(piece));
    }
  });

  test("writing sitemap freshness advances when sources are reverified", () => {
    expect(
      writingLastModified({
        publishedOn: "2026-07-20",
        verifiedOn: "2026-07-26",
      }),
    ).toEqual(new Date("2026-07-26T00:00:00.000Z"));
  });

  test("every source URL is https", () => {
    for (const piece of WRITING_PIECES) {
      for (const source of piece.sources) {
        expect(new URL(source.url).protocol).toBe("https:");
      }
    }
  });

  test("every piece carries at least one source with a specific locator", () => {
    for (const piece of WRITING_PIECES) {
      expect(piece.sources.length).toBeGreaterThan(0);
      for (const source of piece.sources) {
        expect(source.locator.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("publishedOn and verifiedOn are valid ISO dates, and verification is not in the future", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const piece of WRITING_PIECES) {
      expect(isValidIsoDate(piece.publishedOn)).toBe(true);
      expect(isValidIsoDate(piece.verifiedOn)).toBe(true);
      expect(piece.verifiedOn <= today).toBe(true);
    }
  });

  test("each record emits an article PageSpec at its own canonical path", () => {
    for (const piece of WRITING_PIECES) {
      const spec = writingPageSpec(piece);
      expect(spec.meta).toEqual(piece.meta);
      expect(spec.meta.path).toBe(pieceHref(piece));
      expect(spec.meta.type).toBe("article");
      expect(spec.sections.length).toBeGreaterThan(piece.sections.length);
    }
  });

  test("the primary-source list is section content, never a list nested inside a lede paragraph", () => {
    const spec = writingPageSpec(WRITING_PIECES[0]!);
    const html = renderToStaticMarkup(
      createElement(PageSections, { sections: spec.sections }),
    );
    expect(html).toContain("<ul");
    expect(html).not.toMatch(/<p[^>]*><ul/u);
  });

  test("publishes the dated Article 50 analysis with the evergreen cross-link", () => {
    const piece = WRITING_PIECES.find(
      ({ slug }) => slug === "eu-ai-act-article-50-august-december-2026",
    );
    expect(piece).toBeDefined();
    expect(piece?.publishedOn).toBe("2026-07-26");
    expect(piece?.verifiedOn).toBe("2026-07-27");
    expect(piece?.related).toContain("/frameworks/eu-ai-act/article-50");
  });

  test("contains no fictional fixture after the verified piece lands", () => {
    expect(
      WRITING_PIECES.some((piece) => piece.slug.startsWith("fixture-")),
    ).toBe(false);
  });

  test("keeps the first piece dated and differentiated from the evergreen obligations reference", () => {
    const piece = WRITING_PIECES.find(
      ({ slug }) => slug === "eu-ai-act-article-50-august-december-2026",
    );
    const copy = JSON.stringify(piece?.sections);

    expect(copy).toContain("July 20, 2026");
    expect(copy).toContain("December 2, 2026");
    expect(copy).toContain("/frameworks/eu-ai-act/article-50");
    expect(copy).not.toContain("Four transparency duties");
    expect(copy).not.toContain(
      "Emotion recognition and biometric categorisation",
    );
    expect(copy).not.toContain("Penalty exposure");
    expect(evergreenOnlyMatches(copy)).toEqual([]);
  });

  test("the differentiation guard rejects a paraphrased evergreen obligation", () => {
    expect(
      evergreenOnlyMatches(
        "Deployers must notify people exposed to emotion-recognition systems.",
      ),
    ).not.toEqual([]);
  });

  test("the shared TechArticle builder carries the real publication date", () => {
    const piece = WRITING_PIECES[0]!;
    expect(
      techArticle({
        headline: piece.title,
        description: piece.dek,
        url: `https://caisson.sh${pieceHref(piece)}`,
        datePublished: piece.publishedOn,
      }),
    ).toMatchObject({ datePublished: "2026-07-26" });
  });
});

describe("/writing route registry", () => {
  test("the hub is a footer resource and spokes stay out of MARKETING_ROUTES", () => {
    expect(
      MARKETING_ROUTES.find((route) => route.path === "/writing"),
    ).toMatchObject({
      label: "Writing",
      group: "product",
      footer: "resources",
    });
    for (const piece of WRITING_PIECES) {
      expect(
        MARKETING_ROUTES.some((route) => route.path === pieceHref(piece)),
      ).toBe(false);
    }
  });
});

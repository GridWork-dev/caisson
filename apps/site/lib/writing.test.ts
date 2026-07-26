import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import WritingHubPage from "../app/(marketing)/writing/page";
import { generateStaticParams } from "../app/(marketing)/writing/[slug]/page";
import sitemap from "../app/sitemap";
import { MARKETING_ROUTES } from "./routes";
import { WRITING_PIECES, writingPageSpec, type WritingPiece } from "./writing";

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
    const urls = new Set(sitemap().map((entry) => entry.url));
    for (const piece of WRITING_PIECES) {
      expect(urls.has(`https://caisson.sh${pieceHref(piece)}`)).toBe(true);
    }
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

  test.skip("pending verified first piece: links to the evergreen Article 50 framework page", () => {
    const firstRealPiece = WRITING_PIECES.find(
      (piece) => !piece.slug.startsWith("fixture-"),
    );
    expect(firstRealPiece).toBeDefined();
    expect(firstRealPiece?.related).toContain(
      "/frameworks/eu-ai-act/article-50",
    );
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

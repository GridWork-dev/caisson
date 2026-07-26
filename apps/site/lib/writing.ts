// Dated commentary records for the /writing hub + spokes. A record is the content source for one
// PageSpec; the shared route renders every record through <PageSections>, matching the glossary
// and module-page registry pattern. `verifiedOn` + `sources` are machine-readable first: the
// report-only regulatory-claim watch imports this registry directly.
import { createElement } from "react";

import type { PageMeta } from "./metadata";
import type { PageSection, PageSpec } from "./page-sections";

export interface WritingSource {
  label: string;
  url: string;
  /** Article number, section, page, or other specific source locator — never a bare domain. */
  locator: string;
}

export interface WritingPiece {
  slug: string;
  title: string;
  /** One-sentence standfirst. */
  dek: string;
  meta: PageMeta;
  publishedOn: string;
  verifiedOn: string;
  sources: readonly WritingSource[];
  sections: readonly PageSection[];
  /** Absolute internal paths to distinct, related Caisson pages. */
  related: readonly string[];
}

// TASK-1/TASK-3 HANDOFF FIXTURE: this is deliberately fictional and contains no regulatory or
// product claim. The verified Article 50 record from the parallel lane replaces it in this branch.
export const WRITING_PIECES: readonly WritingPiece[] = [
  {
    slug: "fixture-fictional-standard",
    title: "Fixture: the fictional standard",
    dek: "A deliberately fictional record used to exercise the writing registry, routes, metadata, and source contract.",
    meta: {
      title: "Fixture: the fictional standard",
      description:
        "A deliberately fictional record used to exercise the Caisson writing-surface machinery without making a regulatory or product claim.",
      path: "/writing/fixture-fictional-standard",
      type: "article",
    },
    publishedOn: "1970-01-01",
    verifiedOn: "1970-01-01",
    sources: [
      {
        label: "IANA-reserved example domain",
        url: "https://example.com/",
        locator: "Example Domain",
      },
    ],
    sections: [
      {
        kind: "section",
        title: "Fixture only",
        lede: "This record validates the collection machinery. It makes no statement about a regulation, legal obligation, or Caisson capability.",
        band: "tint",
      },
    ],
    related: [],
  },
];

export function findWritingPiece(slug: string): WritingPiece | undefined {
  return WRITING_PIECES.find((piece) => piece.slug === slug);
}

function breadcrumbNav(piece: WritingPiece) {
  return createElement(
    "nav",
    { "aria-label": "Breadcrumb", className: "cs-footnote" },
    createElement("a", { href: "/writing", className: "cs-link" }, "Writing"),
    " / ",
    createElement("span", { "aria-current": "page" }, piece.title),
  );
}

function publicationStamp(piece: WritingPiece) {
  return createElement(
    "span",
    { className: "cs-footnote" },
    `Published ${piece.publishedOn} · sources verified ${piece.verifiedOn}`,
  );
}

function sourceList(piece: WritingPiece) {
  return createElement(
    "ul",
    {
      className: "cs-lede",
      style: {
        paddingLeft: "var(--cs-space-5)",
        display: "grid",
        gap: "var(--cs-space-2)",
      },
    },
    piece.sources.map((source) =>
      createElement(
        "li",
        { key: `${source.url}#${source.locator}` },
        createElement(
          "a",
          {
            href: source.url,
            className: "cs-link",
            rel: "noreferrer",
          },
          source.label,
        ),
        ` — ${source.locator}`,
      ),
    ),
  );
}

function relatedLinks(piece: WritingPiece): PageSection | undefined {
  if (piece.related.length === 0) return undefined;
  return {
    kind: "section",
    title: "Related reading",
    children: createElement(
      "ul",
      {
        style: {
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--cs-space-3)",
        },
      },
      piece.related.map((path) =>
        createElement(
          "li",
          { key: path },
          createElement("a", { href: path, className: "cs-link" }, path),
        ),
      ),
    ),
  };
}

/** WritingPiece -> standard page chrome + the record's ordered sections + source disclosure. */
export function writingPageSpec(piece: WritingPiece): PageSpec {
  const sections: PageSection[] = [
    {
      kind: "hero",
      eyebrow: "Writing",
      title: piece.title,
      lede: piece.dek,
      ctas: breadcrumbNav(piece),
      credentials: publicationStamp(piece),
    },
    ...piece.sections,
    {
      kind: "section",
      eyebrow: "Verification",
      title: "Primary sources",
      children: sourceList(piece),
      band: "surface",
    },
  ];

  const related = relatedLinks(piece);
  if (related) sections.push(related);

  return { meta: piece.meta, sections };
}

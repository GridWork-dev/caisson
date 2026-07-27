// Dated commentary records for the /writing hub + spokes. A record is the content source for one
// PageSpec; the shared route renders every record through <PageSections>, matching the glossary
// and module-page registry pattern. `verifiedOn` + `sources` are machine-readable first: the
// report-only regulatory-claim watch imports this registry directly.
import { createElement } from "react";

import {
  ARTICLE_50_PRIMARY_SOURCES,
  ARTICLE_50_VERIFIED_ON,
} from "./article-50-sources";
import type { PageMeta } from "./metadata";
import type { PageSection, PageSpec } from "./page-sections";
import type { RegulatorySource } from "./regulatory-source";

export type WritingSource = RegulatorySource;

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

export function writingLastModified(
  piece: Pick<WritingPiece, "publishedOn" | "verifiedOn">,
): Date {
  const freshnessDate =
    piece.verifiedOn > piece.publishedOn ? piece.verifiedOn : piece.publishedOn;
  return new Date(`${freshnessDate}T00:00:00.000Z`);
}

export const WRITING_PIECES: readonly WritingPiece[] = [
  {
    slug: "eu-ai-act-article-50-august-december-2026",
    title:
      "Article 50 starts August 2. The adopted transition points to December 2.",
    dek: "The Commission’s final July 2026 guidance keeps Article 50’s general application date. The adopted Digital Omnibus text narrows the later deadline to Article 50(2) for qualifying pre-August generative systems, but still awaits Official Journal publication and entry into force.",
    meta: {
      title: "EU AI Act Article 50: the August and December 2026 dates",
      description:
        "What the final July 2026 Article 50 guidance and adopted Digital Omnibus text establish about the August 2 date, the pending narrow December 2 transition, and pre-existing content.",
      path: "/writing/eu-ai-act-article-50-august-december-2026",
      type: "article",
    },
    publishedOn: "2026-07-26",
    verifiedOn: ARTICLE_50_VERIFIED_ON,
    sources: ARTICLE_50_PRIMARY_SOURCES,
    sections: [
      {
        kind: "section",
        eyebrow: "Dated analysis · July 26, 2026",
        title: "What the final guidance and adopted Omnibus text establish.",
        lede: "Article 50 still generally applies from August 2, 2026. The adopted Digital Omnibus text awaits Official Journal publication and entry into force. Once effective, its new Article 111(4) gives providers of generative AI systems placed on the market before August 2 until December 2, 2026 to conform with Article 50(2)’s machine-readable marking and detection duty.",
        band: "tint",
      },
      {
        kind: "section",
        eyebrow: "The boundary",
        title:
          "The transition belongs to Article 50(2), not Article 50 as a whole.",
        lede: "The final guidance starts from the general rule: all in-scope systems must comply on August 2, regardless of when they were placed on the market or put into service. Separately, the adopted Digital Omnibus text gives qualifying generative systems placed on the market before August 2 a transition for Article 50(2)’s marking and detection duty once the amendment enters into force. The other Article 50 duties were not postponed.",
      },
      {
        kind: "featureGrid",
        cols: 3,
        eyebrow: "One system, two clocks",
        title: "A mixed product can cross both dates.",
        items: [
          {
            title: "Direct interaction · August 2",
            body: "For a system that is partly interactive and partly generative, the Article 50(1) interaction-disclosure duty still applies from August 2, 2026.",
          },
          {
            title: "Qualifying generation · December 2",
            body: "Under the adopted text, only Article 50(2)’s marking and detection duty receives the transition, and only for a generative AI system placed on the market before August 2.",
          },
          {
            title: "Everything else · August 2",
            body: "The transition does not postpone the other Article 50 duties or create a general December application date.",
          },
        ],
      },
      {
        kind: "section",
        eyebrow: "Pre-existing content",
        title: "The content cutoff is a separate rule.",
        lede: "Article 50(2) outputs and Article 50(4) deepfakes generated or manipulated before August 2, 2026 do not require retroactive marking or labelling. Public-interest text receives that treatment only when it was both generated or manipulated and published before August 2; earlier-generated text published on or after that date must be labelled.",
        band: "surface",
      },
      {
        kind: "section",
        eyebrow: "Source status",
        title: "Final guidance and an adopted amendment awaiting publication.",
        lede: "The Commission published and adopted the final guidelines on July 20, 2026. They are non-binding; only the Court of Justice of the European Union can ultimately give an authoritative interpretation of the AI Act. The Council gave the Digital Omnibus final approval on June 29, but the act awaits Official Journal publication and entry into force. This dated source reading is not legal advice.",
      },
      {
        kind: "cta",
        eyebrow: "Evergreen reference",
        title: "Need the durable Article 50 rule map?",
        lede: "The framework page covers who Article 50 applies to, the four statutory duties, express exceptions, implementation considerations, and the evidence boundary. This dated piece stays focused on what the July guidance settled.",
        primary: {
          label: "Read what Article 50 requires",
          href: "/frameworks/eu-ai-act/article-50",
        },
      },
    ],
    related: [
      "/frameworks/eu-ai-act/article-50",
      "/frameworks/eu-ai-act",
      "/glossary/eu-ai-act-article-50",
    ],
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

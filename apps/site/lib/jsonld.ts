// JSON-LD structured data (ADR-0079 §4). A single root @graph with stable @ids (Organization +
// WebSite) lives in the root layout; page-scoped nodes (SoftwareApplication / TechArticle /
// BreadcrumbList / FAQPage) reference those @ids by `@id` instead of re-declaring the publisher.
// Replaces the duplicated anonymous SoftwareApplication block. Serialization escapes `<` so a
// stray "</script>" in any field cannot break out of the <script> tag.
import { SITE_NAME, SITE_URL } from "./metadata";
import { formatPrice, priceById } from "./pricing";

export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;

/** XSS-safe serialize for a dangerouslySetInnerHTML JSON-LD payload. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Root @graph — Organization + WebSite (+ SearchAction). Rendered once, in the root layout. */
export const rootGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: SITE_NAME,
      legalName: "GridWork Digital LLC",
      url: SITE_URL,
      description:
        "Compliance-grade infrastructure for regulated SaaS — fail-closed Postgres RLS, S3 Object-Lock WORM, and an append-only audit chain.",
      sameAs: ["https://github.com/GridWork-dev/caisson"],
    },
    {
      "@type": "WebSite",
      "@id": SITE_ID,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { "@id": ORG_ID },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/docs?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

/**
 * A page-scoped SoftwareApplication node. Carries the indicative Offer price (ADR-0081) by
 * pricing id — pass `priceId` to attach a real price, omit for the umbrella home node.
 */
export function softwareApplication(opts: {
  name: string;
  description: string;
  url: string;
  priceId?: string;
}) {
  const price = opts.priceId ? priceById(opts.priceId) : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: opts.name,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    description: opts.description,
    url: opts.url,
    publisher: { "@id": ORG_ID },
    ...(price && price.amount !== null
      ? {
          offers: {
            "@type": "Offer",
            price: price.amount,
            priceCurrency: "USD",
            // Indicative price (ADR-0081) — availability is PreOrder pre-launch.
            availability: "https://schema.org/PreOrder",
            description: formatPrice(price),
          },
        }
      : {}),
  };
}

/** BreadcrumbList for hub/spoke crawl paths (ADR-0079 §2). */
export function breadcrumb(items: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

/** TechArticle for guide/framework pages. */
export function techArticle(opts: {
  headline: string;
  description: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    publisher: { "@id": ORG_ID },
  };
}

/**
 * FAQPage — kept for AI retrieval where a REAL FAQ exists (Google sunset the rich result May
 * 2026, ADR-0079 §4). Only emit when the questions render visibly on the page.
 */
export function faqPage(
  items: readonly { question: string; answer: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  };
}

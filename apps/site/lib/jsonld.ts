// JSON-LD structured data (ADR-0079 §4). A single root @graph with stable @ids (Organization +
// WebSite) lives in the root layout; page-scoped nodes (SoftwareApplication / TechArticle /
// BreadcrumbList / FAQPage) reference those @ids by `@id` instead of re-declaring the publisher.
// Replaces the duplicated anonymous SoftwareApplication block. Serialization escapes `<` so a
// stray "</script>" in any field cannot break out of the <script> tag.
import { SITE_NAME, SITE_URL } from "./metadata";

export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;

/**
 * Public identity surfaces for `sameAs`. Every entry MUST resolve for an ANONYMOUS crawler — a
 * sameAs pointing at a 404 is a broken identity claim, not a weak one. The development repo
 * `caisson-sh/caisson` is private and 404s when logged out, so only the org page is listed. The
 * `caisson` names on npm and crates.io belong to unrelated projects and must never be claimed.
 * Add the public mirror and the npm scope here once they actually publish and resolve anonymously.
 */
export const SAME_AS = ["https://github.com/caisson-sh"] as const;

/**
 * The founder edge. Caisson Software LLC is a separate company that shares its founder with other
 * GridWork work at the individual level only, so the one truthful cross-domain predicate is
 * `founder`, pointing at the Person that gridwork.dev publishes. There is deliberately NO
 * `parentOrganization` / `subOrganization`: that is the subsidiary predicate and it would be
 * false. The IRI must resolve in gridwork.dev's served JSON-LD; the pinning test holds the literal
 * so a drift here cannot go unnoticed.
 */
export const FOUNDER_ID = "https://gridwork.dev/#person";

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
      legalName: "Caisson Software LLC",
      url: SITE_URL,
      description:
        "Compliance-grade infrastructure for regulated SaaS — fail-closed Postgres RLS, S3 Object-Lock WORM, and an append-only audit chain.",
      sameAs: SAME_AS,
      founder: { "@id": FOUNDER_ID },
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

/** A page-scoped SoftwareApplication node. The Offer is price 0: the code is Apache-2.0 and free
 *  (Google's software rich result wants an Offer, and a zero price states the truth). */
export function softwareApplication(opts: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: opts.name,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    description: opts.description,
    url: opts.url,
    publisher: { "@id": ORG_ID },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

/**
 * A per-module SoftwareApplication node. Emitted on the module's own depth page (ADR-0237 F2) and
 * reused, one per element, by `moduleItemList` on the gallery so both surfaces describe the
 * identical entity/URL.
 */
export function moduleSoftwareApplication(
  m: { id: string; label: string; blurb: string },
  opts: { description?: string } = {},
) {
  return softwareApplication({
    name: m.label,
    description: opts.description ?? m.blurb,
    url: `${SITE_URL}/marketplace/modules/${m.id}`,
  });
}

/**
 * ItemList of the modules for the marketplace gallery (ADR-0237 F1). Each element is the module's
 * own SoftwareApplication node, `url` pointing at its depth page.
 */
export function moduleItemList(
  modules: readonly { id: string; label: string; blurb: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Caisson modules",
    numberOfItems: modules.length,
    itemListElement: modules.map((m, i) => {
      const { "@context": _ctx, ...item } = moduleSoftwareApplication(m);
      return {
        "@type": "ListItem",
        position: i + 1,
        item,
      };
    }),
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
  datePublished?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    ...(opts.datePublished === undefined
      ? {}
      : { datePublished: opts.datePublished }),
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

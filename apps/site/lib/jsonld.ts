// JSON-LD structured data (ADR-0079 §4). A single root @graph with stable @ids (Organization +
// WebSite) lives in the root layout; page-scoped nodes (SoftwareApplication / TechArticle /
// BreadcrumbList / FAQPage) reference those @ids by `@id` instead of re-declaring the publisher.
// Replaces the duplicated anonymous SoftwareApplication block. Serialization escapes `<` so a
// stray "</script>" in any field cannot break out of the <script> tag.
import { PARENT_ORG_URL, SITE_NAME, SITE_URL } from "./metadata";
import {
  bundlePriceById,
  formatPrice,
  isBundleId,
  priceById,
  type PriceAnchor,
} from "./pricing";

export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;
/**
 * The parent org's node in ITS OWN graph (gridworkdigital.com), which declares Caisson as a
 * `subOrganization` keyed on ORG_ID. Both halves must use these exact IRIs or the two graphs
 * describe four entities instead of two.
 */
export const PARENT_ORG_ID = `${PARENT_ORG_URL}/#organization`;

/**
 * Public identity surfaces for `sameAs`. Every entry must resolve for an ANONYMOUS crawler — a
 * sameAs pointing at a 404 is a broken identity claim, not a weak one. The development repo
 * (caisson-sh/caisson) is private and 404s when logged out, so only the org page is listed; the
 * `caisson` names on npm and crates.io belong to unrelated projects and must never be claimed.
 * Add the public mirror + the npm scope here once they actually publish.
 */
const SAME_AS = ["https://github.com/caisson-sh"];

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
      // Caisson is a GridWork Digital product; the hub's graph carries the matching
      // `subOrganization` edge back to ORG_ID.
      parentOrganization: { "@id": PARENT_ORG_ID },
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
 * A page-scoped SoftwareApplication node. Carries the committed Offer price (ADR-0082): pass
 * `priceId` to resolve a bundle or plan anchor (post-flip the two id sets are disjoint), or
 * `price` to attach an explicit anchor. Omit both for the umbrella home node.
 */
export function softwareApplication(opts: {
  name: string;
  description: string;
  url: string;
  priceId?: string;
  price?: PriceAnchor;
}) {
  const price =
    opts.price ??
    (opts.priceId
      ? (priceById(opts.priceId) ??
        (isBundleId(opts.priceId) ? bundlePriceById(opts.priceId) : undefined))
      : undefined);
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
            // Committed price (ADR-0082) — live self-serve, so availability is InStock.
            availability: "https://schema.org/InStock",
            description: formatPrice(price),
          },
        }
      : {}),
  };
}

/**
 * A per-module SoftwareApplication node with its committed Offer (ADR-0082 — live self-serve,
 * InStock). Emitted on the module's own depth page (ADR-0237 F2) and reused, one per element, by
 * `moduleItemList` on the catalog tab so both surfaces describe the identical entity/URL.
 */
export function moduleSoftwareApplication(
  m: { id: string; label: string; amount: number; blurb: string },
  opts: { description?: string } = {},
) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: m.label,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    description: opts.description ?? m.blurb,
    url: `${SITE_URL}/marketplace/modules/${m.id}`,
    publisher: { "@id": ORG_ID },
    offers: {
      "@type": "Offer",
      price: m.amount,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };
}

/**
 * ItemList of the à-la-carte modules for the marketplace Modules tab (ADR-0237 F1). Each element
 * is the module's own SoftwareApplication node, `url` pointing at its depth page.
 */
export function moduleItemList(
  modules: readonly {
    id: string;
    label: string;
    amount: number;
    blurb: string;
  }[],
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

/** DefinedTerm — one glossary spoke (ADR-0079 §4 addition, glossary SPEC/ADR-0235). */
export function definedTerm(opts: {
  name: string;
  description: string;
  url: string;
  inDefinedTermSet?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    ...(opts.inDefinedTermSet
      ? { inDefinedTermSet: opts.inDefinedTermSet }
      : {}),
  };
}

/** DefinedTermSet — the /glossary hub, listing every spoke (glossary SPEC/ADR-0235). */
export function definedTermSet(opts: {
  name: string;
  description: string;
  url: string;
  terms: readonly { name: string; description: string; url: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    hasDefinedTerm: opts.terms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.name,
      description: t.description,
      url: t.url,
    })),
  };
}

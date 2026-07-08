import Link from "next/link";

import { Card, Faq, FeatureGrid, Icon, Reveal, Section } from "@/components";

import { MarketplaceSurface } from "@/components/marketplace-surface";
import { bundlePagePath } from "@/components/marketplace";
import { BASE_CAPABILITIES, BASE_PACKAGES } from "@/lib/base-substrate";
import {
  breadcrumb,
  faqPage,
  moduleItemList,
  serializeJsonLd,
  softwareApplication,
} from "@/lib/jsonld";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import { hasModulePage } from "@/lib/module-pages";
import { BUNDLE_PRICES, MODULE_PRICES } from "@/lib/pricing";

export const metadata = buildMetadata({
  title: "Marketplace",
  description: `Every Caisson bundle and module on one surface — ${MODULE_PRICES.length} modules composed into six bundles, one-time perpetual pricing. Filter by type, category, or price; preview the media; compare; and build a stack. Own the source, no forced renewal.`,
  path: "/marketplace",
});

// The unified marketplace surface (ADR-0285): ONE screen for the whole catalog. The good/better/best
// SEO copy the former Bundles + Modules tabs carried is superseded by the surface itself (which
// server-renders every bundle and module card); this page keeps the JSON-LD (bundle Offers + the
// module ItemList + the FAQ), the surface island, the open-base anxiety-relief beat, and the FAQ.
// Prices + membership all derive from `lib/pricing.ts` — never hand-keyed.

const HUB_FAQ = [
  {
    question: "Where did the Modules and Build tabs go?",
    answer:
      "They're this one surface now. Filter by type to see just modules or just bundles, add anything to the stack rail on the right to watch the running total, and the builder still points at the bundle that covers your picks for less. Old links redirect here automatically.",
  },
  {
    question: "Can I buy one module without the bundle around it?",
    answer: `Yes. Each of the ${MODULE_PRICES.length} modules is a standalone one-time purchase — pick what composes onto your base, no bundle required. Every card previews what ships and opens straight to checkout.`,
  },
] as const;

export default function MarketplacePage() {
  const breadcrumbNode = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Marketplace", path: "/marketplace" },
  ]);

  // One SoftwareApplication node per bundle, carrying its committed Offer (ADR-0082, InStock).
  const bundleNodes = BUNDLE_PRICES.map((b) =>
    softwareApplication({
      name: `Caisson ${b.label}`,
      description: b.note,
      url: `${SITE_URL}${bundlePagePath(b.id)}`,
      price: b,
    }),
  );
  // Offer URLs only for modules with a real depth page (mirrors sitemap.ts's MODULE_PAGES-derived
  // module set) — the full MODULE_PRICES list includes SKUs with no `/marketplace/modules/<id>`
  // route yet, and advertising a dead Offer URL in structured data is dishonest to the exact AEO
  // crawlers robots.ts courts (G17).
  const catalogNode = moduleItemList(
    MODULE_PRICES.filter((m) => hasModulePage(m.id)),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbNode) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(catalogNode) }}
      />
      {bundleNodes.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(node) }}
        />
      ))}

      {/* ===== The catalog — one surface ===== */}
      <Section
        eyebrow="The catalog"
        title="Browse the whole library in one place."
        lede="Six bundles and every à-la-carte module, side by side. Filter by type, category, or price; preview the diagrams and demos; compare up to three; and build a stack on the right — the builder points at the bundle that covers your picks for less."
      >
        <MarketplaceSurface />
      </Section>

      {/* ===== The open base — "batteries included" under the prices (anxiety-relief beat;
          ADR-0094 open-core made visible at purchase time) ===== */}
      <Reveal>
        <Section
          eyebrow="The open base"
          title="Every bundle sits on this. So can you, for free."
          lede="Before you weigh a bundle: the audited foundation under all of them is Apache-2.0, open source, and free to use on its own. Buy a bundle and it is a one-time perpetual license — source you own — but the base was always yours."
          band="surface"
        >
          <FeatureGrid cols={3}>
            {BASE_CAPABILITIES.map((c) => (
              <Card key={c.title}>
                <div className="cs-status">
                  <Icon name={c.icon} size="lg" />
                  {c.title}
                </div>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {c.body}
                </p>
                <p
                  className="cs-footnote mono"
                  style={{
                    marginTop: "var(--cs-space-4)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {c.packages.map((p) => `@caisson/${p}`).join(" · ")}
                </p>
              </Card>
            ))}
          </FeatureGrid>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-6)" }}>
            {BASE_PACKAGES.length} packages under Apache-2.0.{" "}
            <Link href="/legal/license" style={{ color: "var(--cs-link)" }}>
              See the open / commercial split
            </Link>
            .
          </p>
        </Section>
      </Reveal>

      {/* ===== FAQ ===== */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqPage(HUB_FAQ)) }}
      />
      <Section eyebrow="FAQ" title="Buying, briefly.">
        <Faq items={HUB_FAQ} defaultOpenFirst />
      </Section>
    </>
  );
}

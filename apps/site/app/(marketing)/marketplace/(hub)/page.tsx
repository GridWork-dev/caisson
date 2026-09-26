import Link from "next/link";

import { Card, Faq, Icon, Reveal, Section } from "@/components";

import { MarketplaceSurface } from "@/components/marketplace-surface";
import { BASE_CAPABILITIES, BASE_PACKAGES } from "@/lib/base-substrate";
import { MODULES } from "@/lib/catalog";
import {
  breadcrumb,
  faqPage,
  moduleItemList,
  serializeJsonLd,
} from "@/lib/jsonld";
import { entryDocsHrefs } from "@/lib/entry-docs";
import { buildMetadata } from "@/lib/metadata";
import { hasModulePage } from "@/lib/module-pages";
import { truthfulSignals } from "@/lib/trust-signals";
import { TruthfulSignals } from "@/components/truthful-signals";

export const metadata = buildMetadata({
  title: "Marketplace",
  description: `Every Caisson module family and module on one surface: ${MODULES.length} modules composed into six families, each with its docs and a live in-browser demo.`,
  path: "/marketplace",
});

// The unified marketplace surface (ADR-0285), now a demonstration gallery: ONE screen for the whole
// catalog. This page keeps the JSON-LD (the module ItemList + the FAQ), the surface island, the
// open-base beat, and the FAQ.

const HUB_FAQ = [
  {
    question: "Where did the Modules and Build tabs go?",
    answer:
      "They're this one surface now. Filter by type to see just modules or just module families. Old links redirect here automatically.",
  },
  {
    question: "Can I use one module without the family around it?",
    answer: `Yes. Each of the ${MODULES.length} modules composes onto the base on its own. Every card links to the module's docs and, where it has one, a live demo that runs the module's own code in your browser.`,
  },
] as const;

export default function MarketplacePage() {
  const signals = truthfulSignals();
  const breadcrumbNode = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Marketplace", path: "/marketplace" },
  ]);
  // URLs only for modules with a real depth page (mirrors sitemap.ts's MODULE_PAGES-derived set) —
  // advertising a dead URL in structured data is dishonest to the crawlers robots.ts courts (G17).
  const catalogNode = moduleItemList(
    MODULES.filter((m) => hasModulePage(m.id)),
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

      {/* ===== The catalog — one surface ===== */}
      <Section
        title="Browse the whole library in one place."
        lede="Six module families and every module, side by side. Filter by type or category, preview the diagrams and demos, then open the docs or run the live demo."
      >
        <div
          style={{
            marginTop: "var(--cs-space-2)",
            marginBottom: "var(--cs-space-6)",
          }}
        >
          <TruthfulSignals signals={signals} lead="Check the evidence:" />
        </div>
        <MarketplaceSurface signals={signals} docsHrefs={entryDocsHrefs()} />
      </Section>

      {/* ===== The open base — "batteries included" under every family ===== */}
      <Section
        title="Every module family sits on this."
        lede="The audited foundation under all of them is Apache-2.0, open source, and free to use on its own."
        band="surface"
      >
        {/* Static header, base-capability cards cascade in (ADR-0307). */}
        <Reveal stagger={70} className="cs-grid cs-grid--3 cs-feature-grid">
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
        </Reveal>
        <p className="cs-footnote" style={{ marginTop: "var(--cs-space-6)" }}>
          {BASE_PACKAGES.length} packages under Apache-2.0.{" "}
          <Link href="/docs/base" className="cs-link">
            Read the base docs
          </Link>
          .
        </p>
      </Section>

      {/* ===== FAQ ===== */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqPage(HUB_FAQ)) }}
      />
      <Section title="The gallery, briefly.">
        <Faq items={HUB_FAQ} defaultOpenFirst />
      </Section>
    </>
  );
}

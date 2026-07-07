// The /compare hub — lists every "Caisson vs X" comparison so the spokes aren't orphaned (internal
// links are the crawl path the AEO program depends on). A record IS a card; the list derives from
// COMPARISONS, so a new comparison shows up here and in the sitemap with no edit to this file.
import Link from "next/link";

import { Button, Card, FeatureGrid, Hero, Reveal, Section } from "@/components";
import { ACCESSED, COMPARISONS } from "@/lib/comparisons";
import { breadcrumb, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Caisson vs the SaaS boilerplates",
  description:
    "Honest, dated comparisons of Caisson against the popular SaaS boilerplates and starter kits — what each ships, what it doesn't, and when to pick which.",
  path: "/compare",
});

export default function CompareHubPage() {
  const bcLd = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Comparisons", path: "/compare" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(bcLd) }}
      />

      <Hero
        eyebrow="Comparisons"
        title="Caisson vs the SaaS boilerplates"
        lede="The starter kits ship auth, billing, and a landing page fast. Caisson ships the compliance and tenant-isolation substrate they mostly leave to you — fail-closed RLS with isolation tests, a WORM audit trail, and SOC 2 / HIPAA / EU AI Act evidence packs. Each page below is an honest, dated line between the two."
        ctas={
          <Button href="/compliance" variant="primary">
            Explore the Compliance bundle
          </Button>
        }
      />

      <Reveal>
        <Section
          eyebrow="The honest frame"
          title="Where a kit ends and Caisson begins"
          lede={`Every competitor fact on these pages was read from the vendor's live site on ${ACCESSED} and stamped with that date. What a kit is genuinely better at stays in — a comparison that overclaims is worse than no page.`}
        >
          <FeatureGrid cols={2}>
            {COMPARISONS.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <Card interactive>
                  <span className="cs-card-title">{`Caisson vs ${c.competitor}`}</span>
                  <p
                    className="cs-muted"
                    style={{ marginTop: "var(--cs-space-2)" }}
                  >
                    {c.category}
                  </p>
                  <p
                    className="cs-muted"
                    style={{ marginTop: "var(--cs-space-3)" }}
                  >
                    {c.whenPickCaisson}
                  </p>
                </Card>
              </Link>
            ))}
          </FeatureGrid>
        </Section>
      </Reveal>
    </>
  );
}

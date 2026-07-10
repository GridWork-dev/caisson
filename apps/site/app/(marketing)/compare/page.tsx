// The /compare hub — lists every "Caisson vs X" comparison so the spokes aren't orphaned (internal
// links are the crawl path the AEO program depends on). A record IS a card; the list derives from
// COMPARISONS, so a new comparison shows up here and in the sitemap with no edit to this file.
import Link from "next/link";

import { Button, Card, FeatureGrid, Hero, Reveal, Section } from "@/components";
import { ACCESSED, COMPARISONS } from "@/lib/comparisons";
import { breadcrumb, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Caisson vs the alternatives",
  description:
    "Honest, dated comparisons of Caisson against the SaaS boilerplates, the compliance-automation (GRC) platforms, and building it in-house — what each does, what it doesn't, and when to pick which.",
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
        title="Caisson vs the alternatives"
        lede="Three honest frames. The SaaS boilerplates ship auth, billing, and a landing page fast but leave the compliance and tenant-isolation substrate to you. The compliance-automation (GRC) platforms monitor your stack and run the audit — Caisson is the code that implements the controls they inspect. And building it in-house is months of load-bearing work. Each page below draws the honest, dated line."
        ctas={
          <Button href="/compliance" variant="primary">
            Explore the Compliance bundle
          </Button>
        }
      />

      <Reveal>
        <Section
          eyebrow="The honest frame"
          title="Where each alternative ends and Caisson begins"
          lede={`Every competitor fact on these pages was read from the vendor's live site — on ${ACCESSED} for the full sweep, with any later-added page stamped with its own verification date. What a competitor is genuinely better at stays in — a comparison that overclaims is worse than no page. With the GRC platforms the job is to draw the own-vs-rent line honestly, not to declare a winner.`}
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

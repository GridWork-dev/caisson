// The glossary hub — a clustered index of every GLOSSARY_TERMS entry + a DefinedTermSet (glossary
// SPEC §IA). Footer-only nav placement (ADR-0235 Fork D-nav); fully crawlable via the footer link
// + the sitemap's glossary block (app/sitemap.ts).
import Link from "next/link";

import { Hero, Section } from "@/components";
import { GLOSSARY_TERMS, type GlossaryCluster } from "@/lib/glossary";
import { breadcrumb, definedTermSet, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata, SITE_URL } from "@/lib/metadata";

const DESCRIPTION =
  "Definitions for the compliance, security, licensing, and AI-infrastructure terms Caisson ships real code against: WORM audit logs, row-level security, token metering, and more.";

export const metadata = buildMetadata({
  title: "Glossary",
  description: DESCRIPTION,
  path: "/glossary",
});

const CLUSTER_ORDER: readonly GlossaryCluster[] = [
  "compliance",
  "security",
  "licensing",
  "ai-infra",
];

const CLUSTER_LABELS: Record<GlossaryCluster, string> = {
  compliance: "Compliance & audit",
  security: "Multi-tenancy & security",
  licensing: "Licensing & commerce",
  "ai-infra": "AI & agent infrastructure",
};

const breadcrumbLd = breadcrumb([
  { name: "Home", path: "/" },
  { name: "Glossary", path: "/glossary" },
]);

const termSetLd = definedTermSet({
  name: "Caisson glossary",
  description: DESCRIPTION,
  url: `${SITE_URL}/glossary`,
  terms: GLOSSARY_TERMS.map((t) => ({
    name: t.term,
    description: t.definition,
    url: `${SITE_URL}/glossary/${t.slug}`,
  })),
});

export default function GlossaryHubPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(termSetLd) }}
      />

      <Hero
        eyebrow="Glossary"
        title="The Caisson glossary."
        lede={DESCRIPTION}
      />

      {CLUSTER_ORDER.map((cluster) => {
        const terms = GLOSSARY_TERMS.filter((t) => t.cluster === cluster).sort(
          (a, b) => a.term.localeCompare(b.term),
        );
        if (terms.length === 0) return null;
        return (
          <Section
            key={cluster}
            title={
              <>
                {CLUSTER_LABELS[cluster]}{" "}
                <span className="cs-muted">({terms.length})</span>
              </>
            }
          >
            <ul
              className="cs-grid cs-grid--3"
              style={{ listStyle: "none", padding: 0, margin: 0 }}
            >
              {terms.map((t) => (
                <li key={t.slug}>
                  <Link href={`/glossary/${t.slug}`} className="cs-link">
                    {t.term}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </>
  );
}

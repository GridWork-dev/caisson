import { Button, Hero, Section, StatusChip, Terminal } from "@/components";
import { ModuleCatalog } from "@/components/module-catalog";
import { breadcrumb, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Modules",
  description:
    "Browse all 14 Caisson modules à la carte. Filter by edition or price, take exactly the capability you need onto the shared base, or compose a full stack in the builder.",
  path: "/modules",
});

// RSC shell (ADR-0191): the Hero + JSON-LD stay server-rendered; the faceted catalog is the one
// client leaf (`ModuleCatalog`). Mirrors how /pricing keeps the shell RSC with client buy leaves.
export default function ModulesPage() {
  const breadcrumbNode = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Modules", path: "/modules" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbNode) }}
      />

      <Hero
        eyebrow="Modules"
        title="Every module, à la carte."
        lede="Fourteen modules across the four editions. Take exactly the capability you need onto the shared base — field encryption, token metering, on-device search — or compose a whole stack in the builder."
        ctas={
          <>
            <Button href="/build" variant="primary">
              Build a stack →
            </Button>
            <Button href="/pricing" variant="ghost">
              See editions & bundle
            </Button>
          </>
        }
        artifact={
          <Terminal
            label="modules"
            status={<StatusChip label="14 available" tone="success" dot />}
          >
            {"module."}
            <span className="cs-tok-accent">field-crypto</span>
            {"     $199    compliance\nmodule."}
            <span className="cs-tok-accent">ai-meter</span>
            {"         $199    ai-kit\nmodule."}
            <span className="cs-tok-accent">local-store</span>
            {"      $99     local-first\nmodule."}
            <span className="cs-tok-accent">agent-kernel</span>
            {"     $199    agentic-dev"}
          </Terminal>
        }
      />

      <Section
        eyebrow="Catalog"
        title="Filter the catalog."
        lede="Narrow by edition or price band — filters combine across facets and widen within one. Every module composes onto the same audited base."
      >
        <ModuleCatalog />
      </Section>
    </>
  );
}

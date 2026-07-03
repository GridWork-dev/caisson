import Link from "next/link";

import { Section, StatusChip, Terminal } from "@/components";
import { ModuleCatalog } from "@/components/module-catalog";
import { breadcrumb, moduleItemList, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";
import { MODULE_PRICES } from "@/lib/pricing";

// Counts derive from the catalog — never hardcoded (the "15 modules" strings that survived the
// ADR-0238 drop were exactly this class of drift).
const TOTAL = MODULE_PRICES.length;

export const metadata = buildMetadata({
  title: "Marketplace — Modules",
  description: `Browse all ${TOTAL} standalone Caisson modules à la carte. Filter by edition or price, take exactly the capability you need onto the shared base, or compose a full stack in the builder.`,
  path: "/marketplace/modules",
});

// The Modules tab (ADR-0237 F1): the faceted à-la-carte catalog. RSC shell; the catalog is the
// one client leaf (`ModuleCatalog`).
export default function MarketplaceModulesPage() {
  const breadcrumbNode = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Marketplace", path: "/marketplace" },
    { name: "Modules", path: "/marketplace/modules" },
  ]);
  const catalogNode = moduleItemList(MODULE_PRICES);

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

      <Section
        eyebrow="À la carte"
        title="Every module, standalone."
        lede={`${TOTAL === 11 ? "Eleven" : String(TOTAL)} standalone modules across the four editions. Take exactly the capability you need onto the shared base — field encryption, token metering, on-device search — or compose a whole stack in the builder.`}
      >
        <div style={{ marginBottom: "var(--cs-space-8)" }}>
          <Terminal
            label="modules"
            status={
              <StatusChip label={`${TOTAL} available`} tone="success" dot />
            }
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
        </div>
        <ModuleCatalog />
      </Section>

      {/* ===== Licensing — what's open, what's on this catalog ===== */}
      <Section
        eyebrow="Licensing"
        title="The base is free. The modules are the product."
        lede={
          <>
            Every module here composes onto the base substrate — kernel, auth,
            tenancy-rls, ui, billing, credits, jobs, email, ai-config,
            mcp-server, registry-schema, observability, and the generator
            tooling (cli, migrate, license-verify) — which is{" "}
            <code className="mono">Apache-2.0</code>, free to use on its own.
            What&rsquo;s priced above are the commercial modules and editions,
            under the{" "}
            <Link href="/legal/license" className="mono">
              Commercial License
            </Link>
            .
          </>
        }
      />
    </>
  );
}

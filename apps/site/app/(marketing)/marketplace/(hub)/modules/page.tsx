import { Fragment } from "react";
import Link from "next/link";

import { Section, StatusChip, Terminal } from "@/components";
import { ModuleCatalog } from "@/components/module-catalog";
import { breadcrumb, moduleItemList, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";
import { baseSubstrateList, baseToolingList } from "@/lib/base-substrate";
import { MODULE_PAGES } from "@/lib/module-pages";
import { moduleAmount, MODULE_PRICES } from "@/lib/pricing";

// Counts derive from the catalog — never hardcoded (the "15 modules" strings that survived the
// ADR-0238 drop were exactly this class of drift).
const TOTAL = MODULE_PRICES.length;

// A representative four-module strip for the terminal art — ids + their bundle. Prices read from
// the SOT (`moduleAmount`) so a reprice can never leave a stale number in the decoration; the
// gaps pad to fixed columns for monospace alignment (ids ≤ 12 chars, prices ≤ 4).
const SHOWCASE: readonly (readonly [id: string, bundle: string])[] = [
  ["field-crypto", "compliance"],
  ["ai-meter", "ai-production"],
  ["local-store", "local-first"],
  ["agent-kernel", "agentic-dev"],
];

// Slugs with a built depth page — passed to the catalog so a card only links to a detail route that
// exists (the W6.2 carve/standalone SKUs have no depth page yet).
const DETAIL_SLUGS = MODULE_PAGES.map((r) => r.slug);

export const metadata = buildMetadata({
  title: "Marketplace — Modules",
  description: `Browse all ${TOTAL} standalone Caisson modules à la carte. Filter by category or price, take exactly the capability you need onto the shared base, or compose a full stack in the builder.`,
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
        lede={`${TOTAL} standalone modules across the six bundles. Take exactly the capability you need onto the shared base — field encryption, token metering, on-device search — or compose a whole stack in the builder.`}
      >
        <div style={{ marginBottom: "var(--cs-space-8)" }}>
          <Terminal
            label="modules"
            status={
              <StatusChip label={`${TOTAL} available`} tone="success" dot />
            }
          >
            {SHOWCASE.map(([id, bundle], i) => {
              const price = `$${moduleAmount(id)}`;
              const gap1 = " ".repeat(14 - id.length);
              const gap2 = " ".repeat(8 - price.length);
              const nl = i < SHOWCASE.length - 1 ? "\n" : "";
              return (
                <Fragment key={id}>
                  {"module."}
                  <span className="cs-tok-accent">{id}</span>
                  {`${gap1}${price}${gap2}${bundle}${nl}`}
                </Fragment>
              );
            })}
          </Terminal>
        </div>
        <ModuleCatalog detailSlugs={DETAIL_SLUGS} />
      </Section>

      {/* ===== Licensing — what's open, what's on this catalog ===== */}
      <Section
        eyebrow="Licensing"
        title="The base is free. The modules are the product."
        lede={
          <>
            Every module here composes onto the base substrate —{" "}
            {baseSubstrateList()}, and the generator tooling (
            {baseToolingList()}) — which is{" "}
            <code className="mono">Apache-2.0</code>, free to use on its own.
            What&rsquo;s priced above are the commercial modules and bundles,
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

import type { ReactNode } from "react";

import { Hero } from "@/components";
import { MarketplaceHeroArtifact } from "@/components/marketplace-hero-artifact";
import { MarketplaceTabs } from "@/components/marketplace-tabs";
import { formatUsd, MODULE_PRICES } from "@/lib/pricing";

// The /marketplace shell (ADR-0285, supersedes the ADR-0237 four-tab split): one hero + the tab bar,
// shared by the unified surface and the standalone Plans page. Each page owns its metadata/canonical
// and its JSON-LD; this layout owns only the frame. Counts and the price band DERIVE from the catalog
// — never hardcoded (the ADR-0238 drift class).
const TOTAL = MODULE_PRICES.length;
const MIN = Math.min(...MODULE_PRICES.map((m) => m.amount));
const MAX = Math.max(...MODULE_PRICES.map((m) => m.amount));

export default function MarketplaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <Hero
        eyebrow="Marketplace"
        title="Every bundle and module, one surface."
        lede={`${TOTAL} modules compose six bundles on the same audited base, priced ${formatUsd(MIN)} to ${formatUsd(MAX)} each. Filter, compare, and build a stack in one place — take a single module for exactly the capability you need, a bundle for a whole domain, or the Everything bundle for the entire catalog. Own the source — no forced renewal.`}
        ctas={<MarketplaceTabs />}
        artifact={<MarketplaceHeroArtifact />}
      />
      {children}
    </>
  );
}

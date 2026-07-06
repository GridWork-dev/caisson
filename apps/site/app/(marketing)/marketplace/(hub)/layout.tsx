import type { ReactNode } from "react";

import { Hero } from "@/components";
import { MarketplaceTabs } from "@/components/marketplace-tabs";
import { formatUsd, MODULE_PRICES } from "@/lib/pricing";

// The unified /marketplace hub shell (ADR-0237 F1, supersedes the ADR-0191 three-route split):
// one hero + the pill tab bar, shared by the four tab pages (Editions · Modules · Build · Plans).
// Each tab page owns its metadata/canonical and its JSON-LD; this layout owns only the frame.
// Counts and the price band DERIVE from the catalog — never hardcoded (the ADR-0238 drift class).
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
        title="One module, one bundle, or everything."
        lede={`${TOTAL} modules compose six bundles on the same audited base, priced ${formatUsd(MIN)} to ${formatUsd(MAX)} each. Take a single module for exactly the capability you need, a bundle for a whole domain, or the Everything bundle for the entire catalog. Own the source — no forced renewal.`}
        ctas={<MarketplaceTabs />}
      />
      {children}
    </>
  );
}

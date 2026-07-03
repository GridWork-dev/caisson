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
        title="One module, one edition, or everything."
        lede={`${TOTAL === 11 ? "Eleven" : String(TOTAL)} modules compose four editions on the same audited base, priced ${formatUsd(MIN)} to ${formatUsd(MAX)} each. Take a single module for exactly the capability you need, a full edition for the whole thing, or the everything bundle for all four. Own the source — no renewal gate.`}
        ctas={<MarketplaceTabs />}
      />
      {children}
    </>
  );
}

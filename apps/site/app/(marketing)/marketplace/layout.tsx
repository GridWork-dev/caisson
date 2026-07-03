import type { ReactNode } from "react";

import { Hero } from "@/components";
import { MarketplaceTabs } from "@/components/marketplace-tabs";

// The unified /marketplace hub shell (ADR-0237 F1, supersedes the ADR-0191 three-route split):
// one hero + the pill tab bar, shared by the four tab pages (Editions · Modules · Build · Plans).
// Each tab page owns its metadata/canonical and its JSON-LD; this layout owns only the frame.
export default function MarketplaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <Hero
        eyebrow="Marketplace"
        title="Buy a module, an edition, or everything."
        lede="Every module stands alone; every edition is a composition of the same audited base. Take exactly the capability you need, or the whole library — one-time perpetual, own the source."
        ctas={<MarketplaceTabs />}
      />
      {children}
    </>
  );
}

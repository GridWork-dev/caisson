import type { ReactNode } from "react";

import { Hero } from "@/components";
import { Button } from "@/components/button";
import { MarketplaceHeroArtifact } from "@/components/marketplace-hero-artifact";
import { MODULES } from "@/lib/catalog";

// The /marketplace shell: one hero over the demonstration gallery. The page owns its
// metadata/canonical and its JSON-LD; this layout owns only the frame. The module count DERIVES
// from the catalog — never hardcoded (the ADR-0238 drift class).
export default function MarketplaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <Hero
        eyebrow="Marketplace"
        title="Every module family and module, one surface."
        lede={`${MODULES.length} modules compose six module families on the same audited base. Filter by family or category, open a module's docs, and run its live demo in the browser.`}
        ctas={
          <Button href="/docs" variant="primary">
            Read the docs
          </Button>
        }
        artifact={<MarketplaceHeroArtifact />}
      />
      {children}
    </>
  );
}

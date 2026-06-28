import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

// The root @graph (Organization + WebSite) lives in app/layout.tsx.
// Per-page structured data nodes (SoftwareApplication, BreadcrumbList, etc.)
// are emitted by each page file via lib/jsonld helpers. No duplicate here.

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav />
      {/* id="main-content" is the skip-link target injected by the root layout */}
      <main id="main-content">{children}</main>
      <SiteFooter />
    </>
  );
}

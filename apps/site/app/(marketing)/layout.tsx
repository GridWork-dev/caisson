import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

// SoftwareApplication structured data for the marketing surface (no price — pricing fork open).
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Caisson",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  description:
    "Compliance-grade infrastructure for regulated SaaS. Fail-closed Postgres RLS, S3 Object-Lock WORM, and an append-only audit chain.",
  url: "https://caisson.sh",
  offers: { "@type": "Offer", availability: "https://schema.org/PreOrder" },
  publisher: { "@type": "Organization", name: "GridWork Digital LLC" },
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}

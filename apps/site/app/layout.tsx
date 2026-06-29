import "@caisson/ui/styles/tokens.css";
import "@caisson/ui/styles/base.css";
import "./global.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { RootProvider } from "fumadocs-ui/provider/next";

import SearchDialog from "@/components/search";
import { fontVariables } from "@/lib/fonts";
import { rootGraph, serializeJsonLd } from "@/lib/jsonld";

export const metadata: Metadata = {
  metadataBase: new URL("https://caisson.sh"),
  title: {
    default: "Caisson — Compliance-grade infrastructure for regulated SaaS",
    template: "%s · Caisson",
  },
  description:
    "Fail-closed Postgres RLS, S3 Object-Lock WORM, and an append-only audit chain — wired and tested before your first customer, not backfilled after your first audit.",
  applicationName: "Caisson",
  openGraph: {
    type: "website",
    siteName: "Caisson",
    url: "https://caisson.sh",
    title: "Caisson — Compliance-grade infrastructure for regulated SaaS",
    description: "Fail-closed by construction.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0d1216",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Self-hosted fonts (next/font, lib/fonts.ts) — no render-blocking Google <link>.
            No-flash theme set is externalized to /theme-init.js so script-src can drop
            'unsafe-inline' for it; runs blocking before paint. */}
        <script src="/theme-init.js" />
        {/* Root @graph: Organization + WebSite (ADR-0079 §4) — XSS-safe serialized. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(rootGraph) }}
        />
      </head>
      <body>
        <a href="#main-content" className="cs-skip-link">
          Skip to content
        </a>
        {/* theme.enabled:false — Caisson owns the theme via data-theme + cs-theme (studio pattern,
            ADR-0042); fumadocs does not run a second next-themes manager. */}
        <RootProvider theme={{ enabled: false }} search={{ SearchDialog }}>
          {children}
        </RootProvider>
        {/* Plausible — cookieless, no consent banner (ADR-0047). Init stub externalized. */}
        <Script
          defer
          data-domain="caisson.sh"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
        <Script src="/plausible-init.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}

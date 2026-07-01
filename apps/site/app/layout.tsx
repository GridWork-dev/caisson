import "@caisson/ui/styles/tokens.css";
import "@caisson/ui/styles/base.css";
import "./global.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";

import SearchDialog from "@/components/search";
import { CartDrawer } from "@/components/cart-drawer";
import { CartProvider } from "@/components/cart-provider";
import { PlausibleInit } from "@/components/plausible-init";
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
          {/* One cart context for the whole origin (ADR-0114 — this is the single unified app):
              the cart a visitor builds on /pricing survives across every page that shows the nav,
              and follows them into the authed /dashboard/cart checkout. The provider lives here so
              EVERY route that renders SiteNav (marketing, security, legal, frameworks, 404) has a
              cart context — a route outside a provider would crash SiteNav's CartTrigger. */}
          <CartProvider>
            {children}
            {/* The slide-out cart, available everywhere the trigger is (returns null when closed). */}
            <CartDrawer />
          </CartProvider>
        </RootProvider>
        {/* Plausible — cookieless, no consent banner, env-gated on NEXT_PUBLIC_PLAUSIBLE_DOMAIN
            (ADR-0118, supersedes the ADR-0047 raw <Script> wiring). */}
        <PlausibleInit />
      </body>
    </html>
  );
}

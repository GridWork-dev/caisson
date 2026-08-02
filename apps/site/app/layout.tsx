import "@caisson/ui/styles/tokens.css";
import "@caisson/ui/styles/base.css";
import "./global.css";
// Registers the private brand glyphs into the kit icon surface for the SERVER bundle graph (the
// client graph is covered by the `@/components` barrel). Side-effect import — keep it.
import "@/lib/register-brand-icons";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";

import SearchDialog from "@/components/search";
import { CartDrawer } from "@/components/cart-drawer";
import { CartProvider } from "@/components/cart-provider";
import { OwnedItemsProvider } from "@/components/owned-items-provider";
import { PlausibleInit } from "@/components/plausible-init";
import { WebVitalsReport } from "@/components/web-vitals-report";
import { fontSansZeroPatch, fontVariables } from "@/lib/fonts";
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
    <html
      lang="en"
      className={fontVariables}
      style={fontSansZeroPatch}
      suppressHydrationWarning
    >
      <head>
        {/* Self-hosted fonts (next/font, lib/fonts.ts) — no render-blocking Google <link>.
            No-flash theme set, inlined (was externalized to /theme-init.js — that request bought
            nothing: the CSP already carries 'unsafe-inline' on script-src, so dropping it was
            never live; inlining removes one render-blocking request off the FCP path on every
            route, same before-paint execution timing). `cs-js` gates the scroll-reveal so
            content is never stuck hidden without JS (progressive enhancement): no class →
            .cs-reveal renders fully visible. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add("cs-js");
try {
  var t = localStorage.getItem("cs-theme");
  if (t) document.documentElement.setAttribute("data-theme", t);
} catch {
  /* storage blocked — keep the default dark theme */
}`,
          }}
        />
        {/* Root @graph: Organization + WebSite (ADR-0079 §4) — XSS-safe serialized. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(rootGraph) }}
        />
        {/* Speculation Rules (ADR-0334 moment 3): hover-eager prerender of marketing nav
            targets — Chromium-only, ignored elsewhere. Never the authed/commerce/API surface;
            analytics are prerender-safe (plausible-init defers to activation, web-vitals is
            activation-aware natively). Static JSON, no user input. */}
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              prerender: [
                {
                  where: {
                    and: [
                      { href_matches: "/*" },
                      {
                        not: {
                          href_matches: [
                            "/dashboard",
                            "/dashboard/*",
                            "/cart",
                            "/api/*",
                            "/login",
                            "/reset-password",
                            "/forgot-password",
                          ],
                        },
                      },
                    ],
                  },
                  eagerness: "moderate",
                },
              ],
            }),
          }}
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
            {/* Ownership awareness (G16) — client-fetched post-mount (see the provider's doc
                comment) so add-to-cart buttons anywhere in the tree can disable/mark an
                already-owned item without forcing this page to render dynamically. */}
            <OwnedItemsProvider>
              {children}
              {/* The slide-out cart, available everywhere the trigger is (returns null when closed). */}
              <CartDrawer />
            </OwnedItemsProvider>
          </CartProvider>
        </RootProvider>
        {/* Plausible — cookieless, no consent banner, env-gated on NEXT_PUBLIC_PLAUSIBLE_DOMAIN
            (ADR-0118, supersedes the ADR-0047 raw <Script> wiring). */}
        <PlausibleInit />
        {/* Web-vitals field capture (task 7, ADR-0334 §7) — cookieless anonymous beacon to
            PostHog; the web-vitals lib loads as a lazy chunk after `load`, never in first-load. */}
        <WebVitalsReport />
      </body>
    </html>
  );
}

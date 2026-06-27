import "@caisson/ui/styles/tokens.css";
import "./global.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { RootProvider } from "fumadocs-ui/provider/next";

import SearchDialog from "@/components/search";

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

// Only the two locked families (ADR-0042, type "Structural"): Hubot Sans + Martian Mono.
// The studio loads six candidates because it is the A/B/C decision surface; the site does not.
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Hubot+Sans:wght@300;400;500;600;700" +
  "&family=Martian+Mono:wght@300;400;500;600&display=swap";

// Set theme before paint to avoid a flash if the operator previously chose light.
const NO_FLASH = `try{var t=localStorage.getItem('cs-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={FONTS_HREF} />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body>
        {/* theme.enabled:false — Caisson owns the theme via data-theme + cs-theme (studio pattern,
            ADR-0042); fumadocs does not run a second next-themes manager. */}
        <RootProvider theme={{ enabled: false }} search={{ SearchDialog }}>
          {children}
        </RootProvider>
        {/* Plausible — cookieless, no consent banner (ADR-0047). */}
        <Script
          defer
          data-domain="caisson.sh"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-init" strategy="afterInteractive">
          {`window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}`}
        </Script>
      </body>
    </html>
  );
}

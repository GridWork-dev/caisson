import "@caisson/ui/styles/tokens.css";
import "@caisson/ui/styles/base.css";
import "./globals.css";
// Registers the private brand glyphs into the kit icon surface for the server bundle graph (admin's
// only bespoke-icon surface — the design/components gallery — is server-rendered). Side-effect.
import "@/lib/register-brand-icons";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { themeInitScript } from "@caisson/ui/components";

import { AdminNav } from "@/components/admin-nav";

export const metadata: Metadata = {
  title: "Caisson · Admin",
  description:
    "The operator control-plane: ops, business admin, live architecture, decisions, and the design system.",
  // Operator-only surface (CF-Access-gated, ADR-0140) — never index.
  robots: { index: false, follow: false },
};

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700" +
  "&family=Geist+Mono:wght@400;500;600" +
  "&family=Hanken+Grotesk:wght@300;400;500;600;700" +
  "&family=Hubot+Sans:wght@300;400;500;600;700" +
  "&family=JetBrains+Mono:wght@400;500;600" +
  "&family=Martian+Mono:wght@300;400;500;600&display=swap";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={FONTS_HREF} />
        {/* 3-prong dark mode (ADR-0100 F3): the kit's pre-paint script pins ONLY an operator
            choice; with none, CSS follows the OS. No hardcoded data-theme → OS-follow is live. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AdminNav />
        <main>{children}</main>
      </body>
    </html>
  );
}

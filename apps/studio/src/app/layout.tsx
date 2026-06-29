import "@caisson/ui/styles/tokens.css";
import "@caisson/ui/styles/base.css";
import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { themeInitScript } from "@caisson/ui/components";

import { Topbar } from "@/components/topbar";

export const metadata: Metadata = {
  title: "Caisson · Design Studio",
  description:
    "Token foundation and design decisions for Caisson, compliance-grade infrastructure.",
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
        {/* 3-prong dark mode (ADR-0098 F3): the kit's pre-paint script pins ONLY an operator
            choice; with none, CSS follows the OS. No hardcoded data-theme → OS-follow is live. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Topbar />
        <main>{children}</main>
      </body>
    </html>
  );
}

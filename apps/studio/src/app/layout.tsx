import "@caisson/ui/styles/tokens.css";
import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

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
        <Topbar />
        <main>{children}</main>
      </body>
    </html>
  );
}

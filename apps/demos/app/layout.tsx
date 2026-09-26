import "@caisson-sh/ui/styles/tokens.css";
import "@caisson-sh/ui/styles/base.css";
import "./global.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { fontSansZeroPatch, fontVariables } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Caisson demos",
  // Every route here is an iframe body inside a caisson.sh page, never a destination of its own.
  // Indexing them would put chrome-less fragments in search results competing with the module
  // pages that embed them.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={fontVariables}
      style={fontSansZeroPatch}
      suppressHydrationWarning
      // The embed marker (ADR-0400). apps/site's wrapper reads this attribute off the loaded
      // iframe document to decide whether a real embed rendered or something else answered —
      // BEFORE the /demos rewrite is armed, the site's own 404 page answers /demos/embed/* with a
      // perfectly successful load event, so "did it load" cannot distinguish the two and "is it
      // ours" can. This attribute is that check's whole contract; renaming it breaks the fallback.
      data-poke-embed="1"
    >
      <head>
        {/* No-flash theme set, inlined — the same script and the same `cs-theme` key apps/site
            uses. This works because the zone is SAME-ORIGIN: the embed document reads the very
            localStorage entry the site's theme toggle wrote, so a light-mode reader never sees a
            dark panel flash inside a light page. A cross-origin subdomain (the shape ADR-0400
            rejected) would have had no way to read it at all. Live toggles after load are pushed
            in by the parent, which can reach this document directly for the same reason. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
  var t = localStorage.getItem("cs-theme");
  if (t) document.documentElement.setAttribute("data-theme", t);
} catch {
  /* storage blocked — keep the default dark theme */
}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

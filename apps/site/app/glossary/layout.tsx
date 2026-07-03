import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

/** Glossary pages live outside (marketing) but need the same nav + footer shell (mirrors
 *  app/frameworks/layout.tsx — glossary SPEC §IA). */
export default function GlossaryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </>
  );
}

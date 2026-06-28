import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

/** Framework pages live outside (marketing) but need the same nav + footer shell. */
export default function FrameworksLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <SiteNav />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </>
  );
}

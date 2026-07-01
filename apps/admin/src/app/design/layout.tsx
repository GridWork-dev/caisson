import type { ReactNode } from "react";

import { DesignNav } from "./design-nav";

// The design section (the absorbed studio) gets its own sub-nav under the root AdminNav.
export default function DesignLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DesignNav />
      {children}
    </>
  );
}

import type { ReactNode } from "react";

import { CatalogNav } from "./catalog-nav";

// The catalog section (the absorbed design studio, now extended with a live component + email
// catalog) gets its own sub-nav under the root AdminNav.
export default function CatalogLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CatalogNav />
      {children}
    </>
  );
}

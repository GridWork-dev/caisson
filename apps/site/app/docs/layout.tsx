import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
      {/* No wrapping <main> here (visual-audit remediation, ADR-0374 W1): DocsLayout's grid
          container (#nd-docs-layout) positions the docs page's header/sidebar/TOC-popover/
          article/TOC as five DIRECT-CHILD grid items via inline `[grid-area:*]` styles — a
          wrapper element between the grid and those items makes every one of those assignments
          inert (grid-area only applies to a direct child) and collapses them all into implicit
          auto-placement instead. The P1-002 main-landmark + skip-link focus target now lives
          directly on the `<article>` fumadocs already renders (`containerProps` on <DocsPage>,
          docs/[[...slug]]/page.tsx) so it keeps the grid intact instead of wrapping it. */}
      {children}
    </DocsLayout>
  );
}

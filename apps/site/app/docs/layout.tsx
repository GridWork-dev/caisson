import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { DocsAskAi } from "@/components/ask-ai/docs-ask-ai";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      // The Ask-AI widget (ADR-0234 F3) sits atop the docs sidebar — a grounded, cited answer over the
      // docs corpus, on every docs page.
      sidebar={{ banner: <DocsAskAi /> }}
      {...baseOptions()}
    >
      {children}
    </DocsLayout>
  );
}

"use client";

// Docs-surface "get started" CTA (ADR-0254 gap #12, docs-funnel Option C). Registered into
// the fumadocs MDX component map (`components/mdx.tsx`) so any doc page can drop in
// `<DocsCta />` the same way it already uses `<Callout>`. Fires the cookieless Plausible
// `docs_cta_click` event (already-locked F8 event set, ADR-0237) on click — this is a
// client-side navigation click, not a server action, so it stays inside `analytics.ts`'s
// existing env-gated no-op contract.
import Link from "next/link";
import { Button } from "@caisson-sh/ui/components";
import { trackEvent } from "@/lib/analytics";

export function DocsCta({
  href = "/marketplace",
  children = "Run the live demos",
}: {
  href?: string;
  children?: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => trackEvent("docs_cta_click", { source: "docs" })}
      style={{ textDecoration: "none", display: "inline-block" }}
    >
      <Button variant="primary">{children}</Button>
    </Link>
  );
}

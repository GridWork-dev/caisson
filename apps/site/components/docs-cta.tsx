"use client";

// Docs-surface "get started" CTA (ADR-0254 gap #12, docs-funnel Option C). Registered into
// the fumadocs MDX component map (`components/mdx.tsx`) so any doc page can drop in
// `<DocsCta />` the same way it already uses `<Callout>`.
import Link from "next/link";
import { Button } from "@caisson-sh/ui/components";

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
      style={{ textDecoration: "none", display: "inline-block" }}
    >
      <Button variant="primary">{children}</Button>
    </Link>
  );
}

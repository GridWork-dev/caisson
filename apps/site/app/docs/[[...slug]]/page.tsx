import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import { createRelativeLink } from "fumadocs-ui/mdx";

import { getMDXComponents } from "@/components/mdx";
import { buildMetadata } from "@/lib/metadata";
import { source } from "@/lib/source";

type Params = { params: Promise<{ slug?: string[] }> };

export default async function Page(props: Params) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({ a: createRelativeLink(source, page) })}
        />
      </DocsBody>
    </DocsPage>
  );
}

// Static export: enumerate every doc slug → one HTML file per page.
export function generateStaticParams() {
  return source.generateParams();
}

// Canonical/OG/Twitter via the shared helper (ADR-0079 §4) — docs pages were the one tree
// skipping it (AEO audit 2026-07-09; ADR-0307 board-sweep ride-along).
export async function generateMetadata(props: Params): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  return buildMetadata({
    title: page.data.title,
    description:
      page.data.description ?? `${page.data.title} — Caisson documentation.`,
    path: page.url,
    type: "article",
  });
}

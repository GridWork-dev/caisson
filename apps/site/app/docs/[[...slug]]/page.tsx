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
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      // A one-segment route (e.g. /docs/agentic-dev) is a bundle's own folder-index page — its
      // meta.json category title IS its H1 (both "Agentic-Dev"), so fumadocs' auto breadcrumb
      // just repeats the heading verbatim (visual-audit remediation). Two-plus segment pages
      // (e.g. /docs/agentic-dev/agent-kernel) keep it: there the breadcrumb ("Agentic-Dev")
      // usefully differs from the H1 ("agent-kernel"). Standalone one-segment pages with no
      // enclosing category (getting-started, licensing, refunds) already render no breadcrumb
      // either way, so this is a no-op for them.
      breadcrumb={{ enabled: (params.slug?.length ?? 0) !== 1 }}
      // The root skip link's `href="#main-content"` (apps/site/app/layout.tsx) needs a target +
      // landmark on the docs subtree, same as every other app-subtree layout (P1-002). Any prop
      // not in DocsPage's own destructure list falls through to fumadocs' <article id="nd-page"
      // [grid-area:main]> (the Container slot, docs/layout.tsx no longer wraps it) so the fix
      // doesn't cost the grid item its grid-area assignment. `role="main"` is explicit rather
      // than relying on an HTML tag, since <article>'s own implicit role isn't "main".
      // `tabIndex={-1}` makes the landmark itself the fragment-navigation focus target, so
      // activating the skip link both scrolls AND moves focus — not just a hash change. The
      // article's own `id="nd-page"` is overridden by this id, same stable CSS hook either way.
      id="main-content"
      role="main"
      tabIndex={-1}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      {/* cs-prose (visual-audit remediation, WCAG 1.4.1): scopes the underline-by-default link
          inversion in global.css to real inline prose links only — never the heading self-link
          anchors fumadocs wraps every h1-h6's own text in ([data-card] excludes those). */}
      <DocsBody className="cs-prose">
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
// skipping it (AEO audit 2026-07-09; ADR-0309 board-sweep ride-along).
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

import type { MetadataRoute } from "next";

import { source } from "@/lib/source";
import { GLOSSARY_TERMS } from "@/lib/glossary";
import { MARKETING_ROUTES } from "@/lib/routes";

export const dynamic = "force-static";

const BASE = "https://caisson.sh";

// lastModified is set to the build date so search engines see a consistent
// freshness signal per deploy. In a CMS-driven site this would be per-entry.
const BUILT_AT = new Date("2026-06-27T00:00:00Z");

export default function sitemap(): MetadataRoute.Sitemap {
  // Marketing pages derive 1:1 from the canonical MARKETING_ROUTES registry (lib/routes.ts) — the
  // same list the nav + footer consume, so a page can never appear in one and silently drift in
  // another. Docs pages still come from Fumadocs' source.
  const marketing: MetadataRoute.Sitemap = MARKETING_ROUTES.map((route) => ({
    url: `${BASE}${route.path}`,
    lastModified: BUILT_AT,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const docs: MetadataRoute.Sitemap = source.getPages().map((page) => ({
    url: `${BASE}${page.url}`,
    lastModified: BUILT_AT,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Glossary spokes derive from GLOSSARY_TERMS the same way docs derive from Fumadocs' source —
  // the bulk program never touches the hand-curated MARKETING_ROUTES list (glossary SPEC §IA).
  const glossary: MetadataRoute.Sitemap = GLOSSARY_TERMS.map((term) => ({
    url: `${BASE}/glossary/${term.slug}`,
    lastModified: BUILT_AT,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...marketing, ...docs, ...glossary];
}

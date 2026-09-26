import type { MetadataRoute } from "next";

import { source } from "@/lib/source";
import { MODULE_PAGES } from "@/lib/module-pages";
import { MARKETING_ROUTES } from "@/lib/routes";
import { WRITING_PIECES, writingLastModified } from "@/lib/writing";

export const dynamic = "force-static";

const BASE = "https://caisson.sh";

// lastModified is set to the build date so search engines see a consistent
// freshness signal per deploy. `force-static` prerenders this route once at build
// time, so `new Date()` bakes in the real build timestamp rather than a hand-set
// value that goes stale the moment it's forgotten. In a CMS-driven site this would
// be per-entry.
const BUILT_AT = new Date();

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

  // Module depth pages derive from MODULE_PAGES (ADR-0237 F2): a record IS the page, so the
  // sitemap can never list a module the catalog dropped.
  const modules: MetadataRoute.Sitemap = MODULE_PAGES.map((record) => ({
    url: `${BASE}/marketplace/modules/${record.slug}`,
    lastModified: BUILT_AT,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Dated-commentary spokes derive from WRITING_PIECES. The /writing hub is emitted once through
  // MARKETING_ROUTES above; individual records never enter that hand-curated route registry.
  const writing: MetadataRoute.Sitemap = WRITING_PIECES.map((piece) => ({
    url: `${BASE}/writing/${piece.slug}`,
    lastModified: writingLastModified(piece),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...marketing, ...docs, ...modules, ...writing];
}

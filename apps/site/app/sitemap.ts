import type { MetadataRoute } from "next";

import { source } from "@/lib/source";

export const dynamic = "force-static";

const BASE = "https://caisson.sh";

// lastModified is set to the build date so search engines see a consistent
// freshness signal per deploy. In a CMS-driven site this would be per-entry.
const BUILT_AT = new Date("2026-06-27T00:00:00Z");

// Core marketing pages — highest priority
const MARKETING_CORE: Array<{ path: string; priority: number }> = [
  { path: "", priority: 1.0 },
  { path: "/compliance", priority: 0.9 },
  { path: "/ai-kit", priority: 0.9 },
  { path: "/local-first", priority: 0.9 },
  { path: "/agentic-dev", priority: 0.9 },
  { path: "/pricing", priority: 0.85 },
];

// Secondary marketing pages — security, trust, procurement, changelog
const MARKETING_SECONDARY: Array<{ path: string; priority: number }> = [
  { path: "/security", priority: 0.75 },
  { path: "/changelog", priority: 0.7 },
  { path: "/procurement", priority: 0.7 },
];

// Framework / compliance-signal pages (SEO long-tail)
const FRAMEWORKS: Array<{ path: string; priority: number }> = [
  { path: "/frameworks/eu-ai-act", priority: 0.75 },
];

// Legal pages — low priority (exist for crawl completeness, not ranking)
const LEGAL: Array<{ path: string; priority: number }> = [
  { path: "/legal/privacy", priority: 0.4 },
  { path: "/legal/terms", priority: 0.4 },
  { path: "/legal/license", priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const marketing: MetadataRoute.Sitemap = [
    ...MARKETING_CORE,
    ...MARKETING_SECONDARY,
    ...FRAMEWORKS,
    ...LEGAL,
  ].map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    lastModified: BUILT_AT,
    changeFrequency: "weekly" as const,
    priority,
  }));

  const docs: MetadataRoute.Sitemap = source.getPages().map((page) => ({
    url: `${BASE}${page.url}`,
    lastModified: BUILT_AT,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...marketing, ...docs];
}

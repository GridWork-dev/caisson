import type { MetadataRoute } from "next";

import { source } from "@/lib/source";

export const dynamic = "force-static";

const BASE = "https://caisson.sh";
const MARKETING = [
  "",
  "/compliance",
  "/ai-kit",
  "/local-first",
  "/agentic-dev",
  "/pricing",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const marketing: MetadataRoute.Sitemap = MARKETING.map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.8,
  }));
  const docs: MetadataRoute.Sitemap = source.getPages().map((page) => ({
    url: `${BASE}${page.url}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));
  return [...marketing, ...docs];
}

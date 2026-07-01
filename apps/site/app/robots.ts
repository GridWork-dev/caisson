import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// NOTE (SWEEP followup): Cloudflare content-signal headers (e.g. X-Robots-Tag for
// server-sent content type signals, Cache-Control for freshness hints to Googlebot)
// cannot be set from a static export. Those signals should be wired via Cloudflare
// Pages _headers file in a subsequent SWEEP pass when CWV/crawl-budget work begins.

export default function robots(): MetadataRoute.Robots {
  return {
    // The authed buyer dashboard (ADR-0114) has no SEO value and no business being crawled.
    rules: { userAgent: "*", allow: "/", disallow: "/dashboard" },
    sitemap: "https://caisson.sh/sitemap.xml",
    host: "https://caisson.sh",
  };
}

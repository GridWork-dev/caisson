import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// NOTE (SWEEP followup): the site is now a dynamic Next standalone app on Railway
// (ADR-0114/0115, superseding the old Cloudflare Pages static export) — per-path
// content-signal headers (X-Robots-Tag, freshness Cache-Control for Googlebot) CAN be
// added via next.config.ts's headers() (already used for the CSP/HSTS/security floor).
// Not yet wired: still a follow-up for when CWV/crawl-budget work begins, not a
// platform blocker.

export default function robots(): MetadataRoute.Robots {
  return {
    // The authed buyer dashboard (ADR-0114) has no SEO value and no business being crawled.
    rules: { userAgent: "*", allow: "/", disallow: "/dashboard" },
    sitemap: "https://caisson.sh/sitemap.xml",
    host: "https://caisson.sh",
  };
}

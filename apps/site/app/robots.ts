import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// NOTE (SWEEP followup): the site is now a dynamic Next standalone app on Railway
// (ADR-0114/0115, superseding the old Cloudflare Pages static export) — per-path
// content-signal headers (X-Robots-Tag, freshness Cache-Control for Googlebot) CAN be
// added via next.config.ts's headers() (already used for the CSP/HSTS/security floor).
// Not yet wired: still a follow-up for when CWV/crawl-budget work begins, not a
// platform blocker.

// AI answer-engine crawlers we explicitly welcome (AEO program, CAISSON-29). The wildcard rule
// below already admits them, but a named Allow is an unambiguous, auditable signal — and a hedge
// against a managed edge rule that default-blocks AI bots (a common silent AEO blocker). robots.txt
// is most-specific-match: a bot with its own user-agent group ignores the `*` group entirely, so
// each named group repeats the `/dashboard` disallow rather than inheriting it. This is the full
// current answer-engine set (OpenAI, Anthropic, Perplexity, Google/Apple AI grounding, and peers) —
// a static token list, so a new bot simply falls back to the equally-permissive `*` rule.
const AI_CRAWLERS = [
  "GPTBot", // OpenAI training + ChatGPT browsing
  "OAI-SearchBot", // OpenAI SearchGPT index
  "ChatGPT-User", // ChatGPT on-demand fetch (user action)
  "ClaudeBot", // Anthropic crawler
  "Claude-Web", // Anthropic on-demand fetch
  "anthropic-ai", // legacy Anthropic UA
  "PerplexityBot", // Perplexity index
  "Perplexity-User", // Perplexity on-demand fetch
  "Google-Extended", // Gemini / Vertex grounding opt-in
  "Applebot-Extended", // Apple Intelligence grounding opt-in
  "Amazonbot", // Alexa / Amazon answer index
  "cohere-ai", // Cohere retrieval
  "DuckAssistBot", // DuckDuckGo AI assist
  "Meta-ExternalAgent", // Meta AI fetch
];

export default function robots(): MetadataRoute.Robots {
  return {
    // The authed buyer dashboard (ADR-0114) has no SEO value and no business being crawled.
    rules: [
      { userAgent: AI_CRAWLERS, allow: "/", disallow: "/dashboard" },
      { userAgent: "*", allow: "/", disallow: "/dashboard" },
    ],
    sitemap: "https://caisson.sh/sitemap.xml",
    host: "https://caisson.sh",
  };
}

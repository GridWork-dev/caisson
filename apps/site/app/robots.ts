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

// Paths with no SEO value that a crawler should never spend budget on: the authed buyer dashboard
// (ADR-0114) plus the checkout and account-recovery dead-ends. /cart and /dashboard currently
// redirect to a Cloudflare Access team login, so an allowed crawl indexes an auth wall under a
// caisson.sh URL. Disallowed rather than `noindex` on purpose — these carry no ranking signal
// worth crawling to collect, and it matches the pre-existing /dashboard rule. The root layout
// excludes these same paths from its speculation rules (plus /api/*, which is a prerender concern
// rather than a crawl one) — a route added to one list usually belongs in the other.
const NO_CRAWL = [
  "/dashboard",
  "/cart",
  "/login",
  "/forgot-password",
  "/reset-password",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_CRAWLERS, allow: "/", disallow: NO_CRAWL },
      { userAgent: "*", allow: "/", disallow: NO_CRAWL },
    ],
    sitemap: "https://caisson.sh/sitemap.xml",
    host: "https://caisson.sh",
  };
}

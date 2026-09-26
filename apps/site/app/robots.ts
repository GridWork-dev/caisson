import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// The site is a static export (per-path headers live in public/_headers).

// AI answer-engine crawlers we explicitly welcome (AEO program, CAISSON-29). The wildcard rule
// below already admits them, but a named Allow is an unambiguous, auditable signal — and a hedge
// against a managed edge rule that default-blocks AI bots (a common silent AEO blocker). robots.txt
// is most-specific-match: a bot with its own user-agent group ignores the `*` group entirely, so
// each named group repeats the disallow list rather than inheriting it. This is the full current
// answer-engine set (OpenAI, Anthropic, Perplexity, Google/Apple AI grounding, and peers) — a
// static token list, so a new bot simply falls back to the equally-permissive `*` rule.
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

// Paths with no SEO value that a crawler should never spend budget on: the framed demo embeds
// (they render inside module pages, never as standalone documents) and the prebuilt search index.
const NO_CRAWL = ["/demos/", "/api/"];

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

# Technical SEO — static-export Next 16 / Cloudflare Pages (Caisson site)

Research surface: **seo** (with visual / brand / copy adjacencies on the OG + font decisions).
Date: 2026-06-27. Researcher dispatch (grounded, exa + crawl4ai). Every claim carries a URL.

Scope: `apps/site` — single static-export (`output: "export"`) Next 16 App Router app, Fumadocs
MDX docs, images unoptimized, deployed to Cloudflare Pages direct-upload, Plausible analytics,
no SSR / no server routes (waitlist = CF Pages Function). Locks honored: ADR-0040 (compliance
wedge hero), ADR-0041 (name = Caisson / `caisson.sh`), ADR-0042 (palette A teal + Hubot Sans /
Martian Mono), ADR-0045 (stack), ADR-0047 (Plausible cookieless), ADR-0048 (SKU structure, no
hard prices). Pricing remains the only open GTM fork → **no `Offer.price` may be emitted yet.**

---

## 0. Current-state audit (what the repo already ships)

Read from the working tree:

| Surface                                                                                                                            | Status                                                                                                                     | File                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `metadataBase`, title default + `%s · Caisson` template, description, `applicationName`, root `openGraph`, `robots:{index,follow}` | ✅ present                                                                                                                 | `apps/site/app/layout.tsx:11-28`                                      |
| Per-page `metadata` (title + description) on marketing pages                                                                       | ✅ present                                                                                                                 | `apps/site/app/(marketing)/page.tsx:6-10`, `compliance/page.tsx:6-10` |
| Docs `generateMetadata` (title + description only)                                                                                 | ⚠️ thin — no canonical, no OG, no article schema                                                                           | `apps/site/app/docs/[[...slug]]/page.tsx:41-49`                       |
| Single global build-time OG image (1200×630, satori, hard-coded hex)                                                               | ✅ present, **global only**                                                                                                | `apps/site/app/opengraph-image.tsx`                                   |
| `sitemap.ts` (`force-static`, marketing + docs, weekly, priority)                                                                  | ✅ present — **no `lastModified`**                                                                                         | `apps/site/app/sitemap.ts`                                            |
| `robots.ts` (`force-static`, allow `*`, sitemap, host)                                                                             | ✅ present — **no AI-crawler stance**                                                                                      | `apps/site/app/robots.ts`                                             |
| `SoftwareApplication` JSON-LD                                                                                                      | ⚠️ present but **duplicated on every marketing page**, `offers.PreOrder` (no price), no `@id`, no Organization, no WebSite | `apps/site/app/(marketing)/layout.tsx:7-18`                           |
| `llms.txt` + `llms-full.txt`                                                                                                       | ✅ present (fumadocs `llms()`), `force-static`                                                                             | `apps/site/app/llms.txt/route.ts`, `llms-full.txt/route.ts`           |
| Fonts: Hubot Sans (5 weights) + Martian Mono (4 weights) via **Google Fonts CDN** `<link>`                                         | ⚠️ render-blocking third-party stylesheet, FOUT, no metric overrides, no preload                                           | `apps/site/app/layout.tsx:32-49`                                      |
| Security headers (Pages Functions)                                                                                                 | ✅ present                                                                                                                 | `apps/site/functions/_middleware.ts`                                  |
| RSC `.txt` prefetch-sibling cleanup ("index.txt trap")                                                                             | ✅ handled                                                                                                                 | `apps/site/scripts/normalize-export.mjs`                              |

**Headline gaps:** (1) no `Organization` entity anywhere → no Knowledge-Panel anchor; (2) no
canonical tags (`alternates.canonical`); (3) no Twitter card metadata; (4) one OG image for the
whole site; (5) JSON-LD duplicated, not an `@graph` entity model; (6) fonts on the Google CDN
(slowest, least-controllable option) with no FOUT/CLS mitigation; (7) no explicit AI-crawler policy.

---

## 1. Structured data / JSON-LD

### What still earns its bytes in 2026

The rich-result set has narrowed hard. Confirmed live (Google) vs AI-only-parse:

- **Organization** — Knowledge Panel / entity card. "One per site, on the homepage. Logo, sameAs
  (social profiles), founder, contact. This is the canonical entity card Google uses to identify
  your business." [spaceandstory.co](https://spaceandstory.co/blog/structured-data-types-google-2026),
  [Google docs](https://developers.google.com/search/docs/appearance/structured-data/organization)
- **BreadcrumbList** — "boring but high-impact… feeds AI extractors a clean hierarchy. Every page
  in a site with structure should have it." Desktop-SERP only (not mobile).
  [spaceandstory.co](https://spaceandstory.co/blog/structured-data-types-google-2026),
  [Google breadcrumb docs](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)
- **Article / TechArticle** — "Powers Top Stories, Discover… the highest-impact field most teams
  skip is `author` with a linked `Person` schema." Needs `headline`, `author`, `datePublished`.
  [crawlraven.com](https://crawlraven.com/blog/google-faq-rich-results-deprecated-may-2026)
- **SoftwareApplication / WebApplication** — "the right type for most SaaS… signals to Google that
  your offering is software, not a generic Product." Rich result requires `aggregateRating` **and/or**
  `offers.price`; with neither it is parsed but renders nothing.
  [wildandfreetools.com](https://wildandfreetools.com/blog/schema-markup-for-saas-pricing-pages/),
  [seo.yatna.ai](https://seo.yatna.ai/seo-academy/softwareapplication-schema-rich-results/),
  [Google SoftwareApplication docs](https://developers.google.com/search/docs/appearance/structured-data/software-app)
- **WebSite (+ optional SearchAction)** — one per site on the homepage; anchors the publisher
  entity, feeds AI engines, `isPartOf` reference for every page. The SearchAction sitelinks-search-box
  was **retired by Google Nov 21 2024** but Bing/Copilot/agentic-search still consume it.
  [Google: Farewell Sitelinks Search Box](https://developers.google.com/search/blog/2024/10/sitelinks-search-box),
  [capconvert.com](https://www.capconvert.com/learn/blog/how-to-create-website-schema),
  [geodocs.dev](https://geodocs.dev/technical/website-schema-searchaction-ai-search)
- **FAQPage — DEAD.** Fully sunset in Google Search **May 7 2026** (was gov/health-only since Aug
  2023). Still a valid type; AI engines (Perplexity, AI Mode) still parse it for retrieval. Ship
  only where FAQs are _real_, never manufactured for the schema.
  [Google updates changelog](https://developers.google.com/search/updates),
  [searchenginejournal.com](https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/),
  [seojuice.com](https://seojuice.com/blog/schema-org-2026-what-google-reads/)

### The architecture decision (the high-leverage one)

The strongest 2026 guidance is to treat JSON-LD as an **entity graph, not a tag checklist**: give
every reusable entity a stable `@id` URI and cross-reference them (`publisher`, `isPartOf`,
`author`) so Google/LLMs accumulate evidence across pages. Combine related entities on one page
under `@graph`. "A site that implements JSON-LD as a tag checklist gets occasional rich results; a
site that implements it as a knowledge graph earns durable entity representation in Google's
Knowledge Graph, AI Overviews, and LLM citation indexes."
[samcheek.com](https://samcheek.com/blog/json-ld-schema-nextjs-app-router-2026)

The current repo duplicates an anonymous `SoftwareApplication` (no `@id`) on every marketing page —
the anti-pattern. Recommended target: a **root `@graph`** with `Organization#org` +
`WebSite#website` (publisher → `#org`), then page-scoped `SoftwareApplication`/`TechArticle`/
`BreadcrumbList` that reference those `@id`s.

### How to emit statically in Next 16

JSON-LD is "just a `<script>` tag" and works in `output: export` in any Server Component — the
current `dangerouslySetInnerHTML` pattern is correct.
[zlyqor.com](https://zlyqor.com/blog/next-js-static-export-seo-guide). One hardening note: escape
the `<` to prevent a `</script>` break-out XSS via any interpolated value —
`JSON.stringify(data).replace(/</g, '\\u003c')` is the documented mitigation.
[samcheek.com](https://samcheek.com/blog/json-ld-schema-nextjs-app-router-2026). Prefer a Server
Component `<script>` over the `metadata` object (Next's metadata API has no first-class JSON-LD slot).
[schemapreview.com](https://schemapreview.com/guides/json-ld-nextjs-app-router/)

> **Pricing-fork constraint:** until pricing locks (ADR-0048), `offers` must NOT carry a numeric
> `price`. Keep `SoftwareApplication` without `offers` (or `offers.availability: PreOrder` with no
> price — current state), and add `Offer`/`Product` price schema to `/pricing` only after the lock.
> Emitting `price:0` would mislabel a paid product as free
> ([seo.yatna.ai](https://seo.yatna.ai/seo-academy/softwareapplication-schema-rich-results/)).

---

## 2. Metadata API patterns (Next 16, static export)

Confirmed working under `output: export` (build-time evaluation, baked into HTML):
`export const metadata`, `generateMetadata` (dynamic routes via `generateStaticParams`), `sitemap.ts`,
`robots.ts`, file-convention OG images. [zlyqor.com](https://zlyqor.com/blog/next-js-static-export-seo-guide),
[Next.js metadata docs](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)

Patterns to adopt:

- **Canonical on every page** via `alternates: { canonical: '/path' }` (resolved against
  `metadataBase`). "Always include the canonical URL. This is belt-and-suspenders protection
  against duplicate content from URL parameters or trailing slash variants." Currently absent.
  [zlyqor.com](https://zlyqor.com/blog/next-js-static-export-seo-guide),
  [alirehanhaider.com](https://alirehanhaider.com/blog/fix-missing-canonical-tags-nextjs)
- **`metadataBase`** already set (`https://caisson.sh`) — critical so relative OG/canonical URLs
  resolve to absolute. [zlyqor.com](https://zlyqor.com/blog/next-js-static-export-seo-guide)
- **`generateMetadata` must not be in a `'use client'` component**; OK here (docs page is a Server
  Component). [zlyqor.com](https://zlyqor.com/blog/next-js-static-export-seo-guide)
- **Streaming metadata is irrelevant here** — "Prerendered pages don't use streaming since metadata
  is resolved at build time," and it's disabled for `Twitterbot`/`Slackbot`/`Bingbot` regardless.
  No `htmlLimitedBots` config needed for a fully static site.
  [Next.js metadata docs](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- **Trailing-slash gotcha:** with `output:'export'` + `trailingSlash:true`, Next has a history of
  bugs appending a trailing slash to file URLs and mis-emitting canonical/`index.html`
  ([#62900](https://github.com/vercel/next.js/issues/62900),
  [#68215](https://github.com/vercel/next.js/issues/68215),
  [canonical fix #62109](https://github.com/vercel/next.js/commit/dc71a5721b80867d91359f3b91d85202d9dda3a1)).
  Decide one canonical form (no trailing slash is current default) and make sitemap + canonical +
  Cloudflare serving agree, or duplicate-URL dilution results.
- Docs pages should add `openGraph` + `twitter` + `alternates.canonical` in their `generateMetadata`
  (today they emit only title/description).

---

## 3. OG / social image strategy

The app ships **one** global `app/opengraph-image.tsx` (1200×630, satori, hard-coded palette hex —
correctly justified since satori can't read OKLCH custom props). Best-practice gaps + decisions:

- **Per-route OG images** are the convention: drop `opengraph-image.tsx` in any route segment; Next
  renders it to a 1200×630 PNG at build. A per-edition image (Compliance / AI-Kit / Local-first /
  Agentic-Dev) lifts social CTR vs one generic card.
  [Next opengraph-image convention](https://nextjs.thisisme1228.com/docs/content/app/api-reference/file-conventions/metadata/opengraph-image),
  [rabinarayanpatra.com](https://www.rabinarayanpatra.com/snippets/nextjs/opengraph-image-route)
- **STATIC-EXPORT GOTCHA — dynamic routes:** `opengraph-image.tsx` inside a **dynamic** segment
  (`app/docs/[[...slug]]/opengraph-image.tsx`) historically did **not** statically generate under
  `output:'export'` — it was marked server-rendered and produced no PNG, even with
  `generateStaticParams`. ([vercel/next.js #51147](https://github.com/vercel/next.js/issues/51147),
  closed-completed Feb 2025; [#57349](https://github.com/vercel/next.js/issues/57349)). Static OG
  for **each** doc page therefore needs either `generateImageMetadata` enumerating params, or a
  build-time satori/resvg script that writes one PNG per slug — verify on the pinned Next 16 build
  before relying on per-doc cards. A safe fallback: one shared docs OG + per-edition marketing OG.
  ([JoZapf/nextjs-static-og-generator](https://github.com/JoZapf/nextjs-static-og-generator))
- **Twitter card is missing.** Add `twitter: { card: 'summary_large_image', title, description,
images, site:'@…' }`. Next reuses `opengraph-image` for `twitter-image` if no separate file, but
  the `twitter.card` field + handle still need setting.
  [rabinarayanpatra.com](https://www.rabinarayanpatra.com/snippets/nextjs/app-router-metadata-generator)
- **Dimensions:** 1200×630 (1.91:1) is the universal default and already used; no need for square
  unless targeting a specific surface. [makerkit.dev](https://makerkit.dev/blog/tutorials/dynamic-og-image)
- **Per-page `alt`** text is set globally today (`export const alt`); per-edition images should each
  set their own `alt` (accessibility + a weak relevance signal).
- **OG fonts:** satori currently falls back to system `monospace` (line 33). To make the card carry
  the locked wordmark identity (Martian Mono / Hubot Sans), embed the woff via the `fonts` option
  (`readFile` the woff at build, pass to `ImageResponse`). This is a **brand** decision, not just
  perf. [Vercel: custom font in OG](https://vercel.com/kb/guide/using-custom-font),
  [zenn.dev custom OG fonts](https://zenn.dev/ryota_09/articles/cdef1901df899b?locale=en)
- **Favicon / icon set:** no `app/icon`, `apple-icon`, or `manifest`/`theme-color` observed — a
  brand-surface gap (the dark `#0d1216` should be the `theme-color`).
  [Next favicons](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)

---

## 4. Sitemap / robots (static export)

Both already correct in shape. Refinements:

- **`sitemap.ts`** runs at build in Node — can `fs`-read content, emit one accurate `out/sitemap.xml`.
  Current file omits `lastModified`; add it (from MDX frontmatter / git mtime) — it's the one field
  crawlers actually weight; `changeFrequency`/`priority` are largely ignored by Google but harmless.
  [zlyqor.com](https://zlyqor.com/blog/next-js-static-export-seo-guide)
- **`robots.ts`** runs at build → `out/robots.txt`; cleaner than a static `/public` file because the
  sitemap URL derives from `metadataBase`. [zlyqor.com](https://zlyqor.com/blog/next-js-static-export-seo-guide)
- Current `robots.ts` is `allow:'/'` for `*` with **no AI-crawler rules** — see §6 for the policy fork.
- **Route handlers don't run in `output:'export'`** — confirm `app/api/search/route.ts` is either a
  build-time static index (fumadocs orama static) or a CF Pages Function, not relied on as a live
  server route. [zlyqor.com](https://zlyqor.com/blog/next-js-static-export-seo-guide)

---

## 5. Core Web Vitals — fonts, CLS, LCP (static dark site)

This is the biggest **shippable perf win**. The site loads Hubot Sans (5 weights) + Martian Mono
(4 weights) from the **Google Fonts CDN** via a render-blocking `<link>` — the slowest, least
controllable option.

- **Self-host beats the CDN in 2026.** The Google embed adds two cross-origin connections
  (`fonts.googleapis.com` CSS + `fonts.gstatic.com` files), a render-blocking third-party stylesheet,
  and fonts that can't share your HTTP/2 connection, can't be preloaded, and whose `font-display` you
  can only set globally. Browser cache partitioning killed the old shared-cache advantage. Measured
  median **LCP improvement ~180ms** self-hosting with preload.
  [corewebvitals.io](https://www.corewebvitals.io/pagespeed/self-host-google-fonts),
  [webvitals.tools](https://webvitals.tools/guides/font-loading/),
  [madegooddesigns.com](https://madegooddesigns.com/google-fonts-vs-self-hosted/)
- **In Next, `next/font` self-hosts at build** (Google or local), eliminating the external request
  and giving zero-layout-shift handling. Vercel's own skill: "Use `next/font` for automatic font
  optimization with zero layout shift."
  [vercel-labs/next-skills font.md](https://github.com/vercel/nextjs-skills/blob/HEAD/skills/next-best-practices/font.md),
  [Vercel Academy: fonts](https://vercel.com/academy/nextjs-foundations/fonts-with-next-font)
- **`font-display`:** `swap` = 0ms block, infinite swap, text visible immediately (FOUT) — best for
  LCP, risk CLS. `optional` = 100ms block, no swap → **zero CLS** but font may not show first visit.
  `block`/FOIT is the worst (blank text up to 3s). Only 0.5% of sites use `optional` despite it being
  the most CWV-safe. [web.dev font best practices](https://web.dev/articles/font-best-practices),
  [Chrome: font-display](https://developer.chrome.com/blog/font-display),
  [vitalsfixer.com](https://vitalsfixer.com/blog/font-loading-optimization)
- **Kill the swap-shift with metric overrides.** `size-adjust` + `ascent-override` +
  `descent-override` reshape the system fallback to match the web font → "CLS from font swap drops by
  80 to 90 percent." `next/font` generates a `adjustFontFallback` automatically; for `local`, compute
  with Capsize. [webvitals.tools](https://webvitals.tools/guides/font-loading/),
  [vitalsfixer.com](https://vitalsfixer.com/blog/font-loading-optimization)
- **Preload one critical weight** (the H1 display weight) and ship **WOFF2 only** — 97%+ support, no
  WOFF/TTF fallbacks needed. Subset to Latin. Currently 9 font files load uncontrolled.
  [studiolimb.com](https://www.studiolimb.com/guides/google-fonts-performance.html),
  [madegooddesigns.com](https://madegooddesigns.com/google-fonts-vs-self-hosted/)
- **LCP element risk:** the hero is a `<pre className="cs-code">` terminal block in **Martian Mono**
  (`page.tsx:100`, `compliance/page.tsx:125`). If the LCP candidate is that monospace block or the
  display H1, a late web-font swap directly delays/ shifts LCP. Preload the two families used
  above-the-fold; consider `font-display:optional` for the display face to lock CLS.
  [vitalsfixer.com](https://vitalsfixer.com/blog/font-loading-optimization)
- Dark theme is set pre-paint via the inline `NO_FLASH` script (`layout.tsx:37`) — good, avoids a
  theme-flash CLS/contrast hit. `images:{unoptimized:true}` means any raster needs explicit
  `width`/`height` to avoid CLS (the site is mostly type + CSS, low risk).

---

## 6. AI / GEO — llms.txt, AI-crawler policy, generative-engine ranking

### llms.txt / llms-full.txt (already shipped)

The honest 2026 evidence: **llms.txt does not currently drive AI-search visibility or citations.**

- Google on record (Mueller, June 2025): "no AI system currently uses llms.txt… it's super-obvious
  if you look at your server logs" — compared it to the deprecated keywords meta tag. Illyes (July
  2025): Google doesn't support it and isn't planning to.
  [seoprocheck.com](https://seoprocheck.com/research/ai-search/llms-txt-explained/),
  [limy.ai](https://limy.ai/blog/llms.txt-in-2026-the-full-guide)
- Log studies converge: OtterlyAI 90-day — **84 hits / 62.1K AI-bot requests (0.1%)**; Limy — 408 /
  515M; Ahrefs — "97% of llms.txt files never get read"; SE Ranking (300K domains) — removing the
  llms.txt feature _improved_ their citation-prediction model (it was noise).
  [otterly.ai](https://otterly.ai/blog/the-llms-txt-experiment/),
  [limy.ai](https://limy.ai/blog/llms.txt-in-2026-the-full-guide),
  [ahrefs.com](https://ahrefs.com/blog/llmstxt-study/),
  [seranking.com](https://seranking.com/blog/llms-txt/)
- **Where it genuinely helps:** IDE / coding agents (Cursor, Claude Code, Copilot, Cline, Aider)
  fetch `/llms.txt` + `/llms-full.txt` when pointed at a docs site — "agent identifies which
  dependency owns a feature, fetches that library's llms.txt, then pulls only the relevant linked
  pages." For a developer-tool product like Caisson this is the _exact_ high-value audience.
  [limy.ai](https://limy.ai/blog/llms.txt-in-2026-the-full-guide),
  [seoprocheck.com](https://seoprocheck.com/research/ai-search/llms-txt-explained/)
- **Verdict:** keep the files (cheap, right audience), but (a) don't expect SERP/AI-citation lift,
  (b) the real GEO levers are crawlable raw HTML (not client-rendered), homepage strength, and
  internal linking — "crawlers enter via the homepage and follow internal links."
  [longato.ch](https://www.longato.ch/llmstxt-2026-june/). **Route agents to it** — link
  `/llms.txt` from the HTML/docs so agents discover it (an unlinked file is rarely fetched).
  [ahrefs.com](https://ahrefs.com/blog/llmstxt-study/)
- **Caisson-specific risk:** Trigger.dev (a close dev-infra comp) renders its homepage client-side —
  crawl4ai fetched its HTML and found **0 JSON-LD blocks and 0 OG/twitter meta** in the initial
  markup (verified this session). Caisson's static export is strictly better here; the lesson is to
  keep the substantive copy in server-rendered HTML, which the current Server Components already do.

### AI-crawler policy (robots.txt) — a real fork

The 2026 consensus for a **marketing / developer-tool site that monetizes through discovery**: do
**not** block retrieval/search crawlers. Vendors split _training_ vs _search_ user-agents, and the
decisions are independent:

- Training-only (no referral, ever): `GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended` (token, not
  a UA), `Applebot-Extended`, `Bytespider`. Search/citation (send traffic): `OAI-SearchBot`,
  `Claude-SearchBot`, `PerplexityBot`, `Perplexity-User`, `ChatGPT-User`, `Bingbot`.
  [digitalapplied.com](https://www.digitalapplied.com/blog/ai-crawler-access-control-2026-robots-llms-txt-decision-matrix),
  [okara.ai](https://okara.ai/blog/robots-txt-for-ai-crawlers),
  [nicodigital.com](https://www.nicodigital.com/technical-seo/should-you-block-gptbot-claudebot-perplexitybot/)
- "For 80% of brands, 'Allow All plus a strong llms.txt' is the right policy." Blocking
  PerplexityBot/OAI-SearchBot = immediate zero AI-answer visibility; Vercel+MERJ measured a **73%
  drop in ChatGPT-Search citations within 60 days** on sites that blocked GPTBot.
  [nicodigital.com](https://www.nicodigital.com/technical-seo/should-you-block-gptbot-claudebot-perplexitybot/),
  [scoregeo.ai](https://scoregeo.ai/blog/ai-bots-robots-txt-truth)
- Blocking any AI crawler has **zero effect on Googlebot / classic Google ranking**.
  [verlua.com](https://www.verlua.com/blog/ai-crawler-management-guide),
  [ranketai.com](https://www.ranketai.com/en/blog/explainer-ranketai-guide-05-ai-crawler-policies-2026-05-07)
- **Cloudflare Content-Signals Policy** (late 2025): a robots.txt addition declaring _use_ intent —
  `search=yes`, `ai-input=yes`, `ai-train=yes|no` — written as an EU-copyright reservation of rights,
  added to millions of domains. Caisson is on Cloudflare Pages → cheap to express stance here.
  [rankry.ai](https://rankry.ai/blog/should-you-allow-or-blocking-ai-crawlers/),
  [digitalapplied.com](https://www.digitalapplied.com/blog/ai-crawler-access-control-2026-robots-llms-txt-decision-matrix)

### What actually ranks in generative engines (2026)

- AI engines (Perplexity, ChatGPT-Search, Claude, Google AI Mode) extract from **rendered HTML at
  retrieval**, and **parse JSON-LD** to ground citations — Organization, Article, BreadcrumbList,
  Product all feed the "AI parse" column even where the visible rich result is gone.
  [seojuice.com](https://seojuice.com/blog/schema-org-2026-what-google-reads/),
  [spaceandstory.co](https://spaceandstory.co/blog/structured-data-types-google-2026)
- A May 2026 study (via Search Engine Roundtable) found **adding schema markup did NOT improve AI
  citation rates** — so structured data is for entity-disambiguation and Google rich results, not a
  GEO silver bullet. [hybridranking.com](https://hybridranking.com/blog/llms-txt-one-year-later)
- Net GEO priority for Caisson: server-rendered substantive copy (done), clean entity graph
  (Organization + WebSite + per-edition SoftwareApplication), strong internal linking from the
  homepage, and the evidence-dense terminal-transcript copy that already reads well to an LLM.

---

## 7. Decision / fork table

surface ∈ {visual, brand, seo, copy}. Conf = high/med/low. ★ = present individually to operator
(brand-expansion / hero-or-wordmark-adjacent), not batched.

| #     | Surface      | Fork                                                 | Options                                                                                                                           | Recommendation                                                                                | Conf                                        | Evidence                                                                                                                                                                                                                                              |
| ----- | ------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1    | seo          | JSON-LD type set to ship                             | A) Org+WebSite+SoftwareApplication+Breadcrumb+TechArticle · B) just keep SoftwareApplication · C) add FAQPage too                 | **A** (drop FAQPage)                                                                          | high                                        | FAQ dead May-7-2026; Org/Breadcrumb/Article still live [searchenginejournal](https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/), [spaceandstory](https://spaceandstory.co/blog/structured-data-types-google-2026) |
| F2    | seo          | JSON-LD architecture                                 | A) per-page duplicated anonymous blocks (current) · B) root `@graph` with stable `@id`, pages reference it                        | **B** — entity graph                                                                          | high                                        | [samcheek.com](https://samcheek.com/blog/json-ld-schema-nextjs-app-router-2026)                                                                                                                                                                       |
| F3    | seo          | Add Organization entity (currently none)             | A) add `Organization#org` (GridWork Digital LLC, logo, sameAs GitHub/X) on homepage · B) omit                                     | **A**                                                                                         | high                                        | [Google Org docs](https://developers.google.com/search/docs/appearance/structured-data/organization), [squin.org](https://squin.org/structured-data/organization-schema/)                                                                             |
| F4    | seo          | SoftwareApplication `offers` while pricing is locked | A) no `offers` · B) keep `offers.PreOrder` no price (current) · C) `price:0`                                                      | **B**                                                                                         | high                                        | rich result needs price/rating; never emit price:0 on paid product [seo.yatna.ai](https://seo.yatna.ai/seo-academy/softwareapplication-schema-rich-results/); ADR-0048                                                                                |
| F5    | seo          | `@type` for the product                              | A) `SoftwareApplication` (current) · B) `WebApplication` · C) both `["SoftwareApplication","WebApplication"]`                     | **A**, `applicationCategory:"SecurityApplication"` or `DeveloperApplication`                  | med                                         | Google treats them identically; category is controlled-vocab [seo.yatna.ai](https://seo.yatna.ai/seo-academy/softwareapplication-schema-rich-results/), [autoseobot](https://autoseobot.com/blog/schema-markup-saas.html)                             |
| F6    | seo          | WebSite + SearchAction                               | A) WebSite only · B) WebSite + SearchAction (Bing/agentic) · C) neither                                                           | **B if** a stable `/search?q=` URL exists, else **A** (fumadocs static search has no GET URL) | med                                         | Google retired the SERP box Nov-2024 but Bing/Copilot/agents use it [Google](https://developers.google.com/search/blog/2024/10/sitelinks-search-box), [geodocs.dev](https://geodocs.dev/technical/website-schema-searchaction-ai-search)              |
| F7    | seo          | BreadcrumbList on docs                               | A) add on every docs page · B) omit                                                                                               | **A**                                                                                         | high                                        | "highest free CTR lift of any safe schema"; feeds AI topology [crawlraven](https://crawlraven.com/blog/google-faq-rich-results-deprecated-may-2026)                                                                                                   |
| F8    | seo          | Docs page schema type                                | A) `TechArticle` · B) `Article` · C) none                                                                                         | **A `TechArticle`** with `datePublished`/`dateModified`; `author`→`#org`                      | med                                         | Article powers Discover; author is the skipped high-impact field [crawlraven](https://crawlraven.com/blog/google-faq-rich-results-deprecated-may-2026)                                                                                                |
| F9    | seo          | FAQPage anywhere                                     | A) skip entirely · B) ship on a real FAQ section for AI-retrieval only                                                            | **A** now; B only if a genuine FAQ ships                                                      | high                                        | Google rich result fully sunset May-7-2026 [Google updates](https://developers.google.com/search/updates)                                                                                                                                             |
| F10   | seo          | Canonical tags                                       | A) add `alternates.canonical` to every page · B) rely on self-referential default                                                 | **A**                                                                                         | high                                        | [zlyqor](https://zlyqor.com/blog/next-js-static-export-seo-guide), [alirehanhaider](https://alirehanhaider.com/blog/fix-missing-canonical-tags-nextjs)                                                                                                |
| F11   | seo          | Trailing-slash canonical form                        | A) no trailing slash (current default) · B) `trailingSlash:true`                                                                  | **A** — keep default; align sitemap+canonical+CF                                              | high                                        | export+trailingSlash bugs [#62900](https://github.com/vercel/next.js/issues/62900), [#68215](https://github.com/vercel/next.js/issues/68215)                                                                                                          |
| F12   | seo          | hreflang / i18n                                      | A) `en` only, no alternates · B) add `x-default` self-ref                                                                         | **A** (English-only product)                                                                  | high                                        | hreflang only needed multi-locale [indxel](https://indxel.com/blog/hreflang-implementation-guide)                                                                                                                                                     |
| F13   | seo+security | JSON-LD injection escaping                           | A) `JSON.stringify` raw (current) · B) `.replace(/</g,'\\u003c')`                                                                 | **B**                                                                                         | high                                        | `</script>` breakout [samcheek](https://samcheek.com/blog/json-ld-schema-nextjs-app-router-2026); repo security floor                                                                                                                                 |
| F14   | seo          | docs `robots` directives                             | A) index all docs · B) `noindex` thin/placeholder docs until written                                                              | **B** for stub pages, A for real ones                                                         | med                                         | avoid thin-content dilution [fokal](https://www.fokal.com/platform-seo/nextjs-seo/)                                                                                                                                                                   |
| F15   | seo          | sitemap `lastModified`                               | A) add from frontmatter/git mtime · B) omit (current)                                                                             | **A**                                                                                         | med                                         | lastmod is the field Google weights [zlyqor](https://zlyqor.com/blog/next-js-static-export-seo-guide)                                                                                                                                                 |
| F16   | visual       | OG image granularity                                 | A) single global (current) · B) per-edition (5 marketing cards) · C) per-edition + per-doc                                        | **B**                                                                                         | high                                        | per-page OG lifts social CTR [rabinarayanpatra](https://www.rabinarayanpatra.com/snippets/nextjs/opengraph-image-route)                                                                                                                               |
| F17   | visual       | Per-doc OG under static export                       | A) one shared docs card · B) `generateImageMetadata` per slug · C) build-time satori script                                       | **A** unless verified on Next 16 build, then B/C                                              | med                                         | dynamic-route OG didn't statically gen under export [#51147](https://github.com/vercel/next.js/issues/51147)                                                                                                                                          |
| F18   | seo+brand    | Twitter card (missing)                               | A) add `summary_large_image` + `twitter:site` handle · B) leave OG-only                                                           | **A**                                                                                         | high                                        | [rabinarayanpatra](https://www.rabinarayanpatra.com/snippets/nextjs/app-router-metadata-generator)                                                                                                                                                    |
| F19 ★ | brand        | OG image wordmark/font                               | A) keep system `monospace` (current) · B) embed Martian Mono woff in satori · C) embed Hubot Sans display                         | **B/C** — carry the locked wordmark face                                                      | med                                         | OG is a brand surface; satori font embed [Vercel](https://vercel.com/kb/guide/using-custom-font); ADR-0042                                                                                                                                            |
| F20 ★ | visual+brand | OG image motif                                       | A) "Fail-closed by construction." + accent bar (current) · B) terminal/RLS-denial transcript card · C) wordmark-only              | **B** — the evidence-over-adjectives motif matches the hero                                   | med                                         | hero copy uses denial transcripts `page.tsx:100`; ADR-0040 voice                                                                                                                                                                                      |
| F21 ★ | brand        | Favicon / icon / theme-color (missing)               | A) add `icon`+`apple-icon`+`manifest`, `theme-color:#0d1216` · B) default favicon                                                 | **A**                                                                                         | high                                        | [Next favicons](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)                                                                                                                                                                   |
| F22   | copy         | OG `alt` per page                                    | A) per-edition alt strings · B) one global alt (current)                                                                          | **A**                                                                                         | med                                         | a11y + relevance [opengraph-image convention](https://nextjs.thisisme1228.com/docs/content/app/api-reference/file-conventions/metadata/opengraph-image)                                                                                               |
| F23   | visual+seo   | Font hosting                                         | A) Google CDN `<link>` (current) · B) `next/font/local` self-host WOFF2 · C) `next/font/google` (build-time self-host)            | **B** (or C)                                                                                  | high                                        | self-host removes render-block, ~180ms LCP win [corewebvitals](https://www.corewebvitals.io/pagespeed/self-host-google-fonts), [Vercel skill](https://github.com/vercel/nextjs-skills/blob/HEAD/skills/next-best-practices/font.md)                   |
| F24   | visual+seo   | `font-display` for the display/H1 face               | A) `swap` · B) `optional` · C) `fallback`                                                                                         | **optional** for display H1 (zero CLS), `swap` for body                                       | med                                         | optional = most CWV-safe [web.dev](https://web.dev/articles/font-best-practices), [Chrome](https://developer.chrome.com/blog/font-display)                                                                                                            |
| F25   | visual+seo   | Fallback metric overrides                            | A) add `size-adjust`/ascent/descent (or `next/font` auto) · B) none (current)                                                     | **A**                                                                                         | high                                        | cuts swap-CLS 80-90% [webvitals.tools](https://webvitals.tools/guides/font-loading/), [vitalsfixer](https://vitalsfixer.com/blog/font-loading-optimization)                                                                                           |
| F26   | seo          | Preload critical font weight                         | A) preload 1 display weight WOFF2 · B) none (current)                                                                             | **A**                                                                                         | high                                        | only 12% of sites preload; clear LCP lever [corewebvitals responsive](https://www.corewebvitals.io/pagespeed/responsive-font-loading-strategy)                                                                                                        |
| F27   | visual+seo   | Font weight/subset trim                              | A) ship only weights used above-the-fold, Latin subset, WOFF2-only · B) keep 5+4 weights (current)                                | **A**                                                                                         | med                                         | each weight ~15-50KB pre-LCP [vitalsfixer](https://vitalsfixer.com/blog/font-loading-optimization), [madegood](https://madegooddesigns.com/google-fonts-vs-self-hosted/)                                                                              |
| F28   | visual+seo   | LCP-hero font risk                                   | A) preload the Martian Mono weight used in the code-hero · B) accept late swap                                                    | **A** + consider `optional` on the H1                                                         | med                                         | hero is monospace `<pre>` `page.tsx:100`; late swap delays LCP [vitalsfixer](https://vitalsfixer.com/blog/font-loading-optimization)                                                                                                                  |
| F29 ★ | seo+brand    | AI-crawler policy                                    | A) Allow-all + strong llms.txt · B) block training (GPTBot/ClaudeBot/CCBot/Google-Extended), allow search/citation · C) block all | **A** (discovery-driven dev tool)                                                             | high                                        | "80% of brands: allow-all"; blocking GPTBot → -73% ChatGPT citations [nicodigital](https://www.nicodigital.com/technical-seo/should-you-block-gptbot-claudebot-perplexitybot/), [scoregeo](https://scoregeo.ai/blog/ai-bots-robots-txt-truth)         |
| F30   | seo          | Cloudflare Content-Signals in robots.txt             | A) add `search=yes, ai-input=yes, ai-train=yes` · B) omit                                                                         | **A** (cheap, on CF already)                                                                  | med                                         | [rankry](https://rankry.ai/blog/should-you-allow-or-blocking-ai-crawlers/), [digitalapplied](https://www.digitalapplied.com/blog/ai-crawler-access-control-2026-robots-llms-txt-decision-matrix)                                                      |
| F31   | seo          | llms.txt linking                                     | A) link `/llms.txt` from HTML `<head>`/footer + docs · B) leave unlinked (current)                                                | **A** — route agents to it                                                                    | med                                         | unlinked files rarely fetched [ahrefs](https://ahrefs.com/blog/llmstxt-study/)                                                                                                                                                                        |
| F32   | seo+copy     | llms-full.txt scope                                  | A) docs only (current) · B) docs + marketing one-pager                                                                            | **A** keep; agents want docs not pitch                                                        | low                                         | IDE agents pull docs [limy.ai](https://limy.ai/blog/llms.txt-in-2026-the-full-guide)                                                                                                                                                                  |
| F33   | copy         | Title template separator                             | A) `%s · Caisson` (current middot) · B) `%s                                                                                       | Caisson`· C)`%s — Caisson`                                                                    | **A** keep (middot suits the mono/wordmark) | low                                                                                                                                                                                                                                                   | brand-consistency heuristic; `layout.tsx:15` |
| F34   | copy         | OG/social description                                | A) short "Fail-closed by construction." (current OG) · B) full guarantee line · C) per-edition                                    | **C** per-edition, short + benefit                                                            | med                                         | per-page desc improves CTR [toolsdock](https://toolsdock.io/blog/nextjs-metadata-guide)                                                                                                                                                               |
| F35   | copy         | Meta description length discipline                   | A) 150-160 char per page · B) reuse one global                                                                                    | **A**                                                                                         | med                                         | [nazarboyko](https://www.nazarboyko.com/articles/nextjs-seo-metadata-sitemaps-open-graph-structured-data)                                                                                                                                             |
| F36   | seo          | Plausible custom events for AI/source attribution    | A) tag waitlist conversions + outbound `/llms.txt` hits · B) pageviews only (current)                                             | **A** (AI sessions can't be seen otherwise)                                                   | low                                         | can't measure llms.txt impact w/o it [searchless.ai](https://searchless.ai/articles/2026-05-08-llms-txt-adoption-2026-data-real-adoption-rates/)                                                                                                      |

---

## 8. References (primary)

- Next.js — Metadata & OG images (official): https://nextjs.org/docs/app/getting-started/metadata-and-og-images
- Next.js — opengraph-image / twitter-image convention: https://nextjs.thisisme1228.com/docs/content/app/api-reference/file-conventions/metadata/opengraph-image
- Next static-export OG gotcha (#51147): https://github.com/vercel/next.js/issues/51147 · trailingSlash (#62900): https://github.com/vercel/next.js/issues/62900
- Static-export SEO patterns: https://zlyqor.com/blog/next-js-static-export-seo-guide
- JSON-LD entity-graph in App Router (2026): https://samcheek.com/blog/json-ld-schema-nextjs-app-router-2026
- JSON-LD injection-safe in Next: https://schemapreview.com/guides/json-ld-nextjs-app-router/
- Schema set still rewarded 2026: https://spaceandstory.co/blog/structured-data-types-google-2026 · https://seojuice.com/blog/schema-org-2026-what-google-reads/
- FAQ deprecation (May 7 2026): https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/ · https://developers.google.com/search/updates
- SoftwareApplication for SaaS: https://wildandfreetools.com/blog/schema-markup-for-saas-pricing-pages/ · https://seo.yatna.ai/seo-academy/softwareapplication-schema-rich-results/ · https://developers.google.com/search/docs/appearance/structured-data/software-app
- Organization: https://developers.google.com/search/docs/appearance/structured-data/organization · https://squin.org/structured-data/organization-schema/
- WebSite/SearchAction post-deprecation: https://developers.google.com/search/blog/2024/10/sitelinks-search-box · https://geodocs.dev/technical/website-schema-searchaction-ai-search
- BreadcrumbList: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- Self-host fonts / CWV: https://www.corewebvitals.io/pagespeed/self-host-google-fonts · https://webvitals.tools/guides/font-loading/ · https://madegooddesigns.com/google-fonts-vs-self-hosted/
- font-display: https://web.dev/articles/font-best-practices · https://developer.chrome.com/blog/font-display
- next/font (Vercel skill): https://github.com/vercel/nextjs-skills/blob/HEAD/skills/next-best-practices/font.md
- Custom OG fonts (satori): https://vercel.com/kb/guide/using-custom-font · https://zenn.dev/ryota_09/articles/cdef1901df899b?locale=en
- llms.txt evidence: https://ahrefs.com/blog/llmstxt-study/ · https://otterly.ai/blog/the-llms-txt-experiment/ · https://limy.ai/blog/llms.txt-in-2026-the-full-guide · https://seoprocheck.com/research/ai-search/llms-txt-explained/ · https://www.longato.ch/llmstxt-2026-june/
- AI-crawler policy: https://www.nicodigital.com/technical-seo/should-you-block-gptbot-claudebot-perplexitybot/ · https://www.digitalapplied.com/blog/ai-crawler-access-control-2026-robots-llms-txt-decision-matrix · https://okara.ai/blog/robots-txt-for-ai-crawlers · https://scoregeo.ai/blog/ai-bots-robots-txt-truth

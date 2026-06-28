# Current-state SEO inventory + gap analysis — `apps/site`

**Surface:** SEO (with brand / visual / copy spillover)
**Scope:** `apps/site` — the Caisson marketing (6 pages) + Fumadocs docs surface, static-export Next 16 → Cloudflare Pages (ADR-0045).
**Date:** 2026-06-27 · branch `design/brand-site-seo`
**Method:** full read of every SEO-bearing file (routes, metadata exports, JSON-LD, nav/footer, headers); behavior grounded against Next.js metadata internals (exa-code) + a 2025/2026 technical-SEO-for-SaaS checklist corpus (exa web).

> One-line verdict: the **mechanical floor is laid** (metadataBase, sitemap-with-docs, robots, a single OG image, one SoftwareApplication block, llms.txt/llms-full.txt, clean security headers) but the **per-page SEO layer is thin**: no canonical anywhere, no Twitter card, OpenGraph title/description silently identical on all 13+ pages (Next merge semantics), no favicon/icon/manifest at all, and only one of the six standard SaaS schema types is present. Roughly **a dozen high-value, low-effort wins** before launch.

---

## 1. Inventory — what SEO is present today

### 1.1 Global metadata (`app/layout.tsx:11-28`)

| Field                                            | Value                                                                                                         | Note                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `metadataBase`                                   | `https://caisson.sh`                                                                                          | ✅ present — relative OG URLs resolve correctly   |
| `title.default`                                  | "Caisson — Compliance-grade infrastructure for regulated SaaS"                                                | ✅                                                |
| `title.template`                                 | `%s · Caisson`                                                                                                | ✅ good — every child title gets the brand suffix |
| `description`                                    | "Fail-closed Postgres RLS, S3 Object-Lock WORM… not backfilled after your first audit." (173 chars)           | ✅ present, slightly over the ~155-char SERP cut  |
| `applicationName`                                | "Caisson"                                                                                                     | ✅                                                |
| `openGraph`                                      | `type: website`, `siteName`, `url`, `title` (full brand title), `description: "Fail-closed by construction."` | ⚠️ **static** — see §2.1                          |
| `robots`                                         | `{ index: true, follow: true }`                                                                               | ✅                                                |
| `alternates` / `canonical`                       | **absent**                                                                                                    | ❌ see §2.2                                       |
| `twitter`                                        | **absent**                                                                                                    | ❌ see §2.3                                       |
| `icons` / favicon / manifest / `themeColor`      | **absent**                                                                                                    | ❌ see §2.6, §2.11                                |
| `keywords` / `authors` / `creator` / `publisher` | **absent**                                                                                                    | minor — §2.13                                     |

### 1.2 Per-page marketing metadata (the 6 `(marketing)/**` pages)

Each page exports a `metadata` object with **only `title` + `description`** — no per-page `openGraph`, `twitter`, or `alternates`.

| Route          | `title` (pre-template)                                             | desc length | file:line                               |
| -------------- | ------------------------------------------------------------------ | ----------- | --------------------------------------- |
| `/`            | "Compliance-grade infrastructure for regulated SaaS"               | 173         | `(marketing)/page.tsx:6-10`             |
| `/compliance`  | "Compliance — fail-closed infrastructure for regulated SaaS"       | ~270        | `(marketing)/compliance/page.tsx:6-10`  |
| `/ai-kit`      | "AI Production Kit — metering, spend caps, and an eval gate in CI" | ~210        | `(marketing)/ai-kit/page.tsx:6-10`      |
| `/local-first` | "Local-first AI — your data never leaves the device"               | ~190        | `(marketing)/local-first/page.tsx:6-10` |
| `/agentic-dev` | "Agentic-Dev — a governed-agent kernel (Roadmap)"                  | ~180        | `(marketing)/agentic-dev/page.tsx:6-9`  |
| `/pricing`     | "Pricing — own the code, or subscribe"                             | ~180        | `(marketing)/pricing/page.tsx:5-9`      |

Title length check: `/ai-kit` + template = "AI Production Kit — metering, spend caps, and an eval gate in CI · Caisson" ≈ 72 chars → **truncates in SERP** (~60 char budget). `/compliance` description ≈ 270 chars → truncated. See §2.14.

### 1.3 JSON-LD structured data

- **SoftwareApplication** — present, injected in `(marketing)/layout.tsx:7-26` via `dangerouslySetInnerHTML`. Renders on **all 6 marketing pages, identically**. Fields: `name`, `applicationCategory: DeveloperApplication`, `operatingSystem: Any`, `description`, `url`, `offers: {Offer, availability: PreOrder}` (correctly **no price** — ADR-0048 fork open), `publisher: {Organization, name: "GridWork Digital LLC"}`.
  - This **is** the "SoftwareApplication JSON-LD" the kickoff references — it exists. ✅
- **Organization** (standalone, homepage) — ❌ absent (only nested inside `publisher`).
- **WebSite** (+ `SearchAction`) — ❌ absent (the site _has_ a search dialog, `components/search.tsx`).
- **BreadcrumbList** — ❌ absent on every interior + docs page.
- **FAQPage** — ❌ absent (no visible FAQ content exists to mark up).
- **Article / TechArticle** (docs) — ❌ absent; docs pages emit no JSON-LD at all (the SoftwareApplication lives only in the marketing route group, not in `app/docs/**`).

### 1.4 Sitemap (`app/sitemap.ts`)

- ✅ `force-static`, base `https://caisson.sh`.
- ✅ 6 marketing routes hard-listed (`""`,`/compliance`,`/ai-kit`,`/local-first`,`/agentic-dev`,`/pricing`).
- ✅ **Docs ARE included** — `source.getPages()` enumerates every `content/docs/**` page (index, getting-started, base/_, compliance/_, ai-kit, local-first, agentic-dev, cli) → ~22 doc URLs. Good coverage.
- `changeFrequency: weekly` (marketing/docs), `priority` 1.0 home / 0.8 marketing / 0.6 docs.
- ❌ **No `lastModified`** on any entry — the SaaS checklist explicitly wants `lastmod`.
- `llms.txt`, `llms-full.txt`, per-page `content.md` correctly **excluded** (agent endpoints). ✅

### 1.5 robots (`app/robots.ts`)

- `userAgent: "*", allow: "/"` (allow-all), `sitemap: …/sitemap.xml`, `host: https://caisson.sh`.
- ✅ sitemap reference present. ⚠️ `host` is a non-standard directive Google ignores (Yandex-only) — harmless.
- ❌ No explicit AI-crawler allow rules (GPTBot / ClaudeBot / PerplexityBot / Google-Extended). No disallow for the duplicate-markdown surface (`/llms.mdx/*`).

### 1.6 OG image (`app/opengraph-image.tsx`)

- ✅ Single build-time satori raster, 1200×630, `force-static`, has descriptive `alt` ("Caisson — Compliance-grade infrastructure for regulated SaaS").
- Cold-steel palette mirrored as hex (sanctioned ADR-0042 exception). Wordmark "caisson" + "Fail-closed by construction." + control list.
- ❌ **One image for the entire site** — every marketing AND docs page shares it (root-level convention cascades). No per-edition / per-page OG image.

### 1.7 llms.txt surface (the agent-readable layer — a genuine differentiator)

- `app/llms.txt/route.ts` → `llms(source).index()` (fumadocs) — emits an index of **docs pages only**. ❌ The 6 marketing pages are **not** listed.
- `app/llms-full.txt/route.ts` → concatenates `getLLMText(page)` over `source.getPages()` — **docs corpus only**, marketing copy excluded.
- `app/llms.mdx/docs/[[...slug]]/route.ts` → per-page raw markdown (`content.md`), `Content-Type: text/markdown`. This **mirrors every docs HTML page** as plain markdown → a duplicate-content surface (see §2.12).
- Docs index links to both `/llms.txt` and `/llms-full.txt` (`content/docs/index.mdx`), and the footer links `/llms.txt`. ✅ discoverable.

### 1.8 Heading structure

- Every marketing page has **exactly one `<h1>`** (the value-prop line, e.g. "Fail-closed by construction.", "Audit-ready from the first commit."), preceded by a `cs-eyebrow` span (not a heading) — clean. ✅
- `<h2>` section titles throughout; `/compliance` correctly uses `<h3>` for card titles under an `<h2>`. ✅ Logical hierarchy, no skips.
- Brand token "caisson" appears in the nav wordmark + title tags, not in any h1 (evidence-led voice, ADR-0040). See §2.15.

### 1.9 Internal linking (`components/site-nav.tsx`, `components/site-footer.tsx`)

- **Nav** (5 links): `/compliance`, `/ai-kit`, `/local-first`, `/pricing`, `/docs`. ❌ `/agentic-dev` is **not** in the primary nav.
- **Footer** (3 columns): Editions (all 4 incl. agentic-dev), Product (pricing, docs, getting-started), Resources (llms.txt, GitHub). ✅ broad.
- Home page cross-links all 4 edition pages via cards (`page.tsx:175-203`) + `/pricing` + `/docs`. ✅
- Docs index hand-links getting-started + sections. Fumadocs auto-builds the docs sidebar tree from `meta.json`. ✅
- `aria-current="page"` on active nav link, `aria-label` on nav regions. ✅ accessible.

### 1.10 Accessibility / crawlable-content positives

- All code blocks carry `aria-label` describing the transcript; decorative glyphs are `aria-hidden`. ✅
- Waitlist email input has a visually-hidden `<label>` + `autoComplete`. ✅
- **No content `<img>` tags** anywhere (all visuals are CSS / `<pre>` / glyphs) → no missing-alt-text debt on-page; the only image is the OG raster (has alt). ✅
- `lang="en"` on `<html>`. ✅

### 1.11 Rendering / indexability foundation

- `output: "export"` static HTML (`next.config.ts`) → fully pre-rendered, Googlebot-friendly (the checklist's #1 ask: "ship HTML, not promises"). ✅
- `images: { unoptimized: true }`. Security headers strong (`public/_headers`: nosniff, DENY, HSTS-preload, CSP, Referrer-Policy). ✅
- `normalize-export.mjs` strips RSC `.txt` prefetch siblings (the "index.txt trap") — prevents intermittent blank pages that would wreck crawl quality. ✅
- ❌ No custom 404 (`not-found.tsx` absent — default Next 404.html). ❌ No `public/_redirects` (www→apex / canonicalization).

---

## 2. Gap analysis vs modern technical-SEO checklist

Grounded against: Burncode "SEO for SaaS technical checklist" (2026-04), OmniRank "100-point SaaS SEO" (2026-04), Exalt "Technical SEO for SaaS 2025", Ghostly "JSON-LD guide" (2026-03), Next.js metadata-merge issues #57633 / #46899 / discussion #84588.

### 2.1 OpenGraph title/description are identical on every page (silent) — **HIGH**

The root layout sets a full static `openGraph` object. Each child page sets `metadata` with **only top-level `title`/`description`** and **no `openGraph` key**. Per Next.js merge semantics (confirmed: vercel/next.js #57633 "Open graph properties are not inherited in children routes", #46899, discussion #84588 "Deep merge support…"): when a child omits `openGraph`, it **inherits the parent's wholesale**, and Next **does not** auto-derive `og:title` from the page `title`. Result: **every page — all 6 marketing + all ~22 docs — shares `og:title` = "Caisson — Compliance-grade…" and `og:description` = "Fail-closed by construction."** Social/Slack/iMessage/LinkedIn previews are page-blind. _Evidence:_ `app/layout.tsx:20-26` (static OG) vs `(marketing)/*/page.tsx:6-10` (title/desc only). File:line + Next issue corpus.

### 2.2 No canonical URL anywhere — **HIGH**

`grep canonical|alternates` → 0 hits across `app/` + `components/`. The checklist's hardest line: "every page should have a self-referencing canonical" (John Mueller). Without it, `caisson.sh/x`, `www.caisson.sh/x`, trailing-slash variants, and the markdown mirror compete. _Evidence:_ whole-tree grep (no hits); Strapi/Exalt/Growigami checklists all flag self-referencing canonical as baseline.

### 2.3 No Twitter card metadata — **HIGH (easy)**

No `twitter.*`. X/Twitter falls back to OG (so it half-works) but there is no `twitter:card = summary_large_image`, no `twitter:site`/`creator`. _Evidence:_ `grep twitter` → 0 hits; checklist "Open Graph tags + Twitter cards for social optimization".

### 2.4 Only 1 of 6 standard SaaS schema types present — **HIGH/MEDIUM**

Present: SoftwareApplication. Missing the rest of the canonical SaaS set every checklist names: **Organization** (homepage, with `logo` + `sameAs` to GitHub/X), **WebSite** (+ optional SearchAction), **BreadcrumbList** (interior + docs), **FAQPage** (needs visible Q&A — see §2.5), **Article/TechArticle** (docs). Docs pages emit **zero** JSON-LD. _Evidence:_ `(marketing)/layout.tsx:7-26` (only block in repo); OmniRank/Exalt/Growigami all list the 6-type set; `app/docs/**` has no `ld+json`.

### 2.5 No FAQ content → no FAQPage eligibility — **MEDIUM (copy)**

No page has a visible FAQ section, so FAQPage schema can't be added honestly (Ghostly: "only for useful visible Q&A"; note Google has _reduced_ FAQ rich results for non-gov/health sites — value is now mostly AI-Overview eligibility, OmniRank). A compliance buyer has predictable objections ("does WORM lock me out?", "what frameworks?", "AGPL obligations?") that an FAQ would answer **and** feed AI answer engines. _Evidence:_ no `<dl>`/FAQ markup in any page; OmniRank "FAQPage critical for AI Overview eligibility".

### 2.6 No favicon / icon / apple-touch-icon / manifest — **HIGH (brand + seo)**

`find … -iname '*icon*' -o '*favicon*' -o '*manifest*'` → **0 files** in `app/` or `public/`. Browser tabs, bookmarks, search-result favicons, and PWA/Android install all fall back to defaults. Google shows a favicon beside every mobile SERP result — its absence is a visible credibility gap. Also brand-adjacent: the favicon is the smallest expression of the logomark this brand-expansion session is chartered to define. _Evidence:_ icon-search empty; this is both an SEO SERP-favicon item and a brand-book deliverable.

### 2.7 Single site-wide OG image — **MEDIUM (visual/seo)**

`app/opengraph-image.tsx` is one image for 28+ pages. A shared compliance message under the AI-Kit or Pricing URL is a mismatch when shared. Per-route `opengraph-image.tsx` (or `generateImageMetadata`) lets each edition carry its own headline. _Evidence:_ `opengraph-image.tsx:21-77` (single component, root-level).

### 2.8 Sitemap missing `lastModified` — **MEDIUM**

No `lastmod` on any entry. Burncode: "Sitemap.xml… includes lastmod, references all canonical URLs." Helps recrawl prioritization. _Evidence:_ `app/sitemap.ts:18-27` (no `lastModified` key).

### 2.9 llms.txt omits the marketing pages — **MEDIUM**

`llms(source).index()` indexes docs only; the 6 marketing pages (the actual sales surface AI assistants would cite) aren't listed. OmniRank: "`/llms.txt` present and lists 10+ key pages with descriptions." _Evidence:_ `app/llms.txt/route.ts:8-10` + `lib/source.ts` (`source` = docs collection only).

### 2.10 SoftwareApplication is generic, not per-edition — **MEDIUM**

The same block on `/compliance`, `/ai-kit`, etc. A per-edition SoftwareApplication (`name: "Caisson Compliance"`, edition-specific `description`, `featureList`) on each edition page would map structured data to the page a searcher landed on. _Evidence:_ `(marketing)/layout.tsx` (one constant, route-group-wide).

### 2.11 No `themeColor` / `color-scheme` viewport meta — **LOW (brand/visual)**

Dark-first brand but no `themeColor` (mobile browser chrome stays default white) and no `color-scheme` hint. A `viewport`/`themeColor` export = `#0d1216` matches the locked surface. _Evidence:_ no `viewport`/`themeColor` export in `layout.tsx`.

### 2.12 Markdown mirror = duplicate-content surface — **MEDIUM**

`/llms.mdx/docs/**/content.md` reproduces every docs page as plaintext (`route.ts` + `generateStaticParams`). It's `text/markdown` (unlikely to rank as HTML) but is uncanonicalized and crawlable. Cleanest fix: an `X-Robots-Tag: noindex` for `/llms.mdx/*` in `public/_headers`, or a robots disallow. _Evidence:_ `app/llms.mdx/docs/[[...slug]]/route.ts:10-25`.

### 2.13 No `authors` / `publisher` / `creator` metadata — **LOW**

Skip `keywords` (Google ignores). But `authors`/`publisher` feed E-E-A-T + AI attribution; OmniRank: "Organization schema includes comprehensive company description… named authors." _Evidence:_ `layout.tsx:11-28` (absent).

### 2.14 Title/description length overflow — **LOW (copy/seo)**

`/ai-kit` title+template ≈ 72 chars (SERP truncates ~60); `/compliance` description ≈ 270 (truncates ~155-160). Front-load the keyword, trim the tail. _Evidence:_ `(marketing)/ai-kit/page.tsx:7`, `compliance/page.tsx:8-9`.

### 2.15 h1 has no brand/primary keyword — **LOW (copy/brand)**

H1s are pure value-prop ("Fail-closed by construction."). Intentional (ADR-0040 evidence-led voice) and brand recall comes from wordmark + title. Worth a conscious lock rather than drift. _Evidence:_ `(marketing)/page.tsx:66-77`; ADR-0040.

### 2.16 No custom 404 / no `_redirects` — **MEDIUM (visual + seo)**

Default Next 404.html (unbranded, dead-ends crawlers/users). No `public/_redirects` → www↔apex and trailing-slash canonicalization lean entirely on CF defaults. _Evidence:_ no `app/not-found.tsx`; no `public/_redirects` (only `_headers`).

### 2.17 `/agentic-dev` not in primary nav — **LOW (IA/seo)**

Reachable only via home cards + footer → shallower internal-link equity than its siblings. Defensible (it's "Roadmap"), but a "Roadmap"-tagged nav slot would flatten the graph. _Evidence:_ `site-nav.tsx:8-14` (5 links, agentic-dev absent).

### 2.18 hreflang — **N/A (correctly)**

Single-locale `en`; no hreflang needed. A self-referencing canonical (§2.2) + `og:locale` covers it. Note only.

### 2.19 No Lighthouse/CWV baseline or CI budget — **MEDIUM (process)**

CWV is a confirmed ranking signal; no audit has been run and no perf budget gates CI. Static export + self-hosted fonts start strong, but the Google-Fonts `<link>` (`layout.tsx:43-49`) is a render-blocking third-party request worth measuring. _Evidence:_ no Lighthouse config / CI job; `layout.tsx` external font stylesheet.

---

## 3. SEO fork table (prioritized)

| #   | Fork                                                     | Surface | Priority | Conf   |
| --- | -------------------------------------------------------- | ------- | -------- | ------ |
| F1  | Fix per-page OpenGraph (title/desc identical everywhere) | seo     | HIGH     | high   |
| F2  | Self-referencing canonical per page                      | seo     | HIGH     | high   |
| F3  | Twitter card metadata                                    | seo     | HIGH     | high   |
| F4  | Favicon / icon / apple-touch / manifest set              | brand   | HIGH     | high   |
| F5  | Organization JSON-LD (homepage, logo + sameAs)           | seo     | HIGH     | high   |
| F6  | WebSite JSON-LD (+ optional SearchAction)                | seo     | MED      | medium |
| F7  | BreadcrumbList JSON-LD (docs + interior)                 | seo     | MED      | medium |
| F8  | Article/TechArticle JSON-LD on docs                      | seo     | MED      | medium |
| F9  | Per-edition SoftwareApplication                          | seo     | MED      | medium |
| F10 | FAQ section + FAQPage schema (compliance/pricing)        | copy    | MED      | medium |
| F11 | Sitemap `lastModified`                                   | seo     | MED      | high   |
| F12 | llms.txt marketing-page coverage                         | seo     | MED      | medium |
| F13 | noindex the `/llms.mdx/*` markdown mirror                | seo     | MED      | medium |
| F14 | Per-page / per-edition OG image                          | visual  | MED      | medium |
| F15 | Custom branded `not-found.tsx` (404)                     | visual  | MED      | medium |
| F16 | `public/_redirects` www→apex + trailing-slash            | seo     | MED      | medium |
| F17 | AI-crawler allow rules + `host` cleanup in robots        | seo     | LOW      | medium |
| F18 | `themeColor` / `color-scheme` viewport meta              | brand   | LOW      | high   |
| F19 | `authors`/`publisher` metadata (skip keywords)           | seo     | LOW      | medium |
| F20 | Title/description length trim                            | copy    | LOW      | medium |
| F21 | Lock h1 evidence-led (no brand keyword) vs add brand     | copy    | LOW      | medium |
| F22 | `/agentic-dev` nav slot                                  | seo     | LOW      | low    |
| F23 | Lighthouse/CWV baseline + CI budget                      | seo     | MED      | medium |
| F24 | Centralize metadata in a `buildMetadata()` helper        | seo     | HIGH     | high   |

(F1+F2+F3+F19+F24 collapse into one mechanical change — a shared metadata helper — so the HIGH tier is ~4 commits, not 24.)

---

## 4. Recommended sequencing (pre-launch)

1. **One `buildMetadata({title, description, path, ogImage?})` helper** in `lib/` that emits `title`, `description`, `alternates.canonical`, `openGraph` (page title/desc/url/image), `twitter` (summary_large_image). Replace the 6 marketing `metadata` literals + the docs `generateMetadata`. Closes F1, F2, F3, F19, F24 in one stroke.
2. **Icon set** — `app/icon.svg` + `app/apple-icon.png` + `app/manifest.ts` (or `site.webmanifest`), derived from the logomark this session locks. Closes F4 (+ feeds the brand book).
3. **JSON-LD module** — `lib/structured-data.ts` emitting an `@graph` (Organization + WebSite + per-page WebPage/SoftwareApplication/BreadcrumbList with stable `@id`s). Closes F5–F9.
4. **Sitemap `lastModified`** (build date for marketing, frontmatter date for docs) — F11.
5. **`public/_redirects`, `not-found.tsx`, `themeColor`, robots AI rules, `/llms.mdx/*` noindex** — F13, F15, F16, F17, F18.
6. **Lighthouse baseline** before launch (F23); then the copy/IA forks (F10, F12, F20, F21, F22).

---

## 5. Competitor / reference evidence

- **Burncode — "SEO for SaaS: A Technical Checklist Engineers Should Own"** (2026-04-29) — https://burncode.org/blog/seo-for-saas-technical-checklist — "Every feature ships with: a canonical URL, a meta title, a meta description, structured data where applicable, an entry in the sitemap" + "Sitemap… includes lastmod".
- **OmniRank — "Technical SEO Checklist for SaaS: 100+ Points (2026)"** — https://omnirank.net/blog/technical-seo-checklist-saas-100-point-guide — the 6-type schema set (Organization, WebSite+SearchAction, SoftwareApplication, FAQPage, BreadcrumbList, Article); "`/llms.txt`… lists 10+ key pages"; "FAQPage critical for AI Overview eligibility".
- **Exalt — "Technical SEO for SaaS 2025"** — https://www.exaltgrowth.com/saas-seo/technical-seo-for-saas — SoftwareApplication on product pages; BreadcrumbList site-wide; self-referencing canonical.
- **Ghostly — "JSON-LD Schema Markup Guide"** (2026-03) — https://ghostlyinc.com/en-us/json-ld-schema-markup-seo-guide/ — stable `@id`/`@graph` linking; "FAQ rich result heavily reduced — use only for genuinely useful visible Q&A".
- **Next.js metadata merge behavior** — vercel/next.js #57633 (https://github.com/vercel/next.js/issues/57633) "Open graph properties are not inherited in children routes metadata"; #46899; discussion #84588 — confirms §2.1: child `metadata` without an `openGraph` key inherits the parent's verbatim; `og:title` is **not** auto-derived from `title`.

---

## 6. Files inventoried (evidence index)

```
app/layout.tsx                              root metadata, OG, fonts, Plausible
app/(marketing)/layout.tsx:7-26             SoftwareApplication JSON-LD (only block in repo)
app/(marketing)/page.tsx:6-10               home metadata
app/(marketing)/compliance/page.tsx:6-10    + 3 guarantees, field-crypto, evidence-pack
app/(marketing)/ai-kit/page.tsx:6-10        + 6 modules
app/(marketing)/local-first/page.tsx:6-10   + AGPL flank
app/(marketing)/agentic-dev/page.tsx:6-9    + roadmap
app/(marketing)/pricing/page.tsx:5-9        + SKU structure (no prices, ADR-0048)
app/docs/[[...slug]]/page.tsx:41-49         docs generateMetadata (title+desc only, no JSON-LD)
app/docs/layout.tsx                         fumadocs DocsLayout
app/sitemap.ts                              marketing + docs URLs, no lastmod
app/robots.ts                               allow-all, sitemap, host
app/opengraph-image.tsx                     single static OG raster (has alt)
app/llms.txt/route.ts                       docs index (marketing absent)
app/llms-full.txt/route.ts                  docs corpus concat
app/llms.mdx/docs/[[...slug]]/route.ts      per-page markdown mirror (duplicate surface)
components/site-nav.tsx:8-14                 5 nav links (agentic-dev absent)
components/site-footer.tsx                   3-column footer, GitHub + llms.txt
public/_headers                             security headers (no X-Robots for /llms.mdx)
next.config.ts                              output: export, images unoptimized
— absent —                                  favicon/icon/manifest, not-found.tsx, _redirects, canonical, twitter
```

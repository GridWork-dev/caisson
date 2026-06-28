# ADR-0079 — SEO strategy: own the dev-kit long-tail + a programmatic content engine + a technical floor

**Status:** accepted · 2026-06-27 (Design·Brand·SEO·Copy session — operator picked "full programmatic
engine" + "lock all technical as recommended"). **Relates:** ADR-0040 (positioning — picks-and-shovels
gap), ADR-0084 (static Next 16 + Fumadocs MDX on Cloudflare Pages), ADR-0086 (Plausible CSP), ADR-0087→0081
(pricing display), specs/04 (voice). Evidence: `FORK-BOARD.md` (SEO forks S1–S26 + critic), research
`exa-seo-keywords-content.md` · `exa-seo-technical.md` · `current-state-seo.md`.

ADR-0040 found a picks-and-shovels gap: compliance CPC is **10–50× every other cluster at low KD**, but the
head-term SERP is owned by **finished platforms** (Vanta/Drata), not dev-kits. This ADR commits the SEO
posture that exploits that gap.

## 1. Keyword strategy — own the long-tail, cede the head

**Deliberately cede** the `[framework] compliance` head terms (high KD, platform-owned, unwinnable for a
zero-DA domain) and **own the dev-kit long-tail**: "SOC 2 starter kit", "HIPAA boilerplate Next.js",
"self-hosted audit log", "multi-tenant RLS template", "compliance for developers", "LLM cost control",
"token metering", "on-device vector search", "governed agents typescript". Target-and-qualify the
"boilerplate/starter-kit" terms on framework/free pages only — never discount the paid hero (ADR-0040
firewall: the term is fair game, the hero is not). (S1, S7)

## 2. Programmatic content engine

**Top-level hub/spoke taxonomy** (clean crawl paths, breadcrumb-friendly): `/frameworks/{soc2,hipaa,…}`,
`/use-cases/{vertical}`, `/guides/{stack-pattern}`, `/glossary/{term}`. The engine is a **per-framework AND
per-control matrix** — each control (SOC 2 CC6.1, HIPAA §164.312) maps to the **Caisson code that satisfies
it**, so the unique-content floor is met _by construction_ and the page is near-zero-competition technical
content. **Pilot SOC 2 + HIPAA, measure indexation at 90 days before scaling.** Gated on the pilot: 4
use-case verticals (fintech/healthtech/legal/hr-tech), 8–12 stack guides, 6–10 answer-first glossary pages.
**Ship the "EU AI Act-ready" framework page now** — the Aug-2026 enforcement wave means rising search at low
competition, and ADR-0040 already authorizes the named empty slot. (S2, S3, S4, S5, S9, S22)

## 3. Docs as the SEO engine

For a dev-kit the **docs ARE the SEO surface**: structure them as rankable guides (per-framework starter
guides, per-control how-tos) and run a title/intro pass on the existing `tenancy-rls`, `audit-worm`,
`field-crypto` docs for their head terms (multi-tenant RLS, WORM audit log, field-level encryption). Near
zero cost on Fumadocs MDX (ADR-0084). (S10)

## 4. Technical SEO floor

- **Root `@graph` JSON-LD** with stable `@id`s — `Organization` + `WebSite` (+ SearchAction), then page-scoped
  `SoftwareApplication` / `TechArticle` / `BreadcrumbList` referencing those `@id`s; escape `<` in serialized
  JSON-LD. Replaces the duplicated anonymous `SoftwareApplication` block (marketing/layout.tsx). Drop
  `FAQPage` as a _rich-result_ (Google sunset May 2026) but keep it where a real FAQ exists for AI retrieval.
  (S11, S13)
- **`buildMetadata()` helper** emitting per-page `title` / `description` / **self-referencing canonical** /
  `openGraph` / **twitter (summary_large_image)** / authors from args, across marketing + docs — closes the
  identical-OG bug, missing canonicals, and the absent Twitter card in one mechanical change. (S14, S19)
- **Per-edition OG images** (one satori template, edition headline) rendering the dark hero + the RLS-denial
  artifact + the wordmark; defer per-doc OG (verify the static-export dynamic-route gotcha on Next 16). The
  OG `SoftwareApplication`/`Offer` now carries the **indicative price** per ADR-0081 (was price-omitted).
  (S12, S15, V30)
- **Self-host fonts via `next/font`** (Hubot Sans + Martian Mono + the code mono) — drops the
  render-blocking Google Fonts `<link>` (~180ms LCP win), guarantees the 400 body weight, satisfies the
  brand-floor `next/font` mandate, and respects ADR-0086's plausible-only CSP. (S16)
- **Favicon / app-icon / manifest kit** derived from the ADR-0078 waterline glyph (`app/icon.svg` +
  `apple-icon.png` + manifest + `theme-color:#0d1216` + `color-scheme:dark`) — the tab and mobile SERP
  currently show a bare default. (S23)
- **Fix the home ↔ /compliance cannibalization** (near-identical metadata splits authority): home owns the
  umbrella/brand head, /compliance owns the transactional compliance long-tail. **Template** programmatic
  titles/descriptions per type; hand-write the editions; keep the keyword in the **eyebrow + first lede +
  early H2 + title/JSON-LD**, not the voice-pure ≤7-word H1. (S8, S19, S20)
- **Crawl hygiene:** sitemap `lastmod`; reciprocal pricing↔edition internal links; keep agentic-dev out of
  primary nav (ratified roadmap de-emphasis), present in footer. (S24)

## 5. AI / GEO

Keep `robots` **allow-all** (a discovery-driven dev tool; blocking GPTBot measured −73% ChatGPT citations
with zero Googlebot benefit) and add **Cloudflare Content-Signals** (`search=yes, ai-input=yes,
ai-train=…`); verify the CF WAF is not silently blocking AI bots. Extend **llms.txt** to marketing +
framework pages, **link it from the HTML** so agents discover it, and `noindex` the `/llms.mdx/*` markdown
mirror. Lead sections **answer-first** (40–60-word openings, RAG retrieves openings) with named-expert
quotes (+41% citation). Build **branded-term + GitHub-repo** entity SEO (the bare word "caisson" collides
with civil engineering; own "caisson compliance" / "@caisson" + repo topics + README). (S17, S18, S21, C23)

## 6. Quality gates

Establish a **Lighthouse CWV + a11y CI baseline + budget before launch** — CWV is both a ranking signal and
a compliance-credibility signal, and the baseline catches the render-blocking font link the font-hosting fork
removes. Tag Plausible custom events (per-edition CTA, outbound GitHub/docs, source-attributed conversions)
within ADR-0086's cookieless limits. (S25, C20, S26)

## Rejected

Competing for head terms (platform-owned, unwinnable at zero DA); full "Vanta alternative" / kit-vs-kit
comparison pages (ADR-0040 firewall — build honest **build-vs-buy / earlier-layer** pages with no head-to-head
table instead); blocking training crawlers (kills AI-answer visibility); `price:0` schema (mislabels a paid
product); keyword-stuffed mega-titles; per-page OG deferred to later (per-edition ships now).

## Binding

Own the long-tail + a pilot-gated programmatic engine; every programmatic page carries a real code artifact;
root `@graph` JSON-LD; self-hosted fonts; allow-all AI crawlers + content-signals; CWV/a11y CI gate before
launch. The site stays **static** (ADR-0084) — moving to runtime SSR or a CMS for SEO would need a
superseding ADR. Implementation lands in the **build session** (this is doc-only); priorities in
`outputs/specs/design-brand-site-seo/SPEC.md`.

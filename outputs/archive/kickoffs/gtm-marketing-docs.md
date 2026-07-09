# KICKOFF — Caisson GTM: marketing site + docs site (Wave-2 buckets A + B)

> Run this file as the first message of a fresh **ultracode** Claude Code session in the
> `caisson-gtm` worktree (`/home/gw/lab/caisson-gtm`, branch `gtm/marketing-docs`). It is
> self-contained: read **only** this file plus the repo it names and you have everything needed
> to execute. The operator sets effort and launches manually. Do the forks first, then build.

---

## Mission

Ship Caisson's public face: a single Next.js 15 App Router site that serves **both** the
marketing surface (`/`, compliance-led hero per ADR-0040) **and** the product docs
(`/docs/*`, per-package), deployed to Cloudflare Pages on `caisson.sh`, themed entirely against
the locked `--cs-*` design-token contract (ADR-0042) and written in the locked voice
(`specs/04`). This is Wave 2 of the build sequence — it is decoupled from product code (Waves 0–1
build the packages; this session builds the storefront and the manual), and it is the surface
that converts the compliance wedge into a buyer. It matters because for this buyer — a founding
engineer evaluating production-grade infrastructure — the site _is_ the first proof: it must read
as production-grade, not a marketing template, or the "fail-closed by construction" thesis dies on
the homepage. Success is a green Cloudflare Pages build live on `caisson.sh`, a docs surface a
buyer (or their agent) can navigate, and zero relitigation of any locked decision.

## Locked context

These are decided. **Do not relitigate them.** Read them before you write anything.

- **Name + scope + domain — LOCKED (ADR-0041, `knowledge/decisions/ADR-0041-product-name-caisson.md`):**
  the product is **Caisson**, scope `@caisson/*`, primary domain **`caisson.sh`**. Wordmark
  direction: lowercase `caisson`, monospace-adjacent, dark surface, no icon-mascot. Never explain
  the word; let copy lean on _foundation / load / pressure / holds_.
- **Hero positioning — LOCKED (ADR-0040, `knowledge/decisions/ADR-0040-positioning-hero.md`):**
  two-layer — umbrella = "production-grade codebase library, the load-bearing infrastructure cheap
  boilerplates skip"; **hero wedge = Compliance** (the front door). The named enemy is happy-path
  boilerplate. **Buyer firewall:** the generic base is a one-line footnote, **never** a comparison
  table; the price-shopping "I just want a starter kit" buyer is refused at the paid tier and
  enters only via the free AGPL local-first flank. **Sequenced launch, no 4-way splash:** Wave 1 =
  Compliance paid hero with full marketing depth; AI Production Kit is the named #2 ("same rigor,
  AI infra"); Local-first AI is the free AGPL top-of-funnel flank; Agentic-Dev is post-wedge.
  **Compliance Updates subscription is its own SKU** ($149–299/mo) distinct from the Developer
  subscription ($49–199/mo). **EU AI Act Annex IV** is a _gated paid add-on_ surfaced as an
  "EU AI Act-ready" slot, **sold worldwide — do NOT geo-restrict**.
- **Voice + brand — LOCKED (`specs/04-voice-and-brand.md`):** tagline **"Compliance-grade
  infrastructure for regulated SaaS."**; hero H1 **"Fail-closed by construction."**; hero subhead
  is the locked RLS/WORM/audit-chain sentence in §1. Evidence over adjectives; pro-tool register
  (Linear/Resend/Vercel cadence); the banned-word list in §4 is binding (`seamless`, `effortless`,
  `unlock`, `supercharge`, standalone `AI-powered`, bare `production-ready`, emoji-as-bullets, no
  exclamation marks in a hero). Approved alternate headlines + the retrofit-cost line + the
  generic-base footnote are in §6. Per-edition voice in §9.
- **Design foundation — LOCKED (ADR-0042, `knowledge/decisions/ADR-0042-design-system-foundation.md`
  - `DESIGN.md` + `specs/03-design-framework.md`):** Palette **A** "cold-steel teal"
    (`--cs-accent: oklch(0.74 0.115 205)`, wet-dark-steel neutrals hue ~220) + type **2**
    "Structural" (**Hubot Sans** + **Martian Mono**). The contract is the generated
    `packages/ui/styles/tokens.css` (`--cs-*` vars, `:root`/`[data-theme="light"]`), emitted from
    typed TS objects in `packages/ui/src/tokens/` by `scripts/gen-tokens-css.ts`. **Re-skin = swap
    tokens, never fork components.** Dark default + light mirror, both authored. Depth = tonal
    surface shifts + hairline borders, **never shadows**. Accent ≤10% of surface. WCAG 2.2 **AA**
    floor; status never color-alone (glyph + label); visible focus ring always.
- **App framework — LOCKED (ADR-0044, `knowledge/decisions/ADR-0044-app-framework-nextjs.md`):**
  all first-party web surfaces standardize on **Next.js App Router** (currently 15). The
  marketing+docs site is named explicitly as a board-locked Next surface. The `@caisson/*`
  packages stay framework-free (import-boundary lint, ADR-0022) — a web app may import a framework;
  a package may not.
- **Board rows — LOCKED (`docs/state/decisions-and-forks.md`):** **Site hosting = Cloudflare
  Pages** (`caisson.sh` zone + records via Terraform in `infra/terraform/`; Neon over HTTP for
  data). **Docs tooling = single Next site + MDX** (marketing + docs, **one deploy target / one
  brand** — this is why two-apps is the non-default below). **Build sequencing:** Wave 2 = GTM,
  after the Wave-0/Wave-1 substrate. **GTM buildout (now):** marketing + docs queued as parallel
  buckets; **support-bot + commerce/license are deferred to a later wave** — this session does NOT
  build them.
- **Engineering invariants — LOCKED (ADR-0002, `knowledge/decisions/ADR-0002-engineering-invariants.md`
  - `CLAUDE.md`):** TS strict, Bun runtime/PM (never npm/yarn), Zod `.strict()` at every boundary,
    no `any`, no `console.log` in product code, `crypto.randomUUID()` for IDs, `fetchWithTimeout` on
    every outbound fetch, `crypto.timingSafeEqual` for every secret/token compare. One `tooling/`
    standards gate is the sole eslint/tsconfig/test source.
- **Existing infra (read, then extend) — `infra/terraform/`:** `main.tf` already defines the
  `cloudflare_pages_project.site` (`caisson-site`, production branch `main`), the apex + `www`
  custom domains, and proxied CNAMEs. The README's "Not yet wired" note says the build/deploy
  config lands **with the site app** — this session wires it. The README currently names
  "`@cloudflare/next-on-pages` / OpenNext output dir" — **that mention is stale** (see fork 2);
  reconcile it to the chosen deploy mode.
- **The existing pattern to mirror — `apps/studio` + `packages/ui`:** the studio
  (`apps/studio/src/app/layout.tsx`) shows the exact wiring: `import "@caisson/ui/styles/tokens.css"`
  then app CSS; `data-theme="dark"` on `<html>` with a no-flash inline script reading
  `localStorage('cs-theme')`; `transpilePackages: ["@caisson/ui"]` in `next.config.ts` because
  `@caisson/ui` ships raw TS. `globals.css` consumes `--cs-*` vars only — no hard-coded colors.
  **Reuse this pattern; do not invent a second token wiring.** **One divergence to make
  deliberately:** the studio's `layout.tsx` loads _six_ candidate font families (Geist, Geist Mono,
  Hanken Grotesk, Hubot Sans, JetBrains Mono, Martian Mono) because it is the A/B/C decision surface
  — the production site loads **only the two locked families, Hubot Sans + Martian Mono (ADR-0042)**;
  do not copy the full candidate font list (it ships dead webfont weight).

## Scope

Build a **new app** at **`apps/site/`** (the Cloudflare Pages project is already named
`caisson-site` — match it). One app, both surfaces, per the board lock. Concrete targets:

- **`apps/site/`** — Next.js 15 App Router app. `package.json` (`@caisson/site`, private,
  `type: module`, depends `@caisson/ui workspace:*`, dev-deps `@caisson/{eslint-config,tsconfig,testing}`),
  `next.config.ts` (`transpilePackages: ["@caisson/ui"]` + the chosen deploy/MDX config),
  `tsconfig.json`, `eslint.config.js` — all mirroring `apps/studio`.
- **`apps/site/src/app/(marketing)/`** — the marketing route group: `/` (compliance-led hero,
  the locked H1/subhead/tagline, evidence-forward sections), edition pages or sections (Compliance
  hero; AI Production Kit; Local-first AGPL flank; Agentic-Dev roadmap), a pricing/SKU surface
  (per fork 7), and a waitlist/CTA (per fork 5). `layout.tsx` reuses the studio's token wiring.
- **`apps/site/src/app/docs/`** (or the docs framework's convention) — the docs surface, one
  deploy with marketing, same `--cs-*` theme. Per-package docs (`@caisson/auth`, `tenancy-rls`,
  `credits`, `billing`, `ui`, `kernel`, … the published package set) plus a getting-started spine.
- **`apps/site/content/`** — in-repo MDX content (per fork 4): marketing long-form + the docs tree.
- **`apps/site/src/components/`** — marketing/docs primitives themed against `--cs-*` (nav,
  footer, hero, evidence cards, code blocks, CTA). Prefer composing `@caisson/ui` primitives;
  do not duplicate the token layer.
- **SEO + agent-readability:** `sitemap`, `robots`, Open Graph image(s), JSON-LD
  (`SoftwareApplication`), and a generated **`llms.txt`** / `llms-full.txt` (specs/03 §3 wants
  AI-native, agent-readable docs — a buyer's agent must be able to read the docs).
- **`infra/terraform/`** — extend `cloudflare_pages_project.site` with the build/deploy config for
  the chosen deploy mode (fork 2): set `pages_build_output_dir` / build command / `compatibility_date`
  / `compatibility_flags` as the mode requires; reconcile the stale README note.
- **CI** — a deploy job (Wrangler Pages direct-upload, gated on a green build) added to the GitHub
  Actions workflow, consistent with the ADR-0016 standards gate (the gate stays the sole registry
  ingress; the site deploy is a separate job, not a registry publish).
- **Waitlist server seam** (per fork 5) — e.g. `apps/site/functions/api/waitlist.ts` (Cloudflare
  Pages Function) or the framework-native route handler, with Zod `.strict()` validation,
  `fetchWithTimeout` on the outbound call, and the provider secret read from the Worker/Pages env
  (never the client bundle).

## Forks to resolve FIRST (AskUserQuestion)

Put **every** fork below to the operator via the `AskUserQuestion` picker **before writing code**.
Each is a real, researched decision — do not pre-decide. For each, the **first** option is the
researched Recommendation. After the operator locks each, the new decisions become append-only
ADRs (next free numbers after **ADR-0044**) + board rows.

**Fork 1 — Docs framework.**

- **Fumadocs (Recommended).** Composable, headless, MIT, built for Next.js App Router + MDX;
  "docs that live inside a Next.js product" with bring-your-own UI so you theme it against the
  `--cs-*` contract (theme-not-fork — exactly the board lock). First-class OpenAPI + TypeDoc,
  Orama search that works in a static export. Fastest-growing React docs framework: **~12k GitHub
  stars (2026, up from ~10.3k in Jan)**; the installed packages — **`fumadocs-ui` ~59k weekly npm
  downloads (~150k/mo), `fumadocs-core`** — are growing ~3× YoY (used by v0, Ultracite). _Evidence:_
  fumadocs.dev/docs/comparisons; npm `fumadocs-ui` registry metadata (59.1k weekly, Dec 2025);
  doolpa.com/article/fumadocs (2026); pkgpulse "Fumadocs vs Nextra v4 vs Starlight 2026". **Note the
  download-stat trap:** pkgpulse's headline "795 weekly" is the near-empty `fumadocs` _meta-package_
  name — nobody installs that; the real adoption signal is `fumadocs-ui`/`fumadocs-core` above (don't
  re-cite the 795 figure). **Tradeoff/caveat to flag in the picker:**
  Fumadocs UI is built on **Tailwind v4** + its own CSS variables, while `apps/studio` uses plain
  CSS + `--cs-*` vars — adopting it introduces Tailwind to this app and requires mapping Fumadocs's
  theme variables onto the `--cs-*` tokens (an override layer, ~half a day).
- **Nextra v4.** Opinionated, battle-tested theme (powers Vercel/SWR/tRPC/Turbo docs), **~207k
  weekly npm downloads — ~3.5× Fumadocs' real package volume**, so a far larger ecosystem of
  examples/themes/SO answers. _Tradeoff:_ the opinionated theme
  fights an external token contract; deep `--cs-*` theming means overriding theme internals, and
  v3→v4 is a from-scratch App-Router rewrite. Better if a standard docs layout is acceptable as-is.
- **Hand-rolled MDX pipeline** (`@next/mdx` + `rehype`/`remark` + a custom sidebar/TOC/search).
  Maximum control, zero framework lock-in, purest `--cs-*` fit. _Tradeoff:_ you reimplement search,
  TOC, sidebar, prev/next, and `llms.txt` generation that Fumadocs ships for free.

**Fork 2 — Cloudflare deploy mode + Next adapter.** (`@cloudflare/next-on-pages` is **off the
table — npm-deprecated and the repo was archived 2025-09-29**; Cloudflare itself now points to
OpenNext. Do not propose it.)

- **Next.js static export (`output: 'export'`) → Cloudflare Pages direct-upload (Recommended).**
  A marketing + docs MDX site is content-first; static export needs **no adapter**, deploys the
  `out/` dir straight to the existing Pages project (`wrangler pages deploy out/`), and is what
  **Fumadocs officially recommends for Cloudflare** ("Static Export (Recommended)"). Requires
  `images: { unoptimized: true }`, `generateStaticParams` on dynamic routes, and Orama **static**
  search indexes. Cleanest fit with the board's "Cloudflare Pages" lock + the existing Terraform.
  _Evidence:_ Fumadocs Cloudflare deployment docs; Cloudflare Pages static-Next guide;
  github.com/cloudflare/next-on-pages deprecation banner. **Constraint to flag:** no server routes
  in the Next app itself → the waitlist needs a Pages Function (fork 5).
- **OpenNext Cloudflare adapter (`@opennextjs/cloudflare`) → Cloudflare Workers.** Full SSR/ISR/
  server-actions/route-handlers; Cloudflare's "preferred way to deploy Next to Cloudflare." _Tradeoff:_
  changes the deploy target from **Pages to Workers** (reframes the board "Pages" row + the
  Terraform), heavier (Worker size limits), Node runtime only, and there are open Fumadocs+Next16
  chunk-loading issues on OpenNext (fuma-nama/fumadocs #2612) — and Turbopack prod builds are
  unsupported. Pick this only if the site genuinely needs server rendering at runtime.
  _Evidence:_ blog.cloudflare.com OpenNext 1.0-beta post; opennext.js.org/cloudflare.

**Fork 3 — App topology.**

- **Single app, route split `/` + `/docs` (Recommended).** Honors the board lock ("marketing +
  docs ONE deploy target / one brand"); Fumadocs is explicitly designed to compose docs into the
  same App-Router app; one build, one token wiring, one Pages project (`caisson-site`).
- **Two apps** (`apps/site` marketing + `apps/docs`) sharing `@caisson/ui`. Only if the chosen
  docs framework demands its own app or build; **the board leans against this** — would need two
  Pages projects / a subdomain (`docs.caisson.sh`) and splits the brand surface. Don't pick unless
  fork 1's choice forces it.

**Fork 4 — Content source.**

- **In-repo MDX (Recommended)** — Fumadocs MDX collections (or `@next/mdx` if fork 1 is
  hand-rolled), `content/` tree, frontmatter-typed, PR-reviewable, version-controlled, agent-readable.
  Matches the repo source-of-truth doctrine and "practice what you preach"; the docs ship `llms.txt`.
- **Headless CMS** (Sanity / Contentful / Hygraph). _Tradeoff:_ an external dependency + a second
  source of truth for a solo operator — overkill pre-launch and breaks in-repo provenance.
- **Hybrid** (MDX for docs, a light CMS for marketing blog later). Defer the CMS; not Wave 2.

**Fork 5 — Waitlist / primary CTA mechanism.** (Pre-launch: commerce is deferred, so the hero CTA
is capture, not checkout.)

- **Cloudflare Pages Function → Resend Audiences (Recommended).** A single
  `functions/api/waitlist.ts` runs alongside the static export, keeps the API secret in the
  Worker/Pages env (out of the client bundle), and **Resend is already the locked email provider
  (ADR-0018)** — no new vendor. Zod `.strict()` body, `fetchWithTimeout` on the Resend call,
  `crypto.timingSafeEqual` if you gate it with a shared token. _Evidence:_ Resend Audiences API;
  Cloudflare Pages Functions run with static-exported sites.
- **Third-party embed** (Buttondown / ConvertKit / a hosted form). Zero backend, but a new vendor
  - an external script on a privacy-forward brand page.
- **OpenNext route handler / server action** (only if fork 2 = OpenNext). Native Next, but pulls
  in the Workers deploy mode.

**Fork 6 — Analytics.**

- **Cloudflare Web Analytics (Recommended).** Free, **cookieless, no consent banner**, already on
  the Cloudflare edge, negligible JS — and _on-brand_: a product selling fail-closed/compliance
  rigor must not ship a cookie-tracking GA. _Evidence:_ cloudflare.com/web-analytics;
  plausible.io/vs-cloudflare-web-analytics. _Tradeoff:_ basic (no goals/funnels, 6-mo retention).
- **Plausible.** Richer (goals, UTM, funnels), 2.5 KB script, EU-hosted, still cookieless/no-banner;
  paid or self-host. Pick if launch wants conversion goals from day one.
- **No analytics at launch.** Ship the beacon later. Cleanest privacy story; flies blind.

**Fork 7 — Hero SKU surface + pricing display.** (Pricing **numbers** are an _open_ board fork the
operator owns — ADR-0012 holds only working anchors; do not hard-print numbers without sign-off.)

- **Compliance-led lineup, SKU structure shown, prices deferred to "early access / join the
  waitlist" (Recommended).** Honors ADR-0040's sequenced launch + buyer firewall: Compliance is the
  hero/front door; the free Local-first AGPL flank is the top-of-funnel CTA; AI Production Kit is
  named as #2; Agentic-Dev is roadmap; the two subscriptions (Compliance Updates, Developer) and
  the "EU AI Act-ready" gated slot are listed as structure. No hard prices yet (pricing fork open) →
  the page converts to the waitlist, not a checkout. _Evidence:_ ADR-0040 launch sequence + open
  pricing row on the board.
- **Show ADR-0012 anchor prices as provisional** (e.g. "Compliance — from $999 one-time;
  Updates from $149/mo"). Stronger conversion signal, but commits numbers the operator hasn't
  locked.
- **Compliance-only page, defer the other editions entirely.** Tightest wedge, but the umbrella
  ("no orphans") goes unstated and the AGPL flank loses its top-of-funnel slot.

## Research mandate

Run these to ground the build; the concrete findings already gathered are folded in so you start
research-informed. Re-verify anything version-sensitive (the stack moves fast) before committing.

- **Docs framework current state** — `web_search_exa("Fumadocs vs Nextra v4 2026 App Router theming
custom design tokens")` + `get_code_context_exa("Fumadocs Next.js App Router setup MDX source
content directory + theme CSS variables override")`. _Grounds fork 1._ **Already found:** Fumadocs
  = composable/headless, MIT, ~12k stars (2026), `fumadocs-ui` ~59k weekly npm dl (~150k/mo, ~3× YoY),
  Orama search, OpenAPI/TypeDoc, static-export supported; the maintainer positions it as "docs inside
  a Next.js product," vs Nextra's opinionated theme (~207k weekly dl — ~3.5× Fumadocs, harder to
  deep-theme; ignore pkgpulse's "795" — that's the empty `fumadocs` meta-package, not the installed
  `fumadocs-ui`). Sources: fumadocs.dev/docs/comparisons; npm fumadocs-ui registry metadata;
  pkgpulse.com/guides/fumadocs-vs-nextra-v4-vs-starlight-documentation-sites-2026;
  docsio.co/blog/fumadocs.
- **Cloudflare deploy adapter** — `get_code_context_exa("@opennextjs/cloudflare Next.js 15 deploy
Cloudflare Workers open-next.config.ts")` + `web_search_exa("Fumadocs Cloudflare Pages static
export output export 2026")`. _Grounds fork 2._ **Already found:** `@cloudflare/next-on-pages` is
  **deprecated on npm and archived 2025-09-29** (github.com/cloudflare/next-on-pages banner;
  Cloudflare's own blog says OpenNext is "the preferred way"). Fumadocs **officially recommends
  static export → Pages** for docs (Fumadocs Cloudflare deployment doc: "Static Export
  (Recommended)", `out/` dir, `images.unoptimized`, Orama `staticGET`); OpenNext → Workers is the
  SSR path. Fumadocs does **not** run on Cloudflare's Edge runtime. Sources:
  blog.cloudflare.com/deploying-nextjs-apps-to-cloudflare-workers-with-the-opennext-adapter;
  opennext.js.org/cloudflare; developers.cloudflare.com/pages/framework-guides/nextjs.
- **Static-export waitlist seam** — `get_code_context_exa("Cloudflare Pages Functions
functions/api endpoint with static Next export + Resend Audiences API contacts create")`. _Grounds
  fork 5._ **Already found:** Pages Functions run alongside a static export, keeping the secret in
  the Worker env; Resend Audiences exposes a contacts-create API and is the locked provider (ADR-0018).
- **Analytics** — `web_search_exa("Cloudflare Web Analytics vs Plausible cookieless no consent
banner developer tool 2026")`. _Grounds fork 6._ **Already found:** Cloudflare Web Analytics =
  free, cookieless, no client state, no consent banner; Plausible = 2.5 KB, EU-hosted, goals/UTM,
  also cookieless. Sources: cloudflare.com/web-analytics; plausible.io/cookieless-web-analytics.
- **Design references (refero)** — re-run `refero_search_screens` for "developer infrastructure
  security compliance landing page hero dark", "developer documentation site sidebar dark", and
  "developer tool pricing one-time and subscription dark", then `refero_get_screen_image` on the
  strongest before laying out each surface; per the `refero-design` → `impeccable` flow (research is
  mandatory before pixels). **Already pulled — fold these into the layout decisions:**
  - _Landing / security-trust pattern:_ **Linear /security**
    (`refero.design/pages/7035f422-d579-42e5-8eec-9b853f53cf9a` — full-black, centered hero, trust
    grids, certifications), **Resend /security**
    (`0e0e2987-eff8-46d0-b44a-e144824dd700` — dark premium, controls grid, FAQ, evidence-forward),
    **Cal.com /security** (`af3be2d5-d412-4196-8744-07f224b0bcbf`), **GitHub /features/security**
    (`eba8a58d-140d-4efc-8c90-9bae80bf7720`), **Appwrite** (`5ceac5f5-9b89-4d1d-9d3f-83c431be37fc`
    — dark dev-tool landing, bento + logo wall + pricing grid). These are the closest analogs to
    "compliance-grade infra, dark, evidence-forward."
  - _Docs surface:_ **OpenAI docs** (`63b5d647-3e1f-4cab-bbf4-d34188c320e1` — left sidebar, quickstart
    card + code block), **Cursor docs** (`a44b14df-243f-4c6b-9ea6-3cefcbb2b0e2` — three-part docs
    layout, sticky sidebar, search, "Ask AI"), **HTTPie docs** (`17ee0e2d-d085-4b0a-bc17-8abf8badf212`),
    **Factory** docs-article (`ff3c7262-8394-48ff-9e3c-ced63941b99d` — TOC sidebar + code snippets),
    **Missive API docs** (`b8f80465-3917-4dd8-a527-9c1864ae7d40`). Standard three-pane docs IA;
    Caisson differentiates by the cold-steel palette + real artifacts, not layout novelty.
  - _Pricing (one-time + subscription mix, Caisson's exact model):_ **JetBrains store**
    (`a3591fb1-d12a-4ebe-a8ed-91d142941d38` — closest: dev-tool one-time + subscription tiers,
    billing toggle), **OpenAI pricing** (`48b87627-bbe6-415d-b314-632c38e40d95` — cards + comparison
    table + FAQ), **Stage.so** (`51c020e8-67e3-4080-9ceb-373673748fa6` — clean dark 3-tier),
    **Stable Audio** (`e4e600af-d1c8-466a-9c42-7fb931d47bc2` — license + subscription tiers).
  - _Waitlist / audience capture:_ **Resend /features/audiences**
    (`43bab362-c822-46be-a307-c5053e526126`) for the capture + confirmation pattern.

## Standards (binding)

Satisfy all of these; an audit at SHIP will check them.

- **gridwork-core security floor** (`identity/security.md`, auto-loaded): `crypto.timingSafeEqual`
  for every token/secret compare (never `===`); `fetchWithTimeout(url, init, ms)` on **every**
  outbound fetch (the native AbortSignal timeout is forbidden on Bun); Zod `z.object().strict()` at
  every input boundary (the waitlist body); user-supplied URLs rejected unless
  `new URL(input).protocol === "https:"`; no secret in the client bundle (server/Worker env only);
  **production security headers** on responses — `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY` (no embedding planned), `Strict-Transport-Security`, and a CSP
  appropriate to the analytics/font choices (set via Cloudflare Pages `_headers` for a static export,
  or Next headers/middleware for OpenNext).
- **Coding discipline** (ADR-0002 + `identity/coding-discipline.md`): TS strict, **Bun** runtime/PM
  (never npm/yarn), no `any`, no `console.log` in product code, `crypto.randomUUID()` for IDs.
- **One standards gate** (ADR-0016/0022): the app builds, lints, and tests **only** through
  `tooling/` (`@caisson/eslint-config`, `@caisson/tsconfig`, `@caisson/testing`) — mirror
  `apps/studio`'s wiring; do not introduce a parallel eslint/tsconfig. The **import-boundary lint
  (ADR-0022)** still binds: `@caisson/*` packages must stay framework-free — the site app may import
  Next, but never make a package import the framework to serve the site.
- **Design contract (ADR-0042):** every color/space/type value comes from `--cs-*`
  (`@caisson/ui/styles/tokens.css`) — **no hard-coded hex, no ad-hoc rgba** (alpha is a smell; use
  the explicit tint tokens). Theme, never fork. If fork 1 = Fumadocs, map its theme variables onto
  `--cs-*` rather than letting Tailwind defaults leak in. **WCAG 2.2 AA** verified with tooling (the
  studio ships `apps/studio/src/lib/contrast.ts` — reuse it): body ≥4.5:1, large/UI ≥3:1, visible
  focus ring on every interactive element, `prefers-reduced-motion` honored on every animation,
  status never color-alone (glyph + label).
- **Voice (`specs/04`):** the banned-word list is binding; use the locked tagline + H1 + subhead
  verbatim; evidence over adjectives (show a real CI badge / RLS test / audit artifact as the hero
  element, not a stock illustration); no exclamation marks in the hero, no emoji.
- **Positioning firewall (ADR-0040):** the generic base appears **once as a footnote**, never as a
  comparison table; do not co-hero a non-compliance edition; do not geo-restrict.
- **Commits:** conventional, atomic, one logical change each. Scopes for this session: `ui`,
  `docs`, plus a `site` scope (add it to the `CLAUDE.md` scope list in the same change that creates
  `apps/site`). Example: `feat(site): scaffold marketing+docs Next app with --cs-* token wiring`.

## Cadence

This is an **ultracode** session — run the spec-first 7-act loop, orchestrated with the **Workflow
tool**, adversarially verifying every non-trivial claim and keeping research-backed throughout:

1. **SPEC** — write `outputs/specs/gtm-marketing-docs/` (or the repo's spec home): the WHAT + WHY,
   declaring tags (`ui`, `frontend`, `infra`; `external-system` if the waitlist touches Resend).
2. **PLAN** — decompose into atomic tasks with per-task verify commands (build, lint, test,
   contrast check, a real `wrangler pages dev`/preview).
3. **ADR-lock the forks** — the moment the operator resolves each picker fork, write an
   append-only ADR per new decision (**next free numbers after ADR-0044** → ADR-0045, ADR-0046, …;
   one ADR per locked fork, or a sensibly grouped pair) in `knowledge/decisions/`, **never edited
   after the fact**, and add the matching row(s) to `docs/state/decisions-and-forks.md`. No product
   code for a fork before its ADR is locked (the repo's spec-first rule).
4. **EXECUTE** — build `apps/site`, the content, the deploy wiring, the Terraform extension, and
   the CI deploy job, atomic commit per task.
5. **VERIFY (goal-backward)** — re-ask the SPEC goal against the diff: does `caisson.sh` (or the
   Pages preview) serve the compliance-led hero in the locked voice + `--cs-*` theme, and a
   navigable per-package docs surface, on a green Cloudflare build? Pass/fail/partial; partial →
   enumerate gaps + queue follow-ups; fail → new PLAN, do not ship.
6. **SWEEP** — walk downstream: the stale Terraform README note, the `CLAUDE.md` scope list, any
   `DESIGN.md`/`specs/03` deferral now closed, `tokens.css` regen if you touched `packages/ui`.
7. **SHIP** — REVIEW always; fire SECURITY + UI-REVIEW audits per the tags; open the PR; the
   operator approves merge after CI green. **SHIP stops at the merged PR — DEPLOY (the actual
   `terraform apply` + first production Pages deploy) is a separate operator-gated act, not part of
   this cycle.**

## Deliverables

- `apps/site/` — the scaffolded Next 15 App Router app (marketing `/` + docs `/docs`), token-wired
  to `@caisson/ui`, themed against `--cs-*`, in the locked voice.
- `apps/site/content/` — the marketing copy + the initial per-package docs tree + a getting-started
  spine; `llms.txt`/`llms-full.txt` generated.
- The waitlist seam (Pages Function or route handler per fork 5) + analytics (per fork 6) + SEO
  (`sitemap`, `robots`, OG image, JSON-LD).
- `infra/terraform/` extended with the deploy/build config for the chosen mode; README reconciled.
- A CI deploy job (Wrangler Pages direct-upload, gated on a green build).
- **New ADRs** (ADR-0045+) for each locked fork + matching board rows in
  `docs/state/decisions-and-forks.md`.
- Inline SPEC / PLAN / VERIFY / SWEEP / REVIEW notes per the 7-act loop.
- Atomic conventional commits (`feat(site): …`, `docs(site): …`, `feat(infra): …`,
  `docs(adr): …`, `docs(state): …`).
- A `site` commit scope added to `CLAUDE.md`.

## Exit gate

"Done" means all of these are green and verifiable:

- `bun install` clean; `bun run --filter @caisson/site build` (or the workspace build) succeeds with
  the chosen deploy mode; `bun run --filter @caisson/site lint` and `test` pass through `tooling/`.
- `bun run check` (repo-wide) is clean; the standards gate stays green; the import-boundary lint
  shows no package importing the framework.
- A **local Cloudflare preview** of the production build serves both surfaces:
  `/` renders the compliance-led hero with the locked H1 "Fail-closed by construction." + the
  tagline + the locked subhead, and `/docs/*` renders a navigable, searchable per-package docs tree
  — both on the `--cs-*` cold-steel theme with a working dark/light toggle (`wrangler pages dev out/`
  for static export, or `opennextjs-cloudflare preview` for OpenNext).
- The contrast check (reusing `apps/studio/src/lib/contrast.ts`) confirms **WCAG AA** on every
  text/UI pair used; visible focus ring present; `prefers-reduced-motion` honored.
- The waitlist endpoint validates a `.strict()` body, calls the provider with `fetchWithTimeout`,
  keeps the secret server-side, and returns a typed result; no secret appears in the client bundle.
- `terraform validate` (and a `terraform plan` against the real account, if creds are present)
  passes with the new build/deploy config; the README no longer references the deprecated
  next-on-pages.
- An ADR exists for every fork the operator locked (numbered ≥ 0045, append-only) with a matching
  board row; no locked decision (name/hero/voice/design/framework/hosting) was relitigated.
- `grep` confirms **zero** hard-coded color hex / banned voice words in `apps/site`.

## Out of scope / firewall

- **Do not build commerce, license issuance, the support-bot, or the buyer dashboard/cockpit** —
  those are deferred to a later wave (board: GTM-now = marketing + docs only). The pricing surface
  is a SKU _display_ + waitlist, not a checkout.
- **Do not build product feature code** for any `@caisson/*` package — this session ships the
  storefront and the manual, not the library. If docs need a code sample, write it as MDX, don't
  implement a package.
- **Do not relitigate** ADR-0040 (positioning/hero), ADR-0041 (name), ADR-0042 (design tokens),
  ADR-0044 (Next.js), or the board's Cloudflare-Pages / single-Next-MDX / sequenced-launch rows.
  New forks (docs framework, deploy mode, content source, waitlist, analytics, SKU display) are the
  only open decisions, and only via the picker → ADR path.
- **Do not fork `@caisson/ui` components or duplicate the token layer.** Theme via `--cs-*` only;
  if you need a new token, add it to `packages/ui/src/tokens/` and regenerate `tokens.css` (don't
  hand-edit the generated file).
- **Pro-private firewall (binding, `CLAUDE.md`):** **nothing from `media-pipeline` (pro-private)
  may seed any code here — patterns/ideas only, never implementation.** Any harvestable license/UI
  kit comes from the PUBLIC sources (tessera's Pigment floor for the pro-tool aesthetic), never the
  pro-private repo.
- **Do not introduce a second build/lint/test toolchain.** Everything routes through `tooling/`.
- **Do not `terraform apply` or push a production deploy** — that is the operator-gated DEPLOY act
  after the PR merges. SHIP ends at the green, merged PR.

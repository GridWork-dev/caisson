# PLAN — `apps/site` build (GTM marketing + docs)

Decomposed from SPEC.md. Atomic tasks; one logical change per commit. Verify commands per task.
Stack locked: Next 16 + React 19.2 + Fumadocs 16 (static export) → Cloudflare Pages; Plausible;
Resend Segments. Mirror `apps/studio` wiring; route everything through `tooling/`.

## T1 — App skeleton + standards-gate wiring · `feat(site): scaffold …`

`apps/site/{package.json,tsconfig.json,eslint.config.js,next.config.ts,next-env.d.ts,postcss.config.mjs,source.config.ts,wrangler.jsonc}`.
`@caisson/site` private/`type:module`/v0.0.0; deps `@caisson/ui` + next 16 + react 19.2 + fumadocs-{ui,core} 16 + fumadocs-mdx 15 + @orama/orama + next-plausible + tailwindcss 4 + @tailwindcss/postcss + zod; devDeps `@caisson/{eslint-config,testing,tsconfig}` + types + eslint + typescript. tsconfig extends `@caisson/tsconfig/base.json` verbatim + `.source` path alias. next.config: `output:'export'`, `images.unoptimized`, `transpilePackages:['@caisson/ui']`, `createMDX()`. Port 3030.
**Verify:** `bun install` clean; `bun run gate` recognizes `@caisson/site` (extends-base + 3 deps + scripts).

## T2 — Token + theme + Tailwind/Fumadocs CSS wiring · `feat(site): --cs-* token wiring + fd-bridge`

`src/app/layout.tsx` (import `@caisson/ui/styles/tokens.css` first, then `global.css`; `data-theme="dark"`, no-flash `cs-theme` script; **only** Hubot Sans + Martian Mono; Plausible `<Script>`; Fumadocs `RootProvider`). `src/app/global.css` (`@import 'tailwindcss'` + fumadocs preset + `--cs-*` marketing layer + reduced-motion). `src/styles/fd-bridge.css` (`--color-fd-*` → `--cs-*`, dark + light). `src/lib/contrast.ts` (+ `culori` dep) lifted from studio for the AA test.
**Verify:** `bun run --filter @caisson/site build` compiles the CSS; no hard-coded hex (`grep`).

## T3 — Docs surface (Fumadocs static) · `feat(site): Fumadocs /docs static export`

`src/lib/{shared.ts,source.ts,layout.shared.tsx}`, `src/components/{provider,search,mdx}.tsx`, `src/app/docs/layout.tsx`, `src/app/docs/[[...slug]]/page.tsx` (+ `generateStaticParams`/`generateMetadata`), `src/app/api/search/route.ts` (`staticGET`, `revalidate=false`), `src/app/llms.txt/route.ts`, `src/app/llms-full.txt/route.ts`, `src/app/llms.mdx/docs/[[...slug]]/route.ts`. `source.config.ts` `includeProcessedMarkdown:true`.
**Verify:** build emits `out/docs/**`, `out/llms.txt`, `out/api/search` static index.

## T4 — Docs content (MDX) · `docs(site): getting-started spine + per-package docs`

`content/docs/index.mdx` + `getting-started.mdx` + per-package stubs (base substrate + 4 editions' packages) + `meta.json` sidebar. Light real copy from specs; marked placeholders for the rest. `llms.txt` mandate (specs/03 §3).
**Verify:** every doc renders; sidebar tree from `meta.json`; search indexes them.

## T5 — Marketing surface · `feat(site): compliance-led marketing surface`

`(marketing)/layout.tsx` (nav + footer), `(marketing)/page.tsx` (hero H1/subhead/tagline verbatim + evidence + editions overview + SKU section + waitlist CTA), `/compliance`, `/ai-kit`, `/local-first`, `/agentic-dev`, `/pricing`. `src/components/` (nav, footer, hero, evidence-card, edition-card, sku-table, waitlist-form, theme-toggle, code-block). Plain CSS keyed off `--cs-*`; locked voice; generic-base footnote once; no prices.
**Verify:** build renders all routes; `grep` zero banned words + zero hex.

## T6 — Waitlist seam + headers · `feat(site): waitlist Pages Function → Resend Segments`

`functions/api/waitlist.ts` (Zod `.strict()` body, `fetchWithTimeout`, Resend Segments, `User-Agent`, secret from `context.env`, in-function security headers), `functions/_middleware.ts` (header policy). `public/_headers` (CSP + security headers for static assets), `public/robots.txt`.
**Verify:** `tsc` types ok; secret never in `out/` bundle (`grep`); body rejects unknown fields.

## T7 — SEO + agent-readability · `feat(site): sitemap + robots + OG + JSON-LD`

`src/app/sitemap.ts`, `src/app/robots.ts` (or `_headers`/`public`), `src/app/opengraph-image.tsx`, `SoftwareApplication` JSON-LD in marketing layout. `scripts/create-index-txt.mjs` post-build normalizer (the CF `index.txt` blank-page trap); wire into `build` script.
**Verify:** `out/sitemap.xml`, `out/robots.txt`, OG image emitted; `index.txt` siblings normalized.

## T8 — Infra reconcile + CI deploy job · `feat(infra): wire site deploy` / `docs(infra): reconcile …`

Fix the two stale `next-on-pages`/OpenNext comments (`infra/terraform/README.md:38-42`, `main.tf:6-8`) to the accurate static-export direct-upload statement. `wrangler.jsonc` (`pages_build_output_dir:"out"`). CI deploy job (`.github/workflows/`): `wrangler pages deploy out/ --project-name=caisson-site`, gated on green build, `workflow_dispatch` + push-to-`main` only (never a PR).
**Verify:** `terraform validate`; README no longer names next-on-pages; CI yaml lints.

## T9 — VERIFY (Act 4) · goal-backward

`bun install` → `bun run --filter @caisson/site build` (static export) → `bun run --filter @caisson/site lint` + `test` → `bun run check` → `wrangler pages dev out/` serves `/` (locked hero) + `/docs/*` (navigable + searchable) on the `--cs-*` theme + dark/light toggle. Contrast AA via `contrast.ts` test. `grep` gates: zero hex, zero banned words, no secret in bundle, no package importing the framework.

## Acts 5–7

SWEEP (downstream: CLAUDE.md "still open" staleness, DESIGN/specs deferral now closed, tokens regen if `packages/ui` touched) → SHIP (REVIEW + SECURITY + UI/voice audits per tags; PR; operator merges after CI green). **No `terraform apply`, no live deploy.**

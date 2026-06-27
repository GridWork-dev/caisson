# ADR-0045 — GTM site stack: Fumadocs + in-repo MDX, single static-export Next app → Cloudflare Pages

Status: accepted · 2026-06-27 (closes the **"Docs framework"**, **"Cloudflare deploy mode"**,
**"App topology"**, and **"Content source"** open forks for the GTM marketing+docs session.)

The public site (`apps/site`) — marketing **and** product docs — is **one Next.js App Router app**,
statically exported (`output: 'export'`) and direct-uploaded to the existing `caisson-site`
Cloudflare Pages project. Docs are **Fumadocs** (headless, MIT) themed onto the `--cs-*` token
contract (ADR-0042); content is **in-repo MDX** under `apps/site/content/docs/**` (Fumadocs MDX
collections). One build, one token wiring, one Pages project, one brand surface.

## Why

The board already locked **single Next site + MDX, one deploy target / one brand** and **Cloudflare
Pages hosting**. Fumadocs is built to compose docs _into_ an existing App-Router app with
bring-your-own UI, so it themes against `--cs-*` instead of fighting an opinionated theme
(theme-not-fork — the same principle as the design contract). Static export is the cleanest fit for a
content-first marketing+docs site: no adapter, deploys the `out/` dir straight to the existing
direct-upload Pages project (`wrangler pages deploy out/`), and is what Fumadocs officially recommends
for Cloudflare. In-repo MDX matches the repo source-of-truth doctrine, is PR-reviewable and
agent-readable, and ships `llms.txt` for free.

## Version line

**Next 16 + Fumadocs 16 (`fumadocs-ui`/`fumadocs-core` 16.x, `fumadocs-mdx` 15.x) + React 19.2** —
Fumadocs 16 peers Next 16 / React 19.2 and ships the built-in static-export `llms.txt` helpers and the
canonical `next-static` example. `apps/site` carries its own Next/React major; `apps/studio` stays on
Next 15.1.6 / React 19.0 (Bun workspaces allow per-package versions). ADR-0044's "currently 15" is
parenthetical — Next 16 is still App Router, so this does not relitigate the framework lock.

## Scope

Applies to the `apps/site` public site only. Static export means **no Next server routes** in the app
— runtime backend (the waitlist) is a Cloudflare Pages Function (ADR-0046). `images: { unoptimized: true }`,
`generateStaticParams` on the docs `[[...slug]]` route, and static Orama search (`staticGET`,
`revalidate = false`) are required by the export mode. Fumadocs UI's Tailwind v4 footprint is confined
to the docs CSS + an `fd-bridge` layer mapping `--color-fd-*` → `--cs-*`; marketing surfaces stay plain
CSS keyed off `--cs-*` (mirroring `apps/studio`). The `@caisson/*` packages stay framework-free
(ADR-0022 import-boundary lint) — the app imports Next; no package does.

## Rejected

- **Nextra v4** — opinionated theme fights an external token contract; deep `--cs-*` theming means
  overriding theme internals. Larger ecosystem, but theme-not-fork loses.
- **Hand-rolled MDX pipeline** — purest `--cs-*` fit but reimplements search, TOC, sidebar, prev/next,
  and `llms.txt` that Fumadocs ships.
- **OpenNext → Cloudflare Workers** — full SSR, but changes the deploy target Pages→Workers (reframes
  the board "Pages" row + the Terraform), heavier, with open Fumadocs+OpenNext chunk-loading issues. A
  content site does not need runtime server rendering.
- **`@cloudflare/next-on-pages`** — off the table: npm-deprecated, repo archived 2025-09-29.
- **Two apps** (`apps/site` + `apps/docs`) — needs two Pages projects / a `docs.` subdomain and splits
  the brand; the board leans against it and Fumadocs does not force it.
- **Headless CMS** — a second source of truth + an external dependency for a solo operator pre-launch.

## Binding

`apps/site` is a single static-export Next 16 App Router app; docs are Fumadocs themed via the
`fd-bridge` layer onto `--cs-*` (never a forked theme, never hard-coded color); content is in-repo MDX;
the build output `out/` direct-uploads to the `caisson-site` Pages project. Moving the site to SSR
(OpenNext/Workers), a different docs framework, or a CMS requires a superseding ADR.

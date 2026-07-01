# ADR-0114 — Unified dynamic Next 16 app on Railway (marketing + docs + buyer dashboard)

Status: accepted · 2026-06-30 (operator lock — closes the **dashboard host/URL fork**; supersedes the
static-export deploy mode of ADR-0084.)

The public surface and the authenticated buyer dashboard ship as **one Next.js 16 App Router app**
(`apps/site`) deployed as a **Node standalone server on Railway** (project `caisson-prod`), not a static
export to Cloudflare Pages. The buyer dashboard is a **`/dashboard` route group** inside that one app —
not a separate `apps/dashboard` tree, not a subdomain app. Marketing + docs routes stay **statically
generated** (SSG / default static rendering + `generateStaticParams` for the Fumadocs `[[...slug]]`
route); the `/dashboard` route group is **`force-dynamic`** and authed.

## Why

The buyer dashboard is dynamic + authenticated: it reads tenant data through the fail-closed RLS
`withTenant` entry (`packages/tenancy-rls/src/rls.ts:41`), which **opens a transaction** per request
(`db.transaction` → `set_config('app.current_account', …, true)` → `SET LOCAL ROLE app`). A static
export has no server and cannot host it; `/dashboard` as a route on a static-export app is physically
impossible (`output: 'export'` = no SSR, no route handlers).

The operator chose to **unify on one app + one host** rather than run a second app on a subdomain. A
Node server (not the Cloudflare Workers/OpenNext path ADR-0084 weighed) is required by the DB layer:
the transaction-scoped `withTenant` read is **documented-broken on workerd** (Neon HTTP driver has no
transactions; `pg`/`postgres.js` do not bundle under the `workerd` export condition; the Neon WS pool
throws load-500s — `opennextjs-cloudflare#1153`), and `@cloudflare/next-on-pages` is npm-deprecated /
archived (ADR-0084 already noted this). On a full Node runtime every Postgres driver works over TCP,
transactions included. `node:crypto` Ed25519 (the EdDSA-JWT cookie verify, ADR-0015) works on either
runtime, so auth does not break the tie — the database does. This mirrors the proven Wardfile topology
(authed App-Router app, `withTenant`-scoped RSC reads, Railway multi-stage Dockerfile) and the existing
`services/docs` + `services/support-bot` Railway services.

**Static generation is retained.** Moving off `output: 'export'` drops _full-static-no-server_ mode, not
static _rendering_: marketing + docs pages are still statically generated and cached by the Node server,
so the ADR-0079 CWV/SEO posture is preserved at the page level. The one real loss vs Cloudflare Pages is
the global CDN edge (Railway is single-region) — recovered by putting **Cloudflare in front of the
Railway origin** as a CDN/cache proxy (DNS stays on Cloudflare; `caisson.sh` proxied → Railway).

## Scope

- `apps/site` flips `next.config.ts` `output: 'export'` → `output: 'standalone'`; `images.unoptimized`
  may relax to Next's optimizer (Node server) or stay as-is. Fumadocs MDX, the `--cs-*` token contract,
  the `fd-bridge` layer, and the `@caisson/*` framework-free boundary (ADR-0022) are **unchanged**.
- New: a multi-stage **Dockerfile** (bun install → `next build` on Node → `next start` standalone) +
  **`railway.toml`** mirroring `services/docs`; `/health`-equivalent readiness.
- New: `/dashboard` route group — authed (EdDSA-JWT cookie, `node:crypto`), `force-dynamic`, RSC reads
  through a `readScoped` → `withTenant` seam, never statically cached (no cross-tenant cache leak).
- The ADR-0085 waitlist Cloudflare Pages **Function** → a Next **route handler** (`app/api/*`) — the app
  now has a server (the waitlist was already retired as the conversion model by ADR-0082; this is the
  mechanical re-home).
- Static search (Orama `staticGET`) may stay static or become a route handler; either works on a server.

## Relations

- **Supersedes ADR-0084** — the deploy mode (single **static-export** Next app → Cloudflare Pages
  direct-upload). The _docs framework_ (Fumadocs + in-repo MDX), _single-app / one-brand topology_, and
  _Next 16 + Fumadocs 16_ version line of ADR-0084 are **kept**; only "static export → CF Pages
  direct-upload" is replaced by "Node standalone → Railway, Cloudflare CDN in front".
- **Amends ADR-0079** — CWV/SEO is now delivered by SSG-on-Node + a Cloudflare CDN proxy rather than
  CF-Pages static hosting; self-hosted fonts, the `buildMetadata()` helper, the @graph JSON-LD, and the
  a11y/CWV CI baseline are unchanged. Records the single-region-origin tradeoff (mitigated by the CDN).
- **Re-homes ADR-0107** — the pre-launch gate moves from **CF Access on the Pages project** to (a) the
  app's own auth gating `/dashboard`, and (b) optionally **Cloudflare Access in front of the Railway
  origin** for the marketing surface until launch. The "flip = the deliberate launch act, DEPLOY-class,
  operator-gated" principle of ADR-0107 is unchanged; only the mechanism moves.
- Consistent with ADR-0044 (Next.js App Router) and ADR-0015 (auth → RLS seam).

## Rejected

- **`app.caisson.sh` = separate dynamic app on Railway** (the analysis recommendation) — clean
  marketing/app split, but the operator chose one app / one host to avoid operating two Next deploys.
- **Cloudflare Workers via `@opennextjs/cloudflare`** — the transaction-scoped `withTenant` DB path is
  documented-broken on workerd, and Next-16-on-OpenNext is actively bug-bisected (June 2026). Not viable.
- **Keep static-export marketing + bolt the dashboard on** — impossible; `output: 'export'` admits no
  server route.

## Build-now vs DEPLOY-class

**Buildable now (autonomous, in-repo):** the `next.config` flip, the Dockerfile + `railway.toml`, the
`/dashboard` route group + views + the EdDSA-JWT cookie seam + the `readScoped`/`withTenant` reads + a
PGlite dev double + the Railway-PG prod swap behind `DATABASE_URL`. CI build/typecheck via the standards
gate. The current CF-Pages `deploy-site.yml` + Terraform `access.tf` are **left in place** (the site is
CF-Access-gated, zero public traffic) until the operator does the cutover.

**DEPLOY-class (operator-gated):** create the Railway service in `caisson-prod`; provision the DB
(ADR-0115); set secrets; DNS cutover `caisson.sh` → Railway (Cloudflare proxied, CDN in front); decide
the marketing pre-launch gate (Cloudflare Access in front vs open); retire the CF-Pages project +
`access.tf` + `deploy-site.yml`. Runbook: `docs/state/p6-deploy-runbook.md`.

## Binding

`apps/site` is a single dynamic Next 16 App Router app, Node `standalone` output, deployed to Railway;
marketing + docs render statically (SSG), `/dashboard` is dynamic + authed + tenant-scoped; Cloudflare
fronts the origin as DNS + CDN. Returning the marketing surface to a static export, or splitting the
dashboard into a separate app/host, requires a superseding ADR.

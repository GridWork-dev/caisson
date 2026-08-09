import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

// The monorepo root (two levels up from apps/site) — pinned explicitly because Turbopack's
// auto-detected workspace root walks up to the FIRST ancestor directory carrying a lockfile,
// which silently picks the wrong root when this checkout itself lives nested inside another
// lockfile-bearing ancestor (e.g. a gtr/git worktree under a parent checkout's tree) — observed
// as "Module not found" for workspace packages whose symlinks live only under apps/site/
// node_modules, never hoisted to the misdetected root's node_modules (vercel/next.js#92978).
const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));

const config: NextConfig = {
  // Keep static generation below the build host's memory ceiling. Next otherwise derives this
  // from host CPUs and can fan out dozens of workers for this documentation-heavy app.
  experimental: { cpus: 2 },
  // Node standalone server on Railway (ADR-0114, supersedes the static-export deploy mode of
  // ADR-0084). Marketing + docs routes still render statically (SSG / generateStaticParams) —
  // this only swaps the OUTPUT MODE so `/dashboard` can exist as a dynamic, authed route group.
  output: "standalone",
  // Cloudflare brotli-compresses at the edge already (HTML already serves `br`); the origin's
  // own gzip pre-compression was pinning ~1.7MB of cacheable JS+CSS to gzip on every cold load
  // because CF caches whatever content-encoding the origin sent. Turning this off lets CF's
  // edge brotli take over static assets — ~15-18% smaller transfer, no code change needed.
  compress: false,
  // Pin the file-tracing root to the monorepo root (mirrors turbopack.root above) so standalone
  // output tracing walks from the real workspace boundary, not a misdetected ancestor.
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingExcludes: {
    // Source maps and type declarations are never `require()`d at runtime — safe to drop from
    // every route's traced/copied output.
    "*": [
      "**/*.js.map",
      "**/*.d.ts",
      "**/*.d.ts.map",
      // @caisson/service-license's dist/server.js (the standalone HTTP-server bootstrap,
      // `startServer`) and dist/app.js (`createApp`, its router wiring) are never CALLED by
      // apps/site at runtime — grep-verified: this app only pulls SQL schema constants (via
      // @caisson/platform-migrations) and `recordCheckoutAbandonment`, and Turbopack fully
      // bundles those into the route's compiled chunk (confirmed: the two symbols appear
      // inlined in .next/server/chunks/*, and the compiled route.js never `require()`s
      // @caisson/service-license from node_modules at runtime) — so excluding server.js/app.js
      // from the standalone COPY is safe. server.js's
      // `resolve(import.meta.dir, "../../../registry/index.json")` is a dynamic path Turbopack
      // can't statically bound, which trips the "whole project traced unintentionally" NFT
      // warning below on ./apps/site/app/api/ask/route.ts's import chain. Measured effect of
      // this exclude on `.next/standalone` size: negligible (177557293 vs 177557865 bytes,
      // clean before/after builds — the 124MB standalone is dominated by this app's own
      // compiled server chunks, not a monorepo-wide copy) — kept anyway as a correctness
      // guard (these two files must never ship) since the warning itself can only be silenced
      // at its source (a turbopackIgnore comment in services/license/src/server.ts, outside
      // this file's scope).
      "**/services/license/dist/server.js",
      "**/services/license/dist/server.js.map",
      "**/services/license/dist/app.js",
      "**/services/license/dist/app.js.map",
    ],
  },
  reactStrictMode: true,
  // next/image's optimizer needs a server, which standalone now has — keep unoptimized for now
  // (no incremental behavior change from the static-export era; revisit at DEPLOY).
  images: { unoptimized: true },
  // @caisson/ui ships raw TS (exports point at src/*.ts); Next transpiles it (ADR-0042 token floor).
  // @caisson/ui-pro is the same raw-.tsx-plus-co-located-.css delivery — the /ui showcase renders it.
  // @caisson/demo-registry (CAISSON-35, the /ui showcase's data source) is the same raw-source
  // delivery, and its module-scope CATALOG_ENTRIES unconditionally combines all three entry files
  // — including the six per-package `./ui` surfaces — so every package below needs to resolve
  // through this list too, exactly like apps/admin/next.config.ts (the registry's other consumer).
  transpilePackages: [
    "@caisson/ui",
    "@caisson/brand",
    "@caisson/ui-pro",
    "@caisson/demo-registry",
    "@caisson/audit-worm",
    "@caisson/license-issue",
    "@caisson/local-store",
    "@caisson/prompt-registry",
    "@caisson/ai-meter",
    "@caisson/audit-harness",
  ],
  turbopack: {
    root: monorepoRoot,
    // CAISSON-82 (ADR-0315): silences the "Encountered unexpected file in NFT list" build warning
    // on the `apps/site/app/api/ask/route.ts → lib/db.ts → @caisson/platform-migrations →
    // services/license/dist/{index,server}.js` chain (documented in `outputFileTracingExcludes`
    // above — that config already keeps the two service-license bootstrap files OUT of the
    // standalone COPY; it does NOT silence the build-time WARNING itself, which fires from
    // Turbopack's trace analysis before excludes are applied). The warning's root cause is
    // `services/license/src/server.ts`'s `resolve(import.meta.dir,
    // "../../../registry/index.json")` — a dynamic path Turbopack can't statically bound — but
    // fixing it at the source (a `turbopackIgnore` comment on that call) is out of this app's
    // surface (`services/license`). `turbopack.ignoreIssue` (Next 16.2+) is the supported
    // apps/site-side alternative: it matches on the issue's `path` + `title` and drops it from
    // CLI output entirely, without touching the excluded file's actual runtime reachability (the
    // route still serves — this only suppresses the diagnostic). Scoped tight to next.config.ts
    // (the path Turbopack attributes this specific trace-analysis issue to) + the exact title, so
    // it can never mask an unrelated "Module not found" or other real warning on this file.
    // Measured effect on `.next/standalone` size: negligible (179089647 without vs 179091433 with
    // — a ~1.8KB delta, well inside normal build-to-build content-hash/metadata noise), matching
    // the fact that this is a pure CLI-diagnostics filter, not a tracing/copy behavior change.
    ignoreIssue: [
      {
        path: "**/next.config.ts",
        title: "Encountered unexpected file in NFT list",
      },
    ],
  },
  // ADR-0311 measured `experimental.optimizePackageImports: ["@caisson/ui",
  // "@caisson/demo-registry"]` here: a clean before/after build produced a byte-identical
  // `.next/static` output (20168326 bytes both times — Turbopack's per-route First Load JS
  // table isn't emitted in this Next 16 build format, so the whole-app static bundle is the
  // measured proxy). Both packages already ship flat raw-source entry points through
  // transpilePackages, so there was no deep-barrel import for the optimizer to split; dropped
  // rather than carrying a no-op experimental flag.
  // ADR-0237 F1 + ADR-0285: the commerce routes fold into the ONE /marketplace surface. The
  // original /pricing · /modules · /build 301 there; the ADR-0285 rework additionally folds the
  // former Modules + Build TABS (/marketplace/modules · /marketplace/build) into the same surface
  // and re-points the old /modules · /build chains straight at /marketplace (no double hop). The
  // module DEPTH pages (/marketplace/modules/<slug>) and Plans (/marketplace/plans) stay live and
  // are unaffected — these sources match the exact tab paths only. The registry (lib/routes.ts),
  // sitemap, nav, and footer emit only the surviving routes in the same change. Fragments survive
  // redirects client-side; internal links are swept to the new paths directly.
  async redirects() {
    return [
      { source: "/pricing", destination: "/marketplace", permanent: true },
      { source: "/modules", destination: "/marketplace", permanent: true },
      { source: "/build", destination: "/marketplace", permanent: true },
      {
        source: "/marketplace/modules",
        destination: "/marketplace",
        permanent: true,
      },
      {
        source: "/marketplace/build",
        destination: "/marketplace",
        permanent: true,
      },
      // 2026-07-06 operator lock: /changelog absorbed into the dedicated /updates surface —
      // one route, changelog integrated. Permanent 301s preserve SEO equity/RSS subscribers.
      { source: "/changelog", destination: "/updates", permanent: true },
      {
        source: "/changelog/rss.xml",
        destination: "/updates/rss.xml",
        permanent: true,
      },
      // 2026-07-09 six-bundle docs rework (Kickoff G W4): the docs dir `ai-kit/` renamed to
      // `ai-production/` (the bundle's real id), the stale pre-carve `@caisson/compliance` page
      // folded into the bundle overview + compliance-core, and the commercial credits page moved
      // from the open-base section to its selling bundle. Permanent 301s keep inbound links alive.
      {
        source: "/docs/ai-kit",
        destination: "/docs/ai-production",
        permanent: true,
      },
      {
        source: "/docs/ai-kit/:path*",
        destination: "/docs/ai-production/:path*",
        permanent: true,
      },
      {
        source: "/docs/base/credits",
        destination: "/docs/ai-production/credits",
        permanent: true,
      },
      {
        source: "/docs/compliance/compliance",
        destination: "/docs/compliance",
        permanent: true,
      },
    ];
  },
  // Security headers — the CSP/HSTS/X-Frame floor the (now-deleted) Cloudflare Pages public/_headers
  // served, now emitted by the Node standalone server (which never read _headers). Divergence from
  // that file: the Paddle Billing overlay checkout is a live surface here, so *.paddle.com is allowed
  // where Paddle actually loads — script from cdn.paddle.com, the overlay iframe (frame-src) +
  // checkout XHR (connect-src) from buy/checkout-service.paddle.com, and paddle.css (style-src); the
  // wildcard covers both sandbox (sandbox-*) and production subdomains. Without these the store
  // silently no-ops (paddle.js CSP-blocked → getPaddle() undefined). script-src stays pinned to
  // cdn.paddle.com (the one script origin). CSP keeps 'unsafe-inline' on script/style-src because
  // Next still inlines its hydration bootstrap without a per-request nonce under App Router; a nonce
  // path is a tracked follow-up. frame-ancestors 'none' is unchanged (it protects THIS site from
  // being embedded — unrelated to the Paddle iframe we load).
  //
  // challenges.cloudflare.com is the Cloudflare Turnstile surface (ADR-0234 F5): its api.js (script-src),
  // the managed-challenge iframe (frame-src), and the widget's verify XHR (connect-src). Gates /api/ask
  // (and the waitlist form) from day one; the server-side siteverify runs on the Node server, not the
  // browser, so no extra connect origin is needed for it. Landed in the same commit as the widget per
  // the identity/security-surfaces.md same-commit invariant for a new third-party surface.
  //
  // us.i.posthog.com / us-assets.i.posthog.com is the PostHog US-Cloud surface (dashboard-only:
  // posthog-init.tsx is mounted from the dashboard layout, never marketing — but the CSP is global,
  // so the origins are allowed here). us.i.posthog.com takes every capture/identify/flags XHR
  // (connect-src); us-assets.i.posthog.com serves lazily-loaded extension scripts, e.g. the session
  // recorder (script-src + connect-src). Landed in the same commit that bakes NEXT_PUBLIC_POSTHOG_KEY
  // into the client bundle — without these the armed key's every request is CSP-blocked and the
  // dashboard just logs console errors (same-commit third-party-surface invariant again).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // ADR-0079 §5: allow-all posture, LOCKED — do not change the values.
          {
            key: "Content-Signal",
            value: "search=yes, ai-input=yes, ai-train=yes",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https://*.paddle.com; font-src 'self'; style-src 'self' 'unsafe-inline' https://*.paddle.com; script-src 'self' 'unsafe-inline' https://plausible.io https://cdn.paddle.com https://challenges.cloudflare.com https://us-assets.i.posthog.com; frame-src https://*.paddle.com https://challenges.cloudflare.com; connect-src 'self' https://plausible.io https://*.paddle.com https://challenges.cloudflare.com https://us.i.posthog.com https://us-assets.i.posthog.com",
          },
        ],
      },
      // No custom /_next/static/:path* Cache-Control entry here — Next 16 sets
      // `public, max-age=31536000, immutable` on those content-hashed assets natively (verified
      // live); a custom entry only duplicated it and tripped the build's "custom Cache-Control
      // headers detected" warning.
    ];
  },
};

const withMDX = createMDX();

export default withMDX(config);

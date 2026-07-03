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
  // Node standalone server on Railway (ADR-0114, supersedes the static-export deploy mode of
  // ADR-0084). Marketing + docs routes still render statically (SSG / generateStaticParams) —
  // this only swaps the OUTPUT MODE so `/dashboard` can exist as a dynamic, authed route group.
  output: "standalone",
  reactStrictMode: true,
  // next/image's optimizer needs a server, which standalone now has — keep unoptimized for now
  // (no incremental behavior change from the static-export era; revisit at DEPLOY).
  images: { unoptimized: true },
  // @caisson/ui ships raw TS (exports point at src/*.ts); Next transpiles it (ADR-0042 token floor).
  transpilePackages: ["@caisson/ui"],
  turbopack: { root: monorepoRoot },
  // ADR-0237 F1: the three old commerce routes fold into the /marketplace hub. Permanent 301s
  // preserve SEO equity; the registry (lib/routes.ts), sitemap, nav, and footer emit only the
  // canonical hub routes in the same change, so these are the ONLY surviving references to the
  // old paths. Fragments survive redirects client-side (#editions still lands), but internal
  // links are swept to the new paths directly.
  async redirects() {
    return [
      { source: "/pricing", destination: "/marketplace", permanent: true },
      {
        source: "/modules",
        destination: "/marketplace/modules",
        permanent: true,
      },
      {
        source: "/build",
        destination: "/marketplace/build",
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
              "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https://*.paddle.com; font-src 'self'; style-src 'self' 'unsafe-inline' https://*.paddle.com; script-src 'self' 'unsafe-inline' https://plausible.io https://cdn.paddle.com https://challenges.cloudflare.com; frame-src https://*.paddle.com https://challenges.cloudflare.com; connect-src 'self' https://plausible.io https://*.paddle.com https://challenges.cloudflare.com",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(config);

import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// The monorepo root (two levels up from apps/demos) — pinned explicitly because Turbopack's
// auto-detected workspace root walks up to the FIRST ancestor carrying a lockfile, which
// silently picks the wrong root when this checkout lives nested inside another lockfile-bearing
// ancestor (a gtr/git worktree under a parent checkout) — same fix apps/site and apps/admin
// carry (vercel/next.js#92978).
const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));

const config: NextConfig = {
  // Node standalone server on Railway (ADR-0400), same output mode as apps/site and apps/admin.
  output: "standalone",
  // Multi-zone child (ADR-0400 decision 2). `basePath` prefixes BOTH the routes and the
  // `_next/*` asset URLs with /demos, so apps/site needs exactly ONE rewrite source
  // (`/demos/:path*`) to proxy pages and chunks alike — the alternative shape (assetPrefix plus a
  // physical app/demos/ folder) needs a second `/demos-static/*` rewrite for the same result.
  // The consequence to know: EVERY route here is served under /demos, including /healthz, which
  // is why railway.toml probes `/demos/healthz`.
  basePath: "/demos",
  reactStrictMode: true,
  images: { unoptimized: true },
  // @caisson/ui ships raw TS (its "./components" export points straight at src/) so Next has to
  // transpile it — same entry apps/site and apps/admin carry. Every other package a poke drives
  // resolves through its built `dist` entry, so nothing else belongs on this list.
  transpilePackages: ["@caisson/ui"],
  // Pin the file-tracing root to the monorepo root (mirrors turbopack.root below) so standalone
  // output tracing walks from the real workspace boundary, not a misdetected ancestor.
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingExcludes: {
    "*": ["**/*.js.map", "**/*.d.ts", "**/*.d.ts.map"],
  },
  turbopack: { root: monorepoRoot },
  // Security-floor response headers (identity/security.md). Two deliberate differences from
  // apps/site's floor, both forced by this app's ONE job — being embedded by the site:
  //
  // 1. `frame-ancestors 'self'` instead of 'none'. A same-origin iframe is still an iframe:
  //    'none' blocks the parent page too. 'self' is evaluated against the DOCUMENT's origin, so
  //    proxied through apps/site the ancestor must be caisson.sh, and hit directly on the
  //    Railway URL the ancestor must be that Railway host — nobody else can frame either one.
  //
  // 2. No `X-Frame-Options` at all. apps/site sets it on the proxied response, and two
  //    X-Frame-Options headers with different values is a case browsers resolve inconsistently
  //    (some treat the pair as invalid and enforce neither). CSP `frame-ancestors` supersedes
  //    X-Frame-Options wherever both are present, so stating the rule once, in the header that
  //    wins, is both simpler and stricter than stating it twice.
  //
  // `connect-src 'self'` is not boilerplate here: every poke prints "Runs entirely in your
  // browser. Nothing leaves this page." — this is that sentence enforced by the browser rather
  // than asserted by the copy. 'unsafe-inline' on script-src covers Next's hydration bootstrap
  // (no per-request nonce under App Router) and the no-flash theme script in layout.tsx.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
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
              "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'",
          },
        ],
      },
    ];
  },
};

export default config;

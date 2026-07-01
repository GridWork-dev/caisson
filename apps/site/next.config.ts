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
  // Security headers — ported verbatim from the (now-deleted) Cloudflare Pages public/_headers so
  // the Node standalone server serves the same CSP/HSTS/X-Frame floor the static Pages deploy did
  // (the Node server never read _headers). Values are byte-identical so the /security page stays
  // honest. CSP keeps 'unsafe-inline' on script/style-src because Next still inlines its hydration
  // bootstrap without a per-request nonce under App Router; a nonce path is a tracked follow-up.
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
              "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://plausible.io; connect-src 'self' https://plausible.io",
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
